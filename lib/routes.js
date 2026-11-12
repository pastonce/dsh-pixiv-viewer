/**
 * dsh-pixiv-viewer — host HTTP routes under /api/plugins/pixiv-viewer.
 *
 * Wire protocol: `{ ok: true, value }` / `{ ok: false, error: { code, message } }`.
 * Mutating endpoints check same-origin / loopback (the DSH /api trust fence
 * never sees exact+prefix routes registered by plugins, so we enforce it here).
 */

import { execFile } from 'node:child_process'
import { writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { ApiError, isValidPximgUrl } from './pixiv.js'

const execFileAsync = promisify(execFile)

export const CATEGORIES = Object.freeze({
  genshin: { label: '原神', words: ['原神'] },
  hsr: { label: '崩坏：星穹铁道', words: ['崩坏：星穹铁道', '崩壊：スターレイル'] },
  zzz: { label: '绝区零', words: ['绝区零', 'ゼンレスゾーンゼロ'] },
  tot: { label: '未定事件簿', words: ['未定事件簿', 'Tears of Themis'] },
})

const MAX_BODY = 1 * 1024 * 1024

const SORT_MAP = Object.freeze({ date_desc: 'date_d', date_asc: 'date', popular_d: 'popular_d' })
const TIERS = Object.freeze(['', '100users入り', '500users入り', '1000users入り', '3000users入り', '5000users入り', '10000users入り'])
const TIER_MIN = Object.freeze({ '100users入り': 100, '500users入り': 500, '1000users入り': 1000, '3000users入り': 3000, '5000users入り': 5000, '10000users入り': 10000 })
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

/** Reads a raw (non-JSON) body up to `maxBytes`. */
function readRawBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > maxBytes) {
        reject(new Error('body too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
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
          const hideAi = requestUrl.searchParams.get('hideAi') !== '0'
          const tier = TIERS.includes(requestUrl.searchParams.get('tier') ?? '') ? requestUrl.searchParams.get('tier') : ''
          const tierMin = TIER_MIN[tier] ?? null
          // all paged searches treat page as a raw-page cursor (each request
          // may walk several raw pages), so deep cursors are legitimate
          const pageMax = 1000
          const page = Math.min(Math.max(1, Number.parseInt(requestUrl.searchParams.get('page') ?? '1', 10) || 1), pageMax)
          const category = CATEGORIES[requestUrl.searchParams.get('cat') ?? ''] ?? null

          if (type === 'pid') {
            if (!/^\d{4,12}$/.test(word)) return fail(res, 400, 'bad_request', '请输入数字作品 ID')
            const result = await pixiv.searchPid(word)
            return ok(res, { ...result, paginated: false })
          }
          if (type === 'user') {
            const result = /^\d{4,12}$/.test(word)
              ? await pixiv.userWorks(word, { hideAi })
              : await pixiv.searchUserByName(word, { hideAi })
            // the user-works payload carries real bookmark counts, so the
            // tier filter is applied locally
            if (tierMin) {
              const items = result.items.filter((item) => (item.totalBookmarks ?? 0) >= tierMin)
              return ok(res, { ...result, total: items.length, items, paginated: false })
            }
            return ok(res, { ...result, paginated: false })
          }

          // an active category is ANDed into tag / title searches
          const catWord = category?.words[0] ?? ''
          const sMode = type === 'title' ? 's_tc' : undefined
          // operators (| - +) only count as standalone tokens — a symbol
          // attached to a word is part of the tag name ("R-18", "C++")
          const norm = word.replace(/｜/g, '|').replace(/＋/g, '+').replace(/－/g, '-')
          const isComplex = norm.split(/\s+/).some((token) => token === '|' || token === '-')
          if (isComplex) {
            const result = await pixiv.searchComplex({ query: norm, r18, sort, hideAi, minBookmarks: tierMin, sMode, extra: catWord })
            return ok(res, { ...result, paginated: false })
          }
          // a standalone + is plain AND (pixiv's default) — drop it
          const clean = norm.split(/\s+/).filter((token) => token !== '+').join(' ')
          const term = [catWord, clean].filter(Boolean).join(' ')
          // the tier floor is matched by substring against each work's own
          // tags ("原神1000users入り" satisfies the 1000users入り tier); no detail traffic
          const result = tierMin
            ? await pixiv.searchTiered({ word: term, r18, sort, page, hideAi, sMode, minBookmarks: tierMin })
            : await pixiv.searchPaged({ word: term, r18, sort, page, hideAi, sMode })
          return ok(res, { ...result, paginated: true })
        }

        if (path === '/category' && method === 'GET') {
          const key = requestUrl.searchParams.get('key') ?? ''
          const category = CATEGORIES[key]
          if (!category) return fail(res, 400, 'bad_request', '未知分类')
          const r18 = requestUrl.searchParams.get('r18') === '1'
          const hideAi = requestUrl.searchParams.get('hideAi') !== '0'
          const page = Math.min(Math.max(1, Number.parseInt(requestUrl.searchParams.get('page') ?? '1', 10) || 1), 1000)
          const tier = TIERS.includes(requestUrl.searchParams.get('tier') ?? '') ? requestUrl.searchParams.get('tier') : ''
          const result = await pixiv.searchCategory({ words: category.words, r18, hideAi, page, minBookmarks: TIER_MIN[tier] ?? null })
          return ok(res, { ...result, paginated: true })
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

        // one page of the user's own bookmarks; the client walks pages itself
        // (progress per page) and applies R18 / AI / video filters locally
        if (path === '/bookmarks' && method === 'GET') {
          const offset = Math.max(0, Number.parseInt(requestUrl.searchParams.get('offset') ?? '0', 10) || 0)
          const result = await pixiv.bookmarkList({ offset, limit: 48 })
          return ok(res, result)
        }

        // ------------------------------------------------------------ image proxy
        if (path === '/img' && method === 'GET') {
          const target = requestUrl.searchParams.get('url') ?? ''
          if (!isValidPximgUrl(target)) return fail(res, 400, 'bad_request', '无效的图片地址')
          const download = requestUrl.searchParams.get('dl') === '1'
          const filename = sanitizeFilename(requestUrl.searchParams.get('filename') ?? '')

          const upstream = await pixiv.fetchImageCached(target)
          const headers = {
            'Content-Type': upstream.contentType,
            // pximg URLs are content-addressed, so browser-side caching for a
            // week avoids re-proxying the same thumbnails/large images
            'Cache-Control': 'public, max-age=604800',
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
          res.end(upstream.buffer)
          return
        }

        // ------------------------------------------------------------ clipboard
        // The webview's clipboard APIs are unreliable for images (the async
        // API is permission-gated, execCommand silently writes text-only), so
        // the client falls back to this route: the host writes the Windows
        // clipboard directly via PowerShell. Body is a PNG blob.
        if (path === '/copy' && method === 'POST') {
          return await guard(async () => {
            if (process.platform !== 'win32') return fail(res, 501, 'unsupported', '剪贴板回退仅支持 Windows')
            const body = await readRawBody(req, 64 * 1024 * 1024)
            const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
            if (body.length < PNG_MAGIC.length || !PNG_MAGIC.equals(body.subarray(0, PNG_MAGIC.length))) {
              return fail(res, 400, 'bad_request', '剪贴板回退仅接受 PNG 图片')
            }
            const file = join(tmpdir(), `pixiv-viewer-copy-${Date.now()}-${Math.random().toString(36).slice(2)}.png`)
            try {
              await writeFile(file, body)
              // System.Drawing (GDI+) sniffs the format itself; powershell.exe
              // runs STA so the WinForms clipboard works
              const psPath = file.replace(/'/g, "''")
              const script = [
                'Add-Type -AssemblyName System.Windows.Forms',
                'Add-Type -AssemblyName System.Drawing',
                `$img = [System.Drawing.Image]::FromFile('${psPath}')`,
                '$ok = $false',
                'for ($i = 0; $i -lt 5 -and -not $ok; $i++) {',
                // try/catch must stay one statement — a `;` between `}` and
                // `catch` is a PowerShell parse error
                '  try { [System.Windows.Forms.Clipboard]::SetImage($img); $ok = $true } catch { Start-Sleep -Milliseconds 150 }',
                '}',
                '$img.Dispose()',
                'if (-not $ok) { exit 1 }',
              ].join('; ')
              try {
                await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-STA', '-Command', script], { timeout: 15000, windowsHide: true })
              } catch (error) {
                const detail = String(error?.stderr || error?.message || error).split('\n')[0].slice(0, 120)
                return fail(res, 500, 'clipboard', `写入剪贴板失败: ${detail}`)
              }
              return ok(res, { copied: true })
            } finally {
              rm(file, { force: true }).catch(() => {})
            }
          })
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
