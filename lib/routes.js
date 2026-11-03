/**
 * dsh-pixiv-viewer — host HTTP routes under /api/plugins/pixiv-viewer.
 *
 * Wire protocol: `{ ok: true, value }` / `{ ok: false, error: { code, message } }`.
 * Mutating endpoints check same-origin / loopback (the DSH /api trust fence
 * never sees exact+prefix routes registered by plugins, so we enforce it here).
 */

import { Readable } from 'node:stream'
import { isValidPximgUrl } from './pixiv.js'

export const CATEGORIES = Object.freeze({
  genshin: { label: '原神', words: ['原神'] },
  hsr: { label: '崩坏：星穹铁道', words: ['崩坏：星穹铁道', '崩壊：スターレイル'] },
  zzz: { label: '绝区零', words: ['绝区零', 'ゼンレスゾーンゼロ'] },
  tot: { label: '未定事件簿', words: ['未定事件簿', 'Tears of Themis'] },
})

const MAX_BODY = 1 * 1024 * 1024
const PAGE_SIZE = 30

const SORT_MAP = Object.freeze({ date_desc: 'date_d', date_asc: 'date', popular_d: 'popular_d' })

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

/** Accepts a bare authorization code or a pasted callback URL; returns the code or ''. */
function extractAuthCode(raw) {
  if (!/[?&]code=/.test(raw)) return raw.includes('=') ? '' : raw
  try {
    const code = new URL(raw).searchParams.get('code')
    if (code) return code
  } catch {
    // not a valid URL, fall through to regex
  }
  const match = raw.match(/[?&]code=([^&#]+)/)
  return match ? decodeURIComponent(match[1]) : ''
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
          const token = pixiv.store.token
          return ok(res, {
            loggedIn: Boolean(token.refresh_token && token.access_token),
            userName: token.user?.name ?? null,
            proxy: pixiv.resolveProxy(),
            hasCookie: Boolean(pixiv.store.config.phpsessid),
          })
        }

        // ------------------------------------------------------------ login
        if (path === '/login/start' && method === 'POST') {
          return await guard(() => ok(res, { loginUrl: pixiv.startLogin() }))
        }

        if (path === '/login/code' && method === 'POST') {
          return await guard(async () => {
            const body = await readBody(req)
            const raw = typeof body.code === 'string' ? body.code.trim() : ''
            if (raw.length < 10) {
              return fail(res, 400, 'bad_request', '请粘贴完整的回调地址或授权码')
            }
            const code = extractAuthCode(raw)
            if (!code) {
              const isLoginPage = raw.includes('post-redirect') || raw.includes('code_challenge')
              return fail(res, 400, 'bad_request', isLoginPage
                ? '你复制的是登录页本身的地址，登录还没完成。请在登录页完成登录，浏览器会跳转到一个空白页（地址以 app-api.pixiv.net 开头且含 code=），复制那个地址再粘贴。'
                : '未在粘贴内容中找到授权码 code，请粘贴登录完成后跳转的空白页地址（含 code=）')
            }
            const payload = await pixiv.exchangeCode(code)
            await pixiv.applyAccessToken(payload)
            return ok(res, { userName: payload.user?.name ?? null })
          })
        }

        if (path === '/login/token' && method === 'POST') {
          return await guard(async () => {
            const body = await readBody(req)
            const refreshToken = typeof body.refreshToken === 'string' ? body.refreshToken.trim() : ''
            if (!refreshToken) return fail(res, 400, 'bad_request', '请粘贴 refresh_token')
            await pixiv.store.saveToken({ refresh_token: refreshToken, access_token: null, expires_at: 0 })
            const payload = await pixiv.refreshAccessToken()
            return ok(res, { userName: payload.user?.name ?? null })
          })
        }

        if (path === '/logout' && method === 'POST') {
          return await guard(async () => {
            await pixiv.store.clearAuth()
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
              patch.phpsessid = value.length > 0 ? value : null
            }
            await pixiv.store.saveConfig(patch)
            return ok(res, { proxy: pixiv.store.config.proxy, hasCookie: Boolean(pixiv.store.config.phpsessid) })
          })
        }

        // ------------------------------------------------------------ search
        if (path === '/search' && method === 'GET') {
          const word = (requestUrl.searchParams.get('word') ?? '').trim()
          if (!word) return fail(res, 400, 'bad_request', '请输入搜索关键词或标签')
          const r18 = requestUrl.searchParams.get('r18') === '1'
          const sortParam = requestUrl.searchParams.get('sort') ?? 'date_desc'
          const sort = SORT_MAP[sortParam] ?? 'date_desc'
          const page = Math.max(1, Number.parseInt(requestUrl.searchParams.get('page') ?? '1', 10) || 1)
          const hideAi = requestUrl.searchParams.get('hideAi') !== '0'

          if (r18) {
            const items = await pixiv.searchWeb({ word, r18: true, sort, page })
            return ok(res, { items })
          }
          if (sort === 'popular_d') {
            const items = await pixiv.searchWeb({ word, r18: false, sort, page })
            return ok(res, { items })
          }
          const offset = (page - 1) * PAGE_SIZE
          const result = await pixiv.searchAppApi({ word, sort, offset, hideAi })
          const items = result.items.filter((item) => item.xRestrict === 0)
          return ok(res, { items, total: result.total })
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

        // ------------------------------------------------------------ detail
        const detailMatch = path.match(/^\/illust\/(\d+)$/)
        if (detailMatch && method === 'GET') {
          const illust = await pixiv.illustDetail(detailMatch[1])
          if (!illust) return fail(res, 404, 'not_found', '作品不存在或已被删除')
          return ok(res, {
            id: illust.id,
            title: illust.title,
            userName: illust.user?.name ?? '',
            userId: illust.user?.id ?? 0,
            xRestrict: illust.x_restrict ?? 0,
            isBookmarked: illust.is_bookmarked === true,
            totalBookmarks: illust.total_bookmarks ?? 0,
            viewCount: illust.total_view ?? 0,
            createDate: illust.create_date ?? null,
            tags: (illust.tags ?? []).map((tag) => ({ name: tag.name ?? String(tag) })),
            pages: pixiv.viewerPages(illust),
          })
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

          const upstream = await pixiv.fetchImage(target, res.req?.aborted ? undefined : undefined)
          const contentType = upstream.headers.get('content-type') ?? 'image/jpeg'
          const headers = {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=86400',
            'Access-Control-Allow-Origin': '*',
          }
          if (download) {
            headers['Content-Disposition'] = `attachment; filename*=UTF-8''${encodeURIComponent(filename)}.jpg`
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
