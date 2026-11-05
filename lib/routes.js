/**
 * dsh-pixiv-viewer — host HTTP routes under /api/plugins/pixiv-viewer.
 *
 * Wire protocol: `{ ok: true, value }` / `{ ok: false, error: { code, message } }`.
 * Mutating endpoints check same-origin / loopback (the DSH /api trust fence
 * never sees exact+prefix routes registered by plugins, so we enforce it here).
 */

import { Readable } from 'node:stream'
import { ApiError, isValidPximgUrl } from './pixiv.js'

export const CATEGORIES = Object.freeze({
  genshin: { label: '原神', words: ['原神'] },
  hsr: { label: '崩坏：星穹铁道', words: ['崩坏：星穹铁道', '崩壊：スターレイル'] },
  zzz: { label: '绝区零', words: ['绝区零', 'ゼンレスゾーンゼロ'] },
  tot: { label: '未定事件簿', words: ['未定事件簿', 'Tears of Themis'] },
})

const MAX_BODY = 1 * 1024 * 1024

const SORT_MAP = Object.freeze({ date_desc: 'date_d', date_asc: 'date', popular_d: 'popular_d' })
const TIERS = Object.freeze(['', '100users入り', '500users入り', '1000users入り', '3000users入り', '5000users入り', '10000users入り'])
const COOKIE_RE = /^[A-Za-z0-9_-]{20,128}$/

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload)
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(body)
}

const ok = (res, value) => sendJson(res, 200, { ok: true, value })
const fail = (res, status, code, message) => sendJson(res, status, { ok: false, error: { code, message } })

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY) {
        reject(new Error('body too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      try {
        resolve(chunks.length === 0 ? {} : JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        reject(new Error('bad json'))
      }
    })
    req.on('error', reject)
  })
}

/** Loopback + same-origin only, mirroring the /api fence semantics. */
function isTrustedMutation(req) {
  const host = String(req.headers.host ?? '')
  const origin = req.headers.origin
  const fetchSite = String(req.headers['sec-fetch-site'] ?? '')
  if (fetchSite === 'cross-site') return false
  if (origin === 'null') return false
  const isLoopback = /^(127\.\d+\.\d+\.\d+|\[::1\]|localhost)(:\d+)?$/i.test(host)
  if (!isLoopback) return false
  if (!origin) return true
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

function sanitizeFilename(name) {
  const clean = String(name ?? '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(0, 120)
  return clean || 'pixiv_image'
}

export function registerRoutes(webServer, pixiv) {
  const route = {
    kind: 'prefix',
    path: '/api/plugins/pixiv-viewer',
    handler: async (req, res) => {
      const requestUrl = new URL(req.url, 'http://127.0.0.1')
      const path = requestUrl.pathname.replace(/^\/api\/plugins\/pixiv-viewer/, '') || '/'
      const method = req.method ?? 'GET'

      const guard = (fn) => {
        if (!isTrustedMutation(req)) return fail(res, 403, 'forbidden', '跨站请求被拒绝')
        return fn()
      }

      try {
        // ------------------------------------------------------------ status
        if (path === '/status' && method === 'GET') {
          const hasCookie = Boolean(pixiv.store.config.phpsessid)
          let loggedIn = hasCookie
          let userName = null
          if (hasCookie) {
            try {
              userName = (await pixiv.probeUser())?.name ?? null
            } catch (error) {
              // an expired cookie is a real "signed out"; network hiccups are not
              if (error instanceof ApiError && error.code === 'cookie_expired') loggedIn = false
            }
          }
          return ok(res, {
            loggedIn,
            userName,
            proxy: pixiv.resolveProxy(),
            hasCookie,
          })
        }

        // ------------------------------------------------------------ login
        if (path === '/login/session' && method === 'POST') {
          return await guard(async () => {
            const body = await readBody(req)
            const value = typeof body.phpsessid === 'string' ? body.phpsessid.trim() : ''
            if (!COOKIE_RE.test(value)) {
              return fail(res, 400, 'bad_request', '请输入有效的 PHPSESSID（浏览器 F12 → 应用/Application → Cookie → www.pixiv.net → 复制 PHPSESSID 的值）')
            }
            let user
            try {
              user = await pixiv.probeUser(value)
            } catch (error) {
              if (error instanceof ApiError && error.code === 'cookie_expired') {
                return fail(res, 401, 'cookie_expired', error.message)
              }
              throw error
            }
            await pixiv.store.saveConfig({ phpsessid: value })
            pixiv.clearSessionCache()
            return ok(res, { userName: user.name })
          })
        }

        if (path === '/logout' && method === 'POST') {
          return await guard(async () => {
            await pixiv.store.clearAuth()
            pixiv.clearSessionCache()
            return ok(res, {})
          })
        }

        // ------------------------------------------------------------ config
        if (path === '/config' && method === 'GET') {
          return ok(res, { proxy: pixiv.store.config.proxy, hasCookie: Boolean(pixiv.store.config.phpsessid) })
        }

        if (path === '/config' && method === 'POST') {
          return await guard(async () => {
            const body = await readBody(req)
            const patch = {}
            let cookieChanged = false
            if ('proxy' in body) {
              const proxy = typeof body.proxy === 'string' && body.proxy.trim() ? body.proxy.trim() : null
              if (proxy) {
                try {
                  const parsed = new URL(proxy)
                  if (!/^https?:$/.test(parsed.protocol)) throw new Error('protocol')
                } catch {
                  return fail(res, 400, 'bad_request', '代理地址格式无效（示例：http://127.0.0.1:7890）')
                }
              }
              patch.proxy = proxy
            }
            if ('phpsessid' in body) {
              const value = typeof body.phpsessid === 'string' ? body.phpsessid.trim() : ''
              if (value && !COOKIE_RE.test(value)) {
                return fail(res, 400, 'bad_request', 'PHPSESSID 格式无效，请粘贴完整的 Cookie 值')
              }
              patch.phpsessid = value.length > 0 ? value : null
              cookieChanged = (pixiv.store.config.phpsessid ?? null) !== (patch.phpsessid ?? null)
            }
            await pixiv.store.saveConfig(patch)
            if (cookieChanged) pixiv.clearSessionCache()
            return ok(res, { proxy: pixiv.store.config.proxy, hasCookie: Boolean(pixiv.store.config.phpsessid) })
          })
        }

        // ------------------------------------------------------------ search
        if (path === '/search' && method === 'GET') {
          const word = (requestUrl.searchParams.get('word') ?? '').trim()
          if (!word) return fail(res, 400, 'bad_request', '请输入搜索关键词或标签')
          const type = ['tag', 'title', 'user', 'pid'].includes(requestUrl.searchParams.get('type') ?? '') ? requestUrl.searchParams.get('type') : 'tag'
          const r18 = requestUrl.searchParams.get('r18') === '1'
          const sort = SORT_MAP[requestUrl.searchParams.get('sort') ?? ''] ?? 'date_d'
          const page = Math.min(Math.max(1, Number.parseInt(requestUrl.searchParams.get('page') ?? '1', 10) || 1), 60)
          const hideAi = requestUrl.searchParams.get('hideAi') !== '0'
          const tier = TIERS.includes(requestUrl.searchParams.get('tier') ?? '') ? requestUrl.searchParams.get('tier') : ''

          if (type === 'pid') {
            if (!/^\d{4,12}$/.test(word)) return fail(res, 400, 'bad_request', '请输入数字作品 ID')
            const result = await pixiv.searchPid(word)
            return ok(res, { ...result, paginated: false })
          }
          if (type === 'user') {
            const result = /^\d{4,12}$/.test(word)
              ? await pixiv.userWorks(word, { hideAi })
              : await pixiv.searchUserByName(word, { hideAi })
            return ok(res, { ...result, paginated: false })
          }

          const sMode = type === 'title' ? 's_tc' : undefined
          const tokens = word.split(/\s+/)
          const isComplex = /[|｜+＋]/.test(word) || tokens.some((token) => token.startsWith('-'))
          const result = isComplex
            ? await pixiv.searchComplex({ query: word, r18, sort, hideAi, tier, sMode })
            : await pixiv.searchWeb({ word: tier ? `${word} ${tier}`.trim() : word, r18, sort, page, hideAi, sMode })
          return ok(res, { ...result, paginated: !isComplex })
        }

        if (path === '/category' && method === 'GET') {
          const key = requestUrl.searchParams.get('key') ?? ''
          const category = CATEGORIES[key]
          if (!category) return fail(res, 400, 'bad_request', '未知分类')
          const r18 = requestUrl.searchParams.get('r18') === '1'
          const hideAi = requestUrl.searchParams.get('hideAi') !== '0'
          const result = await pixiv.searchCategory({ words: category.words, r18, hideAi })
          return ok(res, result)
        }

        if (path === '/daily' && method === 'GET') {
          const r18 = requestUrl.searchParams.get('r18') === '1'
          const hideAi = requestUrl.searchParams.get('hideAi') !== '0'
          const result = await pixiv.searchDaily({ r18, hideAi })
          return ok(res, result)
        }

        // ------------------------------------------------------------ detail
        const detailMatch = path.match(/^\/illust\/(\d+)$/)
        if (detailMatch && method === 'GET') {
          const detail = await pixiv.illustDetail(detailMatch[1])
          return ok(res, detail)
        }

        // ------------------------------------------------------------ bookmark
        if (path === '/bookmark' && method === 'POST') {
          return await guard(async () => {
            const body = await readBody(req)
            const illustId = Number.parseInt(body.illustId, 10)
            if (!Number.isFinite(illustId) || illustId <= 0) return fail(res, 400, 'bad_request', '无效的作品 ID')
            const restrict = body.restrict === 'private' ? 'private' : 'public'
            await pixiv.bookmarkAdd(illustId, restrict)
            return ok(res, { bookmarked: true })
          })
        }

        const unbookmarkMatch = path.match(/^\/bookmark\/(\d+)$/)
        if (unbookmarkMatch && method === 'DELETE') {
          return await guard(async () => {
            await pixiv.bookmarkDelete(Number.parseInt(unbookmarkMatch[1], 10))
            return ok(res, { bookmarked: false })
          })
        }

        // ------------------------------------------------------------ image proxy
        if (path === '/img' && method === 'GET') {
          const target = requestUrl.searchParams.get('url') ?? ''
          if (!isValidPximgUrl(target)) return fail(res, 400, 'bad_request', '无效的图片地址')
          const download = requestUrl.searchParams.get('dl') === '1'
          const filename = sanitizeFilename(requestUrl.searchParams.get('filename') ?? '')

          const upstream = await pixiv.fetchImage(target)
          const contentType = upstream.headers.get('content-type') ?? 'image/jpeg'
          const headers = {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=86400',
            'Access-Control-Allow-Origin': '*',
          }
          if (download) {
            const ext = (target.match(/\.(png|gif|jpe?g|webp|bmp|avif)(?:\?|$)/i)?.[1] ?? 'jpg').toLowerCase().replace('jpeg', 'jpg')
            headers['Content-Disposition'] = `attachment; filename*=UTF-8''${encodeURIComponent(filename)}.${ext}`
          }
          if (upstream.status === 404 || upstream.status === 403) {
            return fail(res, upstream.status, 'not_found', '图片不存在或无权访问')
          }
          res.writeHead(upstream.status, headers)
          const stream = Readable.fromWeb(upstream.body)
          stream.on('error', () => res.destroy())
          req.on('close', () => stream.destroy())
          stream.pipe(res)
          return
        }

        return fail(res, 404, 'not_found', `未知接口: ${method} ${path}`)
      } catch (error) {
        const code = error.code && typeof error.code === 'string' ? error.code : 'internal'
        const message = error.message && typeof error.message === 'string' ? error.message : '服务器内部错误'
        const status = typeof error.status === 'number' && error.status > 0 ? error.status : 500
        if (status >= 500) pixiv.log.warn(`[pixiv-viewer] ${method} ${path} -> ${code}: ${message}`)
        return fail(res, status, code, message)
      }
    },
  }
  return webServer.register(route)
}
