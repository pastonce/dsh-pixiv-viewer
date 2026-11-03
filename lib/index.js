/**
 * dsh-pixiv-viewer — host half (Node.js).
 *
 * Owns the pixiv client (session-cookie web-ajax API: search, R-18,
 * bookmarks, image streaming) and exposes it to the Web GUI through
 * HTTP routes under /api/plugins/pixiv-viewer. The browser half lives in
 * lib/client.js and talks to us exclusively over those routes.
 */

import { PixivClient, PixivStore } from './pixiv.js'
import { registerRoutes } from './routes.js'

export const name = 'dsh-pixiv-viewer'
export const inject = []

export async function apply(ctx) {
  const store = new PixivStore()
  await store.load()
  const pixiv = new PixivClient({ store, log: ctx.logger })

  // `webServer` is provided by the Web composition; on a headless host the
  // plugin stays loaded but serves nothing (browser half has no page either).
  ctx.inject(['webServer'], (webCtx) => {
    webCtx.effect(() => registerRoutes(webCtx.webServer, pixiv), 'dsh-pixiv-viewer: http routes')
  })
}
