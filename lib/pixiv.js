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
 *  - images are fetched through a separate limiter without any account
 *    cookie (Referer + UA only), so they run faster than ajax safely;
 *  - hot ajax responses (search / detail / user works) are cached briefly
 *    to avoid re-fetching identical data through the rate limiter;
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
// image fetches carry no account cookie (Referer + UA only, CDN traffic),
// so they can be faster than the account-bound ajax limiter
const IMG_INTERVAL_MS = 120
const IMG_CONCURRENCY = 6
const USER_CACHE_MS = 10 * 60 * 1000
const SEARCH_CACHE_MS = 60 * 1000
const DETAIL_CACHE_MS = 5 * 60 * 1000

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
    this.cache = new Map()
  }

  // ---------------------------------------------------------------- response cache

  cacheGet(key) {
    const entry = this.cache.get(key)
    if (!entry) return undefined
    if (entry.expires <= Date.now()) {
      this.cache.delete(key)
      return undefined
    }
    this.cache.delete(key)
    this.cache.set(key, entry)
    return entry.value
  }

  cacheSet(key, value, ttlMs, cap = 64) {
    this.cache.set(key, { value, expires: Date.now() + ttlMs })
    while (this.cache.size > cap) this.cache.delete(this.cache.keys().next().value)
  }

  cacheDelete(key) {
    this.cache.delete(key)
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
      if (value === undefined || value === null) continue
      if (Array.isArray(value)) {
        for (const item of value) url.searchParams.append(key, String(item))
      } else {
        url.searchParams.set(key, String(value))
      }
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
      illustType: item.illustType ?? 0,
      createDate: item.createDate ?? null,
      totalBookmarks: item.bookmarkCount ?? 0,
      viewCount: item.viewCount ?? 0,
      isBookmarked: Boolean(item.bookmarkData),
      tags: (item.tags ?? []).map((tag) => ({ name: typeof tag === 'string' ? tag : tag.tag ?? String(tag) })),
      thumbUrl: typeof item.url === 'string' && item.url.startsWith('http') ? item.url : null,
    }
  }

  /**
   * Web ajax search. R18 toggle semantics: off -> mode=safe (R-18 filtered out),
   * on -> mode=all (R-18 mixed in with safe works). Videos (ugoira, illustType 2)
   * are always filtered out. sMode: undefined (tag partial) | 's_tc' (title/caption).
   */
  async searchWeb({ word, r18 = false, sort = 'date_d', page = 1, hideAi = true, sMode } = {}) {
    const key = ['sw', word, r18 ? 1 : 0, sort, page, hideAi ? 1 : 0, sMode ?? ''].join('\u0000')
    const hit = this.cacheGet(key)
    if (hit !== undefined) return hit
    const run = async () => {
      const payload = await this.webAjax(`/search/artworks/${encodeURIComponent(word)}`, {
        params: {
          word,
          order: sort,
          mode: r18 ? 'all' : 'safe',
          p: String(page),
          lang: 'zh',
          ...(sMode ? { s_mode: sMode } : {}),
        },
      })
      const data = payload.body?.illustManga?.data ?? payload.body?.illust?.data ?? []
      const total = payload.body?.illustManga?.total ?? payload.body?.illust?.total ?? data.length
      let items = data.map((item) => this.mapWebIllust(item)).filter((item) => item.illustType !== 2)
      // aiType: 0=Undefined, 1=NotAiGenerate, 2=AiGenerate — filter only real AI works
      if (hideAi) items = items.filter((item) => item.aiType !== 2)
      const result = { total, items }
      this.cacheSet(key, result, SEARCH_CACHE_MS, 120)
      return result
    }
    return this.apiLimiter.schedule(run)
  }

  /**
   * Daily popularity ranking (the top-page feed) — the one genuinely
   * popularity-ordered list available; sliced to a random 60 per refresh.
   * /top/illust only accepts mode=all|r18, so R18-off filters client-side
   * (same mixed semantics as search: on = mixed, off = filtered).
   */
  async searchDaily({ r18 = false, hideAi = true } = {}) {
    const payload = await this.webAjax('/top/illust', { params: { mode: 'all', lang: 'zh' } })
    const data = payload.body?.thumbnails?.illust ?? []
    let items = data
      .map((item) => this.mapWebIllust(item))
      .filter((item) => item.illustType !== 2 && item.thumbUrl)
    if (!r18) items = items.filter((item) => item.xRestrict !== 1)
    if (hideAi) items = items.filter((item) => item.aiType !== 2)
    for (let i = items.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[items[i], items[j]] = [items[j], items[i]]
    }
    return { total: items.length, items: items.slice(0, 60) }
  }

  /**
   * Category search: runs the same query against every word, merges by id.
   * One page per word to keep request volume (and account risk) low. `tier`
   * is ANDed into every word; total is the largest per-word total (an
   * approximation — the merged list may dedupe overlaps).
   */
  async searchCategory({ words, r18 = false, hideAi = true, page = 1, tier = '' }) {
    const resultsPerWord = []
    let firstError = null
    let maxTotal = 0
    for (const word of words.slice(0, 3)) {
      try {
        const term = tier ? `${word} ${tier}`.trim() : word
        const { items, total } = await this.searchWeb({ word: term, r18, sort: 'date_d', page, hideAi })
        maxTotal = Math.max(maxTotal, typeof total === 'number' ? total : items.length)
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
    return { total: maxTotal, items: merged }
  }

  // ------------------------------------------------------------------ typed search

  mapProfileIllust(work, userName, userId) {
    return {
      id: work.id,
      title: work.title ?? '',
      userName,
      userId: Number(userId) || 0,
      pageCount: work.pageCount ?? 1,
      width: work.width ?? 0,
      height: work.height ?? 0,
      xRestrict: work.xRestrict ?? 0,
      aiType: work.aiType ?? 0,
      illustType: work.illustType ?? 0,
      createDate: work.createDate ?? null,
      totalBookmarks: work.bookmarkCount ?? 0,
      viewCount: work.viewCount ?? 0,
      isBookmarked: false,
      tags: (work.tags ?? []).map((tag) => ({ name: typeof tag === 'string' ? tag : tag.tag ?? String(tag) })),
      thumbUrl: typeof work.url === 'string' && work.url.startsWith('http') ? work.url : null,
    }
  }

  /**
   * A user's works. profile/all only returns the id list nowadays (values are
   * nulled out); the site then loads the actual items via profile/illusts?ids[].
   */
  async userWorks(userId, { hideAi = true, userName = null } = {}) {
    const id = String(userId)
    const key = ['uw', id, hideAi ? 1 : 0].join('\u0000')
    const hit = this.cacheGet(key)
    if (hit !== undefined) return hit
    const run = async () => {
      const all = await this.webAjax(`/user/${id}/profile/all`, { params: { sensitiveFilterMode: 'userSetting', lang: 'zh' } })
      const ids = Object.keys(all.body?.illusts ?? {}).slice(0, 200)
      if (ids.length === 0) throw new ApiError('not_found', '该用户没有公开的作品', 404)
      const works = await this.webAjax(`/user/${id}/profile/illusts`, {
        params: {
          'ids[]': ids,
          work_category: 'illust',
          is_first_page: '1',
          sensitiveFilterMode: 'userSetting',
          lang: 'zh',
        },
      })
      if (!userName) {
        const user = await this.webAjax(`/user/${id}`, { params: { full: '0', lang: 'zh' } })
        userName = user.body?.name ?? `用户 ${id}`
      }
      const map = works.body?.works ?? {}
      let items = Object.values(map)
        .filter((work) => work && typeof work === 'object')
        .map((work) => this.mapProfileIllust(work, userName, id))
        .filter((item) => item.illustType !== 2 && item.thumbUrl)
      if (hideAi) items = items.filter((item) => item.aiType !== 2)
      items.sort((a, b) => (new Date(b.createDate).getTime() || 0) - (new Date(a.createDate).getTime() || 0))
      const result = { total: items.length, items: items.slice(0, 60), userName }
      this.cacheSet(key, result, SEARCH_CACHE_MS, 40)
      return result
    }
    return this.apiLimiter.schedule(run)
  }

  /**
   * Author search by name: pixiv removed the user-search endpoints, so the
   * only lead is works whose userName matches the query (artists often tag
   * their own name). Fails with a hint when nothing matches.
   */
  async searchUserByName(word, { hideAi = true } = {}) {
    const { items } = await this.searchWeb({ word, r18: true, sort: 'date_d', page: 1, hideAi })
    const lower = word.toLowerCase()
    const counts = new Map()
    let best = null
    for (const item of items) {
      const name = String(item.userName ?? '').toLowerCase()
      if (!name) continue
      const exact = name === lower
      if (!exact && !name.includes(lower)) continue
      const userId = item.userId
      counts.set(userId, (counts.get(userId) ?? 0) + 1)
      if (exact || !best || counts.get(userId) > counts.get(best.userId)) best = { userId, userName: item.userName, exact }
      if (exact) break
    }
    if (!best) {
      throw new ApiError('not_found', '未找到该作者：pixiv 已不支持按名字搜索作者。请点击任意作品上的作者名，或输入作者的用户 ID', 404)
    }
    return this.userWorks(best.userId, { hideAi, userName: best.userName })
  }

  /** PID lookup: one work, mapped to the grid item shape. */
  async searchPid(pid) {
    const detail = await this.illustDetail(pid)
    return {
      total: 1,
      items: [{
        id: detail.id,
        title: detail.title,
        userName: detail.userName,
        userId: detail.userId,
        pageCount: detail.pageCount,
        width: detail.width,
        height: detail.height,
        xRestrict: detail.xRestrict,
        aiType: detail.aiType,
        illustType: detail.illustType,
        createDate: detail.createDate,
        totalBookmarks: detail.totalBookmarks,
        viewCount: detail.viewCount,
        isBookmarked: detail.isBookmarked,
        tags: detail.tags,
        thumbUrl: detail.thumbUrl,
      }],
    }
  }

  /**
   * Set-operations search: groups split by | (union, merged by id), + / space
   * inside a group = intersection (pixiv AND), leading - excludes a tag
   * (complement). Tier ("…users入り") and `extra` (an in-category AND term)
   * are appended to every group as AND constraints. Result is capped at 60,
   * sorted by the chosen order.
   */
  async searchComplex({ query, r18 = false, sort = 'date_d', hideAi = true, tier = '', sMode, extra = '' } = {}) {
    const normalize = (text) => text.replace(/｜/g, '|').replace(/＋/g, '+').replace(/－/g, '-')
    const groups = normalize(query).split('|').map((group) => group.trim()).filter(Boolean).slice(0, 3)
    if (groups.length === 0) throw new ApiError('bad_request', '请输入搜索内容')
    const results = []
    const negativeTerms = new Set()
    for (const group of groups) {
      const tokens = group.replace(/\+/g, ' ').split(/\s+/).filter(Boolean).slice(0, 4)
      const positives = []
      for (const token of tokens) {
        if (token.startsWith('-')) negativeTerms.add(token.slice(1))
        else positives.push(token)
      }
      let word = positives.join(' ')
      if (tier && !positives.includes(tier)) word = `${word} ${tier}`.trim()
      if (extra && !positives.includes(extra)) word = `${word} ${extra}`.trim()
      if (!word) continue
      const { items } = await this.searchWeb({ word, r18, sort, page: 1, hideAi, sMode })
      results.push(items)
    }
    const excludeIds = new Set()
    for (const term of [...negativeTerms].slice(0, 3)) {
      const { items } = await this.searchWeb({ word: term, r18, sort: 'date_d', page: 1, hideAi })
      for (const item of items) excludeIds.add(item.id)
    }
    const seen = new Set()
    const merged = []
    for (const items of results) {
      for (const item of items) {
        if (excludeIds.has(item.id) || seen.has(item.id)) continue
        seen.add(item.id)
        merged.push(item)
      }
    }
    const time = (value) => (value ? new Date(value).getTime() : 0)
    merged.sort((a, b) => {
      // search payloads carry no bookmark counts, so "popular" falls back to
      // newest-first — exactly what the official site does for 人気順 today.
      if (sort === 'date_asc') return time(a.createDate) - time(b.createDate)
      return time(b.createDate) - time(a.createDate)
    })
    return { total: merged.length, items: merged.slice(0, 60) }
  }

  // ------------------------------------------------------------------ detail & bookmark

  /** Detail + viewer pages, mapped to the shape the client expects. */
  async illustDetail(illustId) {
    const key = `detail:${illustId}`
    const hit = this.cacheGet(key)
    if (hit !== undefined) return hit
    const run = async () => {
      const payload = await this.webAjax(`/illust/${illustId}`, { params: { lang: 'zh' } })
      const body = payload.body
      if (!body || !body.illustId) throw new ApiError('not_found', '作品不存在或已被删除', 404)
      if (body.illustType === 2) throw new ApiError('unsupported', '视频（动图）作品暂不支持查看')

      let pages = []
      if ((body.pageCount ?? 1) > 1) {
        pages = await this.illustPages(illustId)
      } else {
        pages = pagesFromUrls(body.urls)
      }
      if (pages.length === 0) pages = await this.illustPages(illustId)

      const detail = {
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
        illustType: body.illustType ?? 0,
        tags: (body.tags?.tags ?? []).map((tag) => ({ name: tag.tag ?? String(tag) })),
        thumbUrl: pages[0]?.thumb ?? null,
        pages,
      }
      this.cacheSet(key, detail, DETAIL_CACHE_MS, 60)
      return detail
    }
    return this.apiLimiter.schedule(run)
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
    this.cacheDelete(`detail:${illustId}`)
  }

  async bookmarkDelete(illustId) {
    const detail = await this.illustDetail(illustId)
    if (!detail.bookmarkId) return
    await this.csrfPost('/illusts/bookmarks/delete', {
      form: { bookmark_id: String(detail.bookmarkId) },
    })
    this.cacheDelete(`detail:${illustId}`)
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
