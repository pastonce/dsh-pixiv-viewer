/**
 * dsh-pixiv-viewer — host pixiv client.
 *
 * Talks exclusively to the pixiv web ajax endpoints (www.pixiv.net/ajax/…)
 * with the user's own PHPSESSID session cookie — the same requests the
 * official website makes, so R-18 and bookmark sync work natively and no
 * OAuth token dance is needed. (The App API OAuth path was dropped because
 * pixiv's /start endpoint rejects replayed login flows.)
 *
 * Account-safety measures built in here:
 *  - every ajax call is serialised through a rate limiter (>= 1.5s apart);
 *  - images are fetched through a separate, gentler limiter (small concurrency);
 *  - the session cookie is stored locally only, never logged;
 *  - bookmark writes reuse the website's own CSRF token (parsed from a page
 *    embedded in every pixiv HTML response), refreshed only when needed.
 */

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fetch as undiciFetch, ProxyAgent } from 'undici'

const WEB = 'https://www.pixiv.net'
const WEB_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

export const DATA_DIR = join(homedir(), '.pixiv-viewer')

const API_INTERVAL_MS = 1500
const IMG_INTERVAL_MS = 250
const IMG_CONCURRENCY = 3
const USER_CACHE_MS = 10 * 60 * 1000

export class ApiError extends Error {
  constructor(code, message, status = 0) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** Serialises tasks so at least `interval` ms passes between starts. */
export class RateLimiter {
  constructor(interval) {
    this.interval = interval
    this.last = 0
  }

  schedule(fn) {
    const now = Date.now()
    const wait = Math.max(0, this.last + this.interval - now)
    this.last = Math.max(now, this.last + this.interval)
    return sleep(wait).then(fn)
  }
}

/** Concurrent task gate. */
export class ConcurrencyLimiter {
  constructor(max) {
    this.max = max
    this.active = 0
    this.queue = []
  }

  schedule(fn) {
    return new Promise((resolve, reject) => {
      const run = () => {
        this.active += 1
        Promise.resolve()
          .then(fn)
          .then(resolve, reject)
          .finally(() => {
            this.active -= 1
            const next = this.queue.shift()
            if (next) next()
          })
      }
      if (this.active < this.max) run()
      else this.queue.push(run)
    })
  }
}

const DEFAULT_CONFIG = Object.freeze({ proxy: null, phpsessid: null })

/** Local persistence under ~/.pixiv-viewer (config.json). */
export class PixivStore {
  constructor(dir = DATA_DIR) {
    this.dir = dir
    this.configPath = join(dir, 'config.json')
    this.config = { ...DEFAULT_CONFIG }
  }

  async load() {
    this.config = { ...DEFAULT_CONFIG, ...(await readJson(this.configPath, DEFAULT_CONFIG)) }
  }

  async saveConfig(patch) {
    this.config = { ...this.config, ...patch }
    await writeJson(this.configPath, this.config)
  }

  async clearAuth() {
    this.config = { ...this.config, phpsessid: null }
    await writeJson(this.configPath, this.config)
  }
}

export class PixivClient {
  constructor({ store, log }) {
    this.store = store
    this.log = log ?? console
    this.apiLimiter = new RateLimiter(API_INTERVAL_MS)
    this.imgLimiter = new RateLimiter(IMG_INTERVAL_MS)
    this.imgGate = new ConcurrencyLimiter(IMG_CONCURRENCY)
    this.csrf = null
    this.csrfPending = null
    this.user = null
  }

  // ------------------------------------------------------------------ proxy

  resolveProxy() {
    if (this.store.config.proxy) return this.store.config.proxy
    return process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy || null
  }

  createDispatcher() {
    const proxy = this.resolveProxy()
    if (!proxy) return null
    let url
    try {
      url = new URL(proxy)
    } catch {
      throw new ApiError('bad_config', `无效的代理地址: ${proxy}`)
    }
    return new ProxyAgent({ uri: url.href })
  }

  /** fetch with proxy support; never touches the global dispatcher. */
  async fetch(input, init = {}) {
    const dispatcher = this.createDispatcher()
    const requestInit = dispatcher ? { ...init, dispatcher } : init
    // undici's own fetch, so the ProxyAgent and the client always come from
    // the same undici version (Node's built-in fetch bundles a different one
    // and rejects a foreign dispatcher with UND_ERR_INVALID_ARG).
    return undiciFetch(input, requestInit)
  }

  clearSessionCache() {
    this.csrf = null
    this.user = null
  }

  requireCookie() {
    const phpsessid = this.store.config.phpsessid
    if (!phpsessid) {
      throw new ApiError('cookie_required', '请先登录：粘贴浏览器中已登录 pixiv 的 PHPSESSID（F12 → Application → Cookies → www.pixiv.net）')
    }
    return phpsessid
  }

  /** Low-level request to www.pixiv.net with an explicit session cookie. */
  async webFetch(url, { cookie, method = 'GET', form, json, headers = {}, signal } = {}) {
    let response
    try {
      response = await this.fetch(url, {
        method,
        headers: {
          Cookie: `PHPSESSID=${cookie}`,
          'User-Agent': WEB_UA,
          Referer: `${WEB}/`,
          Accept: 'application/json',
          ...headers,
          ...(form ? { 'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8' } : {}),
          ...(json ? { 'Content-Type': 'application/json; charset=utf-8' } : {}),
        },
        ...(form ? { body: new URLSearchParams(form).toString() } : {}),
        ...(json ? { body: JSON.stringify(json) } : {}),
        signal: signal ?? AbortSignal.timeout(30_000),
      })
    } catch (error) {
      throw new ApiError('network_error', `无法连接 pixiv（${error.cause?.code ?? error.message}）。如在国内网络，请在插件设置中配置代理。`)
    }
    return response
  }

  /** One /ajax call with the stored session, serialised by the rate limiter. */
  async webAjax(path, options = {}) {
    const { params, ...rest } = options
    const url = new URL(`${WEB}/ajax${path}`)
    for (const [key, value] of Object.entries(params ?? {})) {
      if (value !== undefined && value !== null) url.searchParams.set(key, String(value))
    }
    const run = async () => {
      const response = await this.webFetch(url, { ...rest, cookie: this.requireCookie() })
      if (response.status === 429) throw new ApiError('rate_limited', '请求过于频繁，请稍等片刻再试', 429)
      const payload = await safeJson(response)
      if (!response.ok || payload.error) {
        const message = payload.message || `pixiv 返回错误（${response.status}）`
        if (response.status === 401 || response.status === 403 || /ログイン|login|認証/i.test(message)) {
          throw new ApiError('cookie_expired', 'PHPSESSID 已失效，请重新登录', response.status)
        }
        throw new ApiError('pixiv_error', message, response.status)
      }
      return payload
    }
    return this.apiLimiter.schedule(run)
  }

  // ------------------------------------------------------------------ session

  /** Resolves the logged-in user; cached for 10 minutes. */
  async probeUser(phpsessid = null) {
    if (!phpsessid && this.user && Date.now() - this.user.at < USER_CACHE_MS) return this.user
    const run = async () => {
      const cookie = phpsessid ?? this.requireCookie()
      // the smallest endpoint that still echoes the x-userid header
      const first = await this.webFetch(`${WEB}/ajax/user/extra?is_smartphone=0&lang=zh`, { cookie })
      const userId = first.headers.get('x-userid')
      if (!userId) {
        throw new ApiError('cookie_expired', 'PHPSESSID 无效或已过期：请在浏览器中登录 pixiv.net 后复制最新的 PHPSESSID')
      }
      const payload = await safeJson(await this.webFetch(`${WEB}/ajax/user/${userId}?full=0&lang=zh`, { cookie }))
      const user = { userId, name: payload.body?.name ?? '', at: Date.now() }
      if (!phpsessid) this.user = user
      return user
    }
    return this.apiLimiter.schedule(run)
  }

  /**
   * The website's CSRF token lives in every HTML page (__NEXT_DATA__ →
   * serverSerializedPreloadedState.api.token); fetch + cache it.
   */
  getCsrf() {
    if (this.csrf) return Promise.resolve(this.csrf)
    if (this.csrfPending) return this.csrfPending
    this.csrfPending = this.apiLimiter.schedule(async () => {
      try {
        const response = await this.webFetch(`${WEB}/`, { cookie: this.requireCookie() })
        const userId = response.headers.get('x-userid')
        const html = await response.text()
        let token = null
        const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
        if (match) {
          try {
            const data = JSON.parse(match[1])
            const state = JSON.parse(data?.props?.pageProps?.serverSerializedPreloadedState ?? 'null')
            token = state?.api?.token ?? null
          } catch {
            // page structure changed; handled below
          }
        }
        if (!token) {
          if (!userId) throw new ApiError('cookie_expired', 'PHPSESSID 已失效，请重新登录')
          throw new ApiError('pixiv_error', '无法获取 pixiv 页面的安全令牌（页面结构可能已变化）')
        }
        this.csrf = { token, userId }
        return this.csrf
      } finally {
        this.csrfPending = null
      }
    })
    return this.csrfPending
  }

  /** POST with the website's CSRF headers; retries once if the token rotated. */
  async csrfPost(path, { form, json } = {}) {
    const send = async () => {
      const csrf = await this.getCsrf()
      return this.webAjax(path, {
        method: 'POST',
        form,
        json,
        headers: {
          'x-csrf-token': csrf.token,
          ...(csrf.userId ? { 'x-user-id': csrf.userId } : {}),
        },
      })
    }
    try {
      return await send()
    } catch (error) {
      const stale = error instanceof ApiError && error.code === 'pixiv_error'
        && error.status === 400 && /リクエスト|request/i.test(error.message)
      if (!stale) throw error
      this.csrf = null
      return send()
    }
  }

  // ------------------------------------------------------------------ search

  mapWebIllust(item) {
    return {
      id: item.id,
      title: item.title,
      userName: item.userName ?? '',
      userId: item.userId ?? 0,
      pageCount: item.pageCount ?? 1,
      width: item.width ?? 0,
      height: item.height ?? 0,
      xRestrict: item.xRestrict ?? 0,
      aiType: item.aiType ?? 0,
      createDate: item.createDate ?? null,
      totalBookmarks: item.bookmarkCount ?? 0,
      viewCount: item.viewCount ?? 0,
      isBookmarked: Boolean(item.bookmarkData),
      tags: (item.tags ?? []).map((tag) => ({ name: typeof tag === 'string' ? tag : tag.tag ?? String(tag) })),
      thumbUrl: typeof item.url === 'string' && item.url.startsWith('http') ? item.url : null,
    }
  }

  /** Web ajax search. mode=r18 serves R-18; mode=safe keeps results clean. */
  async searchWeb({ word, r18 = false, sort = 'date_d', page = 1, hideAi = true }) {
    const payload = await this.webAjax(`/search/artworks/${encodeURIComponent(word)}`, {
      params: {
        word,
        order: sort,
        mode: r18 ? 'r18' : 'safe',
        p: String(page),
        lang: 'zh',
      },
    })
    const data = payload.body?.illustManga?.data ?? payload.body?.illust?.data ?? []
    const total = payload.body?.illustManga?.total ?? payload.body?.illust?.total ?? data.length
    const items = data.map((item) => this.mapWebIllust(item))
    // aiType: 0=Undefined, 1=NotAiGenerate, 2=AiGenerate — filter only real AI works
    return { total, items: hideAi ? items.filter((item) => item.aiType !== 2) : items }
  }

  /**
   * Category search: runs the same query against every word, merges by id.
   * One page per word to keep request volume (and account risk) low.
   */
  async searchCategory({ words, r18 = false, hideAi = true }) {
    const resultsPerWord = []
    let firstError = null
    for (const word of words.slice(0, 3)) {
      try {
        const { items } = await this.searchWeb({ word, r18, sort: 'date_d', page: 1, hideAi })
        resultsPerWord.push(items)
      } catch (error) {
        if (error instanceof ApiError && error.code === 'cookie_required') throw error
        firstError ??= error
        this.log.warn(`[pixiv-viewer] category word failed: ${word} ${error.message}`)
      }
    }
    if (resultsPerWord.length === 0 && firstError) throw firstError
    const seen = new Set()
    const merged = []
    for (const items of resultsPerWord) {
      for (const item of items) {
        if (seen.has(item.id)) continue
        seen.add(item.id)
        merged.push(item)
      }
    }
    merged.sort((a, b) => {
      const aDate = a.createDate ? new Date(a.createDate).getTime() : 0
      const bDate = b.createDate ? new Date(b.createDate).getTime() : 0
      return bDate - aDate
    })
    return { total: merged.length, items: merged }
  }

  // ------------------------------------------------------------------ detail & bookmark

  /** Detail + viewer pages, mapped to the shape the client expects. */
  async illustDetail(illustId) {
    const payload = await this.webAjax(`/illust/${illustId}`, { params: { lang: 'zh' } })
    const body = payload.body
    if (!body || !body.illustId) throw new ApiError('not_found', '作品不存在或已被删除', 404)

    let pages = []
    if ((body.pageCount ?? 1) > 1) {
      pages = await this.illustPages(illustId)
    } else {
      pages = pagesFromUrls(body.urls)
    }
    if (pages.length === 0) pages = await this.illustPages(illustId)

    return {
      id: body.illustId,
      title: body.illustTitle ?? body.title,
      userName: body.userName ?? '',
      userId: body.userId ?? 0,
      xRestrict: body.xRestrict ?? 0,
      isBookmarked: Boolean(body.bookmarkData),
      bookmarkId: body.bookmarkData?.id ?? null,
      totalBookmarks: body.bookmarkCount ?? 0,
      viewCount: body.viewCount ?? 0,
      likeCount: body.likeCount ?? 0,
      createDate: body.createDate ?? null,
      width: body.width ?? 0,
      height: body.height ?? 0,
      pageCount: body.pageCount ?? pages.length,
      aiType: body.aiType ?? 0,
      tags: (body.tags?.tags ?? []).map((tag) => ({ name: tag.tag ?? String(tag) })),
      pages,
    }
  }

  async illustPages(illustId) {
    const payload = await this.webAjax(`/illust/${illustId}/pages`, { params: { lang: 'zh' } })
    const entries = Array.isArray(payload.body) ? payload.body : []
    return entries
      .map((page) => {
        const urls = page.urls ?? {}
        let url = urls.original ?? urls.regular ?? urls.small
        if (url && url.endsWith('.zip')) url = urls.regular ?? urls.small ?? null
        return { url, thumb: urls.small ?? urls.regular ?? url }
      })
      .filter((page) => page.url)
  }

  async bookmarkAdd(illustId, restrict = 'public') {
    await this.csrfPost('/illusts/bookmarks/add', {
      json: {
        illust_id: String(illustId),
        restrict: restrict === 'private' ? 1 : 0,
        comment: '',
        tags: [],
      },
    })
  }

  async bookmarkDelete(illustId) {
    const detail = await this.illustDetail(illustId)
    if (!detail.bookmarkId) return
    await this.csrfPost('/illusts/bookmarks/delete', {
      form: { bookmark_id: String(detail.bookmarkId) },
    })
  }

  // ------------------------------------------------------------------ images

  async fetchImage(pximgUrl, signal) {
    const dispatcher = this.createDispatcher()
    const init = {
      headers: { Referer: `${WEB}/`, 'User-Agent': WEB_UA },
      signal: signal ?? AbortSignal.timeout(120_000),
      ...(dispatcher ? { dispatcher } : {}),
    }
    return this.imgGate.schedule(() => this.imgLimiter.schedule(() => this.fetch(pximgUrl, init)))
  }
}

// ------------------------------------------------------------------ helpers

function pagesFromUrls(urls) {
  const url = urls?.original ?? urls?.regular
  if (!url || url.endsWith('.zip')) return []
  return [{ url, thumb: urls.small ?? urls.regular ?? url }]
}

async function readJson(path, fallback) {
  try {
    const text = await readFile(path, 'utf8')
    const value = JSON.parse(text)
    return value !== null && typeof value === 'object' ? value : fallback
  } catch {
    return fallback
  }
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true })
  const tmp = `${path}.tmp`
  await writeFile(tmp, JSON.stringify(value, null, 2))
  await rename(tmp, path)
}

async function safeJson(response) {
  try {
    return await response.json()
  } catch {
    return {}
  }
}

export function isValidPximgUrl(raw) {
  try {
    const url = new URL(raw)
    return url.protocol === 'https:' && /(^|\.)pximg\.net$/i.test(url.hostname)
  } catch {
    return false
  }
}
