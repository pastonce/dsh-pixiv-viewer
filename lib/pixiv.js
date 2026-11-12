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
// in-memory image cache: pximg URLs are content-addressed, so repeat fetches
// (download / copy right after viewing) can be served from RAM
const IMG_MEM_MAX_BYTES = 48 * 1024 * 1024
const IMG_MEM_TTL_MS = 30 * 60 * 1000
const USER_CACHE_MS = 10 * 60 * 1000
const SEARCH_CACHE_MS = 60 * 1000
const DETAIL_CACHE_MS = 5 * 60 * 1000
const BOOKMARK_CACHE_MS = 5 * 60 * 1000

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
    this.imgMemCache = new Map()
    this.csrf = null
    this.csrfPending = null
    this.user = null
    this.cache = new Map()
    this.pageBuffers = new Map()
    // periodic sweep so expired cache entries are reclaimed even when the
    // user stops triggering new lookups (caps already bound the size)
    this.cleanupTimer = setInterval(() => this.sweepCaches(), 5 * 60 * 1000)
    if (typeof this.cleanupTimer.unref === 'function') this.cleanupTimer.unref()
  }

  /** Drops expired entries from the response cache and the image RAM cache. */
  sweepCaches() {
    const now = Date.now()
    for (const [key, entry] of this.cache) {
      if (entry.expires <= now) this.cache.delete(key)
    }
    for (const [key, entry] of this.imgMemCache) {
      if (entry.at + IMG_MEM_TTL_MS <= now) this.imgMemCache.delete(key)
    }
  }

  /**
   * Per-context paging buffer: raw pages hold 60 works while client pages
   * hold 80, so a request's surplus is kept here and consumed by the next
   * page of the same context (matched by the cursor the client echoes
   * back). A cursor mismatch means the client re-requested an old page —
   * the walk is restarted, which reproduces it deterministically.
   */
  pageBuffer(key, cursor) {
    let entry = this.pageBuffers.get(key)
    if (!entry || entry.cursor !== cursor) {
      entry = { cursor, items: [], seen: new Set(), done: false }
      this.pageBuffers.delete(key)
      this.pageBuffers.set(key, entry)
      while (this.pageBuffers.size > 12) {
        this.pageBuffers.delete(this.pageBuffers.keys().next().value)
      }
    }
    return entry
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
    let attempt = 0
    for (;;) {
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
        break
      } catch (error) {
        // proxy blips (ECONNRESET / connect timeouts) are common through
        // Clash; retry idempotent GETs once — mutations must not double-run
        if (method !== 'GET' || attempt >= 1) {
          throw new ApiError('network_error', `无法连接 pixiv（${error.cause?.code ?? error.message}）。如在国内网络，请在插件设置中配置代理。`)
        }
        attempt += 1
        await sleep(1000)
      }
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
   * hideAi appends the server-side `-AI生成` exclusion (pixiv ignores the
   * ai_type param), so the reported total matches the filtered list.
   */
  async searchWeb({ word, r18 = false, sort = 'date_d', page = 1, hideAi = true, sMode } = {}) {
    const key = ['sw', word, r18 ? 1 : 0, sort, page, hideAi ? 1 : 0, sMode ?? ''].join('\u0000')
    const hit = this.cacheGet(key)
    if (hit !== undefined) return hit
    const term = hideAi && !word.includes('AI生成') ? `${word} -AI生成` : word
    const run = async () => {
      const payload = await this.webAjax(`/search/artworks/${encodeURIComponent(term)}`, {
        params: {
          word: term,
          order: sort,
          mode: r18 ? 'all' : 'safe',
          p: String(page),
          lang: 'zh',
          ...(sMode ? { s_mode: sMode } : {}),
        },
      })
      const data = payload.body?.illustManga?.data ?? payload.body?.illust?.data ?? []
      const total = payload.body?.illustManga?.total ?? payload.body?.illust?.total ?? data.length
      const items = data.map((item) => this.mapWebIllust(item)).filter((item) => item.illustType !== 2)
      const result = { total, items }
      this.cacheSet(key, result, SEARCH_CACHE_MS, 120)
      return result
    }
    return this.apiLimiter.schedule(run)
  }

  /**
   * Paged search with a tier floor (Nusers入り). The tier is matched by
   * SUBSTRING against each work's own tags, so fandom milestone tags like
   * "原神1000users入り" satisfy the 1000users入り tier (the official
   * `Nusers入り` tag also contains the text). Searches `word Nusers入り` in
   * the normal partial tag mode, which keeps the server-side `-AI生成`
   * exclusion working. Walks raw pages until 80 works pass the local
   * checks; a page buffer carries the surplus into the next page so no
   * work is skipped. Returns a raw-page cursor + explicit hasMore so the
   * client never renders empty "lost" pages and never shows an inflated
   * total. No detail-endpoint traffic at all.
   */
  async searchTiered({ word, r18 = false, sort = 'date_d', page = 1, hideAi = true, sMode, minBookmarks = 100 } = {}) {
    const tierTag = `${minBookmarks}users入り`
    const PAGE_SIZE = 80
    const RAW_PAGE = 60
    const MAX_RAW_PAGES = 12
    const isTitle = sMode === 's_tc'
    // title mode cannot constrain tags server-side — the local substring
    // check over the (complete) search tag list is the only tier filter
    const searchWord = isTitle ? word : [word, tierTag].filter(Boolean).join(' ')
    const keep = (item) => {
      const tags = (item.tags ?? []).map((tag) => tag.name ?? '')
      if (hideAi && tags.includes('AI生成')) return false
      return tags.some((name) => name.includes(tierTag))
    }
    const buffer = this.pageBuffer(['st', searchWord, r18 ? 1 : 0, sort, hideAi ? 1 : 0, sMode ?? '', tierTag].join('\u0000'), page)
    for (let walked = 0; walked < MAX_RAW_PAGES && buffer.items.length < PAGE_SIZE && !buffer.done; walked += 1) {
      const raw = await this.searchWeb({ word: searchWord, r18, sort, page: buffer.cursor, hideAi, sMode })
      buffer.cursor += 1
      for (const item of raw.items) {
        if (keep(item)) buffer.items.push(item)
      }
      // pixiv pages hold 58–60 works (deleted works leave gaps), so a short
      // page is not the end — `total` decides when the stream is exhausted
      if (raw.items.length === 0) buffer.done = true
      else if (typeof raw.total === 'number') buffer.done = (buffer.cursor - 1) * RAW_PAGE >= raw.total
    }
    const items = buffer.items.splice(0, PAGE_SIZE)
    return { total: null, items, nextPage: buffer.cursor, hasMore: buffer.items.length > 0 || !buffer.done }
  }

  /**
   * Plain paged search: walks raw pages until 80 works are collected so a
   * client page is always 10 rows of 8. A page buffer carries the surplus
   * into the next page (raw pages hold 60) so no work is skipped. Cursor +
   * hasMore semantics like searchTiered — the client never guesses from
   * total alone.
   */
  async searchPaged({ word, r18 = false, sort = 'date_d', page = 1, hideAi = true, sMode } = {}) {
    const PAGE_SIZE = 80
    const RAW_PAGE = 60
    const MAX_RAW_PAGES = 12
    const buffer = this.pageBuffer(['sp', word, r18 ? 1 : 0, sort, hideAi ? 1 : 0, sMode ?? ''].join('\u0000'), page)
    let total = null
    for (let walked = 0; walked < MAX_RAW_PAGES && buffer.items.length < PAGE_SIZE && !buffer.done; walked += 1) {
      const raw = await this.searchWeb({ word, r18, sort, page: buffer.cursor, hideAi, sMode })
      if (total === null) total = typeof raw.total === 'number' ? raw.total : null
      buffer.cursor += 1
      buffer.items.push(...raw.items)
      // pixiv pages hold 58–60 works (deleted works leave gaps), so a short
      // page is not the end — `total` decides when the stream is exhausted
      if (raw.items.length === 0) buffer.done = true
      else if (typeof total === 'number') buffer.done = (buffer.cursor - 1) * RAW_PAGE >= total
      else buffer.done = raw.items.length < RAW_PAGE
    }
    const items = buffer.items.splice(0, PAGE_SIZE)
    return { total, items, nextPage: buffer.cursor, hasMore: buffer.items.length > 0 || !buffer.done }
  }

  /**
   * Daily popularity ranking (the top-page feed) — the one genuinely
   * popularity-ordered list available; sliced to a random 80 per refresh.
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
    return { total: items.length, items: items.slice(0, 80) }
  }

  /**
   * Category search: one raw page per word per batch, merged by id (a work
   * tagged with two of the words appears once) and walked until 80 works
   * fill the client page (10 rows of 8). Batches are appended date-sorted,
   * so the page stream is batch-major / date-minor — a consistent order
   * across pages. A page buffer carries the surplus into the next page.
   * With minBookmarks the tier substring check runs locally per batch page.
   */
  async searchCategory({ words, r18 = false, hideAi = true, page = 1, minBookmarks = null } = {}) {
    const PAGE_SIZE = 80
    const MAX_BATCHES = 6
    const tierTag = minBookmarks ? `${minBookmarks}users入り` : null
    const buffer = this.pageBuffer(['sc', words.join('|'), r18 ? 1 : 0, hideAi ? 1 : 0, tierTag ?? ''].join('\u0000'), page)
    let maxTotal = 0
    let firstError = null
    for (let batch = 0; batch < MAX_BATCHES && buffer.items.length < PAGE_SIZE && !buffer.done; batch += 1) {
      const batchItems = []
      let anyWordItems = false
      for (const word of words.slice(0, 3)) {
        try {
          const searchWord = tierTag ? [word, tierTag].filter(Boolean).join(' ') : word
          const raw = await this.searchWeb({ word: searchWord, r18, sort: 'date_d', page: buffer.cursor, hideAi })
          if (typeof raw.total === 'number') maxTotal = Math.max(maxTotal, raw.total)
          if (raw.items.length > 0) anyWordItems = true
          for (const item of raw.items) {
            if (tierTag) {
              const tags = (item.tags ?? []).map((tag) => tag.name ?? '')
              if (hideAi && tags.includes('AI生成')) continue
              if (!tags.some((name) => name.includes(tierTag))) continue
            }
            if (!buffer.seen.has(item.id)) {
              buffer.seen.add(item.id)
              batchItems.push(item)
            }
          }
        } catch (error) {
          if (error instanceof ApiError && error.code === 'cookie_required') throw error
          firstError ??= error
          this.log.warn(`[pixiv-viewer] category word failed: ${word} ${error.message}`)
        }
      }
      buffer.cursor += 1
      if (!anyWordItems) {
        buffer.done = true
        break
      }
      batchItems.sort((a, b) => {
        const aDate = a.createDate ? new Date(a.createDate).getTime() : 0
        const bDate = b.createDate ? new Date(b.createDate).getTime() : 0
        return bDate - aDate
      })
      for (const item of batchItems) {
        buffer.items.push(item)
      }
    }
    if (buffer.items.length === 0 && firstError) throw firstError
    const items = buffer.items.splice(0, PAGE_SIZE)
    const total = tierTag ? null : maxTotal
    return { total, items, nextPage: buffer.cursor, hasMore: buffer.items.length > 0 || !buffer.done }
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
      // profile/illusts rejects oversized id lists (400 不正确的请求) — read
      // in the official site's own page size of 48 ids per request
      const works = { body: { works: {} } }
      for (let start = 0; start < ids.length; start += 48) {
        const batch = await this.webAjax(`/user/${id}/profile/illusts`, {
          params: {
            'ids[]': ids.slice(start, start + 48),
            work_category: 'illust',
            is_first_page: start === 0 ? '1' : '0',
            sensitiveFilterMode: 'userSetting',
            lang: 'zh',
          },
        })
        Object.assign(works.body.works, batch.body?.works ?? {})
      }
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
      const result = { total: items.length, items: items.slice(0, 80), userName }
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
   * Set-operations search. Operators only count as STANDALONE tokens
   * (whitespace on both sides) — a |, + or - attached to a word is part of
   * the tag name itself ("R-18", "C++"):
   *   - a standalone | splits union groups (merged by id)
   *   - a standalone - marks the NEXT token as excluded; exclusions are
   *     applied locally against each item's own tags (partial match, the
   *     same semantics as the bookmarks mode) — reliable and free of extra
   *     requests, unlike searching each excluded term separately, which
   *     only ever covered that term's first page and missed most works
   *   - a standalone + is plain AND (pixiv's default), so it is dropped
   * `extra` (an in-category AND term) is appended to every group as an AND
   * constraint; minBookmarks switches each group to the tier-tag search
   * (substring `Nusers入り` match). Result is capped at 80, sorted by the
   * chosen order.
   */
  async searchComplex({ query, r18 = false, sort = 'date_d', hideAi = true, minBookmarks = null, sMode, extra = '' } = {}) {
    const normalize = (text) => text.replace(/｜/g, '|').replace(/＋/g, '+').replace(/－/g, '-')
    const tokens = normalize(query).split(/\s+/).filter(Boolean)
    if (tokens.length === 0) throw new ApiError('bad_request', '请输入搜索内容')
    const groups = []
    let current = []
    for (const token of tokens) {
      if (token === '|') {
        if (current.length > 0) {
          groups.push(current)
          current = []
        }
        continue
      }
      current.push(token)
    }
    if (current.length > 0 || groups.length === 0) groups.push(current)
    const results = []
    const negativeTerms = new Set()
    for (const group of groups.slice(0, 3)) {
      const positives = []
      let pendingNegative = false
      for (const token of group.slice(0, 4)) {
        if (token === '-') {
          pendingNegative = true
          continue
        }
        if (token === '+') continue
        if (pendingNegative) {
          pendingNegative = false
          negativeTerms.add(token)
          continue
        }
        positives.push(token)
      }
      let word = positives.join(' ')
      if (extra && !positives.includes(extra)) word = `${word} ${extra}`.trim()
      if (!word) continue
      // with a tier floor the group is searched against the tier tag
      // (substring match, fandom milestone tags included) — no detail traffic
      const { items } = minBookmarks
        ? await this.searchTiered({ word, r18, sort, page: 1, hideAi, sMode, minBookmarks })
        : await this.searchWeb({ word, r18, sort, page: 1, hideAi, sMode })
      results.push(items)
    }
    if (results.length === 0) {
      throw negativeTerms.size > 0
        ? new ApiError('bad_request', '排除标签（-）不能单独使用，请同时输入要搜索的标签')
        : new ApiError('bad_request', '请输入搜索内容')
    }
    const seen = new Set()
    const merged = []
    for (const items of results) {
      for (const item of items) {
        if (seen.has(item.id)) continue
        seen.add(item.id)
        merged.push(item)
      }
    }
    const excludes = [...negativeTerms].map((term) => term.toLowerCase())
    let filtered = excludes.length === 0
      ? merged
      : merged.filter((item) => {
        const tags = (item.tags ?? []).map((tag) => (tag.name ?? '').toLowerCase())
        return !excludes.some((term) => tags.some((name) => name.includes(term)))
      })
    const time = (value) => (value ? new Date(value).getTime() : 0)
    filtered.sort((a, b) => {
      // search payloads carry no bookmark counts, so "popular" falls back to
      // newest-first — exactly what the official site does for 人気順 today.
      if (sort === 'date_asc') return time(a.createDate) - time(b.createDate)
      return time(b.createDate) - time(a.createDate)
    })
    return { total: filtered.length, items: filtered.slice(0, 80) }
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
    this.clearBookmarkCache()
  }

  async bookmarkDelete(illustId) {
    const detail = await this.illustDetail(illustId)
    if (!detail.bookmarkId) return
    await this.csrfPost('/illusts/bookmarks/delete', {
      form: { bookmark_id: String(detail.bookmarkId) },
    })
    this.cacheDelete(`detail:${illustId}`)
    this.clearBookmarkCache()
  }

  clearBookmarkCache() {
    for (const key of this.cache.keys()) {
      if (key.startsWith('bl\u0000')) this.cache.delete(key)
    }
  }

  /**
   * One page of the user's own bookmarks (the same ajax the website's
   * bookmark page uses; rest=show includes private ones for the owner).
   * Returns raw mapped items — the client applies R18 / AI / video filters
   * locally so the pagination walk stays consistent. Cached for 5 minutes.
   */
  async bookmarkList({ offset = 0, limit = 48 } = {}) {
    const key = ['bl', offset, limit].join('\u0000')
    const hit = this.cacheGet(key)
    if (hit !== undefined) return hit
    const run = async () => {
      const user = await this.probeUser()
      const payload = await this.webAjax(`/user/${user.userId}/illusts/bookmarks`, {
        params: { tag: '', offset: String(offset), limit: String(limit), rest: 'show', lang: 'zh' },
      })
      const body = payload.body ?? {}
      const items = (body.works ?? [])
        .filter((work) => work && typeof work === 'object')
        .map((work) => ({ ...this.mapProfileIllust(work, work.userName ?? user.name ?? '', work.userId), isBookmarked: true }))
      const result = { total: typeof body.total === 'number' ? body.total : items.length, items }
      this.cacheSet(key, result, BOOKMARK_CACHE_MS, 200)
      return result
    }
    return this.apiLimiter.schedule(run)
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

  /**
   * fetchImage with a small in-memory LRU. pximg URLs are content-addressed
   * (immutable), so repeat fetches — e.g. download/copy right after viewing —
   * come from RAM instead of the CDN. Returns { status, contentType, buffer }.
   */
  async fetchImageCached(pximgUrl, signal) {
    const hit = this.imgMemCache.get(pximgUrl)
    if (hit && hit.at + IMG_MEM_TTL_MS > Date.now()) {
      this.imgMemCache.delete(pximgUrl)
      this.imgMemCache.set(pximgUrl, hit)
      return { status: 200, contentType: hit.contentType, buffer: hit.buffer }
    }
    if (hit) this.imgMemCache.delete(pximgUrl)
    const response = await this.fetchImage(pximgUrl, signal)
    const contentType = response.headers.get('content-type') ?? 'image/jpeg'
    if (!response.ok) return { status: response.status, contentType, buffer: Buffer.alloc(0) }
    const buffer = Buffer.from(await response.arrayBuffer())
    if (buffer.length > 0 && buffer.length <= IMG_MEM_MAX_BYTES) {
      this.imgMemCache.set(pximgUrl, { buffer, contentType, at: Date.now() })
      let bytes = 0
      for (const value of this.imgMemCache.values()) bytes += value.buffer.length
      const iter = this.imgMemCache.keys()
      while (bytes > IMG_MEM_MAX_BYTES) {
        const oldest = iter.next().value
        const removed = this.imgMemCache.get(oldest)
        if (!removed) break
        bytes -= removed.buffer.length
        this.imgMemCache.delete(oldest)
      }
    }
    return { status: 200, contentType, buffer }
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
