/**
 * dsh-pixiv-viewer — client half (browser bundle).
 *
 * A self-registering lazy CJS factory picked up by `window.__ModuleLoader__`
 * in the browser. Contributes one row to `sidebar.panellist` and one keyed
 * entry to the `main` slot; all pixiv traffic goes through the host half's
 * HTTP routes at /api/plugins/pixiv-viewer (search, category, bookmark,
 * login, image proxy) — the browser never talks to pixiv directly, so the
 * Referer header and the API rate limits live on the host side.
 *
 * UI language: Chinese by default, English fallback; the two dictionaries
 * must stay key-symmetric (a missing key renders the raw key, silently).
 */

window.__ModuleLoader__.load({
  id: 'dsh-pixiv-viewer',

  factory(require) {
    const React = require('react')
    const h = React.createElement

    const VERSION = '0.1.0'
    const PANEL_ID = 'pixiv-viewer'
    const BASE = '/api/plugins/pixiv-viewer'
    const STYLE_ID = 'dsh-pixiv-viewer-css'
    const PREFS_KEY = 'dsh-pixiv-viewer/prefs'

    // ------------------------------------------------------------------ i18n

    const zh = {
      'panel': 'Pixiv 看图',
      'title': 'Pixiv 看图',
      'login': '登录 pixiv',
      'loggedInAs': '已登录：{name}',
      'logout': '退出登录',
      'settings': '设置',
      'all': '全部',
      'searchPlaceholder': '搜索作品 / 标签，回车确认',
      'filterPlaceholder': '在当前结果中筛选标题 / 标签 / 画师',
      'search': '搜索',
      'r18': 'R18',
      'hideAi': '隐藏 AI 作品',
      'sort.date_desc': '最新',
      'sort.date_asc': '最旧',
      'sort.popular_d': '热门',
      'prevPage': '上一页',
      'nextPage': '下一页',
      'pageOf': '第 {page} 页',
      'totalItems': '共 {n} 件作品',
      'empty.prompt': '选择一个分类，或输入关键词搜索',
      'empty.none': '没有找到作品，换个关键词试试',
      'loading': '加载中…',
      'retry': '重试',
      'notLoggedIn': '尚未登录，部分功能不可用',
      'login.title': '登录 Pixiv',
      'login.hint': '点击下方按钮打开 pixiv 登录页（支持代理环境）。在登录页完成登录后，复制最终跳转页的整段地址粘贴到下方：含 code= 的空白页地址，或停在 accounts.pixiv.net/post-redirect 时粘贴该地址（插件会自动继续跳转）。',
      'login.follow': '已打开登录流程的下一步页面（新标签页）。请在新页面继续：它会自动跳转几次，最终停在的空白页地址含 code= 时，把整段地址复制回来粘贴。',
      'login.openManual': '没有自动打开？点此手动打开',
      'login.open': '打开 Pixiv 登录页',
      'login.codePlaceholder': '粘贴回调地址（含 code=…）',
      'login.codeSubmit': '用授权码登录',
      'login.or': '或者',
      'login.tokenPlaceholder': '粘贴 refresh_token',
      'login.tokenSubmit': '用 refresh_token 登录',
      'login.success': '登录成功',
      'settings.title': '设置',
      'settings.proxy': '代理地址（pixiv 需要，例如 http://127.0.0.1:7890）',
      'settings.proxyPlaceholder': 'http://127.0.0.1:7890',
      'settings.cookie': 'PHPSESSID（仅 R18 与热门排序需要；浏览器登录 pixiv.net 后从 Cookie 中复制）',
      'settings.cookiePlaceholder': 'PHPSESSID 值',
      'settings.save': '保存',
      'settings.saved': '已保存',
      'settings.needCookie': 'R18 / 热门排序需要先配置 PHPSESSID',
      'bookmark.add': '收藏',
      'bookmark.remove': '取消收藏',
      'bookmark.failed': '收藏操作失败',
      'save': '保存图片',
      'viewer.pages': '{page} / {pages}',
      'viewer.bookmarks': '{n} 收藏',
      'viewer.views': '{n} 浏览',
      'close': '关闭',
      'auth.required': '请先登录 pixiv 账号',
      'rate.limited': '请求过于频繁，请稍候再试',
      'cookie.expired': 'PHPSESSID 已失效，请在设置中更新',
      'cookie.required': 'R18 / 热门排序需要 PHPSESSID，请在设置中配置',
      'network.error': '网络错误：无法访问 pixiv（可能需要配置代理）',
      'token.expired': '登录已过期，请重新登录',
      'cat.genshin': '原神',
      'cat.hsr': '星穹铁道',
      'cat.zzz': '绝区零',
      'cat.tot': '未定事件簿',
    }

    const en = {
      'panel': 'Pixiv Viewer',
      'title': 'Pixiv Viewer',
      'login': 'Sign in to pixiv',
      'loggedInAs': 'Signed in as {name}',
      'logout': 'Sign out',
      'settings': 'Settings',
      'all': 'All',
      'searchPlaceholder': 'Search artworks / tags, press Enter',
      'filterPlaceholder': 'Filter current results by title / tag / artist',
      'search': 'Search',
      'r18': 'R18',
      'hideAi': 'Hide AI works',
      'sort.date_desc': 'Newest',
      'sort.date_asc': 'Oldest',
      'sort.popular_d': 'Popular',
      'prevPage': 'Previous',
      'nextPage': 'Next',
      'pageOf': 'Page {page}',
      'totalItems': '{n} works',
      'empty.prompt': 'Pick a category or type a keyword to search',
      'empty.none': 'No works found, try another keyword',
      'loading': 'Loading…',
      'retry': 'Retry',
      'notLoggedIn': 'Not signed in, some features are unavailable',
      'login.title': 'Sign in to Pixiv',
      'login.hint': 'Click the button below to open the pixiv sign-in page (proxies work too). After signing in, copy the whole URL of the final page into the box below — either a blank-page URL containing code=, or an accounts.pixiv.net/post-redirect URL and the plugin will continue the redirects for you.',
      'login.follow': 'Opened the next step of the login flow in a new tab. Continue there — it will redirect on its own. When it stops on a blank page whose URL contains code=, copy the whole URL back here.',
      'login.openManual': 'Didn\'t open? Open it manually',
      'login.open': 'Open pixiv sign-in page',
      'login.codePlaceholder': 'Paste the callback URL (contains code=…)',
      'login.codeSubmit': 'Sign in with code',
      'login.or': 'or',
      'login.tokenPlaceholder': 'Paste refresh_token',
      'login.tokenSubmit': 'Sign in with refresh_token',
      'login.success': 'Signed in',
      'settings.title': 'Settings',
      'settings.proxy': 'Proxy URL (required for pixiv, e.g. http://127.0.0.1:7890)',
      'settings.proxyPlaceholder': 'http://127.0.0.1:7890',
      'settings.cookie': 'PHPSESSID (needed only for R18 / popular sort; copy from cookies after signing in to pixiv.net)',
      'settings.cookiePlaceholder': 'PHPSESSID value',
      'settings.save': 'Save',
      'settings.saved': 'Saved',
      'settings.needCookie': 'R18 / popular sort requires a PHPSESSID first',
      'bookmark.add': 'Bookmark',
      'bookmark.remove': 'Unbookmark',
      'bookmark.failed': 'Bookmark failed',
      'save': 'Save image',
      'viewer.pages': '{page} / {pages}',
      'viewer.bookmarks': '{n} bookmarks',
      'viewer.views': '{n} views',
      'close': 'Close',
      'auth.required': 'Please sign in to pixiv first',
      'rate.limited': 'Too many requests, please wait a moment',
      'cookie.expired': 'PHPSESSID expired, update it in Settings',
      'cookie.required': 'R18 / popular sort requires a PHPSESSID, configure it in Settings',
      'network.error': 'Network error: cannot reach pixiv (a proxy may be needed)',
      'token.expired': 'Session expired, please sign in again',
      'cat.genshin': 'Genshin',
      'cat.hsr': 'Star Rail',
      'cat.zzz': 'Zenless',
      'cat.tot': 'Themis',
    }

    function language() {
      try {
        const tag = String(document.documentElement.lang || navigator.language || '')
        return tag.toLowerCase().startsWith('zh') ? 'zh' : 'en'
      } catch {
        return 'zh'
      }
    }

    function makeT() {
      return function t(key) {
        const dict = language() === 'zh' ? zh : en
        return dict[key] ?? key
      }
    }

    function fmt(t, template, values) {
      return template.replace(/\{(\w+)\}/g, (_, name) => (values[name] ?? `{${name}}`))
    }

    function fmtCount(n) {
      if (typeof n !== 'number' || !Number.isFinite(n)) return '0'
      if (n >= 10000) return `${(n / 10000).toFixed(1)}${language() === 'zh' ? '万' : 'k'}`
      return String(n)
    }

    function fmtDate(value) {
      if (!value) return ''
      const date = new Date(value)
      if (Number.isNaN(date.getTime())) return ''
      const pad = (v) => String(v).padStart(2, '0')
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    }

    // ------------------------------------------------------------------ css

    const CSS = `
/* ── 面板根 ─────────────────────────────────────────────────────────── */
.pv-root{
  position:relative;
  display:flex;
  flex-direction:column;
  height:100%;
  min-height:0;
  padding:14px 18px 12px;
  box-sizing:border-box;
  gap:10px;
  color:var(--dsw-alias-label-primary);
  overflow:hidden;
}
.pv-topbar{display:flex;align-items:center;gap:10px;flex:none}
.pv-title{font-size:16px;font-weight:600;line-height:22px;margin:0}
.pv-ver{color:var(--dsw-alias-label-tertiary);font-size:10px;font-weight:400;letter-spacing:.02em}
.pv-spacer{flex:1}
.pv-chip{
  display:inline-flex;align-items:center;gap:6px;height:26px;padding:0 10px;
  border:.5px solid var(--dsw-alias-border-l2);border-radius:999px;
  background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);
  font-size:12px;line-height:1;white-space:nowrap;box-sizing:border-box;
}
.pv-chip .pv-dot{width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-state-idle-primary)}
.pv-chip.pv-on .pv-dot{background:var(--dsw-alias-state-success-primary)}

/* ── 工具条 ─────────────────────────────────────────────────────────── */
.pv-toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;flex:none}
.pv-cats{display:flex;gap:4px}
.pv-cat{
  height:28px;padding:0 12px;border:.5px solid var(--dsw-alias-border-l1);
  border-radius:var(--dsw-radius-sm);background:transparent;
  color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;line-height:1;
  cursor:pointer;white-space:nowrap;box-sizing:border-box;
}
.pv-cat:hover{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l2)}
.pv-cat.pv-on{
  color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l3);
  background:var(--dsw-alias-bg-layer-2);
}
.pv-input{
  flex:1;min-width:160px;height:28px;padding:0 10px;
  border:.5px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-sm);
  background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);
  font:inherit;font-size:12px;line-height:1;box-sizing:border-box;outline:none;
}
.pv-input::placeholder{color:var(--dsw-alias-label-tertiary)}
.pv-input:focus{border-color:var(--dsw-alias-border-l3)}
.pv-select{
  height:28px;padding:0 8px;border:.5px solid var(--dsw-alias-border-l1);
  border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-bg-layer-1);
  color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;cursor:pointer;
  box-sizing:border-box;outline:none;
}
.pv-switch-row{display:inline-flex;align-items:center;gap:6px;cursor:pointer;user-select:none}
.pv-switch-label{font-size:12px;color:var(--dsw-alias-label-secondary)}
.pv-switch{
  position:relative;width:30px;height:18px;border:.5px solid var(--dsw-alias-border-l2);
  border-radius:999px;background:transparent;box-sizing:border-box;
}
.pv-switch:after{
  content:"";position:absolute;top:2px;left:2px;width:12px;height:12px;border-radius:50%;
  background:var(--dsw-alias-label-tertiary);
  transition:transform .12s ease, background-color .12s ease;
}
.pv-switch.pv-on{border-color:var(--dsw-alias-brand-primary);background:color-mix(in srgb, var(--dsw-alias-brand-primary) 18%, transparent)}
.pv-switch.pv-on:after{transform:translateX(12px);background:var(--dsw-alias-brand-primary)}

/* ── 提示横幅 ───────────────────────────────────────────────────────── */
.pv-banner{
  flex:none;display:flex;align-items:center;gap:8px;padding:7px 12px;
  border:.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-sm);
  background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);
  font-size:12px;line-height:18px;box-sizing:border-box;
}
.pv-banner.pv-warn{border-color:var(--dsw-alias-state-warn-primary);color:var(--dsw-alias-label-primary)}
.pv-banner .pv-link{
  border:none;background:none;color:var(--dsw-alias-state-business-primary);
  font:inherit;font-size:12px;cursor:pointer;padding:0;
}
.pv-banner .pv-link:hover{text-decoration:underline}

/* ── 内容区与网格 ───────────────────────────────────────────────────── */
.pv-body{flex:1;min-height:0;overflow-y:auto;position:relative}
.pv-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;padding-bottom:8px}
.pv-card{
  position:relative;display:flex;flex-direction:column;gap:6px;min-width:0;
  border:.5px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-md);
  background:var(--dsw-alias-bg-layer-1);overflow:hidden;cursor:pointer;
}
.pv-card:hover{border-color:var(--dsw-alias-border-l2);box-shadow:var(--dsw-elevation-soft)}
.pv-thumb{width:100%;aspect-ratio:1/1;object-fit:cover;display:block;background:var(--dsw-alias-bg-layer-2)}
.pv-card-meta{padding:0 8px 8px;display:flex;flex-direction:column;gap:4px;min-width:0}
.pv-card-title{
  font-size:12px;line-height:16px;color:var(--dsw-alias-label-primary);
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
}
.pv-card-sub{
  display:flex;align-items:center;justify-content:space-between;gap:6px;
  font-size:11px;line-height:14px;color:var(--dsw-alias-label-tertiary);
  white-space:nowrap;overflow:hidden;
}
.pv-card-sub .pv-user{overflow:hidden;text-overflow:ellipsis;min-width:0}
.pv-card-actions{
  position:absolute;top:6px;right:6px;display:flex;gap:4px;opacity:0;
  transition:opacity .12s ease;
}
.pv-card:hover .pv-card-actions,.pv-card:focus-within .pv-card-actions{opacity:1}
.pv-icon-btn{
  display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;
  border:none;border-radius:var(--dsw-radius-sm);cursor:pointer;padding:0;
  background:rgba(0,0,0,.55);color:#fff;box-sizing:border-box;
}
.pv-icon-btn:hover{background:rgba(0,0,0,.75)}
.pv-icon-btn.pv-bookmarked{background:var(--dsw-alias-state-business-primary)}
.pv-page-tag{
  position:absolute;left:6px;top:6px;height:18px;padding:0 6px;display:inline-flex;
  align-items:center;border-radius:4px;background:rgba(0,0,0,.55);color:#fff;
  font-size:10px;line-height:1;
}
.pv-r18-tag{
  position:absolute;left:6px;bottom:6px;height:16px;padding:0 5px;display:inline-flex;
  align-items:center;border-radius:4px;background:rgba(180,60,60,.85);color:#fff;
  font-size:10px;line-height:1;
}

/* ── 空态 / 加载 / 错误 ─────────────────────────────────────────────── */
.pv-state{
  position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;
  justify-content:center;gap:10px;color:var(--dsw-alias-label-tertiary);font-size:13px;
}
.pv-spinner{
  width:22px;height:22px;border-radius:50%;
  border:2px solid var(--dsw-alias-border-l2);border-top-color:var(--dsw-alias-brand-primary);
  animation:pv-spin .8s linear infinite;
}
@keyframes pv-spin{to{transform:rotate(360deg)}}
.pv-error{color:var(--dsw-alias-state-error-primary)}

/* ── 分页 ───────────────────────────────────────────────────────────── */
.pv-pager{flex:none;display:flex;align-items:center;justify-content:center;gap:10px;padding:2px 0}
.pv-pager-btn{
  height:26px;padding:0 12px;border:.5px solid var(--dsw-alias-border-l1);
  border-radius:var(--dsw-radius-sm);background:transparent;color:var(--dsw-alias-label-secondary);
  font:inherit;font-size:12px;cursor:pointer;
}
.pv-pager-btn:hover:not(:disabled){color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l2)}
.pv-pager-btn:disabled{opacity:.4;cursor:default}
.pv-pager-info{font-size:12px;color:var(--dsw-alias-label-tertiary)}

/* ── 通用按钮 ───────────────────────────────────────────────────────── */
.pv-btn{
  display:inline-flex;align-items:center;justify-content:center;gap:6px;height:28px;
  padding:0 14px;border:.5px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-sm);
  background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;
  line-height:1;cursor:pointer;box-sizing:border-box;white-space:nowrap;
}
.pv-btn:hover{border-color:var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1)}
.pv-btn.pv-primary{background:var(--dsw-alias-brand-primary);border-color:transparent;color:#fff}
.pv-btn.pv-primary:hover{background:color-mix(in srgb, var(--dsw-alias-brand-primary) 88%, #000)}
.pv-btn:disabled{opacity:.45;cursor:default}
.pv-btn:focus-visible,.pv-cat:focus-visible,.pv-input:focus-visible,.pv-select:focus-visible,
.pv-icon-btn:focus-visible,.pv-pager-btn:focus-visible,.pv-banner .pv-link:focus-visible{
  outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color);outline-offset:1px;
}

/* ── 查看器 ─────────────────────────────────────────────────────────── */
.pv-viewer{
  position:fixed;inset:0;z-index:1200;display:flex;flex-direction:column;
  background:rgba(10,10,12,.92);color:#eee;
}
.pv-viewer-top{
  flex:none;display:flex;align-items:center;gap:12px;padding:12px 18px;
  background:linear-gradient(180deg,rgba(0,0,0,.5),transparent);position:relative;z-index:2;
}
.pv-viewer-title{font-size:14px;font-weight:600;line-height:20px;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pv-viewer-user{font-size:12px;color:#bbb;white-space:nowrap}
.pv-viewer-stage{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;position:relative;padding:8px 64px;box-sizing:border-box}
.pv-viewer-img{max-width:100%;max-height:100%;object-fit:contain;border-radius:6px;box-shadow:0 12px 48px rgba(0,0,0,.6)}
.pv-viewer-nav{
  position:absolute;top:50%;transform:translateY(-50%);width:40px;height:64px;
  display:flex;align-items:center;justify-content:center;border:none;border-radius:8px;
  background:rgba(255,255,255,.08);color:#eee;font-size:22px;cursor:pointer;z-index:2;
}
.pv-viewer-nav:hover{background:rgba(255,255,255,.16)}
.pv-viewer-nav.pv-prev{left:14px}
.pv-viewer-nav.pv-next{right:14px}
.pv-viewer-bottom{
  flex:none;display:flex;align-items:center;gap:14px;padding:12px 18px;
  background:linear-gradient(0deg,rgba(0,0,0,.5),transparent);font-size:12px;position:relative;z-index:2;
}
.pv-viewer-pages{color:#ccc;white-space:nowrap}
.pv-viewer-stats{color:#aaa;display:flex;gap:14px}
.pv-viewer-actions{flex:1;display:flex;justify-content:flex-end;gap:8px}
.pv-viewer-btn{
  display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 12px;
  border:.5px solid rgba(255,255,255,.25);border-radius:var(--dsw-radius-sm);
  background:rgba(255,255,255,.06);color:#eee;font:inherit;font-size:12px;cursor:pointer;
}
.pv-viewer-btn:hover{background:rgba(255,255,255,.14)}
.pv-viewer-btn.pv-bookmarked{border-color:transparent;background:#2b7fff;color:#fff}
.pv-viewer-tags{display:flex;gap:6px;flex-wrap:wrap;flex:1;min-width:0;max-height:24px;overflow:hidden}
.pv-viewer-tag{
  height:20px;padding:0 8px;display:inline-flex;align-items:center;border-radius:999px;
  background:rgba(255,255,255,.1);color:#ddd;font-size:11px;white-space:nowrap;cursor:pointer;
}
.pv-viewer-tag:hover{background:rgba(255,255,255,.22)}

/* ── 模态框 ─────────────────────────────────────────────────────────── */
.pv-modal{
  position:fixed;inset:0;z-index:1300;display:flex;align-items:center;justify-content:center;
  background:rgba(0,0,0,.45);
}
.pv-modal-card{
  width:min(460px,calc(100vw - 48px));max-height:calc(100vh - 96px);overflow-y:auto;
  display:flex;flex-direction:column;gap:12px;padding:16px;box-sizing:border-box;
  border:.5px solid var(--dsw-alias-border-l2);border-radius:12px;
  background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);
  box-shadow:var(--dsw-elevation-soft);
}
.pv-modal-head{display:flex;align-items:center;justify-content:space-between;gap:10px}
.pv-modal-title{font-size:14px;font-weight:600;margin:0}
.pv-modal-close{
  width:24px;height:24px;display:flex;align-items:center;justify-content:center;
  border:none;background:none;color:var(--dsw-alias-label-tertiary);font-size:16px;
  cursor:pointer;border-radius:var(--dsw-radius-sm);
}
.pv-modal-close:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2)}
.pv-modal-hint{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}
.pv-modal-hint a{color:var(--dsw-alias-brand-primary);text-decoration:none}
.pv-modal-hint a:hover{text-decoration:underline}
.pv-field{display:flex;flex-direction:column;gap:5px}
.pv-field-label{font-size:12px;color:var(--dsw-alias-label-secondary)}
.pv-field input{height:30px}
.pv-divider{display:flex;align-items:center;gap:10px;color:var(--dsw-alias-label-tertiary);font-size:11px}
.pv-divider:before,.pv-divider:after{content:"";flex:1;height:1px;background:var(--dsw-alias-border-l1)}
.pv-modal-err{font-size:12px;color:var(--dsw-alias-state-error-primary);line-height:17px;white-space:pre-wrap}
.pv-modal-row{display:flex;justify-content:flex-end;gap:8px}

/* ── Toast ──────────────────────────────────────────────────────────── */
.pv-toast{
  position:fixed;top:18px;left:50%;transform:translateX(-50%);z-index:1400;
  max-width:min(520px,calc(100vw - 48px));padding:8px 14px;border-radius:8px;
  background:var(--dsw-alias-bg-layer-2);border:.5px solid var(--dsw-alias-border-l2);
  color:var(--dsw-alias-label-primary);font-size:12px;line-height:18px;
  box-shadow:var(--dsw-elevation-soft);box-sizing:border-box;
}
.pv-toast.pv-error{border-color:var(--dsw-alias-state-error-primary)}
.pv-toast.pv-success{border-color:var(--dsw-alias-state-success-primary)}

@media (prefers-reduced-motion: reduce){
  .pv-switch:after,.pv-card-actions{transition:none}
  .pv-spinner{animation-duration:2s}
}
`

    // ------------------------------------------------------------------ api

    /** JSON call to the host half; throws Error with `.code` on failure. */
    async function api(path, options = {}) {
      const init = { method: options.method ?? 'GET', headers: {} }
      if (options.body !== undefined) {
        init.headers['Content-Type'] = 'application/json'
        init.body = JSON.stringify(options.body)
      }
      let res
      try {
        res = await fetch(BASE + path, init)
      } catch {
        const err = new Error('network')
        err.code = 'network'
        throw err
      }
      let data = null
      try {
        data = await res.json()
      } catch {
        /* non-JSON body */
      }
      if (!data || data.ok !== true) {
        const err = new Error(data?.error?.message ?? `HTTP ${res.status}`)
        err.code = data?.error?.code ?? 'network'
        throw err
      }
      return data.value
    }

    function friendlyMessage(error) {
      switch (error?.code) {
        case 'auth_required': return t0('auth.required')
        case 'cookie_required': return t0('cookie.required')
        case 'cookie_expired': return t0('cookie.expired')
        case 'rate_limited': return t0('rate.limited')
        case 'token_expired': return t0('token.expired')
        case 'network':
        case 'network_error': return t0('network.error')
        default: return error?.message || String(error)
      }
    }

    let t0 = makeT()

    function imgProxy(url) {
      return `${BASE}/img?url=${encodeURIComponent(url)}`
    }

    // ------------------------------------------------------------------ prefs

    const DEFAULT_PREFS = { r18: false, hideAi: true, sort: 'date_desc' }

    function loadPrefs() {
      try {
        const raw = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}')
        const prefs = { ...DEFAULT_PREFS }
        if (raw.r18 === true || raw.r18 === false) prefs.r18 = raw.r18
        if (raw.hideAi === true || raw.hideAi === false) prefs.hideAi = raw.hideAi
        if (['date_desc', 'date_asc', 'popular_d'].includes(raw.sort)) prefs.sort = raw.sort
        return prefs
      } catch {
        return { ...DEFAULT_PREFS }
      }
    }

    function savePrefs(prefs) {
      try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
      } catch {
        /* storage unavailable */
      }
    }

    // ------------------------------------------------------------------ atoms

    const CATEGORIES = [
      { key: '', labelKey: 'all' },
      { key: 'genshin', labelKey: 'cat.genshin' },
      { key: 'hsr', labelKey: 'cat.hsr' },
      { key: 'zzz', labelKey: 'cat.zzz' },
      { key: 'tot', labelKey: 'cat.tot' },
    ]

    const SORTS = [
      { key: 'date_desc', labelKey: 'sort.date_desc' },
      { key: 'date_asc', labelKey: 'sort.date_asc' },
      { key: 'popular_d', labelKey: 'sort.popular_d' },
    ]

    function svgIcon(path, size) {
      return h(
        'svg',
        {
          width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
          stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round',
        },
        h('path', { d: path }),
      )
    }

    const ICONS = {
      image: 'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm3 11l3.5-4.5 2.5 3 1.5-2 3.5 4.5H7z',
      heart: 'M12 20s-6.5-4.2-9-8.5C1.2 8 3.4 4.5 7 4.5c2 0 3.6 1.1 5 3 1.4-1.9 3-3 5-3 3.6 0 5.8 3.5 4 7-2.5 4.3-9 8.5-9 8.5z',
      download: 'M12 3v12m0 0l-4.5-4.5M12 15l4.5-4.5M4 19h16',
      gear: 'M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zm0 0V5m0 14v-3.5M5 12h3.5M15.5 12H19m-1.2-5.8l-2.5 2.5m-6.6 6.6l-2.5 2.5m11.6 0l-2.5-2.5M6.2 6.2l2.5 2.5',
      close: 'M6 6l12 12M18 6L6 18',
      left: 'M14.5 6l-6 6 6 6',
      right: 'M9.5 6l6 6-6 6',
      search: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zm5.7.3l4 4',
      user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 8a7 7 0 0 1 14 0',
      lock: 'M6 10h12v10H6zM8 10V7a4 4 0 0 1 8 0v3',
    }

    // ------------------------------------------------------------------ components

    function SidebarIcon({ size }) {
      return svgIcon(ICONS.image, size)
    }

    function Switch({ on, label, onChange, title }) {
      return h(
        'label',
        {
          className: 'pv-switch-row', title,
          onClick: () => onChange(!on),
        },
        h('span', { className: `pv-switch${on ? ' pv-on' : ''}`, 'aria-hidden': 'true' }),
        h(
          'span',
          { className: 'pv-switch-label', role: 'switch', 'aria-checked': on, tabIndex: 0,
            onKeyDown: (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onChange(!on)
              }
            } },
          label,
        ),
      )
    }

    function Modal({ title, onClose, children }) {
      React.useEffect(() => {
        const onKey = (event) => {
          if (event.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
      }, [onClose])
      return h(
        'div',
        { className: 'pv-modal', onMouseDown: (event) => { if (event.target === event.currentTarget) onClose() } },
        h(
          'div',
          { className: 'pv-modal-card', role: 'dialog', 'aria-modal': 'true' },
          h('div', { className: 'pv-modal-head' },
            h('h3', { className: 'pv-modal-title' }, title),
            h('button', { className: 'pv-modal-close', onClick: onClose, 'aria-label': t0('close') }, '×'),
          ),
          children,
        ),
      )
    }

    function LoginModal({ onClose, onLoggedIn, notify }) {
      const [code, setCode] = React.useState('')
      const [token, setToken] = React.useState('')
      const [busy, setBusy] = React.useState(false)
      const [error, setError] = React.useState(null)
      const [followUrl, setFollowUrl] = React.useState(null)

      const startLogin = async () => {
        setError(null)
        setBusy(true)
        try {
          const { loginUrl } = await api('/login/start', { method: 'POST', body: {} })
          window.open(loginUrl, '_blank', 'noopener')
        } catch (err) {
          setError(friendlyMessage(err))
        } finally {
          setBusy(false)
        }
      }

      /** Intermediate OAuth pages that must continue inside the browser (session cookies live there). */
      const continueUrl = (raw) => {
        let parsed = null
        try { parsed = new URL(raw) } catch { return null }
        if (parsed.hostname === 'accounts.pixiv.net' && parsed.pathname === '/post-redirect') {
          const returnTo = parsed.searchParams.get('return_to')
          if (!returnTo) return null
          try {
            if (new URL(returnTo).hostname !== 'app-api.pixiv.net') return null
          } catch { return null }
          return returnTo
        }
        if (parsed.hostname === 'app-api.pixiv.net' && /\/web\/v1\/users\/auth\/pixiv\/start$/.test(parsed.pathname)) return raw
        return null
      }

      const submitCode = async () => {
        const raw = code.trim()
        if (!raw) return
        setError(null)
        const follow = continueUrl(raw)
        if (follow) {
          setFollowUrl(follow)
          window.open(follow, '_blank', 'noopener')
          return
        }
        setBusy(true)
        try {
          const value = await api('/login/code', { method: 'POST', body: { code: raw } })
          notify(t0('login.success'), 'success')
          onLoggedIn(value)
          onClose()
        } catch (err) {
          setError(friendlyMessage(err))
        } finally {
          setBusy(false)
        }
      }

      const submitToken = async () => {
        if (!token.trim()) return
        setError(null)
        setBusy(true)
        try {
          const value = await api('/login/token', { method: 'POST', body: { refreshToken: token.trim() } })
          notify(t0('login.success'), 'success')
          onLoggedIn(value)
          onClose()
        } catch (err) {
          setError(friendlyMessage(err))
        } finally {
          setBusy(false)
        }
      }

      return h(
        Modal,
        { title: t0('login.title'), onClose },
        h('p', { className: 'pv-modal-hint' }, t0('login.hint')),
        h('div', { className: 'pv-modal-row' },
          h('button', { className: 'pv-btn pv-primary', onClick: startLogin, disabled: busy },
            svgIcon(ICONS.user, 14), t0('login.open')),
        ),
        h('div', { className: 'pv-field' },
          h('span', { className: 'pv-field-label' }, t0('login.codePlaceholder')),
          h('input', {
            className: 'pv-input', value: code, placeholder: 'https://app-api.pixiv.net/…callback?…code=…',
            onChange: (event) => setCode(event.target.value),
            onKeyDown: (event) => { if (event.key === 'Enter') submitCode() },
          }),
        ),
        followUrl ? h('p', { className: 'pv-modal-hint' },
          t0('login.follow'), ' ',
          h('a', { href: followUrl, target: '_blank', rel: 'noreferrer' }, t0('login.openManual')),
        ) : null,
        h('div', { className: 'pv-modal-row' },
          h('button', { className: 'pv-btn pv-primary', onClick: submitCode, disabled: busy || !code.trim() },
            t0('login.codeSubmit')),
        ),
        h('div', { className: 'pv-divider' }, t0('login.or')),
        h('div', { className: 'pv-field' },
          h('span', { className: 'pv-field-label' }, t0('login.tokenPlaceholder')),
          h('input', {
            className: 'pv-input', value: token, type: 'password',
            onChange: (event) => setToken(event.target.value),
            onKeyDown: (event) => { if (event.key === 'Enter') submitToken() },
          }),
        ),
        h('div', { className: 'pv-modal-row' },
          h('button', { className: 'pv-btn', onClick: submitToken, disabled: busy || !token.trim() },
            t0('login.tokenSubmit')),
        ),
        error ? h('div', { className: 'pv-modal-err' }, error) : null,
      )
    }

    function SettingsModal({ status, onClose, notify }) {
      const [proxy, setProxy] = React.useState(status.proxy ?? '')
      const [cookie, setCookie] = React.useState('')
      const [busy, setBusy] = React.useState(false)
      const [error, setError] = React.useState(null)
      const [saved, setSaved] = React.useState(false)

      const save = async () => {
        setBusy(true)
        setError(null)
        setSaved(false)
        try {
          await api('/config', { method: 'POST', body: { proxy, phpsessid: cookie } })
          setSaved(true)
          notify(t0('settings.saved'), 'success')
          setTimeout(() => setSaved(false), 2000)
        } catch (err) {
          setError(friendlyMessage(err))
        } finally {
          setBusy(false)
        }
      }

      const logout = async () => {
        setBusy(true)
        setError(null)
        try {
          await api('/logout', { method: 'POST', body: {} })
          notify(t0('logout'), 'success')
          onClose()
        } catch (err) {
          setError(friendlyMessage(err))
        } finally {
          setBusy(false)
        }
      }

      return h(
        Modal,
        { title: t0('settings.title'), onClose },
        h('div', { className: 'pv-field' },
          h('span', { className: 'pv-field-label' }, t0('settings.proxy')),
          h('input', {
            className: 'pv-input', value: proxy, placeholder: t0('settings.proxyPlaceholder'),
            onChange: (event) => setProxy(event.target.value),
          }),
        ),
        h('div', { className: 'pv-field' },
          h('span', { className: 'pv-field-label' }, t0('settings.cookie')),
          h('input', {
            className: 'pv-input', value: cookie, placeholder: t0('settings.cookiePlaceholder'),
            onChange: (event) => setCookie(event.target.value),
          }),
          status.hasCookie
            ? h('span', { className: 'pv-field-label' }, `✓ PHPSESSID ${t0('settings.saved').toLowerCase()}`)
            : null,
        ),
        error ? h('div', { className: 'pv-modal-err' }, error) : null,
        h('div', { className: 'pv-modal-row' },
          status.loggedIn
            ? h('button', { className: 'pv-btn', onClick: logout, disabled: busy }, t0('logout'))
            : null,
          h('span', { className: 'pv-spacer' }),
          h('button', { className: 'pv-btn pv-primary', onClick: save, disabled: busy },
            saved ? `✓ ${t0('settings.saved')}` : t0('settings.save')),
        ),
      )
    }

    function Viewer({ items, index, onClose, onNavigate, onToggleBookmark, notify, onSearchTag }) {
      const [detail, setDetail] = React.useState(null)
      const [pageIdx, setPageIdx] = React.useState(0)
      const [loading, setLoading] = React.useState(true)
      const item = items[index]

      React.useEffect(() => {
        let alive = true
        setLoading(true)
        setPageIdx(0)
        setDetail(null)
        api(`/illust/${item.id}`)
          .then((value) => { if (alive) setDetail(value) })
          .catch((error) => { if (alive) notify(friendlyMessage(error), 'error') })
          .finally(() => { if (alive) setLoading(false) })
        return () => { alive = false }
      }, [item.id])

      React.useEffect(() => {
        const onKey = (event) => {
          if (event.key === 'Escape') onClose()
          else if (event.key === 'ArrowLeft') onNavigate(-1)
          else if (event.key === 'ArrowRight') onNavigate(1)
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
      }, [onClose, onNavigate])

      const pages = detail?.pages?.length ? detail.pages : [item.thumbUrl]
      const current = pages[Math.min(pageIdx, pages.length - 1)]
      const bookmarked = detail ? detail.isBookmarked : item.isBookmarked
      const tags = detail?.tags ?? item.tags ?? []

      const saveImage = () => {
        const filename = encodeURIComponent((detail?.title ?? item.title ?? 'pixiv').slice(0, 60))
        window.open(`${imgProxy(current)}&dl=1&filename=${filename}`, '_blank', 'noopener')
      }

      return h(
        'div',
        { className: 'pv-viewer', role: 'dialog', 'aria-modal': 'true' },
        h('div', { className: 'pv-viewer-top' },
          h('div', { className: 'pv-viewer-title' }, detail?.title ?? item.title),
          h('span', { className: 'pv-viewer-user' },
            svgIcon(ICONS.user, 12), ' ', detail?.userName ?? item.userName),
          h('button', { className: 'pv-viewer-btn', onClick: onClose, 'aria-label': t0('close') },
            svgIcon(ICONS.close, 14)),
        ),
        h('div', { className: 'pv-viewer-stage' },
          h('button', {
            className: 'pv-viewer-nav pv-prev', 'aria-label': t0('prevPage'),
            onClick: () => onNavigate(-1), disabled: index <= 0,
          }, '‹'),
          loading
            ? h('div', { className: 'pv-spinner' })
            : h('img', {
              className: 'pv-viewer-img', src: imgProxy(current), alt: detail?.title ?? item.title,
              draggable: false,
            }),
          h('button', {
            className: 'pv-viewer-nav pv-next', 'aria-label': t0('nextPage'),
            onClick: () => onNavigate(1), disabled: index >= items.length - 1,
          }, '›'),
        ),
        h('div', { className: 'pv-viewer-bottom' },
          h('span', { className: 'pv-viewer-pages' },
            fmt(t0, t0('viewer.pages'), { page: Math.min(pageIdx, pages.length - 1) + 1, pages: pages.length })),
          h('span', { className: 'pv-viewer-stats' },
            h('span', null, svgIcon(ICONS.heart, 12), ' ', fmtCount(detail?.totalBookmarks ?? item.totalBookmarks)),
            detail ? h('span', null, fmt(t0, t0('viewer.views'), { n: fmtCount(detail.viewCount) })) : null,
            detail?.createDate ? h('span', null, fmtDate(detail.createDate)) : null,
          ),
          h('div', { className: 'pv-viewer-tags' },
            tags.slice(0, 12).map((tag) =>
              h('button', {
                key: tag.name, className: 'pv-viewer-tag',
                onClick: () => onSearchTag(tag.name),
              }, `#${tag.name}`),
            ),
          ),
          h('div', { className: 'pv-viewer-actions' },
            h('button', {
              className: `pv-viewer-btn${bookmarked ? ' pv-bookmarked' : ''}`,
              onClick: () => onToggleBookmark(item.id, !bookmarked),
            }, svgIcon(ICONS.heart, 14), bookmarked ? t0('bookmark.remove') : t0('bookmark.add')),
            h('button', { className: 'pv-viewer-btn', onClick: saveImage },
              svgIcon(ICONS.download, 14), t0('save')),
          ),
        ),
      )
    }

    function Card({ item, t, onOpen, onToggleBookmark }) {
      return h(
        'div',
        {
          className: 'pv-card', tabIndex: 0, role: 'button',
          onClick: () => onOpen(item.id),
          onKeyDown: (event) => { if (event.key === 'Enter') onOpen(item.id) },
        },
        h('img', {
          className: 'pv-thumb', src: imgProxy(item.thumbUrl), alt: item.title,
          loading: 'lazy', draggable: false,
        }),
        item.pageCount > 1 ? h('span', { className: 'pv-page-tag' }, `${item.pageCount}P`) : null,
        item.xRestrict > 0 ? h('span', { className: 'pv-r18-tag' }, 'R18') : null,
        h('div', {
          className: 'pv-card-actions',
          onClick: (event) => event.stopPropagation(),
        },
        h('button', {
          className: `pv-icon-btn${item.isBookmarked ? ' pv-bookmarked' : ''}`,
          title: item.isBookmarked ? t('bookmark.remove') : t('bookmark.add'),
          onClick: () => onToggleBookmark(item.id, !item.isBookmarked),
        }, svgIcon(ICONS.heart, 14)),
        ),
        h('div', { className: 'pv-card-meta' },
          h('div', { className: 'pv-card-title', title: item.title }, item.title),
          h('div', { className: 'pv-card-sub' },
            h('span', { className: 'pv-user' }, item.userName),
            h('span', null, svgIcon(ICONS.heart, 10), ' ', fmtCount(item.totalBookmarks)),
          ),
        ),
      )
    }

    // ------------------------------------------------------------------ root

    function App() {
      const [t, setT] = React.useState(() => makeT())
      const [status, setStatus] = React.useState(null)
      const [prefs, setPrefs] = React.useState(() => loadPrefs())
      const [category, setCategory] = React.useState('')
      const [word, setWord] = React.useState('')
      const [filter, setFilter] = React.useState('')
      const [items, setItems] = React.useState([])
      const [total, setTotal] = React.useState(0)
      const [page, setPage] = React.useState(1)
      const [loading, setLoading] = React.useState(false)
      const [error, setError] = React.useState(null)
      const [viewerIndex, setViewerIndex] = React.useState(null)
      const [loginOpen, setLoginOpen] = React.useState(false)
      const [settingsOpen, setSettingsOpen] = React.useState(false)
      const [toast, setToast] = React.useState(null)
      const [refreshTick, setRefreshTick] = React.useState(0)
      const [paginated, setPaginated] = React.useState(false)
      const toastTimer = React.useRef(null)
      const requestSeq = React.useRef(0)

      const notify = React.useCallback((text, tone = 'info') => {
        setToast({ text, tone })
        clearTimeout(toastTimer.current)
        toastTimer.current = setTimeout(() => setToast(null), 2600)
      }, [])

      const refreshStatus = React.useCallback(async () => {
        try {
          setStatus(await api('/status'))
        } catch {
          /* status is best-effort */
        }
      }, [])

      React.useEffect(() => {
        refreshStatus()
        const timer = setInterval(refreshStatus, 60000)
        return () => clearInterval(timer)
      }, [refreshStatus])

      // follow the shell language live
      React.useEffect(() => {
        const update = () => setT(makeT())
        const observer = new MutationObserver(update)
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] })
        window.addEventListener('languagechange', update)
        return () => {
          observer.disconnect()
          window.removeEventListener('languagechange', update)
        }
      }, [])

      t0 = t

      const fetchView = React.useCallback(async (view, seq) => {
        setLoading(true)
        setError(null)
        try {
          if (view.category) {
            const result = await api(`/category?key=${encodeURIComponent(view.category)}&r18=${view.r18 ? '1' : '0'}&hideAi=${view.hideAi ? '1' : '0'}`)
            if (seq !== requestSeq.current) return
            setItems(result.items ?? [])
            setTotal(0)
            setPaginated(false)
          } else if (view.word) {
            const query = `word=${encodeURIComponent(view.word)}&r18=${view.r18 ? '1' : '0'}&sort=${view.sort}&page=${view.page}&hideAi=${view.hideAi ? '1' : '0'}`
            const result = await api(`/search?${query}`)
            if (seq !== requestSeq.current) return
            setItems(result.items ?? [])
            setTotal(typeof result.total === 'number' ? result.total : null)
            setPaginated(true)
          } else {
            setItems([])
            setTotal(0)
            setPaginated(false)
          }
        } catch (err) {
          if (seq !== requestSeq.current) return
          setItems([])
          setTotal(0)
          setPaginated(false)
          setError(friendlyMessage(err))
        } finally {
          if (seq === requestSeq.current) setLoading(false)
        }
      }, [])

      const currentView = React.useMemo(() => ({
        category,
        word,
        r18: prefs.r18,
        hideAi: prefs.hideAi,
        sort: prefs.sort,
        page,
        refreshTick,
      }), [category, word, prefs.r18, prefs.hideAi, prefs.sort, page, refreshTick])

      React.useEffect(() => {
        const seq = ++requestSeq.current
        fetchView(currentView, seq)
      }, [currentView, fetchView])

      const filtered = React.useMemo(() => {
        const query = filter.trim().toLowerCase()
        if (!query) return items
        return items.filter((item) =>
          (item.title ?? '').toLowerCase().includes(query)
          || (item.userName ?? '').toLowerCase().includes(query)
          || (item.tags ?? []).some((tag) => (tag.name ?? '').toLowerCase().includes(query)),
        )
      }, [items, filter])

      const hasMore = total === null ? items.length === 30 : page * 30 < total

      const togglePref = (key, value) => {
        const next = { ...prefs, [key]: value }
        setPrefs(next)
        savePrefs(next)
        setPage(1)
        if ((key === 'r18' && value) || (key === 'sort' && value === 'popular_d')) {
          if (status && !status.hasCookie) {
            notify(t('settings.needCookie'), 'error')
            setSettingsOpen(true)
          }
        }
      }

      const submitSearch = () => {
        const value = word.trim()
        if (!value) return
        setCategory('')
        setWord(value)
        setFilter('')
        setPage(1)
        setRefreshTick((tick) => tick + 1)
      }

      const pickCategory = (key) => {
        setCategory(key)
        setWord('')
        setFilter('')
        setPage(1)
        if (key !== category) setRefreshTick((tick) => tick + 1)
      }

      const searchTag = (tag) => {
        setViewerIndex(null)
        setCategory('')
        setWord(tag)
        setFilter('')
        setPage(1)
        setRefreshTick((tick) => tick + 1)
      }

      const openViewer = (id) => {
        const index = items.findIndex((item) => item.id === id)
        if (index >= 0) setViewerIndex(index)
      }

      const toggleBookmark = async (id, want) => {
        const patch = (value) => {
          setItems((list) => list.map((item) => (item.id === id ? { ...item, isBookmarked: value } : item)))
        }
        patch(want)
        try {
          if (want) await api('/bookmark', { method: 'POST', body: { illustId: id, restrict: 'public' } })
          else await api(`/bookmark/${id}`, { method: 'DELETE' })
        } catch (err) {
          patch(!want)
          notify(`${t('bookmark.failed')}：${friendlyMessage(err)}`, 'error')
        }
      }

      const navigate = (delta) => {
        setViewerIndex((index) => {
          if (index === null) return index
          const next = index + delta
          return next >= 0 && next < items.length ? next : index
        })
      }

      const viewerItem = viewerIndex !== null ? items[viewerIndex] : null

      return h(
        'div',
        { className: 'pv-root' },
        h('div', { className: 'pv-topbar' },
          h('h2', { className: 'pv-title' }, t('title')),
          h('span', { className: 'pv-ver' }, `v${VERSION}`),
          h('div', { className: 'pv-spacer' }),
          status
            ? status.loggedIn
              ? h('span', { className: 'pv-chip pv-on' },
                h('span', { className: 'pv-dot' }),
                fmt(t, t('loggedInAs'), { name: status.userName ?? 'pixiv' }))
              : h('button', { className: 'pv-chip', onClick: () => setLoginOpen(true) },
                h('span', { className: 'pv-dot' }), t('login'))
            : null,
          h('button', { className: 'pv-icon-btn', style: { background: 'transparent', color: 'var(--dsw-alias-label-secondary)' }, title: t('settings'), onClick: () => setSettingsOpen(true) },
            svgIcon(ICONS.gear, 16)),
        ),
        h('div', { className: 'pv-toolbar' },
          h('div', { className: 'pv-cats' },
            CATEGORIES.map((cat) =>
              h('button', {
                key: cat.key, className: `pv-cat${category === cat.key ? ' pv-on' : ''}`,
                onClick: () => pickCategory(cat.key),
              }, t(cat.labelKey)),
            ),
          ),
          h('input', {
            className: 'pv-input', type: 'text',
            placeholder: t('searchPlaceholder'), value: word,
            onChange: (event) => setWord(event.target.value),
            onKeyDown: (event) => { if (event.key === 'Enter') submitSearch() },
          }),
          h('button', { className: 'pv-btn', onClick: submitSearch },
            svgIcon(ICONS.search, 13), t('search')),
          h('select', {
            className: 'pv-select', value: prefs.sort, 'aria-label': t('sort.' + prefs.sort),
            onChange: (event) => togglePref('sort', event.target.value),
          },
            SORTS.map((sort) => h('option', { key: sort.key, value: sort.key }, t(sort.labelKey))),
          ),
          h(Switch, {
            on: prefs.r18, label: t('r18'),
            onChange: (value) => togglePref('r18', value),
          }),
          h(Switch, {
            on: prefs.hideAi, label: t('hideAi'),
            onChange: (value) => togglePref('hideAi', value),
          }),
        ),
        h('input', {
          className: 'pv-input', type: 'text', placeholder: t('filterPlaceholder'), value: filter,
          onChange: (event) => setFilter(event.target.value),
        }),
        status && !status.loggedIn
          ? h('div', { className: 'pv-banner pv-warn' },
            svgIcon(ICONS.lock, 14),
            h('span', null, t('notLoggedIn')),
            h('button', { className: 'pv-link', onClick: () => setLoginOpen(true) }, t('login')),
          )
          : null,
        error
          ? h('div', { className: 'pv-banner pv-warn' },
            h('span', null, error),
            h('span', { className: 'pv-spacer' }),
            h('button', { className: 'pv-link', onClick: () => setRefreshTick((tick) => tick + 1) }, t('retry')),
          )
          : null,
        h('div', { className: 'pv-body' },
          loading
            ? h('div', { className: 'pv-state' }, h('div', { className: 'pv-spinner' }))
            : filtered.length === 0
              ? h('div', { className: 'pv-state' },
                category || word ? t('empty.none') : t('empty.prompt'))
              : h('div', { className: 'pv-grid' },
                filtered.map((item) =>
                  h(Card, {
                    key: item.id, item, t,
                    onOpen: openViewer,
                    onToggleBookmark: toggleBookmark,
                  }),
                ),
              ),
        ),
        paginated && (total > 0 || hasMore)
          ? h('div', { className: 'pv-pager' },
            h('button', {
              className: 'pv-pager-btn', disabled: page <= 1,
              onClick: () => setPage((value) => Math.max(1, value - 1)),
            }, `‹ ${t('prevPage')}`),
            h('span', { className: 'pv-pager-info' },
              fmt(t, t('pageOf'), { page }),
              total ? ` · ${fmt(t, t('totalItems'), { n: fmtCount(total) })}` : '',
            ),
            h('button', {
              className: 'pv-pager-btn', disabled: !hasMore,
              onClick: () => setPage((value) => value + 1),
            }, `${t('nextPage')} ›`),
          )
          : null,
        viewerItem
          ? h(Viewer, {
            items,
            index: viewerIndex,
            onClose: () => setViewerIndex(null),
            onNavigate: navigate,
            onToggleBookmark: toggleBookmark,
            onSearchTag: searchTag,
            notify,
          })
          : null,
        loginOpen
          ? h(LoginModal, {
            onClose: () => setLoginOpen(false),
            onLoggedIn: refreshStatus,
            notify,
          })
          : null,
        settingsOpen
          ? h(SettingsModal, {
            status, onClose: () => setSettingsOpen(false), notify,
          })
          : null,
        toast
          ? h('div', { className: `pv-toast${toast.tone === 'error' ? ' pv-error' : toast.tone === 'success' ? ' pv-success' : ''}` },
            toast.text)
          : null,
      )
    }

    // ------------------------------------------------------------------ entry

    function installStyles() {
      let tag = document.getElementById(STYLE_ID)
      if (!tag) {
        tag = document.createElement('style')
        tag.id = STYLE_ID
        tag.dataset.pluginCss = STYLE_ID
        document.head.appendChild(tag)
      }
      tag.textContent = CSS
      return () => {
        document.getElementById(STYLE_ID)?.remove()
      }
    }

    return {
      inject: ['slots'],

      apply(ctx) {
        ctx.effect(installStyles, 'dsh-pixiv-viewer: styles')
        ctx.slots.inject('sidebar.panellist', () =>
          ctx.slots.register(
            {
              name: 'sidebar.panellist',
              id: PANEL_ID,
              order: 25,
              label: () => t0('panel'),
            },
            SidebarIcon,
          ),
        )
        ctx.slots.inject('main', () =>
          ctx.slots.register(
            {
              name: 'main',
              key: PANEL_ID,
            },
            App,
          ),
        )
      },
    }
  },
})
