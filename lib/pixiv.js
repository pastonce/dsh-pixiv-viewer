/**
 * dsh-pixiv-viewer — host pixiv client.
 *
 * Talks to the official pixiv App API (the same endpoints the mobile app
 * uses) with the user's own OAuth token, plus the web ajax search endpoint
 * for R-18 search (which the App API search does not serve).
 *
 * Account-safety measures built in here:
 *  - every App API call is serialised through a rate limiter (>= 1.5s apart);
 *  - images are fetched through a separate, gentler limiter (small concurrency);
 *  - only the user's own refresh_token is used; it is stored locally and
 *    rotated on every refresh, never logged;
 *  - no HTML scraping, no bulk operations.
 */

import { createHash, randomBytes } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fetch as undiciFetch, ProxyAgent } from 'undici'

export const APP_API = 'https://app-api.pixiv.net'
const OAUTH_URL = 'https://oauth.secure.pixiv.net/auth/token'
const WEB = 'https://www.pixiv.net'
const CLIENT_ID = 'MOBrBDS8blbauoSck0ZfDbtuzpyT'
const CLIENT_SECRET = 'lsACyCD94FhDUtGTXi3QzcFE2uU1hqtDaKeqrdw'
const REDIRECT_URI = 'https://app-api.pixiv.net/web/v1/users/auth/pixiv/callback'
const LOGIN_URL = 'https://app-api.pixiv.net/web/v1/login'
const APP_UA = 'PixivAndroidApp/5.0.234 (Android 11; Pixel 5)'
const WEB_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

export const DATA_DIR = join(homedir(), '.pixiv-viewer')

const API_INTERVAL_MS = 1500
const IMG_INTERVAL_MS = 250
const IMG_CONCURRENCY = 3

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
const EMPTY_TOKEN = Object.freeze({ refresh_token: null, access_token: null, expires_at: 0, user: null })

/** Local persistence under ~/.pixiv-viewer (token.json + config.json). */
export class PixivStore {
  constructor(dir = DATA_DIR) {
    this.dir = dir
    this.tokenPath = join(dir, 'token.json')
    this.configPath = join(dir, 'config.json')
    this.token = { ...EMPTY_TOKEN }
    this.config = { ...DEFAULT_CONFIG }
  }

  async load() {
    this.token = await readJson(this.tokenPath, EMPTY_TOKEN)
    this.config = { ...DEFAULT_CONFIG, ...(await readJson(this.configPath, DEFAULT_CONFIG)) }
  }

  async saveToken(patch) {
    this.token = { ...this.token, ...patch }
    await writeJson(this.tokenPath, this.token)
  }

  async saveConfig(patch) {
    this.config = { ...this.config, ...patch }
    await writeJson(this.configPath, this.config)
  }

  async clearAuth() {
    this.token = { ...EMPTY_TOKEN }
    this.config = { ...this.config, phpsessid: null }
    await writeJson(this.tokenPath, this.token)
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
    this.pendingLogin = null
    this.refreshLock = null
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

  // ------------------------------------------------------------------ auth

  s256(data) {
    return createHash('sha256').update(data).digest('base64url')
  }

  startLogin() {
    const codeVerifier = randomBytes(32).toString('base64url')
    const challenge = this.s256(codeVerifier)
    this.pendingLogin = { codeVerifier, createdAt: Date.now() }
    const params = new URLSearchParams({
      code_challenge: challenge,
      code_challenge_method: 'S256',
      client: 'pixiv-android',
    })
    return `${LOGIN_URL}?${params}`
  }

  async exchangeCode(code) {
    const pending = this.pendingLogin
    this.pendingLogin = null
    if (!pending) throw new ApiError('bad_request', '登录会话已过期，请重新开始登录')
    if (Date.now() - pending.createdAt > 15 * 60 * 1000) {
      throw new ApiError('bad_request', '登录会话已过期，请重新开始登录')
    }
    return this.tokenRequest({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'authorization_code',
      code: String(code).trim(),
      code_verifier: pending.codeVerifier,
      redirect_uri: REDIRECT_URI,
      include_policy: 'true',
    })
  }

  async tokenRequest(data) {
    let response
    try {
      response = await this.fetch(OAUTH_URL, {
        method: 'POST',
        headers: { 'User-Agent': APP_UA, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(data).toString(),
        signal: AbortSignal.timeout(30_000),
      })
    } catch (error) {
      throw new ApiError('network_error', `无法连接 pixiv（${error.cause?.code ?? error.message}）。如在国内网络，请在插件设置中配置代理。`)
    }
    const payload = await safeJson(response)
    if (!response.ok || !payload.access_token) {
      this.log.warn(`[pixiv-viewer] auth failed: ${response.status} ${JSON.stringify(payload).slice(0, 200)}`)
      throw new ApiError('auth_failed', '登录失败，请重试登录流程', response.status)
    }
    return payload
  }

  async refreshAccessToken() {
    if (this.refreshLock) return this.refreshLock
    this.refreshLock = (async () => {
      const token = this.store.token
      if (!token.refresh_token) throw new ApiError('not_logged_in', '尚未登录 pixiv')
      try {
        const payload = await this.tokenRequest({
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          grant_type: 'refresh_token',
          refresh_token: token.refresh_token,
          include_policy: 'true',
        })
        await this.store.saveToken({
          access_token: payload.access_token,
          refresh_token: payload.refresh_token ?? token.refresh_token,
          expires_at: Date.now() + (payload.expires_in ?? 3600) * 1000,
          user: payload.user ?? null,
        })
        return payload
      } catch (error) {
        if (error instanceof ApiError && error.code === 'auth_failed') {
          await this.store.saveToken({ access_token: null, expires_at: 0 })
          throw new ApiError('token_expired', '登录已失效，请重新登录')
        }
        throw error
      } finally {
        this.refreshLock = null
      }
    })()
    return this.refreshLock
  }

  async applyAccessToken(payload) {
    await this.store.saveToken({
      access_token: payload.access_token,
      refresh_token: payload.refresh_token ?? this.store.token.refresh_token,
      expires_at: Date.now() + (payload.expires_in ?? 3600) * 1000,
      user: payload.user ?? null,
    })
  }

  // ------------------------------------------------------------------ app api

  async ensureToken() {
    const token = this.store.token
    if (!token.refresh_token) throw new ApiError('not_logged_in', '尚未登录 pixiv')
    if (token.access_token && token.expires_at > Date.now() + 60_000) return token.access_token
    const payload = await this.refreshAccessToken()
    return payload.access_token
  }

  async api(path, { params, method = 'GET', form, signal } = {}) {
    const url = new URL(APP_API + path)
    if (params) for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== null) url.searchParams.set(key, String(value))

    const call = async () => {
      const accessToken = await this.ensureToken()
      let response
      try {
        response = await this.fetch(url, {
          method,
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'User-Agent': APP_UA,
            ...(form ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
          },
          ...(form ? { body: new URLSearchParams(form).toString() } : {}),
          signal: signal ?? AbortSignal.timeout(30_000),
        })
      } catch (error) {
        throw new ApiError('network_error', `无法连接 pixiv（${error.cause?.code ?? error.message}）。如在国内网络，请在插件设置中配置代理。`)
      }
      if (response.status === 429) throw new ApiError('rate_limited', '请求过于频繁，请稍等片刻再试', 429)
      if (response.status === 401) {
        // token may have been rotated elsewhere; refresh once and retry
        await this.store.saveToken({ access_token: null, expires_at: 0 })
        const accessToken = await this.ensureToken()
        response = await this.fetch(url, {
          method,
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'User-Agent': APP_UA,
            ...(form ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
          },
          ...(form ? { body: new URLSearchParams(form).toString() } : {}),
          signal: signal ?? AbortSignal.timeout(30_000),
        })
      }
      const payload = await safeJson(response)
      if (!response.ok || payload.error) {
        const message = payload.error?.user_message || payload.error?.message || `pixiv 返回错误（${response.status}）`
        if (response.status === 401 || response.status === 400) throw new ApiError('pixiv_auth', message, response.status)
        throw new ApiError('pixiv_error', message, response.status)
      }
      return payload
    }
    return this.apiLimiter.schedule(call)
  }

  // ------------------------------------------------------------------ search

  mapAppApiIllust(item) {
    return {
      id: item.id,
      title: item.title,
      userName: item.user?.name ?? '',
      userId: item.user?.id ?? 0,
      pageCount: item.page_count,
      width: item.width,
      height: item.height,
      xRestrict: item.x_restrict ?? 0,
      aiType: item.ai_type ?? null,
      createDate: item.create_date ?? null,
      totalBookmarks: item.total_bookmarks ?? 0,
      viewCount: item.total_view ?? 0,
      isBookmarked: item.is_bookmarked === true,
      tags: (item.tags ?? []).map((tag) => ({ name: tag.name ?? String(tag) })),
      thumbUrl: item.image_urls?.square_medium ?? null,
    }
  }

  mapWebIllust(item) {
    const tags = (item.tags ?? []).map((tag) => ({ name: typeof tag === 'string' ? tag : tag.tag ?? String(tag) }))
    const thumb = typeof item.url === 'string' && item.url.startsWith('http') ? item.url : null
    return {
      id: item.id,
      title: item.title,
      userName: item.userName ?? '',
      userId: item.userId ?? 0,
      pageCount: item.pageCount ?? 1,
      width: item.width ?? 0,
      height: item.height ?? 0,
      xRestrict: item.xRestrict ?? 0,
      aiType: item.aiType ?? null,
      createDate: null,
      totalBookmarks: item.bookmarkCount ?? 0,
      viewCount: item.viewCount ?? 0,
      isBookmarked: false,
      tags,
      thumbUrl: thumb,
    }
  }

  async searchAppApi({ word, sort = 'date_desc', offset = 0, hideAi = true }) {
    const payload = await this.api('/v1/search/illust', {
      params: {
        word,
        search_target: 'partial_match_for_tags',
        sort,
        filter: 'for_ios',
        offset,
        ...(hideAi ? { search_ai_type: 0 } : {}),
      },
    })
    const list = (payload.illusts ?? []).map((item) => this.mapAppApiIllust(item))
    return { total: payload.total ?? list.length, items: list }
  }

  /** Web ajax search (only path that serves R-18). Requires PHPSESSID cookie. */
  async searchWeb({ word, r18 = false, sort = 'date_d', page = 1 }) {
    const phpsessid = this.store.config.phpsessid
    if (!phpsessid) throw new ApiError('cookie_required', '网页搜索需要 Cookie（PHPSESSID），请在插件设置中填写')
    const url = new URL(`${WEB}/ajax/search/artworks/${encodeURIComponent(word)}`)
    url.searchParams.set('word', word)
    url.searchParams.set('order', sort)
    url.searchParams.set('mode', r18 ? 'r18' : 'all')
    url.searchParams.set('p', String(page))
    url.searchParams.set('lang', 'zh')

    const call = async () => {
      let response
      try {
        response = await this.fetch(url, {
          headers: {
            Cookie: `PHPSESSID=${phpsessid}`,
            'User-Agent': WEB_UA,
            Referer: `${WEB}/`,
          },
          signal: AbortSignal.timeout(30_000),
        })
      } catch (error) {
        throw new ApiError('network_error', `无法连接 pixiv 网页端（${error.cause?.code ?? error.message}）。如在国内网络，请在插件设置中配置代理。`)
      }
      if (response.status === 429) throw new ApiError('rate_limited', '请求过于频繁，请稍等片刻再试', 429)
      const payload = await safeJson(response)
      if (!response.ok) throw new ApiError('pixiv_error', `pixiv 返回错误（${response.status}）`, response.status)
      if (payload.error) {
        const message = payload.message || '网页搜索失败（Cookie 可能已过期）'
        if (response.status === 403 || response.status === 401 || message.includes('登录') || message.includes('login')) {
          throw new ApiError('cookie_expired', 'PHPSESSID 已过期，请在插件设置中更新')
        }
        throw new ApiError('pixiv_error', message, response.status)
      }
      const data = payload.body?.illustManga?.data ?? payload.body?.illust?.data ?? []
      return data.map((item) => this.mapWebIllust(item))
    }
    return this.imgLimiter.schedule(call)
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
        if (r18) {
          resultsPerWord.push(await this.searchWeb({ word, r18: true, sort: 'date_d', page: 1 }))
        } else {
          const { items } = await this.searchAppApi({ word, offset: 0, hideAi })
          resultsPerWord.push(items)
        }
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

  async illustDetail(illustId) {
    const payload = await this.api('/v2/illust/detail', { params: { illust_id: illustId } })
    return payload.illust ?? null
  }

  viewerPages(illust) {
    const fallback = illust.image_urls?.large ?? null
    let pages = []
    if (Array.isArray(illust.meta_pages) && illust.meta_pages.length > 0) {
      pages = illust.meta_pages.map((page) => page.image_urls ?? {})
    } else if (illust.meta_single_page?.original_image_url) {
      pages = [{ original: illust.meta_single_page.original_image_url }]
    }
    return pages.map((page) => {
      let url = page.original ?? page.large ?? page.medium ?? fallback
      if (url && url.endsWith('.zip')) url = page.large ?? page.medium ?? fallback
      return { url, thumb: page.square_medium ?? page.medium ?? fallback }
    }).filter((page) => page.url)
  }

  async bookmarkAdd(illustId, restrict = 'public') {
    return this.api('/v2/illust/bookmark/add', { method: 'POST', form: { illust_id: String(illustId), restrict } })
  }

  async bookmarkDelete(illustId) {
    return this.api('/v1/illust/bookmark/delete', { method: 'POST', form: { illust_id: String(illustId) } })
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
