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

    const VERSION = '0.7.0'
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
      'login.hint': '在浏览器中登录 pixiv.net 后，粘贴会话 Cookie（PHPSESSID）即可登录。插件用它访问你已登录的网页版接口，支持搜索、R18、收藏同步，不接触账号密码。',
      'login.hasCookie': '检测到已保存过 Cookie：输入框可留空，直接点击登录。',
      'login.cookiePlaceholder': '粘贴 PHPSESSID（已保存过可留空）',
      'login.submit': '保存并登录',
      'login.getCookie': '如何获取 PHPSESSID',
      'login.getCookieSteps': '1. 在浏览器中登录 https://www.pixiv.net/；2. 按 F12 打开开发者工具；3. 打开「应用 / Application」标签；4. 左侧「存储 → Cookie → https://www.pixiv.net」；5. 复制 PHPSESSID 的值，粘贴到上方输入框。',
      'login.success': '登录成功',
      'settings.title': '设置',
      'settings.proxy': '代理地址（pixiv 需要，例如 http://127.0.0.1:7890）',
      'settings.proxyPlaceholder': 'http://127.0.0.1:7890',
      'settings.cookie': 'PHPSESSID（登录、R18 与热门排序都需要；浏览器登录 pixiv.net 后从 Cookie 中复制）',
      'settings.cookiePlaceholder': 'PHPSESSID 值',
      'settings.save': '保存',
      'settings.saved': '已保存',
      'settings.needCookie': 'R18 / 热门排序需要先登录（粘贴 PHPSESSID）',
      'bookmark.add': '收藏',
      'bookmark.remove': '取消收藏',
      'bookmark.failed': '收藏操作失败',
      'save': '保存图片',
      'copy': '复制图片',
      'copy.done': '已复制到剪贴板',
      'copy.fail': '复制失败',
      'viewer.zoomHint': '滚轮缩放、按住拖动平移',
      'viewer.pages': '{page} / {pages}',
      'viewer.bookmarks': '{n} 收藏',
      'viewer.views': '{n} 浏览',
      'close': '关闭',
      'rate.limited': '请求过于频繁，请稍候再试',
      'cookie.expired': 'PHPSESSID 已失效，请在设置中更新',
      'cookie.required': '需要先登录（粘贴 PHPSESSID）',
      'network.error': '网络错误：无法访问 pixiv（可能需要配置代理）',
      'cat.genshin': '原神',
      'cat.hsr': '星穹铁道',
      'cat.zzz': '绝区零',
      'cat.tot': '未定事件簿',
      'daily': '每日推荐',
      'refresh': '刷新',
      'filter.toggle': '筛选当前结果',
      'r18.hint': '开启后 R18 作品与普通作品混合显示；关闭则过滤掉 R18 作品',
      'unsupported': '暂不支持查看此类作品（视频 / 动图）',
      'type.tag': '标签',
      'type.title': '作品名',
      'type.user': '作者ID',
      'type.pid': 'PID',
      'placeholder.tag': '标签：| 并集、+ 交集、- 排除（运算符前后需空格）；↑↓ 联想，空格/回车填入',
      'placeholder.title': '按作品名搜索',
      'placeholder.user': '输入作者用户 ID（点击作品上的作者名可自动搜索）',
      'placeholder.pid': '输入作品 ID（如 150702144）',
      'tier.none': '不限热度',
      'author.works': '作者作品：{name}',
      'author.clear': '清除',
      'status.results': '「{word}」的搜索结果',
      'status.category': '分类：{name}',
      'bookmarks': '我的收藏',
      'status.bookmarks': '我的收藏（{n} 件）',
      'status.bookmarksFilter': '收藏中「{word}」的筛选结果',
      'bookmarks.loading': '正在加载收藏 {loaded}/{total}…',
      'empty.bookmarks': '还没有收藏任何作品',
      'save.done': '已开始下载图片',
      'saving': '正在下载图片',
      'save.success': '下载成功',
      'save.fail': '下载失败',
      'copying': '正在复制图片',
      'bookmark.added': '已收藏',
      'bookmark.removed': '已取消收藏',
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
      'login.hint': 'Sign in to pixiv.net in your browser, then paste the session cookie (PHPSESSID) here. The plugin uses it to call the same website APIs your signed-in session uses — search, R18 and bookmark sync included. Your password is never involved.',
      'login.hasCookie': 'A cookie is already saved: leave the box empty and click sign in.',
      'login.cookiePlaceholder': 'Paste PHPSESSID (leave empty if saved)',
      'login.submit': 'Save and sign in',
      'login.getCookie': 'How to get PHPSESSID',
      'login.getCookieSteps': '1. Sign in to https://www.pixiv.net/ in your browser; 2. press F12; 3. open the "Application" tab; 4. Storage → Cookies → https://www.pixiv.net; 5. copy the PHPSESSID value into the box above.',
      'login.success': 'Signed in',
      'settings.title': 'Settings',
      'settings.proxy': 'Proxy URL (required for pixiv, e.g. http://127.0.0.1:7890)',
      'settings.proxyPlaceholder': 'http://127.0.0.1:7890',
      'settings.cookie': 'PHPSESSID (needed for sign-in, R18 and popular sort; copy from cookies after signing in to pixiv.net)',
      'settings.cookiePlaceholder': 'PHPSESSID value',
      'settings.save': 'Save',
      'settings.saved': 'Saved',
      'settings.needCookie': 'R18 / popular sort requires signing in first (paste PHPSESSID)',
      'bookmark.add': 'Bookmark',
      'bookmark.remove': 'Unbookmark',
      'bookmark.failed': 'Bookmark failed',
      'save': 'Save image',
      'copy': 'Copy image',
      'copy.done': 'Copied to clipboard',
      'copy.fail': 'Copy failed',
      'viewer.zoomHint': 'Wheel to zoom, drag to pan',
      'viewer.pages': '{page} / {pages}',
      'viewer.bookmarks': '{n} bookmarks',
      'viewer.views': '{n} views',
      'close': 'Close',
      'rate.limited': 'Too many requests, please wait a moment',
      'cookie.expired': 'PHPSESSID expired, update it in Settings',
      'cookie.required': 'Sign in first (paste PHPSESSID)',
      'network.error': 'Network error: cannot reach pixiv (a proxy may be needed)',
      'cat.genshin': 'Genshin',
      'cat.hsr': 'Star Rail',
      'cat.zzz': 'Zenless',
      'cat.tot': 'Themis',
      'daily': 'Daily picks',
      'refresh': 'Refresh',
      'filter.toggle': 'Filter current results',
      'r18.hint': 'When on, R18 works are mixed with safe works; when off, R18 works are filtered out',
      'unsupported': 'This type of work (video / ugoira) is not supported yet',
      'type.tag': 'Tag',
      'type.title': 'Title',
      'type.user': 'Artist ID',
      'type.pid': 'PID',
      'placeholder.tag': 'Tags: | union, + intersect, - exclude (operators need spaces around); ↑↓ suggest, Space/Enter insert',
      'placeholder.title': 'Search by title',
      'placeholder.user': 'Enter an artist user ID (click an author name on a work to search)',
      'placeholder.pid': 'Enter a work ID (e.g. 150702144)',
      'tier.none': 'Any bookmark tier',
      'author.works': 'Works by {name}',
      'author.clear': 'Clear',
      'status.results': 'Results for "{word}"',
      'status.category': 'Category: {name}',
      'bookmarks': 'My bookmarks',
      'status.bookmarks': 'My bookmarks ({n})',
      'status.bookmarksFilter': 'Bookmarks matching "{word}"',
      'bookmarks.loading': 'Loading bookmarks {loaded}/{total}…',
      'empty.bookmarks': 'No bookmarks yet',
      'save.done': 'Download started',
      'save.fail': 'Download failed',
      'saving': 'Downloading image…',
      'save.success': 'Download complete',
      'copying': 'Copying image…',
      'bookmark.added': 'Bookmarked',
      'bookmark.removed': 'Bookmark removed',
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
  font-size:12px;line-height:1;white-space:nowrap;box-sizing:border-box;cursor:pointer;
}
button.pv-chip{font:inherit}
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
  display:inline-flex;align-items:center;gap:5px;
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
.pv-switch.pv-on{border-color:var(--dsw-alias-brand-primary, #2b7fff);background:color-mix(in srgb, var(--dsw-alias-brand-primary, #2b7fff) 18%, transparent)}
.pv-switch.pv-on:after{transform:translateX(12px);background:var(--dsw-alias-brand-primary, #2b7fff)}

/* ── 提示横幅 ───────────────────────────────────────────────────────── */
.pv-banner{
  flex:none;display:flex;align-items:center;gap:8px;padding:7px 12px;
  border:.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-sm);
  background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);
  font-size:12px;line-height:18px;box-sizing:border-box;
}
.pv-banner.pv-warn{border-color:var(--dsw-alias-state-warn-primary);color:var(--dsw-alias-label-primary)}
.pv-banner .pv-link{
  border:none;background:none;color:var(--dsw-alias-state-business-primary, #2b7fff);
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
.pv-thumb-wrap{position:relative;aspect-ratio:1/1;background:var(--dsw-alias-bg-layer-2)}
.pv-thumb{width:100%;height:100%;aspect-ratio:1/1;object-fit:cover;display:block;background:var(--dsw-alias-bg-layer-2)}
.pv-thumb-fail{position:absolute;inset:0;display:flex;align-items:center;justify-content:center}
.pv-thumb-retry{
  display:inline-flex;align-items:center;gap:5px;padding:5px 10px;
  border:.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-sm);
  background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);
  font:inherit;font-size:12px;cursor:pointer;white-space:nowrap;
}
.pv-thumb-retry:hover{color:var(--dsw-alias-brand-primary, #2b7fff);border-color:var(--dsw-alias-brand-primary, #2b7fff)}
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
.pv-card-actions.pv-show{opacity:1}
.pv-icon-btn{
  display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;
  border:none;border-radius:var(--dsw-radius-sm);cursor:pointer;padding:0;
  background:rgba(0,0,0,.55);color:#fff;box-sizing:border-box;
}
.pv-icon-btn:hover{background:rgba(0,0,0,.75)}
.pv-icon-btn.pv-bookmarked{background:rgba(224,54,54,.92)}
.pv-icon-btn.pv-bookmarked:hover{background:rgba(248,70,70,.95)}
.pv-tool-btn{
  width:28px;height:28px;border:.5px solid var(--dsw-alias-border-l1);
  background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);
}
.pv-tool-btn:hover{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l2)}
.pv-tool-btn.pv-on{color:var(--dsw-alias-brand-primary, #2b7fff);border-color:var(--dsw-alias-brand-primary, #2b7fff)}
.pv-filter-input{flex:0 1 200px;min-width:140px}
.pv-search-group{flex:1;min-width:260px;display:flex;align-items:stretch}
.pv-search-group .pv-select{flex:none;border-radius:var(--dsw-radius-sm) 0 0 var(--dsw-radius-sm);border-right:none}
.pv-search-wrap{position:relative;flex:1;min-width:0;display:flex}
.pv-search-wrap .pv-input{flex:1;min-width:0;border-radius:0}
.pv-search-group .pv-btn{flex:none;border-radius:0 var(--dsw-radius-sm) var(--dsw-radius-sm) 0;border-left:none}
.pv-suggest{
  position:absolute;top:calc(100% + 4px);left:0;right:0;z-index:40;
  background:var(--dsw-alias-bg-layer-2);border:.5px solid var(--dsw-alias-border-l2);
  border-radius:var(--dsw-radius-sm);box-shadow:var(--dsw-elevation-soft);
  max-height:240px;overflow-y:auto;padding:4px;box-sizing:border-box;
}
.pv-suggest-item{
  display:flex;align-items:center;justify-content:space-between;gap:8px;
  padding:6px 8px;border:none;border-radius:4px;background:none;width:100%;
  font:inherit;font-size:12px;color:var(--dsw-alias-label-primary);cursor:pointer;
  text-align:left;box-sizing:border-box;
}
.pv-suggest-item:hover,.pv-suggest-item.pv-active{background:var(--dsw-alias-bg-layer-1)}
.pv-suggest-alias{color:var(--dsw-alias-label-tertiary);font-size:11px;white-space:nowrap}
.pv-tag-row{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:thin}
.pv-presets{
  flex:1;min-width:0;display:grid;grid-template-rows:repeat(3,22px);
  grid-auto-flow:column;grid-auto-columns:max-content;gap:4px 6px;
  overflow-x:auto;scrollbar-width:thin;padding:2px 0;
}
.pv-preset{
  flex:none;height:22px;padding:0 9px;border:.5px solid var(--dsw-alias-border-l1);
  border-radius:999px;background:var(--dsw-alias-bg-layer-1);
  color:var(--dsw-alias-label-secondary);font:inherit;font-size:11px;line-height:1;
  cursor:pointer;white-space:nowrap;box-sizing:border-box;
}
.pv-preset:hover{color:var(--dsw-alias-brand-primary, #2b7fff);border-color:var(--dsw-alias-brand-primary, #2b7fff)}
.pv-preset-count{color:var(--dsw-alias-label-tertiary);font-size:10px;margin-left:3px}
.pv-preset:hover .pv-preset-count{color:var(--dsw-alias-brand-primary, #2b7fff)}
.pv-presets-hint{display:flex;align-items:center;color:var(--dsw-alias-label-tertiary);font-size:11px;white-space:nowrap;overflow:visible}
.pv-page-tag{
  position:absolute;left:6px;top:6px;height:18px;padding:0 6px;display:inline-flex;
  align-items:center;border-radius:4px;background:rgba(0,0,0,.55);color:#fff;
  font-size:10px;line-height:1;
}
.pv-card-badges{
  position:absolute;left:6px;bottom:6px;display:flex;gap:4px;
}
.pv-r18-tag{
  height:16px;padding:0 5px;display:inline-flex;
  align-items:center;border-radius:4px;background:rgba(180,60,60,.85);color:#fff;
  font-size:10px;line-height:1;
}
.pv-ai-tag{
  height:16px;padding:0 5px;display:inline-flex;
  align-items:center;border-radius:4px;background:rgba(96,86,180,.85);color:#fff;
  font-size:10px;line-height:1;
}
.pv-card-dl{
  position:absolute;right:6px;bottom:6px;display:flex;gap:4px;opacity:0;
  transition:opacity .12s ease;
}
.pv-card:hover .pv-card-dl,.pv-card:focus-within .pv-card-dl{opacity:1}

/* ── 空态 / 加载 / 错误 ─────────────────────────────────────────────── */
.pv-state{
  position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;
  justify-content:center;gap:10px;color:var(--dsw-alias-label-tertiary);font-size:13px;
}
.pv-spinner{
  width:22px;height:22px;border-radius:50%;
  border:2px solid var(--dsw-alias-border-l2);border-top-color:var(--dsw-alias-brand-primary, #2b7fff);
  animation:pv-spin .8s linear infinite;
}
@keyframes pv-spin{to{transform:rotate(360deg)}}
.pv-error{color:var(--dsw-alias-state-error-primary)}

/* ── 底部状态栏 / 分页 ───────────────────────────────────────────────── */
.pv-statusbar{flex:none;display:flex;align-items:center;justify-content:space-between;gap:12px;min-width:0}
.pv-status-label{
  min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  font-size:12px;color:var(--dsw-alias-label-tertiary);
}
.pv-status-refresh{
  display:inline-flex;align-items:center;gap:5px;border:none;background:none;padding:0;
  color:var(--dsw-alias-state-business-primary, #2b7fff);font:inherit;font-size:12px;cursor:pointer;
}
.pv-status-refresh:hover{text-decoration:underline}
.pv-pager{flex:none;display:flex;align-items:center;gap:10px;padding:2px 0}
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
  padding:0 14px;border:.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-sm);
  background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;font-weight:500;
  line-height:1.2;cursor:pointer;box-sizing:border-box;white-space:nowrap;
  -webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;
}
.pv-btn svg{flex:none}
.pv-btn:hover{border-color:var(--dsw-alias-border-l3);background:var(--dsw-alias-bg-layer-1)}
.pv-btn.pv-primary{background:#2b7fff;border-color:#2b7fff;color:#fff}
.pv-btn.pv-primary:hover{background:#1f6ae0;border-color:#1f6ae0}
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
  flex:none;display:grid;grid-template-columns:1fr minmax(0,auto) 1fr;align-items:center;gap:12px;
  padding:12px 18px;background:linear-gradient(180deg,rgba(0,0,0,.5),transparent);position:relative;z-index:2;
}
.pv-viewer-title{
  grid-column:2;justify-self:center;text-align:center;max-width:min(58vw,560px);
  font-size:14px;font-weight:600;line-height:20px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
}
.pv-viewer-close{flex:none;white-space:nowrap}
.pv-viewer-left{grid-column:1;justify-self:start;display:flex;align-items:center;gap:10px;min-width:0}
.pv-viewer-pid{color:#9aa;font-size:11px;font-variant-numeric:tabular-nums;white-space:nowrap}
.pv-viewer-stage{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;position:relative;padding:8px 64px;box-sizing:border-box;overflow:hidden}
.pv-viewer-spinner{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none}
.pv-viewer-img{max-width:100%;max-height:100%;object-fit:contain;border-radius:6px;box-shadow:0 12px 48px rgba(0,0,0,.6)}
.pv-viewer-img.pv-viewer-img-hidden{opacity:0}
.pv-viewer-img-zoom{cursor:grab}
.pv-viewer-img-zoom:active{cursor:grabbing}
.pv-viewer-error{
  display:flex;flex-direction:column;align-items:center;gap:12px;
  color:#bbb;font-size:13px;
}
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
.pv-viewer-btn.pv-bookmarked{border-color:transparent;background:#e5484d;color:#fff}
.pv-viewer-author{max-width:240px;overflow:hidden}
.pv-viewer-author-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pv-viewer-author-id{color:#9aa;font-size:11px;font-variant-numeric:tabular-nums;white-space:nowrap}
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
  -webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;
}
.pv-modal-close:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2)}
.pv-modal-hint{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}
.pv-modal-hint a{color:var(--dsw-alias-brand-primary, #2b7fff);text-decoration:none}
.pv-modal-hint a:hover{text-decoration:underline}
.pv-field{display:flex;flex-direction:column;gap:5px}
.pv-field-label{font-size:12px;color:var(--dsw-alias-label-secondary)}
.pv-field input{height:30px}
.pv-divider{display:flex;align-items:center;gap:10px;color:var(--dsw-alias-label-tertiary);font-size:11px}
.pv-divider:before,.pv-divider:after{content:"";flex:1;height:1px;background:var(--dsw-alias-border-l1)}
.pv-modal-err{font-size:12px;color:var(--dsw-alias-state-error-primary);line-height:17px;white-space:pre-wrap}
.pv-modal-row{display:flex;justify-content:flex-end;gap:8px}
.pv-details{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}
.pv-details summary{cursor:pointer;color:var(--dsw-alias-brand-primary);margin-bottom:4px}

/* ── Toast ──────────────────────────────────────────────────────────── */
.pv-toast-stack{
  position:fixed;top:18px;left:50%;transform:translateX(-50%);z-index:1400;
  display:flex;flex-direction:column;align-items:center;gap:8px;pointer-events:none;
}
.pv-toast{
  display:flex;align-items:center;gap:8px;
  max-width:min(520px,calc(100vw - 48px));padding:8px 14px;border-radius:8px;
  background:var(--dsw-alias-bg-layer-2);border:.5px solid var(--dsw-alias-border-l2);
  color:var(--dsw-alias-label-primary);font-size:12px;line-height:18px;
  box-shadow:var(--dsw-elevation-soft);box-sizing:border-box;
}
.pv-toast.pv-error{border-color:var(--dsw-alias-state-error-primary)}
.pv-toast.pv-success{border-color:var(--dsw-alias-state-success-primary)}
.pv-toast-spinner{width:12px;height:12px;border-width:2px;flex:none}

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
        case 'cookie_required': return t0('cookie.required')
        case 'cookie_expired': return t0('cookie.expired')
        case 'rate_limited': return t0('rate.limited')
        case 'unsupported': return t0('unsupported')
        case 'network':
        case 'network_error': return t0('network.error')
        default: return error?.message || String(error)
      }
    }

    let t0 = makeT()

    function imgProxy(url) {
      return `${BASE}/img?url=${encodeURIComponent(url)}`
    }

    // ClipboardItem only accepts a handful of image MIME types; anything else
    // (or a missing type) must be re-encoded to PNG first.
    const CLIP_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])

    function toPngBlob(blob) {
      return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(blob)
        const img = new Image()
        img.onload = () => {
          URL.revokeObjectURL(url)
          try {
            const canvas = document.createElement('canvas')
            canvas.width = img.naturalWidth
            canvas.height = img.naturalHeight
            canvas.getContext('2d').drawImage(img, 0, 0)
            canvas.toBlob((out) => (out ? resolve(out) : reject(new Error('encode failed'))), 'image/png')
          } catch (error) {
            reject(error)
          }
        }
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode failed')) }
        img.src = url
      })
    }

    // async Clipboard API — the same path the host app itself uses for image
    // copy; needs the clipboard-write permission but no user gesture
    async function writeImageClipboard(blob) {
      let data = blob
      let type = blob.type || ''
      if (!CLIP_IMAGE_TYPES.has(type)) {
        data = await toPngBlob(blob)
        type = 'image/png'
      }
      if (!window.ClipboardItem || !navigator.clipboard?.write) {
        throw new Error('clipboard api unavailable')
      }
      await navigator.clipboard.write([new ClipboardItem({ [type]: data })])
    }

    async function copyImageBlob(blob) {
      try {
        await writeImageClipboard(blob)
        return
      } catch (error) {
        // The webview clipboard APIs are unreliable (the async API is
        // permission-gated; execCommand reports success but writes text-only),
        // so fall back to the host writing the Windows clipboard directly.
        let png = blob
        if ((blob.type || '') !== 'image/png') {
          try {
            png = await toPngBlob(blob)
          } catch {
            throw error
          }
        }
        try {
          const res = await fetch(`${BASE}/copy`, { method: 'POST', body: png })
          if (res.ok) return
          const data = await res.json().catch(() => null)
          throw Object.assign(new Error(data?.error?.message || `HTTP ${res.status}`), { code: data?.error?.code ?? 'clipboard' })
        } catch (fallback) {
          throw fallback?.code ? fallback : error
        }
      }
    }

    // fetch-then-download: unlike a bare <a download> click, the fetch makes
    // failures observable so the UI can toast them
    async function downloadImage(url, baseName) {
      const response = await fetch(imgProxy(url))
      if (!response.ok) throw new Error(`http ${response.status}`)
      const blob = await response.blob()
      const ext = (url.match(/\.(png|gif|jpe?g|webp|bmp|avif)(?:\?|$)/i)?.[1] ?? 'jpg').toLowerCase().replace('jpeg', 'jpg')
      const objectUrl = URL.createObjectURL(blob)
      try {
        const link = document.createElement('a')
        link.href = objectUrl
        link.download = `${baseName}.${ext}`
        document.body.appendChild(link)
        link.click()
        link.remove()
      } finally {
        setTimeout(() => URL.revokeObjectURL(objectUrl), 30000)
      }
    }

    // ------------------------------------------------------------------ caches

    // In-memory view cache: identical queries reuse the last result instead
    // of round-tripping the host (and the pixiv rate limiter) again.
    const VIEW_CACHE_TTL = 5 * 60 * 1000
    const viewCache = new Map()

    function viewCacheGet(key) {
      const entry = viewCache.get(key)
      if (!entry || entry.at + VIEW_CACHE_TTL < Date.now()) {
        if (entry) viewCache.delete(key)
        return undefined
      }
      return entry.value
    }

    function viewCacheSet(key, value) {
      viewCache.set(key, { value, at: Date.now() })
      while (viewCache.size > 40) viewCache.delete(viewCache.keys().next().value)
    }

    function viewCacheDelete(key) {
      viewCache.delete(key)
    }

    function viewCacheClear() {
      viewCache.clear()
    }

    // In-memory detail cache for the viewer: re-opening a work within the TTL
    // skips the /illust round-trip. Cleared whenever bookmarks change.
    const DETAIL_TTL = 5 * 60 * 1000
    const detailCache = new Map()

    async function fetchDetail(id) {
      const hit = detailCache.get(id)
      if (hit && hit.at + DETAIL_TTL > Date.now()) return hit.value
      const value = await api(`/illust/${id}`)
      detailCache.set(id, { value, at: Date.now() })
      while (detailCache.size > 60) detailCache.delete(detailCache.keys().next().value)
      return value
    }

    // ------------------------------------------------------------------ prefs

    const DEFAULT_PREFS = { r18: false, hideAi: true, sort: 'date_desc' }

    // r18 / hideAi are deliberately session-only (each open starts from the
    // safe defaults); only the sort preference survives across sessions.
    function loadPrefs() {
      try {
        const raw = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}')
        const sort = ['date_desc', 'date_asc', 'popular_d'].includes(raw.sort) ? raw.sort : DEFAULT_PREFS.sort
        return { ...DEFAULT_PREFS, sort }
      } catch {
        return { ...DEFAULT_PREFS }
      }
    }

    function savePrefs(prefs) {
      try {
        localStorage.setItem(PREFS_KEY, JSON.stringify({ sort: prefs.sort }))
      } catch {
        /* storage unavailable */
      }
    }

    // ------------------------------------------------------------------ atoms

    const CATEGORIES = [
      { key: '', labelKey: 'all', words: [] },
      { key: 'genshin', labelKey: 'cat.genshin', words: ['原神'] },
      { key: 'hsr', labelKey: 'cat.hsr', words: ['崩坏：星穹铁道', '崩壊：スターレイル'] },
      { key: 'zzz', labelKey: 'cat.zzz', words: ['绝区零', 'ゼンレスゾーンゼロ'] },
      { key: 'tot', labelKey: 'cat.tot', words: ['未定事件簿', 'Tears of Themis'] },
    ]

    const SORTS = [
      { key: 'date_desc', labelKey: 'sort.date_desc' },
      { key: 'date_asc', labelKey: 'sort.date_asc' },
      { key: 'popular_d', labelKey: 'sort.popular_d' },
    ]

    const TYPES = [
      { key: 'tag', labelKey: 'type.tag' },
      { key: 'title', labelKey: 'type.title' },
      { key: 'user', labelKey: 'type.user' },
      { key: 'pid', labelKey: 'type.pid' },
    ]

    const TIERS = [
      { key: '', labelKey: 'tier.none' },
      { key: '100users入り', labelKey: '100users入り' },
      { key: '500users入り', labelKey: '500users入り' },
      { key: '1000users入り', labelKey: '1000users入り' },
      { key: '3000users入り', labelKey: '3000users入り' },
      { key: '5000users入り', labelKey: '5000users入り' },
      { key: '10000users入り', labelKey: '10000users入り' },
    ]

    const TIER_MIN = {
      '100users入り': 100,
      '500users入り': 500,
      '1000users入り': 1000,
      '3000users入り': 3000,
      '5000users入り': 5000,
      '10000users入り': 10000,
    }

    // local filter helpers for the bookmarks list (no pixiv round-trip:
    // everything is already in memory)

    function funnelText(list, filter) {
      const query = filter.trim().toLowerCase()
      if (!query) return list
      return list.filter((item) =>
        (item.title ?? '').toLowerCase().includes(query)
        || (item.userName ?? '').toLowerCase().includes(query)
        || (item.tags ?? []).some((tag) => (tag.name ?? '').toLowerCase().includes(query)),
      )
    }

    function localMatch(item, view, prefs) {
      if (!prefs.r18 && item.xRestrict > 0) return false
      if (prefs.hideAi && item.aiType === 2) return false
      const tierMin = TIER_MIN[view.tier]
      if (tierMin && (item.totalBookmarks ?? 0) < tierMin) return false
      const cat = CATEGORIES.find((entry) => entry.key === view.category)
      if (cat?.words?.length) {
        const hit = (item.tags ?? []).some((tag) =>
          cat.words.some((word) => (tag.name ?? '').toLowerCase() === word.toLowerCase()))
        if (!hit) return false
      }
      const raw = (view.word ?? '').trim()
      if (!raw) return true
      if (view.searchType === 'pid') {
        return String(item.id) === raw || String(item.id).includes(raw)
      }
      if (view.searchType === 'user') {
        if (/^\d+$/.test(raw)) return Number(item.userId) === Number(raw)
        return (item.userName ?? '').toLowerCase().includes(raw.toLowerCase())
      }
      if (view.searchType === 'title') {
        return (item.title ?? '').toLowerCase().includes(raw.toLowerCase())
      }
      // tag: | union, + intersection, - exclusion, partial match — operators
      // only count as standalone tokens (spaces on both sides); a symbol
      // attached to a word is part of the tag name ("R-18", "C++")
      const tokens = raw
        .replace(/｜/g, '|').replace(/＋/g, '+').replace(/－/g, '-')
        .split(/\s+/).filter(Boolean)
      if (tokens.length === 0) return true
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
      if (current.length > 0) groups.push(current)
      const tags = (item.tags ?? []).map((tag) => (tag.name ?? '').toLowerCase())
      const negatives = []
      let matched = false
      for (const group of groups) {
        const positives = []
        let pendingNegative = false
        for (const token of group) {
          if (token === '-') {
            pendingNegative = true
            continue
          }
          if (token === '+') continue
          if (pendingNegative) {
            pendingNegative = false
            negatives.push(token.toLowerCase())
            continue
          }
          positives.push(token.toLowerCase())
        }
        if (positives.length > 0 && positives.every((token) => tags.some((name) => name.includes(token)))) matched = true
      }
      if (!matched) return false
      return !negatives.some((term) => tags.some((name) => name.includes(term)))
    }

    function sortItems(list, sort) {
      const time = (value) => (value ? new Date(value).getTime() : 0)
      const arr = [...list]
      if (sort === 'date_asc') arr.sort((a, b) => time(a.createDate) - time(b.createDate))
      else if (sort === 'popular_d') arr.sort((a, b) => (b.totalBookmarks ?? 0) - (a.totalBookmarks ?? 0))
      else arr.sort((a, b) => time(b.createDate) - time(a.createDate))
      return arr
    }

    // j = pixiv 实际使用的日文标签；z = 中文释义；aliases = 额外别称（联想匹配用）
    const TAG_DATA = [
      // ── 人物 / 原创 / 性格关系 ──
      ['オリジナル', '原创'],
      ['女の子', '女孩'],
      ['美少女', '美少女'],
      ['少女', '少女'],
      ['男の子', '男孩'],
      ['少年', '少年'],
      ['女性', '女性'],
      ['男性', '男性'],
      ['カップル', '情侣'],
      ['夫婦', '夫妇'],
      ['兄妹', '兄妹'],
      ['姉妹', '姐妹'],
      ['姉弟', '姐弟'],
      ['親子', '亲子'],
      ['yuri', '百合', ['GL']],
      ['BL', '耽美'],
      ['腐向け', '腐向'],
      ['擬人化', '拟人化'],
      ['獣人', '兽人', ['ケモノ']],
      ['獣耳', '兽耳', ['ケモミミ']],
      ['妖怪', '妖怪'],
      ['幽霊', '幽灵'],
      ['神様', '神明'],
      ['女神', '女神'],
      ['天使', '天使'],
      ['堕天使', '堕天使'],
      ['悪魔', '恶魔'],
      ['死神', '死神'],
      ['吸血鬼', '吸血鬼', ['ヴァンパイア']],
      ['サキュバス', '魅魔'],
      ['インキュバス', '梦魔'],
      ['エルフ', '精灵'],
      ['ダークエルフ', '暗精灵'],
      ['ハーフエルフ', '半精灵'],
      ['人魚', '人鱼'],
      ['マーメイド', '美人鱼'],
      ['ドラゴン', '龙', ['竜', '龍']],
      ['スライム', '史莱姆'],
      ['ゴーレム', '魔像'],
      ['ゾンビ', '僵尸'],
      ['ミイラ', '木乃伊'],
      ['フランケン', '弗兰肯斯坦'],
      ['魔法使い', '魔法使'],
      ['魔女', '魔女'],
      ['魔法少女', '魔法少女'],
      ['勇者', '勇者'],
      ['魔王', '魔王'],
      ['剣士', '剑士'],
      ['騎士', '骑士'],
      ['姫', '公主'],
      ['王女', '王女'],
      ['王子', '王子'],
      ['女王', '女王'],
      ['お嬢様', '大小姐'],
      ['執事', '执事'],
      ['メイド', '女仆'],
      ['メイド服', '女仆装'],
      ['バニーガール', '兔女郎'],
      ['ナース', '护士'],
      ['巫女', '巫女'],
      ['忍者', '忍者'],
      ['くノ一', '女忍者'],
      ['侍', '武士'],
      ['僧侶', '僧侣'],
      ['神父', '神父'],
      ['シスター', '修女'],
      ['アイドル', '偶像'],
      ['VTuber', '虚拟主播', ['バーチャルYouTuber']],
      ['配信者', '主播'],
      ['ボカロ', 'V家', ['VOCALOID']],
      ['VOCALOID', 'VOCALOID'],
      ['ロボット', '机器人'],
      ['アンドロイド', '人造人'],
      ['メカ', '机甲'],
      ['サイボーグ', '改造人'],
      ['男の娘', '伪娘'],
      ['女装', '女装'],
      ['男装', '男装'],
      ['ツンデレ', '傲娇'],
      ['ヤンデレ', '病娇'],
      ['クーデレ', '酷娇'],
      ['天然', '天然呆'],
      ['クール', '冷酷'],
      ['元気', '元气'],
      ['甘えん坊', '爱撒娇'],
      ['幼馴染', '青梅竹马', ['幼なじみ']],
      ['先輩', '前辈'],
      ['後輩', '后辈'],
      ['委員長', '委员长'],
      ['風紀委員', '风纪委员'],
      ['同級生', '同班同学'],
      ['転校生', '转学生'],
      ['幼女', '幼女'],
      ['ロリ', '萝莉'],
      ['ショタ', '正太'],
      ['姉', '姐姐'],
      ['妹', '妹妹'],
      ['義妹', '义妹'],
      ['義姉', '义姐'],
      ['母', '母亲'],
      ['先生', '老师'],
      ['教え子', '学生'],
      // ── 自然 / 风景 / 季节 ──
      ['風景', '风景'],
      ['自然', '自然'],
      ['空', '天空'],
      ['青空', '蓝天'],
      ['星空', '星空'],
      ['夜空', '夜空'],
      ['夕焼け', '晚霞', ['夕阳', '黄昏']],
      ['朝焼け', '朝霞', ['日出']],
      ['月', '月亮'],
      ['満月', '满月'],
      ['三日月', '新月'],
      ['太陽', '太阳'],
      ['宇宙', '宇宙'],
      ['惑星', '星球'],
      ['銀河', '银河'],
      ['オーロラ', '极光'],
      ['雲', '云'],
      ['虹', '彩虹'],
      ['海', '大海'],
      ['砂浜', '沙滩'],
      ['ビーチ', '海滩'],
      ['島', '岛屿'],
      ['森', '森林'],
      ['樹木', '树木'],
      ['山', '山'],
      ['富士山', '富士山'],
      ['川', '河流'],
      ['湖', '湖泊'],
      ['滝', '瀑布'],
      ['温泉', '温泉'],
      ['洞窟', '洞窟'],
      ['草原', '草原'],
      ['花畑', '花田'],
      ['花', '花'],
      ['桜', '樱花'],
      ['向日葵', '向日葵'],
      ['紫陽花', '绣球花'],
      ['薔薇', '玫瑰', ['バラ']],
      ['百合の花', '百合花'],
      ['コスモス', '波斯菊'],
      ['たんぽぽ', '蒲公英'],
      ['睡蓮', '睡莲'],
      ['雪景色', '雪景'],
      ['雪', '雪'],
      ['雨', '雨'],
      ['雷', '雷电'],
      ['嵐', '暴风雨'],
      ['台風', '台风'],
      ['紅葉', '红叶'],
      ['春', '春天'],
      ['夏', '夏天'],
      ['秋', '秋天'],
      ['冬', '冬天'],
      ['花火', '烟花', ['烟火']],
      ['祭り', '夏日祭', ['祭典']],
      ['クリスマス', '圣诞', ['圣诞节']],
      ['ハロウィン', '万圣节'],
      ['バレンタイン', '情人节'],
      ['ホワイトデー', '白色情人节'],
      ['お正月', '新年'],
      ['初詣', '新年参拜'],
      ['ひな祭り', '女儿节'],
      ['七夕', '七夕'],
      ['月見', '赏月'],
      ['花見', '赏花'],
      ['夜景', '夜景'],
      ['朝', '早晨'],
      ['昼', '白天'],
      ['夕方', '傍晚'],
      ['夜', '夜晚'],
      ['真夜中', '深夜'],
      ['海辺', '海边'],
      ['水中', '水下'],
      ['空飛ぶ', '飞行'],
      ['浮遊', '漂浮'],
      ['ホラー', '恐怖'],
      // ── 食物 / 饮品 ──
      ['食べ物', '食物'],
      ['料理', '料理'],
      ['スイーツ', '甜点'],
      ['ケーキ', '蛋糕'],
      ['チョコレート', '巧克力'],
      ['アイスクリーム', '冰淇淋'],
      ['パフェ', '芭菲'],
      ['クレープ', '可丽饼'],
      ['プリン', '布丁'],
      ['ゼリー', '果冻'],
      ['マカロン', '马卡龙'],
      ['ドーナツ', '甜甜圈'],
      ['パンケーキ', '松饼'],
      ['ワッフル', '华夫饼'],
      ['クッキー', '曲奇'],
      ['キャンディ', '糖果', ['飴']],
      ['たい焼き', '鲷鱼烧'],
      ['たこ焼き', '章鱼烧'],
      ['おにぎり', '饭团'],
      ['弁当', '便当'],
      ['朝食', '早餐'],
      ['昼食', '午餐'],
      ['夕食', '晚餐'],
      ['カレー', '咖喱'],
      ['ラーメン', '拉面'],
      ['そば', '荞麦面'],
      ['うどん', '乌冬面'],
      ['寿司', '寿司'],
      ['刺身', '刺身'],
      ['天ぷら', '天妇罗'],
      ['焼肉', '烤肉'],
      ['焼き鳥', '烤串'],
      ['おでん', '关东煮'],
      ['鍋', '火锅'],
      ['ピザ', '披萨'],
      ['ハンバーガー', '汉堡'],
      ['パン', '面包'],
      ['サンドイッチ', '三明治'],
      ['オムライス', '蛋包饭'],
      ['ハンバーグ', '汉堡肉'],
      ['パスタ', '意面'],
      ['スパゲッティ', '意大利面'],
      ['餃子', '饺子'],
      ['肉まん', '肉包'],
      ['和菓子', '和果子'],
      ['餅', '年糕'],
      ['団子', '团子'],
      ['大福', '大福'],
      ['コーヒー', '咖啡'],
      ['紅茶', '红茶'],
      ['緑茶', '绿茶'],
      ['抹茶', '抹茶'],
      ['ミルク', '牛奶'],
      ['ジュース', '果汁'],
      ['サイダー', '汽水'],
      ['ラムネ', '波子汽水'],
      ['ビール', '啤酒'],
      ['ワイン', '红酒'],
      ['カクテル', '鸡尾酒'],
      ['酒', '酒'],
      ['日本酒', '日本酒'],
      // ── 动物 / 幻想生物 ──
      ['猫', '猫'],
      ['子猫', '小猫'],
      ['猫耳', '猫耳'],
      ['猫娘', '猫娘'],
      ['犬', '狗'],
      ['子犬', '小狗'],
      ['犬耳', '犬耳'],
      ['うさぎ', '兔子'],
      ['兎耳', '兔耳'],
      ['ハムスター', '仓鼠'],
      ['リス', '松鼠'],
      ['鼠', '老鼠'],
      ['熊', '熊'],
      ['パンダ', '熊猫'],
      ['狐', '狐狸'],
      ['狐耳', '狐耳', ['狐娘']],
      ['狼', '狼'],
      ['虎', '老虎'],
      ['ライオン', '狮子'],
      ['象', '大象'],
      ['馬', '马'],
      ['鹿', '鹿'],
      ['羊', '羊'],
      ['ヤギ', '山羊'],
      ['牛', '牛'],
      ['豚', '猪'],
      ['鳥', '鸟'],
      ['小鳥', '小鸟'],
      ['フクロウ', '猫头鹰'],
      ['ペンギン', '企鹅'],
      ['白鳥', '天鹅'],
      ['カラス', '乌鸦'],
      ['鳩', '鸽子'],
      ['鶏', '鸡'],
      ['魚', '鱼'],
      ['金魚', '金鱼'],
      ['熱帯魚', '热带鱼'],
      ['イルカ', '海豚'],
      ['クジラ', '鲸鱼'],
      ['シャチ', '虎鲸'],
      ['タコ', '章鱼'],
      ['イカ', '鱿鱼'],
      ['カニ', '螃蟹'],
      ['エビ', '虾'],
      ['カメ', '乌龟'],
      ['カエル', '青蛙'],
      ['トカゲ', '蜥蜴'],
      ['ヘビ', '蛇'],
      ['カマキリ', '螳螂'],
      ['蝶', '蝴蝶'],
      ['蜂', '蜜蜂'],
      ['クモ', '蜘蛛'],
      ['クラゲ', '水母'],
      ['恐竜', '恐龙'],
      ['ユニコーン', '独角兽'],
      ['ペガサス', '天马'],
      ['グリフォン', '狮鹫'],
      ['フェニックス', '凤凰'],
      ['ケルベロス', '地狱犬'],
      // ── 发型 / 发色 ──
      ['金髪', '金发'],
      ['黒髪', '黑发'],
      ['白髪', '白发'],
      ['銀髪', '银发'],
      ['青髪', '蓝发'],
      ['水色髪', '水色发'],
      ['緑髪', '绿发'],
      ['ピンク髪', '粉发'],
      ['桃色髪', '桃色发'],
      ['赤髪', '红发'],
      ['紫髪', '紫发'],
      ['茶髪', '棕发'],
      ['オレンジ髪', '橙发'],
      ['灰色髪', '灰发'],
      ['虹色髪', '彩虹发'],
      ['ショートカット', '短发', ['ショートヘア']],
      ['ロングヘア', '长发'],
      ['ミディアム', '中长发', ['セミロング']],
      ['ボブ', '波波头'],
      ['ツインテール', '双马尾'],
      ['ポニーテール', '单马尾', ['马尾']],
      ['サイドテール', '侧马尾'],
      ['アホ毛', '呆毛'],
      ['縦ロール', '纵卷发'],
      ['姫カット', '姬发式'],
      ['お団子ヘア', '团子头'],
      ['三つ編み', '三股辫'],
      ['おさげ', '麻花辫'],
      ['ウェーブヘア', '波浪发'],
      ['ストレートヘア', '直发'],
      ['触角ヘア', '触角发'],
      ['ボサボサ', '乱发'],
      ['寝癖', '起床呆毛'],
      ['ハーフアップ', '半扎发'],
      ['メッシュ', '挑染'],
      ['グラデーション髪', '渐变发'],
      // ── 服饰 / 配饰 ──
      ['眼鏡', '眼镜', ['メガネ']],
      ['サングラス', '墨镜'],
      ['伊達眼鏡', '装饰眼镜'],
      ['リボン', '缎带', ['蝴蝶结']],
      ['フリル', '褶边'],
      ['レース', '蕾丝'],
      ['ドレス', '礼服'],
      ['ウェディングドレス', '婚纱'],
      ['和服', '和服', ['着物']],
      ['浴衣', '浴衣'],
      ['振袖', '振袖'],
      ['巫女服', '巫女服'],
      ['チャイナドレス', '旗袍'],
      ['ゴスロリ', '哥特萝莉'],
      ['ロリータ', '洛丽塔'],
      ['セーラー服', '水手服'],
      ['制服', '制服'],
      ['ブレザー', '西装校服'],
      ['体操服', '体操服'],
      ['ブルマ', '运动短裤'],
      ['スクール水着', '学校泳装'],
      ['水着', '泳装'],
      ['ビキニ', '比基尼'],
      ['ワンピース水着', '连体泳衣'],
      ['競泳水着', '竞技泳装'],
      ['ワンピース', '连衣裙', ['海贼王']],
      ['ミニスカート', '迷你裙'],
      ['プリーツスカート', '百褶裙'],
      ['ロングスカート', '长裙'],
      ['ジーンズ', '牛仔裤'],
      ['ショートパンツ', '短裤'],
      ['スカート', '裙子'],
      ['ジャージ', '运动服'],
      ['パーカー', '卫衣'],
      ['Tシャツ', 'T恤'],
      ['シャツ', '衬衫'],
      ['ブラウス', '女式衬衫'],
      ['スーツ', '西装'],
      ['ネクタイ', '领带'],
      ['ベスト', '马甲'],
      ['コート', '大衣'],
      ['マフラー', '围巾'],
      ['手袋', '手套'],
      ['帽子', '帽子'],
      ['ベレー帽', '贝雷帽'],
      ['麦わら帽子', '草帽'],
      ['キャップ', '鸭舌帽'],
      ['ニット帽', '针织帽'],
      ['ヘッドフォン', '耳机'],
      ['イヤホン', '耳塞'],
      ['イヤリング', '耳环'],
      ['ピアス', '耳钉'],
      ['ネックレス', '项链'],
      ['チョーカー', '颈环'],
      ['髪飾り', '发饰'],
      ['カチューシャ', '发箍'],
      ['シュシュ', '发圈'],
      ['マスク', '口罩'],
      ['眼帯', '眼罩'],
      ['包帯', '绷带'],
      ['絆創膏', '创可贴'],
      ['エプロン', '围裙'],
      ['パジャマ', '睡衣'],
      ['ネグリジェ', '睡裙'],
      ['下着', '内衣'],
      ['ブラジャー', '文胸'],
      ['パンツ', '内裤'],
      ['ランジェリー', '蕾丝内衣'],
      ['バスタオル', '浴巾'],
      ['タオル', '毛巾'],
      ['羽織', '羽织'],
      ['マント', '披风'],
      ['ケープ', '斗篷'],
      ['鎧', '铠甲'],
      ['鎧兜', '甲胄'],
      ['軍服', '军服'],
      ['軍帽', '军帽'],
      ['迷彩', '迷彩'],
      ['ミリタリー', '军武'],
      ['レオタード', '紧身衣'],
      ['チュチュ', '芭蕾裙'],
      ['バレエ', '芭蕾'],
      ['ゴシック', '哥特'],
      ['アンティーク', '古董风'],
      ['セーラー', '水手'],
      // ── 身体 / 部位 / 姿势 ──
      ['ニーソックス', '过膝袜'],
      ['ニーハイ', '及膝袜'],
      ['タイツ', '丝袜'],
      ['黒タイツ', '黑丝'],
      ['パンスト', '连裤袜'],
      ['網タイツ', '网袜'],
      ['ガーターベルト', '吊带袜'],
      ['絶対領域', '绝对领域'],
      ['ふともも', '大腿', ['太もも']],
      ['むちむち', '肉感'],
      ['ぽっちゃり', '丰满'],
      ['スレンダー', '苗条'],
      ['巨乳', '巨乳'],
      ['貧乳', '贫乳'],
      ['微乳', '微乳'],
      ['おっぱい', '胸部'],
      ['胸チラ', '露胸'],
      ['おへそ', '肚脐'],
      ['腋', '腋下', ['わき']],
      ['背中', '后背'],
      ['素肌', '肌肤'],
      ['裸足', '赤脚'],
      ['素足', '光脚'],
      ['足', '脚'],
      ['脚', '腿'],
      ['手', '手'],
      ['指', '手指'],
      ['鎖骨', '锁骨'],
      ['うなじ', '后颈'],
      ['尻', '臀部'],
      ['お尻', '屁股'],
      ['褐色肌', '褐色皮肤'],
      ['色白', '白皮肤'],
      ['日焼け', '晒痕'],
      ['タトゥー', '纹身'],
      ['ほくろ', '美人痣'],
      ['そばかす', '雀斑'],
      ['傷跡', '伤痕'],
      ['オッドアイ', '异色瞳'],
      ['青い目', '蓝眼睛'],
      ['赤い目', '红眼睛'],
      ['金目', '金瞳'],
      ['碧眼', '碧眼'],
      ['三白眼', '三白眼'],
      ['ジト目', '死鱼眼'],
      ['タレ目', '下垂眼'],
      ['笑顔', '笑容'],
      ['泣き顔', '哭脸'],
      ['照れ顔', '害羞脸'],
      ['怒り顔', '生气脸'],
      ['寝顔', '睡颜'],
      ['あくび', '打哈欠'],
      ['ウインク', '眨眼'],
      ['舌出し', '吐舌'],
      ['にっこり', '微笑'],
      ['涎', '流口水'],
      ['頬染め', '脸红', ['赤面']],
      ['涙', '眼泪'],
      ['照れる', '害羞'],
      // ── 行为 / 场景 ──
      ['ハグ', '拥抱', ['抱きしめる']],
      ['キス', '接吻'],
      ['手繋ぎ', '牵手'],
      ['添い寝', '陪睡'],
      ['膝枕', '膝枕'],
      ['お姫様抱っこ', '公主抱'],
      ['おんぶ', '背背'],
      ['耳かき', '掏耳朵', ['耳掃除']],
      ['読書', '读书'],
      ['勉強', '学习'],
      ['料理中', '做饭中'],
      ['食事', '吃饭'],
      ['睡眠', '睡觉'],
      ['お風呂', '洗澡'],
      ['入浴', '入浴'],
      ['シャワー', '淋浴'],
      ['歯磨き', '刷牙'],
      ['洗顔', '洗脸'],
      ['着替え', '换衣服'],
      ['体操', '体操'],
      ['ダンス', '跳舞'],
      ['歌う', '唱歌'],
      ['ピアノ', '钢琴'],
      ['ギター', '吉他'],
      ['バイオリン', '小提琴'],
      ['楽器', '乐器'],
      ['ゲーム', '游戏'],
      ['ゲーム中', '玩游戏'],
      ['自撮り', '自拍'],
      ['写真', '照片'],
      ['カメラ', '相机'],
      ['水遊び', '戏水'],
      ['海水浴', '海水浴'],
      ['スキー', '滑雪'],
      ['スケート', '滑冰'],
      ['サイクリング', '骑车'],
      ['ランニング', '跑步'],
      ['散歩', '散步'],
      ['買い物', '购物'],
      ['お茶', '喝茶'],
      ['コスプレ', 'Cosplay'],
      ['着ぐるみ', '玩偶装'],
      ['水族館', '水族馆'],
      ['遊園地', '游乐园'],
      ['観覧車', '摩天轮'],
      ['学校', '学校'],
      ['教室', '教室'],
      ['図書館', '图书馆'],
      ['病院', '医院'],
      ['電車', '电车'],
      ['車', '汽车'],
      ['バイク', '摩托车'],
      ['自転車', '自行车'],
      ['飛行機', '飞机'],
      ['宇宙船', '宇宙船'],
      ['部屋', '房间'],
      ['ベッド', '床'],
      ['お城', '城堡'],
      ['教会', '教堂'],
      ['神社', '神社'],
      ['鳥居', '鸟居'],
      // ── 画风 / 技法 / 氛围 ──
      ['イラスト', '插画'],
      ['漫画', '漫画'],
      ['アニメ', '动画'],
      ['厚塗り', '厚涂'],
      ['水彩', '水彩'],
      ['水彩風', '水彩风'],
      ['線画', '线稿'],
      ['ラフ', '草稿'],
      ['スケッチ', '速写'],
      ['落書き', '涂鸦'],
      ['モノクロ', '黑白', ['白黒']],
      ['デフォルメ', 'Q版'],
      ['ちびキャラ', 'Q版角色'],
      ['アニメ風', '动画风'],
      ['絵本風', '绘本风'],
      ['リアル', '写实'],
      ['油絵', '油画'],
      ['ドット絵', '像素画'],
      ['背景', '背景'],
      ['光と影', '光与影'],
      ['ファンタジー', '奇幻'],
      ['SF', '科幻'],
      ['スチームパンク', '蒸汽朋克'],
      ['サイバーパンク', '赛博朋克'],
      ['和風', '和风'],
      ['中華風', '中国风'],
      ['洋風', '西洋风'],
      ['エモい', '有感觉'],
      ['きれい', '美丽'],
      ['かわいい', '可爱'],
      ['最高傑作', '最高杰作'],
      ['神作画', '神作画'],
      // ── VOCALOID / 东方 / 虚拟主播 ──
      ['初音ミク', '初音未来', ['初音']],
      ['巡音ルカ', '巡音流歌'],
      ['鏡音リン', '镜音铃'],
      ['鏡音レン', '镜音连'],
      ['KAITO', 'KAITO'],
      ['MEIKO', 'MEIKO'],
      ['重音テト', '重音小豆'],
      ['可不', '可不'],
      ['結月ゆかり', '结月缘'],
      ['GUMI', 'GUMI'],
      ['IA', 'IA'],
      ['東方Project', '东方Project', ['东方']],
      ['博麗霊夢', '博丽灵梦', ['灵梦']],
      ['霧雨魔理沙', '雾雨魔理沙', ['魔理沙']],
      ['十六夜咲夜', '十六夜咲夜'],
      ['レミリア・スカーレット', '蕾米莉亚'],
      ['フランドール・スカーレット', '芙兰朵露'],
      ['パチュリー・ノーレッジ', '帕秋莉'],
      ['魂魄妖夢', '魂魄妖梦'],
      ['西行寺幽々子', '西行寺幽幽子'],
      ['八雲紫', '八云紫'],
      ['古明地こいし', '古明地恋'],
      ['古明地さとり', '古明地觉'],
      ['射命丸文', '射命丸文'],
      ['チルノ', '琪露诺'],
      ['鈴仙・優曇華院・イナバ', '铃仙'],
      ['東風谷早苗', '东风谷早苗'],
      ['風見幽香', '风见幽香'],
      ['蓬莱山輝夜', '蓬莱山辉夜'],
      ['藤原妹紅', '藤原妹红'],
      ['因幡てゐ', '因幡帝'],
      ['四季映姫・ヤマザナドゥ', '四季映姬'],
      ['上白沢慧音', '上白泽慧音'],
      ['アリス・マーガトロイド', '爱丽丝·玛格特罗伊德'],
      ['紅美鈴', '红美铃'],
      ['ホロライブ', 'Hololive', ['hololive']],
      ['兎田ぺこら', '兔田佩克拉'],
      ['星街すいせい', '星街彗星'],
      ['白上フブキ', '白上吹雪'],
      ['宝鐘マリン', '宝钟玛琳'],
      ['にじさんじ', '彩虹社'],
      ['月ノ美兎', '月之美兔'],
      // ── 游戏 ──
      ['原神', '原神'],
      ['甘雨', '甘雨'],
      ['胡桃', '胡桃'],
      ['神里綾華', '神里绫华'],
      ['雷電将軍', '雷电将军'],
      ['八重神子', '八重神子'],
      ['珊瑚宮心海', '珊瑚宫心海'],
      ['ナヒーダ', '纳西妲'],
      ['フリーナ', '芙宁娜'],
      ['モナ', '莫娜'],
      ['刻晴', '刻晴'],
      ['七七', '七七'],
      ['ディルック', '迪卢克'],
      ['ウェンティ', '温迪'],
      ['鍾離', '钟离'],
      ['魈', '魈'],
      ['蛍', '荧'],
      ['パイモン', '派蒙'],
      ['崩壊：スターレイル', '崩坏：星穹铁道', ['星穹铁道', '崩铁']],
      ['ブローニャ', '布洛妮娅'],
      ['銀狼', '银狼'],
      ['カフカ', '卡芙卡'],
      ['三月七', '三月七'],
      ['流蛍', '流萤'],
      ['知更鳥', '知更鸟'],
      ['ゼンレスゾーンゼロ', '绝区零'],
      ['エレン・ジョー', '艾莲'],
      ['アンビー', '安比'],
      ['ニコ', '妮可'],
      ['猫又', '猫又'],
      ['崩壊3rd', '崩坏3rd'],
      ['キアナ・カスラナ', '琪亚娜'],
      ['芽衣', '芽衣'],
      ['八重桜', '八重樱'],
      ['テレサ・アポカリプス', '德丽莎'],
      ['ブルーアーカイブ', '蔚蓝档案', ['碧蓝档案']],
      ['シロコ', '白子'],
      ['ホシノ', '星野'],
      ['ミカ', '未花'],
      ['アズールレーン', '碧蓝航线'],
      ['エンタープライズ', '企业'],
      ['アークナイツ', '明日方舟'],
      ['アーミヤ', '阿米娅'],
      ['エクシア', '能天使'],
      ['ウマ娘', '赛马娘'],
      ['プリンセスコネクト！', '公主连结'],
      ['Fate/GrandOrder', '命运冠位指定'],
      ['FGO', 'FGO'],
      ['アルトリア', '阿尔托莉雅'],
      ['セイバー', 'Saber'],
      ['マシュ', '玛修'],
      ['ジャンヌ・ダルク', '贞德'],
      ['艦隊これくしょん', '舰队Collection', ['舰娘']],
      ['艦これ', '舰C'],
      ['島風', '岛风'],
      ['雪風', '雪风'],
      ['金剛', '金刚'],
      ['加賀', '加贺'],
      ['赤城', '赤城'],
      ['ゼルダの伝説', '塞尔达传说'],
      ['リンク', '林克'],
      ['ゼルダ姫', '塞尔达公主'],
      ['スプラトゥーン', '喷射战士'],
      ['スーパーマリオ', '超级马里奥'],
      ['ピーチ姫', '碧姬公主'],
      ['ロゼッタ', '罗莎塔'],
      ['どうぶつの森', '动物森友会'],
      ['星のカービィ', '星之卡比'],
      ['ファイアーエムブレム', '火焰纹章'],
      ['ファイナルファンタジー', '最终幻想'],
      ['ティファ', '蒂法'],
      ['ストリートファイター', '街头霸王'],
      ['キャミィ', '嘉米'],
      ['キング・オブ・ファイターズ', '拳皇'],
      ['麻宮アテナ', '麻宫雅典娜'],
      ['鉄拳', '铁拳'],
      ['ドラゴンクエスト', '勇者斗恶龙'],
      ['マインクラフト', '我的世界'],
      ['刀剣乱舞', '刀剑乱舞'],
      ['三日月宗近', '三日月宗近'],
      ['ペルソナ', '女神异闻录'],
      ['ジョーカー', 'Joker'],
      ['エルデンリング', '艾尔登法环'],
      ['ダークソウル', '黑暗之魂'],
      ['モンスターハンター', '怪物猎人', ['モンハン', '怪猎']],
      ['プロジェクトセカイ', '世界计划', ['プロセカ']],
      ['ドールズフロントライン', '少女前线', ['少女前線']],
      ['NIKKE', '胜利女神NIKKE'],
      ['勝利の女神', '胜利女神'],
      ['バイオハザード', '生化危机'],
      ['デビルメイクライ', '鬼泣'],
      ['ベヨネッタ', '猎天使魔女'],
      ['デッドオアアライブ', '死或生'],
      ['かすみ', '霞'],
      ['仁王', '仁王'],
      ['只狼', '只狼', ['SEKIRO']],
      ['NieR', '尼尔', ['nier']],
      // ── 动画 / 漫画 ──
      ['ソードアート・オンライン', '刀剑神域'],
      ['アスナ', '亚丝娜'],
      ['Re:ゼロから始める異世界生活', '从零开始的异世界生活', ['从零开始']],
      ['エミリア', '艾米莉亚'],
      ['レム', '蕾姆'],
      ['ラム', '拉姆'],
      ['ご注文はうさぎですか？', '点兔'],
      ['五等分の花嫁', '五等分的花嫁'],
      ['かぐや様は告らせたい', '辉夜大小姐'],
      ['進撃の巨人', '进击的巨人'],
      ['ミカサ', '三笠'],
      ['鬼滅の刃', '鬼灭之刃'],
      ['竈門禰豆子', '祢豆子'],
      ['胡蝶しのぶ', '蝴蝶忍'],
      ['呪術廻戦', '咒术回战'],
      ['五条悟', '五条悟'],
      ['チェンソーマン', '电锯人'],
      ['マキマ', '玛奇玛'],
      ['パワー', '帕瓦'],
      ['ぼっち・ざ・ろっく！', '孤独摇滚'],
      ['SPY×FAMILY', '间谍过家家'],
      ['アーニャ', '阿尼亚'],
      ['葬送のフリーレン', '葬送的芙莉莲'],
      ['フリーレン', '芙莉莲'],
      ['推しの子', '我推的孩子', ['推子']],
      ['ブルーロック', '蓝色监狱'],
      ['ハイキュー!!', '排球少年'],
      ['名探偵コナン', '名侦探柯南'],
      ['リコリス・リコイル', '莉可丽丝'],
      ['NARUTO', '火影忍者'],
      ['ドラゴンボール', '龙珠'],
      ['エヴァンゲリオン', 'EVA', ['新世纪福音战士']],
      ['アスカ', '明日香'],
      ['綾波レイ', '绫波丽'],
      ['ジョジョの奇妙な冒険', 'JOJO的奇妙冒险', ['JOJO', 'jojo']],
      ['銀魂', '银魂'],
      ['ハンターハンター', '全职猎人'],
      ['ポケモン', '宝可梦', ['宠物小精灵', '口袋妖怪']],
      ['ピカチュウ', '皮卡丘'],
      ['イーブイ', '伊布'],
      ['サーナイト', '沙奈朵'],
      ['ミュウツー', '超梦'],
      ['ルカリオ', '路卡利欧'],
      ['けものフレンズ', '动物朋友'],
      ['ラブライブ！', 'LoveLive', ['lovelive']],
      ['アイドルマスター', '偶像大师'],
      ['ダンジョン飯', '迷宫饭'],
      ['転生したらスライムだった件', '关于我转生变成史莱姆这档事', ['转生史莱姆']],
      ['オーバーロード', 'Overlord', ['骨王', 'overlord']],
      ['無職転生', '无职转生'],
      ['ちいかわ', '吉伊卡哇'],
      ['ドラえもん', '哆啦A梦'],
      ['メイドインアビス', '来自深渊'],
      ['サイバーパンク：エッジランナーズ', '赛博朋克：边缘行者'],
      ['この素晴らしい世界に祝福を！', '为美好的世界献上祝福'],
      ['ヴァイオレット・エヴァーガーデン', '紫罗兰永恒花园'],
      ['鋼の錬金術師', '钢之炼金术师'],
      ['魔法少女まどか☆マギカ', '魔法少女小圆', ['まどか☆マギカ', '小圆']],
      ['コードギアス', '叛逆的鲁路修'],
      ['デスノート', '死亡笔记'],
      ['カウボーイビバップ', '星际牛仔'],
    ["可莉", "可莉"],
    ["宵宮", "宵宫"],
    ["夜蘭", "夜兰", ["夜兰"]],
    ["申鶴", "申鹤", ["申鹤"]],
    ["優菈", "优菈", ["优菈"]],
    ["タルタリヤ", "达达利亚", ["达达利亚"]],
    ["放浪者", "流浪者", ["散兵"]],
    ["楓原万葉", "枫原万叶"],
    ["ヌヴィレット", "那维莱特", ["那维莱特"]],
    ["ナヴィア", "娜维娅", ["娜维娅"]],
    ["クロリンデ", "克洛琳德", ["克洛琳德"]],
    ["アルレッキーノ", "阿蕾奇诺", ["阿蕾奇诺","仆人"]],
    ["シグウィン", "希格雯", ["希格雯"]],
    ["チャスカ", "恰斯卡", ["恰斯卡"]],
    ["マーヴィカ", "玛薇卡", ["玛薇卡"]],
    ["キィニチ", "基尼奇", ["基尼奇"]],
    ["シトラリ", "茜特菈莉"],
    ["ディシア", "迪希雅"],
    ["綺良々", "绮良良"],
    ["ファデュイ", "愚人众", ["愚人众"]],
    ["ヘルタ", "黑塔", ["黑塔"]],
    ["符玄", "符玄"],
    ["景元", "景元"],
    ["刃", "刃"],
    ["ルアン・メェイ", "阮梅", ["阮梅"]],
    ["黄泉", "黄泉"],
    ["アベンチュリン", "砂金", ["砂金"]],
    ["サンデー", "星期日", ["星期日"]],
    ["飛霄", "飞霄", ["飞霄"]],
    ["乱破", "乱破"],
    ["白露", "白露"],
    ["丹恒", "丹恒"],
    ["ゼーレ", "希儿", ["希儿"]],
    ["姫子", "姬子"],
    ["羅刹", "罗刹"],
    ["鏡流", "镜流"],
    ["トパーズ", "托帕", ["托帕"]],
    ["Dr.レイシオ", "真理医生", ["真理医生"]],
    ["アスター", "艾丝妲"],
    ["クラーラ", "克拉拉"],
    ["フック", "虎克"],
    ["開拓者", "开拓者"],
    ["ビリー", "比利"],
    ["朱鳶", "朱鸢", ["朱鸢"]],
    ["青衣", "青衣"],
    ["ジェーン・ドゥ", "简·杜", ["简"]],
    ["バーニス", "柏妮思", ["柏妮思"]],
    ["ライト", "莱特"],
    ["浅羽悠真", "浅羽悠真", ["悠真"]],
    ["エヴリン", "伊芙琳", ["伊芙琳"]],
    ["星見雅", "星见雅"],
    ["月城柳", "月城柳"],
    ["ルーシー", "露西"],
    ["グレース", "格莉丝", ["格莉丝"]],
    ["リナ", "丽娜"],
    ["蒼角", "苍角"],
    ["11号", "11号"],
    ["左然", "左然"],
    ["莫弈", "莫弈"],
    ["夏彦", "夏彦"],
    ["陆景和", "陆景和"],
    ["ネロ・クラウディウス", "尼禄", ["尼禄"]],
    ["スカサハ", "斯卡哈", ["斯卡哈"]],
    ["アビゲイル・ウィリアムズ", "阿比盖尔", ["阿比盖尔"]],
    ["葛飾北斎", "葛饰北斋", ["北斋"]],
    ["オベロン", "奥伯龙"],
    ["モルガン", "摩根"],
    ["マーリン", "梅林"],
    ["クー・フーリン", "库丘林", ["库丘林"]],
    ["ギルガメッシュ", "吉尔伽美什", ["吉尔伽美什","金闪闪"]],
    ["エルキドゥ", "恩奇都"],
    ["イシュタル", "伊什塔尔"],
    ["エレシュキガル", "艾蕾", ["艾蕾"]],
    ["メルトリリス", "莉莉丝", ["莉莉丝"]],
    ["両儀式", "两仪式"],
    ["源頼光", "源赖光"],
    ["宮本武蔵", "宫本武藏"],
    ["酒呑童子", "酒吞童子"],
    ["茨木童子", "茨木童子"],
    ["清姫", "清姬"],
    ["玉藻の前", "玉藻前"],
    ["エミヤ", "卫宫", ["卫宫","红A"]],
    ["遠坂凛", "远坂凛"],
    ["間桐桜", "间桐樱"],
    ["イリヤスフィール", "伊莉雅", ["伊莉雅"]],
    ["メドゥーサ", "美杜莎"],
    ["アストルフォ", "阿斯托尔福"],
    ["ニトクリス", "尼托克丽丝"],
    ["ベルファスト", "贝尔法斯特", ["贝尔法斯特"]],
    ["ラフィー", "拉菲"],
    ["ジャベリン", "标枪"],
    ["長門", "长门"],
    ["プリンツ・オイゲン", "欧根亲王"],
    ["ビスマルク", "俾斯麦"],
    ["ティルピッツ", "提尔比茨"],
    ["ヘレナ", "海伦娜"],
    ["クリーブランド", "克利夫兰"],
    ["セントルイス", "圣路易斯"],
    ["ボルチモア", "巴尔的摩"],
    ["信濃", "信浓"],
    ["ニュージャージー", "新泽西", ["花园"]],
    ["能代", "能代"],
    ["吾妻", "吾妻"],
    ["エーギル", "埃吉尔"],
    ["テキサス", "德克萨斯", ["德克萨斯"]],
    ["ラップランド", "拉普兰德", ["拉普兰德"]],
    ["シルバーアッシュ", "银灰", ["银灰"]],
    ["ホシグマ", "星熊"],
    ["サリア", "塞雷娅"],
    ["エイヤフィヤトラ", "艾雅法拉"],
    ["スカジ", "斯卡蒂"],
    ["チェン", "陈"],
    ["ブレイズ", "煌"],
    ["ケルシー", "凯尔希"],
    ["ニェン", "年"],
    ["シー", "夕"],
    ["リィン", "令"],
    ["スペシャルウィーク", "特别周", ["特别周"]],
    ["サイレンススズカ", "无声铃鹿", ["无声铃鹿"]],
    ["トウカイテイオー", "东海帝王", ["东海帝王"]],
    ["メジロマックイーン", "目白麦昆", ["目白麦昆"]],
    ["シンボリルドルフ", "鲁道夫象征"],
    ["マルゼンスキー", "丸善斯基"],
    ["オグリキャップ", "小栗帽"],
    ["ライスシャワー", "米浴"],
    ["サクラバクシンオー", "樱花进王"],
    ["ツインターボ", "双涡轮"],
    ["ゴールドシップ", "黄金船"],
    ["メジロドーベル", "目白多伯"],
    ["ウオッカ", "伏特加"],
    ["ダイワスカーレット", "大和赤骥"],
    ["ナリタブライアン", "成田白仁"],
    ["アグネスタキオン", "爱丽速子"],
    ["グラスワンダー", "草上飞"],
    ["エルコンドルパサー", "神鹰"],
    ["セイウンスカイ", "星云天空"],
    ["ファインモーション", "美妙姿势"],
    ["キタサンブラック", "北部玄驹"],
    ["サトノダイヤモンド", "里见光钻"],
    ["天海春香", "天海春香"],
    ["如月千早", "如月千早"],
    ["星井美希", "星井美希"],
    ["高槻やよい", "高槻弥生"],
    ["萩原雪歩", "萩原雪步"],
    ["菊地真", "菊地真"],
    ["水瀬伊織", "水濑伊织"],
    ["四条貴音", "四条贵音"],
    ["我那覇響", "我那霸响"],
    ["双海亜美", "双海亚美"],
    ["双海真美", "双海真美"],
    ["三浦あずさ", "三浦梓"],
    ["秋月律子", "秋月律子"],
    ["音無小鳥", "音无小鸟"],
    ["渋谷凛", "涩谷凛"],
    ["島村卯月", "岛村卯月"],
    ["本田未央", "本田未央"],
    ["城ヶ崎美嘉", "城崎美嘉"],
    ["一ノ瀬志希", "一之濑志希"],
    ["大槻唯", "大槻唯"],
    ["神崎蘭子", "神崎兰子"],
    ["白坂小梅", "白坂小梅"],
    ["高垣楓", "高垣枫"],
    ["川島瑞樹", "川岛瑞树"],
    ["新田美波", "新田美波"],
    ["安部菜々", "安部菜菜"],
    ["輿水幸子", "舆水幸子"],
    ["五十嵐響子", "五十岚响子"],
    ["佐久間まゆ", "佐久间麻由"],
    ["星輝子", "星辉子"],
    ["北条加蓮", "北条加莲"],
    ["神谷奈緒", "神谷奈绪"],
    ["鷺沢文香", "鹭泽文香"],
    ["塩見周子", "盐见周子"],
    ["宮本フレデリカ", "宫本芙蕾德莉卡"],
    ["速水奏", "速水奏"],
    ["多田李衣菜", "多田李衣菜"],
    ["三船美優", "三船美优"],
    ["早坂美玲", "早坂美玲"],
    ["藤原肇", "藤原肇"],
    ["龍崎薫", "龙崎薰"],
    ["佐城雪美", "佐城雪美"],
    ["依田芳乃", "依田芳乃"],
    ["緒方智絵里", "绪方智绘里"],
    ["双葉杏", "双叶杏"],
    ["諸星きらり", "诸星琪拉莉"],
    ["十時愛梨", "十时爱梨"],
    ["竈門炭治郎", "灶门炭治郎"],
    ["冨岡義勇", "富冈义勇"],
    ["時透無一郎", "时透无一郎"],
    ["甘露寺蜜璃", "甘露寺蜜璃"],
    ["宇髄天元", "宇髓天元"],
    ["不死川実弥", "不死川实弥"],
    ["虎杖悠仁", "虎杖悠仁"],
    ["伏黒恵", "伏黑惠"],
    ["釘崎野薔薇", "钉崎野蔷薇"],
    ["夏油傑", "夏油杰"],
    ["両面宿儺", "两面宿傩"],
    ["乙骨憂太", "乙骨忧太"],
    ["デンジ", "电次"],
    ["フェルン", "菲伦"],
    ["シュタルク", "修塔尔克"],
    ["ヒンメル", "辛美尔"],
    ["星野アイ", "星野爱", ["星野爱"]],
    ["有馬かな", "有马加奈"],
    ["黒川あかね", "黑川茜"],
    ["ヨル・フォージャー", "约尔"],
    ["ロイド・フォージャー", "黄昏"],
    ["後藤ひとり", "后藤一里", ["波奇酱"]],
    ["喜多郁代", "喜多郁代"],
    ["伊地知虹夏", "伊地知虹夏"],
    ["山田リョウ", "山田凉"],
    ["錦木千束", "锦木千束"],
    ["井ノ上たきな", "井之上泷奈"],
    ["潔世一", "洁世一"],
    ["糸師凛", "糸师凛"],
    ["凪誠士郎", "凪诚士郎"],
    ["日向翔陽", "日向翔阳"],
    ["影山飛雄", "影山飞雄"],
    ["及川徹", "及川彻"],
    ["孤爪研磨", "孤爪研磨"],
    ["黒尾鉄朗", "黑尾铁朗"],
    ["碇シンジ", "碇真嗣"],
    ["サーバル", "薮猫"],
    ["マルシル", "玛露希尔"],
    ["リムル＝テンペスト", "利姆露"],
    ["アルベド", "雅儿贝德"],
    ["ロキシー", "洛琪希"],
    ["エリス", "艾莉丝"],
    ["ナナチ", "娜娜奇"],
    ["めぐみん", "惠惠"],
    ["アクア", "阿库娅"],
    ["ダクネス", "达克妮斯"],
    ["鹿目まどか", "鹿目圆"],
    ["暁美ほむら", "晓美焰"],
    ["巴マミ", "巴麻美"],
    ["美樹さやか", "美树沙耶香"],
    ["佐倉杏子", "佐仓杏子"],
    ["キュゥべえ", "丘比"],
    ["洛天依", "洛天依"],
    ["歌愛ユキ", "歌爱雪"],
    ["flower", "flower"],
    ["聖白蓮", "圣白莲"],
    ["封獣ぬえ", "封兽鵺"],
    ["秦こころ", "秦心"],
    ["比那名居天子", "比那名居天子"],
    ["永江衣玖", "永江衣玖"],
    ["物部布都", "物部布都"],
    ["豊聡耳神子", "丰聪耳神子"],
    ["茨木華扇", "茨木华扇"],
    ["宇佐見蓮子", "宇佐见莲子"],
    ["ルーミア", "露米娅"],
    ["小悪魔", "小恶魔"],
    ["ときのそら", "时乃空"],
    ["湊あくあ", "凑阿库娅"],
    ["さくらみこ", "樱巫女"],
    ["不知火フレア", "不知火芙蕾雅"],
    ["白銀ノエル", "白银诺艾尔"],
    ["戌神ころね", "戌神沁音"],
    ["大神ミオ", "大神澪"],
    ["猫又おかゆ", "猫又小粥"],
    ["森カリオペ", "森美声"],
    ["小鳥遊キアラ", "小鸟游琪亚拉"],
    ["一伊那尓栖", "一伊那尔栖"],
    ["がうる・ぐら", "噶呜·古拉"],
    ["ワトソン・アメリア", "华生·阿米莉亚"],
    ["尾丸ポルカ", "尾丸波尔卡"],
    ["雪花ラミィ", "雪花菈米"],
    ["獅白ぼたん", "狮白牡丹"],
    ["桃鈴ねね", "桃铃音音"],
    ["博衣こより", "博衣小夜璃"],
    ["鷹嶺ルイ", "鹰岭露依"],
    ["沙花叉クロヱ", "沙花叉克萝耶"],
    ["風真いろは", "风真伊吕波"],
    ["ラプラス・ダークネス", "拉普拉斯·暗黑"],
    ["天音かなた", "天音彼方"],
    ["常闇トワ", "常暗永远"],
    ["姫森ルーナ", "姬森璐娜"],
    ["角巻わため", "角卷绵芽"],
    ["ロボ子さん", "萝卜子"],
    ["AZKi", "AZKi"],
    ["IRyS", "IRyS"],
    ["セレス・ファウナ", "塞莱希·法娜"],
    ["オーロ・クロニー", "奥罗·克洛尼"],
    ["七詩ムメイ", "七诗无名"],
    ["ハコス・ベールズ", "哈珂斯·贝尔丝"],
    ["こぼ・かなえる", "可波·卡娜艾露"],
    ["夕刻ロベル", "夕刻罗贝尔"],
    ["夜空メル", "夜空梅露"],
    ["赤井はあと", "赤井心"],
    ["潤羽るしあ", "润羽露西娅"],
    ["桐生ココ", "桐生可可"],
    ["剣持刀也", "剑持刀也"],
    ["伏見ガク", "伏见学"],
    ["樋口楓", "樋口枫"],
    ["笹木咲", "笹木咲"],
    ["リゼ・ヘルエスタ", "莉泽·赫露艾斯塔"],
    ["アンジュ・カトリーナ", "安洁·卡特莉娜"],
    ["戌亥とこ", "戌亥床"],
    ["葛葉", "葛叶"],
    ["叶", "叶"],
    ["星川サラ", "星川莎拉"],
    ["緑仙", "绿仙"],
    ["夢追翔", "梦追翔"],
    ["郡道美玲", "郡道美玲"],
    ["社築", "社筑"],
    ["周力一", "周力一"],
    ["黒井しば", "黑井柴"],
    ["勇気ちひろ", "勇气千寻"],
    ["夕陽リリ", "夕阳莉莉"],
    ["シェリン・バーガンディ", "谢林·勃艮第"],
    ["相羽ういは", "相羽初叶"],
    ["静凛", "静凛"],
    ["文野環", "文野环"],
    ["神田笑一", "神田笑一"],
    ["でびでび・でびる", "德比德比·德比鲁"],
    ["アニメ塗り", "动画风上色"],
    ["鉛筆", "铅笔"],
    ["グレースケール", "灰度"],
    ["ぼかし", "模糊"],
    ["影絵", "剪影画"],
    ["逆光", "逆光"],
    ["グラデーション", "渐变"],
    ["パース", "透视"],
    ["俯瞰", "俯瞰"],
    ["あおり", "仰视"],
    ["魚眼", "鱼眼"],
    ["ローアングル", "低角度"],
    ["ハイアングル", "高角度"],
    ["クローズアップ", "特写"],
    ["ポートレート", "肖像"],
    ["全身", "全身"],
    ["半身", "半身"],
    ["バストアップ", "半身像"],
    ["顔アップ", "脸部特写"],
    ["横顔", "侧脸"],
    ["振り返り", "回头"],
    ["後ろ姿", "背影"],
    ["大集合", "大集合"],
    ["集合絵", "合照"],
    ["手描き", "手绘"],
    ["デジタル", "数码绘"],
    ["アナログ", "传统手绘"],
    ["コピック", "马克笔"],
    ["色鉛筆", "彩铅"],
    ["パステル", "粉彩"],
    ["エアブラシ", "喷枪"],
    ["風景画", "风景画"],
    ["人物画", "人物画"],
    ["静物画", "静物画"],
    ["抽象画", "抽象画"],
    ["ミニキャラ", "迷你角色"],
    ["ファンアート", "同人图"],
    ["模写", "临摹"],
    ["色塗り", "上色"],
    ["メイキング", "绘画过程"],
    ["講座", "教程"],
    ["リクエスト", "约稿请求"],
    ["一次創作", "一次创作"],
    ["二次創作", "二次创作"],
    ["版権", "版权"],
    ["泣き", "哭泣"],
    ["怒り", "愤怒"],
    ["羞恥", "羞耻"],
    ["笑い", "笑"],
    ["驚き", "惊讶"],
    ["無表情", "无表情"],
    ["ドヤ顔", "得意脸"],
    ["赤面", "面红耳赤"],
    ["涙目", "泪眼"],
    ["号泣", "嚎啕大哭"],
    ["はにかみ", "腼腆"],
    ["ツリ目", "吊眼"],
    ["チョロ目", "痴汉眼"],
    ["ハート目", "爱心眼"],
    ["星目", "星星眼"],
    ["えへへ", "嘿嘿笑"],
    ["キリッ", "严肃脸"],
    ["メソメソ", "抽泣"],
    ["座る", "坐着"],
    ["立つ", "站立"],
    ["走る", "奔跑"],
    ["ジャンプ", "跳跃"],
    ["ポーズ", "姿势"],
    ["抱っこ", "抱抱"],
    ["肩車", "骑脖子"],
    ["頭ぽんぽん", "摸头"],
    ["なでなで", "抚摸"],
    ["手を振る", "挥手"],
    ["敬礼", "敬礼"],
    ["お辞儀", "鞠躬"],
    ["土下座", "下跪"],
    ["正座", "正坐"],
    ["体育座り", "体育坐"],
    ["あぐら", "盘腿坐"],
    ["四つん這い", "四肢着地"],
    ["逆立ち", "倒立"],
    ["ヨガ", "瑜伽"],
    ["ストレッチ", "拉伸"],
    ["スノボ", "单板滑雪"],
    ["水泳", "游泳"],
    ["バスケ", "篮球"],
    ["サッカー", "足球"],
    ["野球", "棒球"],
    ["テニス", "网球"],
    ["バレー", "排球"],
    ["弓道", "弓道"],
    ["剣道", "剑道"],
    ["柔道", "柔道"],
    ["空手", "空手道"],
    ["フェンシング", "击剑"],
    ["乗馬", "骑马"],
    ["ダーツ", "飞镖"],
    ["ビリヤード", "台球"],
    ["ゴルフ", "高尔夫"],
    ["釣り", "钓鱼"],
    ["恋人", "恋人"],
    ["親友", "挚友"],
    ["兄弟", "兄弟"],
    ["双子", "双胞胎"],
    ["母娘", "母女"],
    ["父子", "父子"],
    ["家族", "家人"],
    ["三角関係", "三角关系"],
    ["ハーレム", "后宫"],
    ["逆ハーレム", "逆后宫"],
    ["両想い", "两情相悦"],
    ["片思い", "单恋"],
    ["失恋", "失恋"],
    ["告白", "告白"],
    ["デート", "约会"],
    ["エスコート", "护花"],
    ["ジャケット", "夹克"],
    ["ホットパンツ", "热裤"],
    ["オーバーオール", "背带裤"],
    ["蝶ネクタイ", "领结"],
    ["カーディガン", "开衫"],
    ["セーター", "毛衣"],
    ["タートルネック", "高领毛衣"],
    ["レインコート", "雨衣"],
    ["学ラン", "立领学生装"],
    ["腕時計", "手表"],
    ["指輪", "戒指"],
    ["ベルト", "腰带"],
    ["サスペンダー", "吊带"],
    ["バッグ", "包"],
    ["リュック", "背包"],
    ["傘", "伞"],
    ["扇子", "扇子"],
    ["刀", "刀"],
    ["鎌", "镰刀"],
    ["斧", "斧头"],
    ["盾", "盾牌"],
    ["兜", "头盔"],
    ["ローブ", "长袍"],
    ["王冠", "王冠"],
    ["ティアラ", "头冠"],
    ["ヘッドドレス", "头饰"],
    ["ベール", "面纱"],
    ["花冠", "花环"],
    ["フード", "兜帽"],
    ["ヘアピン", "发夹"],
    ["ヘアバンド", "发带"],
    ["タルト", "挞"],
    ["シュークリーム", "泡芙"],
    ["饅頭", "馒头"],
    ["味噌汁", "味噌汤"],
    ["チャーハン", "炒饭"],
    ["しゃぶしゃぶ", "涮锅"],
    ["すき焼き", "寿喜烧"],
    ["お好み焼き", "大阪烧"],
    ["焼きそば", "炒面"],
    ["唐揚げ", "炸鸡"],
    ["コロッケ", "可乐饼"],
    ["カツ", "炸猪排"],
    ["ステーキ", "牛排"],
    ["エビフライ", "炸虾"],
    ["茶碗蒸し", "茶碗蒸"],
    ["卵焼き", "玉子烧"],
    ["目玉焼き", "煎蛋"],
    ["納豆", "纳豆"],
    ["漬物", "腌菜"],
    ["サラダ", "沙拉"],
    ["スープ", "汤"],
    ["シチュー", "炖菜"],
    ["グラタン", "焗菜"],
    ["食パン", "吐司"],
    ["トースト", "烤吐司"],
    ["メロンパン", "菠萝包"],
    ["あんぱん", "红豆面包"],
    ["カレーパン", "咖喱面包"],
    ["コーラ", "可乐"],
    ["ココア", "可可"],
    ["ほうじ茶", "焙茶"],
    ["麦茶", "麦茶"],
    ["烏龍茶", "乌龙茶"],
    ["カフェオレ", "咖啡欧蕾"],
    ["ラテ", "拿铁"],
    ["エスプレッソ", "浓缩咖啡"],
    ["カプチーノ", "卡布奇诺"],
    ["モカ", "摩卡"],
    ["スムージー", "冰沙"],
    ["シェイク", "奶昔"],
    ["ハリネズミ", "刺猬"],
    ["モルモット", "豚鼠"],
    ["チンチラ", "龙猫"],
    ["スズメ", "麻雀"],
    ["アヒル", "鸭子"],
    ["カモメ", "海鸥"],
    ["タヌキ", "狸猫"],
    ["イノシシ", "野猪"],
    ["サル", "猴子"],
    ["キリン", "长颈鹿"],
    ["ヒョウ", "豹"],
    ["チーター", "猎豹"],
    ["コアラ", "考拉"],
    ["カンガルー", "袋鼠"],
    ["ラッコ", "海獭"],
    ["アザラシ", "海豹"],
    ["ペリカン", "鹈鹕"],
    ["フラミンゴ", "火烈鸟"],
    ["ダチョウ", "鸵鸟"],
    ["アルパカ", "羊驼"],
    ["ラクダ", "骆驼"],
    ["ヒツジ", "绵羊"],
    ["ポニー", "小马"],
    ["ミニブタ", "迷你猪"],
    ["フェレット", "雪貂"],
    ["ケンタウロス", "半人马"],
    ["ゴブリン", "哥布林"],
    ["オーク", "半兽人"],
    ["トロール", "巨魔"],
    ["ミノタウロス", "牛头人"],
    ["メデューサ", "蛇发女妖"],
    ["セイレーン", "塞壬"],
    ["河童", "河童"],
    ["天狗", "天狗"],
    ["鬼", "鬼"],
    ["スケルトン", "骷髅"],
    ["竜人", "龙人"],
    ["亜人", "亚人"],
    ["半獣", "半兽"],
    ["雨上がり", "雨后"],
    ["雷雨", "雷雨"],
    ["曇り", "阴天"],
    ["快晴", "晴朗"],
    ["吹雪", "暴风雪"],
    ["霧", "雾"],
    ["霜", "霜"],
    ["流星", "流星"],
    ["彗星", "彗星"],
    ["日食", "日食"],
    ["月食", "月食"],
    ["図書室", "图书室"],
    ["保健室", "保健室"],
    ["屋上", "天台"],
    ["体育館", "体育馆"],
    ["プール", "游泳池"],
    ["公園", "公园"],
    ["テーマパーク", "主题公园"],
    ["動物園", "动物园"],
    ["博物館", "博物馆"],
    ["美術館", "美术馆"],
    ["映画館", "电影院"],
    ["劇場", "剧场"],
    ["ライブハウス", "LiveHouse"],
    ["カラオケ", "卡拉OK"],
    ["ゲームセンター", "游戏厅"],
    ["喫茶店", "咖啡店"],
    ["レストラン", "餐厅"],
    ["バー", "酒吧"],
    ["居酒屋", "居酒屋"],
    ["コンビニ", "便利店"],
    ["スーパー", "超市"],
    ["デパート", "百货商场"],
    ["駅", "车站"],
    ["バス", "公交车"],
    ["空港", "机场"],
    ["港", "港口"],
    ["灯台", "灯塔"],
    ["廃墟", "废墟"],
    ["工場", "工厂"],
    ["お寺", "寺庙"],
    ["銭湯", "澡堂"],
    ["海岸", "海岸"],
    ["竹林", "竹林"],
    ["砂漠", "沙漠"],
    ["雪山", "雪山"],
    ["火山", "火山"],
    ["正月", "正月"],
    ["節分", "节分"],
    ["端午の節句", "端午节"],
    ["お盆", "盂兰盆节"],
    ["大晦日", "除夕"],
    ["年越し", "跨年"],
    ["誕生日", "生日"],
    ["記念日", "纪念日"],
    ["文化祭", "文化祭"],
    ["体育祭", "运动会"],
    ["修学旅行", "修学旅行"],
    ["卒業式", "毕业典礼"],
    ["入学式", "开学典礼"],
    ["成人式", "成人礼"],
    ["結婚式", "婚礼"],
    ["本", "书"],
    ["ノート", "笔记本"],
    ["ペン", "笔"],
    ["消しゴム", "橡皮"],
    ["定規", "尺子"],
    ["ランドセル", "小学生书包"],
    ["スマホ", "手机"],
    ["パソコン", "电脑"],
    ["テレビ", "电视"],
    ["ゲーム機", "游戏机"],
    ["コントローラー", "手柄"],
    ["ベース", "贝斯"],
    ["ドラム", "架子鼓"],
    ["フルート", "长笛"],
    ["トランペット", "小号"],
    ["サックス", "萨克斯"],
    ["三味線", "三味线"],
    ["琴", "古琴"],
    ["太鼓", "太鼓"],
    ["マイク", "麦克风"],
    ["花束", "花束"],
    ["花瓶", "花瓶"],
    ["ぬいぐるみ", "玩偶"],
    ["クッション", "抱枕"],
    ["枕", "枕头"],
    ["毛布", "毛毯"],
    ["布団", "被褥"],
    ["ランプ", "油灯"],
    ["ロウソク", "蜡烛"],
    ["ランタン", "灯笼"],
    ["風船", "气球"],
    ["紙飛行機", "纸飞机"],
    ["シャボン玉", "肥皂泡"],
    ["万華鏡", "万花筒"],
    ["パズル", "拼图"],
    ["トランプ", "扑克牌"],
    ["将棋", "将棋"],
    ["囲碁", "围棋"],
    ["チェス", "国际象棋"],
    ["サイコロ", "骰子"],
    ["コイン", "硬币"],
    ["宝石", "宝石"],
    ["クリスタル", "水晶"],
    ["砂時計", "沙漏"],
    ["望遠鏡", "望远镜"],
    ["顕微鏡", "显微镜"],
    ["レコード", "唱片"],
    ["美しい", "优美"],
    ["かっこいい", "帅气"],
    ["セクシー", "性感"],
    ["懐かしい", "怀旧"],
    ["儚い", "虚幻"],
    ["幻想的", "幻想"],
    ["神秘的", "神秘"],
    ["荘厳", "庄严"],
    ["華やか", "华丽"],
    ["落ち着き", "沉稳"],
    ["静寂", "寂静"],
    ["賑やか", "热闹"],
    ["和む", "温馨"],
    ["癒し", "治愈"],
    ["ドキドキ", "心跳加速"],
    ["ワクワク", "兴奋期待"],
    ["切ない", "伤感"],
    ["悲しい", "悲伤"],
    ["楽しい", "快乐"],
    ["嬉しい", "高兴"],
    ["寂しい", "寂寞"],
    ["孤独", "孤独"],
    ["希望", "希望"],
    ["絶望", "绝望"],
    ["平和", "和平"],
    ["戦争", "战争"],
    ["破壊", "破坏"],
    ["再生", "再生"],
    ["誕生", "诞生"],
    ["死", "死亡"],
    ["天国", "天国"],
    ["地獄", "地狱"],
    ["異世界", "异世界"],
    ["未来", "未来"],
    ["過去", "过去"],
    ["現代", "现代"],
    ["古代", "古代"],
    ["中世", "中世纪"],
    ["近未来", "近未来"],
    ["終末", "末日"],
    ["旅", "旅行"],
    ["冒険", "冒险"],
    ["出会い", "相遇"],
    ["別れ", "离别"],
    ["再会", "重逢"],
    ["帰還", "归乡"],
    ["誓い", "誓言"],
    ["約束", "约定"],
    ["運命", "命运"],
    ["奇跡", "奇迹"],
    ["魔法", "魔法"],
    ["呪い", "诅咒"],
    ["祝福", "祝福"],
    ["加護", "加护"],
    ["勝利", "胜利"],
    ["敗北", "败北"],
    ["反撃", "反击"],
  ]

    const PRESET_TAGS = TAG_DATA.map(([tag]) => tag)

    // zh (or an alias) → the Japanese tag pixiv actually uses; TAG_ZH is the
    // reverse map (tag → zh) used for hover tooltips.
    const SYNONYMS = {}
    const TAG_ZH = {}
    for (const [tag, zh, aliases] of TAG_DATA) {
      SYNONYMS[zh] = tag
      TAG_ZH[tag] = zh
      for (const alias of aliases ?? []) SYNONYMS[alias] = tag
    }

    function tagSuggestions(input) {
      const token = input.trim().split(/\s+/).pop() ?? ''
      if (!token) return []
      const lower = token.toLowerCase()
      const out = []
      for (const [tag, zh, aliases] of TAG_DATA) {
        if (out.length >= 8) break
        if (tag.toLowerCase().includes(lower)
          || zh.toLowerCase().includes(lower)
          || (aliases ?? []).some((alias) => alias.toLowerCase().includes(lower))) {
          out.push({ tag, alias: zh })
        }
      }
      return out
    }

    function shuffle(list) {
      for (let i = list.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[list[i], list[j]] = [list[j], list[i]]
      }
      return list
    }

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
      copy: 'M8 8h11a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1zm-3 3H4a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1',
      gear: 'M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zm0 0V5m0 14v-3.5M5 12h3.5M15.5 12H19m-1.2-5.8l-2.5 2.5m-6.6 6.6l-2.5 2.5m11.6 0l-2.5-2.5M6.2 6.2l2.5 2.5',
      close: 'M6 6l12 12M18 6L6 18',
      left: 'M14.5 6l-6 6 6 6',
      right: 'M9.5 6l6 6-6 6',
      search: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zm5.7.3l4 4',
      user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 8a7 7 0 0 1 14 0',
      lock: 'M6 10h12v10H6zM8 10V7a4 4 0 0 1 8 0v3',
      funnel: 'M4 5h16l-6.2 6.6v6.1l-3.6 2.3v-8.4L4 5z',
      refresh: 'M20 11a8 8 0 1 0-2.34 5.66M20 5v6h-6',
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

    function LoginModal({ status, onClose, onLoggedIn, notify }) {
      const [cookie, setCookie] = React.useState('')
      const [busy, setBusy] = React.useState(false)
      const [error, setError] = React.useState(null)

      const hasCookie = Boolean(status?.hasCookie)

      const submitSession = async () => {
        setError(null)
        setBusy(true)
        try {
          const value = await api('/login/session', { method: 'POST', body: { phpsessid: cookie.trim() } })
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
        hasCookie ? h('p', { className: 'pv-modal-hint' }, t0('login.hasCookie')) : null,
        h('div', { className: 'pv-field' },
          h('input', {
            className: 'pv-input', value: cookie, type: 'password',
            placeholder: t0('login.cookiePlaceholder'),
            onChange: (event) => setCookie(event.target.value),
            onKeyDown: (event) => { if (event.key === 'Enter') submitSession() },
          }),
        ),
        h('details', { className: 'pv-details' },
          h('summary', {}, t0('login.getCookie')),
          t0('login.getCookieSteps'),
        ),
        h('div', { className: 'pv-modal-row' },
          h('button', {
            className: 'pv-btn pv-primary', onClick: submitSession,
            disabled: busy || (!cookie.trim() && !hasCookie),
          }, t0('login.submit')),
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

    function Viewer({ items, index, onClose, onNavigate, onToggleBookmark, notify, dismissToast, onSearchTag, onSearchAuthor }) {
      const [detail, setDetail] = React.useState(null)
      const [pageIdx, setPageIdx] = React.useState(0)
      const [loading, setLoading] = React.useState(true)
      const [pageLoading, setPageLoading] = React.useState(false)
      const [imgFailed, setImgFailed] = React.useState(false)
      const [imgKey, setImgKey] = React.useState(0)
      const [bookmarked, setBookmarked] = React.useState(false)
      const [zoom, setZoom] = React.useState({ scale: 1, x: 0, y: 0 })
      const [copying, setCopying] = React.useState(false)
      const item = items[index]
      const stageRef = React.useRef(null)
      const imgRef = React.useRef(null)
      const zoomRef = React.useRef({ scale: 1, x: 0, y: 0 })

      const resetZoom = () => {
        zoomRef.current = { scale: 1, x: 0, y: 0 }
        setZoom(zoomRef.current)
      }

      React.useEffect(() => {
        let alive = true
        setLoading(true)
        setPageIdx(0)
        setDetail(null)
        resetZoom()
        fetchDetail(item.id)
          .then((value) => { if (alive) setDetail(value) })
          .catch((error) => { if (alive) notify(friendlyMessage(error), 'error') })
          .finally(() => { if (alive) setLoading(false) })
        return () => { alive = false }
      }, [item.id])

      React.useEffect(() => {
        setBookmarked(detail ? detail.isBookmarked : item.isBookmarked)
      }, [detail, item])

      React.useEffect(() => {
        setImgFailed(false)
        resetZoom()
      }, [pageIdx, detail])

      const pages = detail?.pages?.length ? detail.pages : [item.thumbUrl]
      const current = pages[Math.min(pageIdx, pages.length - 1)]
      const currentUrl = typeof current === 'string' ? current : (current?.url ?? '')
      const multiPage = pages.length > 1
      const tags = detail?.tags ?? item.tags ?? []

      // hide the current image while the next page loads (multi-page only)
      React.useEffect(() => {
        if (multiPage) setPageLoading(true)
      }, [pageIdx, detail, item.id, multiPage])

      const goPrev = () => {
        if (multiPage && pageIdx > 0) {
          setPageLoading(true)
          setPageIdx((value) => value - 1)
        } else onNavigate(-1)
      }
      const goNext = () => {
        if (multiPage && pageIdx < pages.length - 1) {
          setPageLoading(true)
          setPageIdx((value) => value + 1)
        } else onNavigate(1)
      }
      const canPrev = pageIdx > 0 || index > 0
      const canNext = (multiPage && pageIdx < pages.length - 1) || index < items.length - 1

      React.useEffect(() => {
        const onKey = (event) => {
          const target = event.target
          const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA'
            || target.tagName === 'SELECT' || target.isContentEditable)
          if (event.key === 'Escape') onClose()
          else if (event.key === 'ArrowLeft' || ((event.key === 'a' || event.key === 'A') && !typing)) goPrev()
          else if (event.key === 'ArrowRight' || ((event.key === 'd' || event.key === 'D') && !typing)) goNext()
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
      })

      // wheel zoom anchored at the cursor (native listener: React's wheel
      // handler is passive and can't preventDefault the page scroll)
      React.useEffect(() => {
        const stage = stageRef.current
        if (!stage) return
        const onWheel = (event) => {
          event.preventDefault()
          const img = imgRef.current
          if (!img) return
          const dy = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY
          const scale = Math.min(8, Math.max(1, zoomRef.current.scale * Math.exp(-dy * 0.002)))
          const rect = stage.getBoundingClientRect()
          const mx = event.clientX - rect.left
          const my = event.clientY - rect.top
          // keep the point under the cursor stationary:
          // p' = center + (p - center) * scale + translate
          const cx = img.offsetLeft + img.offsetWidth / 2
          const cy = img.offsetTop + img.offsetHeight / 2
          let x = mx - cx - (mx - cx) * scale
          let y = my - cy - (my - cy) * scale
          if (scale <= 1.01) {
            x = 0
            y = 0
          } else {
            const maxX = Math.max(0, (img.offsetWidth * scale) / 2 - 60)
            const maxY = Math.max(0, (img.offsetHeight * scale) / 2 - 60)
            x = Math.max(-maxX, Math.min(maxX, x))
            y = Math.max(-maxY, Math.min(maxY, y))
          }
          zoomRef.current = { scale, x, y }
          setZoom(zoomRef.current)
        }
        stage.addEventListener('wheel', onWheel, { passive: false })
        return () => stage.removeEventListener('wheel', onWheel)
      }, [])

      // hold-and-drag pan (only while zoomed in)
      const onImgMouseDown = (event) => {
        if (zoomRef.current.scale <= 1) return
        event.preventDefault()
        const startX = event.clientX
        const startY = event.clientY
        const orig = { ...zoomRef.current }
        let moved = false
        const onMove = (ev) => {
          const dx = ev.clientX - startX
          const dy = ev.clientY - startY
          if (!moved && Math.abs(dx) + Math.abs(dy) < 4) return
          moved = true
          const img = imgRef.current
          const maxX = img ? Math.max(0, (img.offsetWidth * orig.scale) / 2 - 60) : 0
          const maxY = img ? Math.max(0, (img.offsetHeight * orig.scale) / 2 - 60) : 0
          const next = {
            scale: orig.scale,
            x: Math.max(-maxX, Math.min(maxX, orig.x + dx)),
            y: Math.max(-maxY, Math.min(maxY, orig.y + dy)),
          }
          zoomRef.current = next
          setZoom(next)
        }
        const onUp = () => {
          window.removeEventListener('mousemove', onMove)
          window.removeEventListener('mouseup', onUp)
        }
        window.addEventListener('mousemove', onMove)
        window.addEventListener('mouseup', onUp)
      }

      const toggleBookmark = async () => {
        const want = !bookmarked
        setBookmarked(want)
        const ok = await onToggleBookmark(item.id, want)
        setBookmarked(ok ? want : !want)
      }

      const saveImage = async () => {
        const busyId = notify(t0('saving'), 'info', { sticky: true })
        notify(t0('save.done'), 'success')
        try {
          const base = (detail?.title ?? item.title ?? 'pixiv').slice(0, 60)
          const filename = multiPage ? `${base}_p${pageIdx + 1}` : base
          await downloadImage(currentUrl, filename)
          dismissToast(busyId)
          notify(t0('save.success'), 'success')
        } catch (error) {
          dismissToast(busyId)
          const detail = String(error?.message ?? error ?? 'unknown').slice(0, 60)
          notify(`${t0('save.fail')} (${detail})`, 'error')
        }
      }

      const copyImage = () => {
        if (copying) return
        setCopying(true)
        const busyId = notify(t0('copying'), 'info', { sticky: true })
        ;(async () => {
          try {
            // the displayed image came from this exact URL, so the fetch
            // normally hits the browser cache instead of the network
            const response = await fetch(imgProxy(currentUrl))
            if (!response.ok) throw new Error(`http ${response.status}`)
            await copyImageBlob(await response.blob())
            dismissToast(busyId)
            notify(t0('copy.done'), 'success')
          } catch (error) {
            dismissToast(busyId)
            const detail = String(error?.message ?? error ?? 'unknown').slice(0, 60)
            notify(`${t0('copy.fail')} (${detail})`, 'error')
          } finally {
            setCopying(false)
          }
        })()
      }

      return h(
        'div',
        { className: 'pv-viewer', role: 'dialog', 'aria-modal': 'true' },
        h('div', { className: 'pv-viewer-top' },
          h('div', { className: 'pv-viewer-left' },
            h('button', { className: 'pv-viewer-btn pv-viewer-close', onClick: onClose, 'aria-label': t0('close') },
              svgIcon(ICONS.close, 14), t0('close')),
            h('span', { className: 'pv-viewer-pid', title: 'PID' }, `PID ${item.id}`),
          ),
          h('div', { className: 'pv-viewer-title', title: detail?.title ?? item.title }, detail?.title ?? item.title),
        ),
        h('div', { className: 'pv-viewer-stage', ref: stageRef },
          h('button', {
            className: 'pv-viewer-nav pv-prev', 'aria-label': t0('prevPage'),
            onClick: goPrev, disabled: !canPrev,
          }, '‹'),
          loading
            ? h('div', { className: 'pv-spinner' })
            : h(React.Fragment, null,
              pageLoading
                ? h('div', { className: 'pv-viewer-spinner' }, h('div', { className: 'pv-spinner' }))
                : null,
              imgFailed
                ? h('div', { className: 'pv-viewer-error' },
                  h('div', null, t0('network.error')),
                  h('button', {
                    className: 'pv-viewer-btn',
                    onClick: () => { setImgFailed(false); setPageLoading(true); setImgKey((key) => key + 1) },
                  }, svgIcon(ICONS.refresh, 14), t0('retry')),
                )
                : h('img', {
                  key: imgKey,
                  ref: imgRef,
                  className: `pv-viewer-img${pageLoading ? ' pv-viewer-img-hidden' : ''}${zoom.scale > 1 ? ' pv-viewer-img-zoom' : ''}`,
                  style: zoom.scale > 1 ? { transform: `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.scale})` } : null,
                  src: imgProxy(currentUrl), alt: detail?.title ?? item.title,
                  draggable: false,
                  title: zoom.scale > 1 ? null : t0('viewer.zoomHint'),
                  onMouseDown: onImgMouseDown,
                  onLoad: () => setPageLoading(false),
                  onError: () => setImgFailed(true),
                }),
            ),
          h('button', {
            className: 'pv-viewer-nav pv-next', 'aria-label': t0('nextPage'),
            onClick: goNext, disabled: !canNext,
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
                title: TAG_ZH[tag.name] ?? '',
                onClick: () => onSearchTag(tag.name),
              }, `#${tag.name}`),
            ),
          ),
          h('div', { className: 'pv-viewer-actions' },
            h('button', {
              className: 'pv-viewer-btn pv-viewer-author',
              title: t0('type.user'),
              onClick: () => onSearchAuthor(detail?.userId ?? item.userId, detail?.userName ?? item.userName),
            },
            svgIcon(ICONS.user, 14),
            h('span', { className: 'pv-viewer-author-name' }, detail?.userName ?? item.userName),
            (detail?.userId || item.userId)
              ? h('span', { className: 'pv-viewer-author-id' }, `ID:${detail?.userId ?? item.userId}`)
              : null),
            h('button', {
              className: `pv-viewer-btn${bookmarked ? ' pv-bookmarked' : ''}`,
              onClick: toggleBookmark,
            }, svgIcon(ICONS.heart, 14), bookmarked ? t0('bookmark.remove') : t0('bookmark.add')),
            h('button', {
              className: 'pv-viewer-btn', onClick: copyImage, disabled: copying,
              title: t0('copy'),
            }, svgIcon(ICONS.copy, 14), t0('copy')),
            h('button', { className: 'pv-viewer-btn', onClick: saveImage },
              svgIcon(ICONS.download, 14), t0('save')),
          ),
        ),
      )
    }

    function Card({ item, t, onOpen, onToggleBookmark, notify, dismissToast }) {
      const [failed, setFailed] = React.useState(false)
      const [attempt, setAttempt] = React.useState(0)

      // full-size image for save / copy: prefer the first detail page, fall
      // back to the thumbnail (detail is cached, so repeat clicks are cheap)
      const bestImageUrl = async () => {
        try {
          const detail = await fetchDetail(item.id)
          return detail.pages?.[0]?.url ?? detail.thumbUrl ?? item.thumbUrl
        } catch {
          return item.thumbUrl
        }
      }

      const saveThumb = async (event) => {
        event.stopPropagation()
        const busyId = notify(t('saving'), 'info', { sticky: true })
        notify(t('save.done'), 'success')
        try {
          const url = await bestImageUrl()
          await downloadImage(url, (item.title ?? 'pixiv').slice(0, 60))
          dismissToast(busyId)
          notify(t('save.success'), 'success')
        } catch (error) {
          dismissToast(busyId)
          const detail = String(error?.message ?? error ?? 'unknown').slice(0, 60)
          notify(`${t('save.fail')} (${detail})`, 'error')
        }
      }

      // same flow as the viewer copy button (fetch at click time, then the
      // clipboard API with the host-side Windows fallback); the thumbnail is
      // the last resort when the original URL fails
      const copyThumb = async (event) => {
        event.stopPropagation()
        const busyId = notify(t('copying'), 'info', { sticky: true })
        try {
          let response = await fetch(imgProxy(await bestImageUrl()))
          if (!response.ok && item.thumbUrl) response = await fetch(imgProxy(item.thumbUrl))
          if (!response.ok) throw new Error(`http ${response.status}`)
          await copyImageBlob(await response.blob())
          dismissToast(busyId)
          notify(t('copy.done'), 'success')
        } catch (error) {
          dismissToast(busyId)
          const detail = String(error?.message ?? error ?? 'unknown').slice(0, 120)
          notify(`${t('copy.fail')} (${detail})`, 'error')
        }
      }

      return h(
        'div',
        {
          className: 'pv-card', tabIndex: 0, role: 'button',
          onClick: () => onOpen(item.id),
          onKeyDown: (event) => { if (event.key === 'Enter') onOpen(item.id) },
        },
        h('div', { className: 'pv-thumb-wrap' },
          failed
            ? h('div', { className: 'pv-thumb-fail' },
              h('button', {
                className: 'pv-thumb-retry',
                title: t('retry'),
                onClick: (event) => {
                  event.stopPropagation()
                  setFailed(false)
                  setAttempt((value) => value + 1)
                },
              }, svgIcon(ICONS.refresh, 13), t('retry')),
            )
            : h('img', {
              key: attempt,
              className: 'pv-thumb',
              src: attempt > 0 ? `${imgProxy(item.thumbUrl)}&t=${attempt}` : imgProxy(item.thumbUrl),
              alt: item.title,
              loading: 'lazy', draggable: false,
              onError: () => setFailed(true),
            }),
          item.pageCount > 1 ? h('span', { className: 'pv-page-tag' }, `${item.pageCount}P`) : null,
          item.xRestrict > 0 || item.aiType === 2
            ? h('span', { className: 'pv-card-badges' },
              item.aiType === 2 ? h('span', { className: 'pv-ai-tag' }, 'AI') : null,
              item.xRestrict > 0 ? h('span', { className: 'pv-r18-tag' }, 'R18') : null,
            )
            : null,
          h('div', {
            className: 'pv-card-dl',
            onClick: (event) => event.stopPropagation(),
          },
          h('button', {
            className: 'pv-icon-btn', title: t('copy'),
            onClick: copyThumb,
          }, svgIcon(ICONS.copy, 13)),
          h('button', {
            className: 'pv-icon-btn', title: t('save'),
            onClick: saveThumb,
          }, svgIcon(ICONS.download, 13)),
          ),
        ),
        h('div', {
          className: `pv-card-actions${item.isBookmarked ? ' pv-show' : ''}`,
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
            h('span', null,
              item.totalBookmarks > 0
                ? h(React.Fragment, null, svgIcon(ICONS.heart, 10), ' ', fmtCount(item.totalBookmarks))
                : null,
            ),
          ),
        ),
      )
    }

    // ------------------------------------------------------------------ root

    function App() {
      const [t, setT] = React.useState(() => makeT())
      const [status, setStatus] = React.useState(null)
      const [prefs, setPrefs] = React.useState(() => loadPrefs())
      // committed view — the only thing that triggers a fetch. Typing, the
      // search-type select and preset clicks stay local until the user submits.
      const [view, setView] = React.useState({ category: '', word: '', searchType: 'tag', tier: '', page: 1, refreshTick: 0 })
      const [word, setWord] = React.useState('')
      const [searchType, setSearchType] = React.useState('tag')
      const [tier, setTier] = React.useState('')
      const [filter, setFilter] = React.useState('')
      const [items, setItems] = React.useState([])
      const [total, setTotal] = React.useState(0)
      const [loading, setLoading] = React.useState(false)
      const [error, setError] = React.useState(null)
      const [viewerIndex, setViewerIndex] = React.useState(null)
      const [loginOpen, setLoginOpen] = React.useState(false)
      const [settingsOpen, setSettingsOpen] = React.useState(false)
      const [toasts, setToasts] = React.useState([]) // { id, text, tone, sticky }
      const [paginated, setPaginated] = React.useState(false)
      const [filterOpen, setFilterOpen] = React.useState(false)
      const [authorName, setAuthorName] = React.useState(null)
      const [suggestOpen, setSuggestOpen] = React.useState(false)
      const [suggestIndex, setSuggestIndex] = React.useState(-1)
      const [mode, setMode] = React.useState('browse') // 'browse' | 'bookmarks'
      const [bookmarks, setBookmarks] = React.useState(null) // full list, loaded on demand
      const [bkLoading, setBkLoading] = React.useState(false)
      const [bkProgress, setBkProgress] = React.useState(null) // { loaded, total }
      const presets = React.useMemo(() => shuffle([...PRESET_TAGS]), [])
      const toastSeq = React.useRef(0)
      const toastTimers = React.useRef(new Map())
      const requestSeq = React.useRef(0)
      const searchInputRef = React.useRef(null)

      const dismissToast = React.useCallback((id) => {
        const timer = toastTimers.current.get(id)
        if (timer) {
          clearTimeout(timer)
          toastTimers.current.delete(id)
        }
        setToasts((list) => list.filter((item) => item.id !== id))
      }, [])

      // multiple toasts stack vertically; `sticky` ones stay until dismissed
      // (the caller gets the id back and dismisses it when the job finishes)
      const notify = React.useCallback((text, tone = 'info', options = {}) => {
        const id = ++toastSeq.current
        setToasts((list) => [...list.slice(-4), { id, text, tone, sticky: options.sticky === true }])
        if (!options.sticky) {
          const timer = setTimeout(() => dismissToast(id), 2600)
          toastTimers.current.set(id, timer)
        }
        return id
      }, [dismissToast])

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

      const viewKeyOf = React.useCallback((v) => {
        if (v.word) return `s:${v.searchType}:${v.word}:${v.r18 ? 1 : 0}:${v.sort}:${v.page}:${v.hideAi ? 1 : 0}:${v.tier}:${v.category}`
        if (v.category) return `c:${v.category}:${v.r18 ? 1 : 0}:${v.hideAi ? 1 : 0}:${v.page}:${v.tier}`
        return `d:${v.r18 ? 1 : 0}:${v.hideAi ? 1 : 0}`
      }, [])

      const fetchView = React.useCallback(async (view, seq) => {
        const key = viewKeyOf(view)
        const cached = viewCacheGet(key)
        if (cached) {
          setItems(cached.items ?? [])
          setTotal(typeof cached.total === 'number' ? cached.total : null)
          setPaginated(cached.paginated === true)
          setLoading(false)
          setError(null)
          return
        }
        setLoading(true)
        setError(null)
        try {
          let result
          if (view.word) {
            const query = `word=${encodeURIComponent(view.word)}&type=${view.searchType}&r18=${view.r18 ? '1' : '0'}&sort=${view.sort}&page=${view.page}&hideAi=${view.hideAi ? '1' : '0'}&tier=${encodeURIComponent(view.tier)}&cat=${encodeURIComponent(view.category)}`
            result = await api(`/search?${query}`)
            if (seq !== requestSeq.current) return
            setItems(result.items ?? [])
            setTotal(typeof result.total === 'number' ? result.total : null)
            setPaginated(result.paginated === true)
            viewCacheSet(key, {
              items: result.items ?? [],
              total: typeof result.total === 'number' ? result.total : null,
              paginated: result.paginated === true,
            })
          } else if (view.category) {
            result = await api(`/category?key=${encodeURIComponent(view.category)}&r18=${view.r18 ? '1' : '0'}&hideAi=${view.hideAi ? '1' : '0'}&page=${view.page}&tier=${encodeURIComponent(view.tier)}`)
            if (seq !== requestSeq.current) return
            setItems(result.items ?? [])
            setTotal(typeof result.total === 'number' ? result.total : null)
            setPaginated(true)
            viewCacheSet(key, {
              items: result.items ?? [],
              total: typeof result.total === 'number' ? result.total : null,
              paginated: true,
            })
          } else {
            result = await api(`/daily?r18=${view.r18 ? '1' : '0'}&hideAi=${view.hideAi ? '1' : '0'}`)
            if (seq !== requestSeq.current) return
            setItems(result.items ?? [])
            setTotal(null)
            setPaginated(false)
            viewCacheSet(key, { items: result.items ?? [], total: null, paginated: false })
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
      }, [viewKeyOf])

      const fetchKey = React.useMemo(() => ({
        ...view,
        r18: prefs.r18,
        hideAi: prefs.hideAi,
        sort: prefs.sort,
      }), [view, prefs.r18, prefs.hideAi, prefs.sort])

      React.useEffect(() => {
        if (mode === 'bookmarks') return
        const seq = ++requestSeq.current
        fetchView(fetchKey, seq)
      }, [fetchKey, fetchView, mode])

      // bookmarks mode: everything is computed locally from the in-memory
      // list — same search types / tiers / sorts, no pixiv round-trip
      React.useEffect(() => {
        if (mode !== 'bookmarks' || !bookmarks) return
        const matched = bookmarks.filter((item) => localMatch(item, view, prefs))
        const funneled = funnelText(matched, filter)
        const sorted = sortItems(funneled, prefs.sort)
        const start = (view.page - 1) * 60
        setItems(sorted.slice(start, start + 60))
        setTotal(sorted.length)
        setPaginated(true)
        setLoading(false)
        setError(null)
      }, [mode, bookmarks, view, prefs, filter])

      const filtered = React.useMemo(() => {
        if (mode === 'bookmarks') return items
        return funnelText(items, filter)
      }, [items, filter, mode])

      const hasMore = total === null ? items.length === 60 : view.page * 60 < total

      // tag frequency across all bookmarks, most-used first — replaces the
      // random presets while the bookmarks view is active
      const bookmarkTagStats = React.useMemo(() => {
        if (mode !== 'bookmarks' || !bookmarks || bookmarks.length === 0) return []
        const counts = new Map()
        for (const item of bookmarks) {
          for (const tag of item.tags ?? []) {
            const name = tag?.name
            if (!name) continue
            counts.set(name, (counts.get(name) ?? 0) + 1)
          }
        }
        return [...counts.entries()].sort((a, b) => b[1] - a[1])
      }, [mode, bookmarks])

      const activeCat = CATEGORIES.find((cat) => cat.key === view.category) ?? null
      const statusLabel = mode === 'bookmarks'
        ? (bkLoading && bkProgress
          ? fmt(t, t('bookmarks.loading'), { loaded: bkProgress.loaded, total: bkProgress.total })
          : bkLoading
            ? t('loading')
            : view.word
              ? fmt(t, t('status.bookmarksFilter'), { word: view.word })
              : fmt(t, t('status.bookmarks'), { n: fmtCount(total) }))
        : view.word
          ? fmt(t, t('status.results'), { word: view.word })
            + (activeCat ? ` · ${fmt(t, t('status.category'), { name: t(activeCat.labelKey) })}` : '')
          : activeCat
            ? fmt(t, t('status.category'), { name: t(activeCat.labelKey) })
            : t('daily')

      const commitView = React.useCallback((patch) => {
        setView((v) => ({ ...v, ...patch, refreshTick: v.refreshTick + 1 }))
      }, [])

      const togglePref = (key, value) => {
        const next = { ...prefs, [key]: value }
        setPrefs(next)
        savePrefs(next)
        setView((v) => ({ ...v, page: 1 }))
        if ((key === 'r18' && value) || (key === 'sort' && value === 'popular_d')) {
          // bookmark-mode R18 / popular sort filter locally — no cookie needed
          if (mode !== 'bookmarks' && status && !status.hasCookie) {
            notify(t('settings.needCookie'), 'error')
            setSettingsOpen(true)
          }
        }
      }

      const submitSearch = () => {
        const value = word.trim()
        setSuggestOpen(false)
        setSuggestIndex(-1)
        setFilter('')
        if (!value) {
          // empty search → back to the daily picks
          setAuthorName(null)
          setTier('')
          setWord('')
          commitView({ category: '', word: '', searchType: 'tag', tier: '', page: 1 })
          return
        }
        setAuthorName(null)
        setWord(value)
        if (searchType === 'pid' || searchType === 'user') {
          // a specific work / author can't be scoped to a category
          commitView({ category: '', word: value, searchType, tier: '', page: 1 })
        } else {
          // keep the active category → search within it
          commitView({ word: value, searchType, tier, page: 1 })
        }
      }

      const pickCategory = (key) => {
        if (mode === 'bookmarks') setMode('browse')
        setWord('')
        setFilter('')
        setAuthorName(null)
        setTier('')
        setSuggestOpen(false)
        setSuggestIndex(-1)
        setView((v) => (v.category === key
          ? v
          : { category: key, word: '', searchType: 'tag', tier: '', page: 1, refreshTick: v.refreshTick + 1 }))
      }

      const toggleBookmarks = () => {
        setViewerIndex(null)
        requestSeq.current += 1 // invalidate any in-flight browse fetch
        if (mode === 'bookmarks') {
          setMode('browse')
          return
        }
        setMode('bookmarks')
        setItems([])
        setTotal(0)
        setPaginated(false)
        setError(null)
        setLoading(true)
        setView((v) => ({ ...v, page: 1 }))
        if (bookmarks === null) loadBookmarks()
      }

      // walks every page of the user's bookmarks (48 per request, rate-limited
      // host-side but cached for 5 min); the grid fills in page by page
      const loadBookmarks = async () => {
        setBkLoading(true)
        setBkProgress(null)
        try {
          let all = []
          let offset = 0
          let total = 0
          while (true) {
            const page = await api(`/bookmarks?offset=${offset}`)
            total = typeof page.total === 'number' ? page.total : 0
            const raw = Array.isArray(page.items) ? page.items : []
            if (raw.length === 0) break
            all = all.concat(raw.filter((item) => item.illustType !== 2 && item.thumbUrl))
            offset += raw.length
            setBookmarks([...all])
            setBkProgress({ loaded: all.length, total })
            if (offset >= total) break
          }
          setBookmarks(all)
        } catch (err) {
          setError(friendlyMessage(err))
          setItems([])
          setTotal(0)
          setPaginated(false)
          setLoading(false)
        } finally {
          setBkLoading(false)
          setBkProgress(null)
        }
      }

      const searchTag = (tag) => {
        setViewerIndex(null)
        setSearchType('tag')
        setWord(tag)
        setFilter('')
        setAuthorName(null)
        setTier('')
        // keep the active category → the tag is searched within it
        commitView({ word: tag, searchType: 'tag', tier: '', page: 1 })
      }

      const searchAuthor = (userId, userName) => {
        setViewerIndex(null)
        setSearchType('user')
        setWord(String(userId))
        setFilter('')
        setAuthorName(userName)
        setTier('')
        commitView({ category: '', word: String(userId), searchType: 'user', tier: '', page: 1 })
      }

      const clearAuthor = () => {
        setAuthorName(null)
        setWord('')
        setFilter('')
        setTier('')
        commitView({ category: '', word: '', searchType: 'tag', tier: '', page: 1 })
      }

      const refreshDaily = () => {
        viewCacheDelete(`d:${prefs.r18 ? 1 : 0}:${prefs.hideAi ? 1 : 0}`)
        setView((v) => ({ ...v, refreshTick: v.refreshTick + 1 }))
      }

      const pickPreset = (tag) => {
        // fills the input only; the search runs when the user submits. A
        // trailing space is appended so the user can keep typing operators
        // (| - +) right away, and focus moves to the input for that.
        setWord((value) => {
          const trimmed = value.trimEnd()
          return trimmed ? `${trimmed} ${tag} ` : `${tag} `
        })
        searchInputRef.current?.focus()
        setSuggestOpen(false)
        setSuggestIndex(-1)
      }

      const applySuggestion = (tag) => {
        setWord((value) => {
          const trimmed = value.trimEnd()
          if (!trimmed) return `${tag} `
          // ending with whitespace or an operator → append instead of
          // replacing, and keep the operator spaced for the next token
          const last = trimmed.split(/\s+/).pop() ?? ''
          const isOperator = ['|', '-', '+'].includes(
            last.replace(/｜/g, '|').replace(/＋/g, '+').replace(/－/g, '-'))
          if (/\s$/.test(value) || isOperator) return `${trimmed} ${tag} `
          const tokens = trimmed.split(/\s+/)
          tokens[tokens.length - 1] = tag
          return `${tokens.join(' ')} `
        })
        searchInputRef.current?.focus()
        setSuggestOpen(false)
        setSuggestIndex(-1)
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
          // cached results carry stale bookmark flags — drop them
          detailCache.clear()
          viewCacheClear()
          // an unbookmarked work leaves the 我的收藏 list (and its tag stats)
          setBookmarks((list) => (list ? list.filter((item) => item.id !== id) : list))
          notify(t(want ? 'bookmark.added' : 'bookmark.removed'), 'success')
          return true
        } catch (err) {
          patch(!want)
          notify(`${t('bookmark.failed')}：${friendlyMessage(err)}`, 'error')
          return false
        }
      }

      const navigate = (delta) => {
        setViewerIndex((index) => {
          if (index === null) return index
          const next = index + delta
          return next >= 0 && next < items.length ? next : index
        })
      }

      const viewerItem = viewerIndex !== null ? (items[viewerIndex] ?? null) : null
      const suggestions = searchType === 'tag' && suggestOpen ? tagSuggestions(word) : []
      const activeSuggestion = suggestIndex >= 0 && suggestIndex < suggestions.length ? suggestions[suggestIndex] : null

      return h(
        'div',
        { className: 'pv-root' },
        h('div', { className: 'pv-topbar' },
          h('h2', { className: 'pv-title' }, t('title')),
          h('span', { className: 'pv-ver' }, `v${VERSION}`),
          h('div', { className: 'pv-spacer' }),
          status
            ? status.loggedIn
              ? h('button', { className: 'pv-chip pv-on', title: t('login'), onClick: () => setLoginOpen(true) },
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
            h('button', {
              className: `pv-cat pv-bookmarks-toggle${mode === 'bookmarks' ? ' pv-on' : ''}`,
              title: t('bookmarks'),
              onClick: toggleBookmarks,
            }, svgIcon(ICONS.heart, 12), t('bookmarks')),
            CATEGORIES.map((cat) =>
              h('button', {
                key: cat.key, className: `pv-cat${mode !== 'bookmarks' && view.category === cat.key ? ' pv-on' : ''}`,
                onClick: () => pickCategory(cat.key),
              }, t(cat.labelKey)),
            ),
          ),
          h('div', { className: 'pv-search-group' },
            h('select', {
              className: 'pv-select', value: searchType,
              'aria-label': 'search type',
              onChange: (event) => { setSearchType(event.target.value); setSuggestOpen(false); setSuggestIndex(-1) },
            },
              TYPES.map((type) => h('option', { key: type.key, value: type.key }, t(type.labelKey))),
            ),
            h('div', { className: 'pv-search-wrap' },
              h('input', {
                ref: searchInputRef,
                className: 'pv-input', type: 'text',
                placeholder: t('placeholder.' + searchType), value: word,
                onChange: (event) => {
                  const value = event.target.value
                  setWord(value)
                  setSuggestOpen(true)
                  setSuggestIndex(-1)
                  if (!value.trim() && view.word) {
                    // cleared to empty → back to the daily picks
                    setAuthorName(null)
                    setTier('')
                    commitView({ category: '', word: '', searchType: 'tag', tier: '', page: 1 })
                  }
                },
                onKeyDown: (event) => {
                  if (event.key === 'ArrowDown') {
                    if (suggestions.length === 0) return
                    event.preventDefault()
                    setSuggestOpen(true)
                    setSuggestIndex((idx) => (idx + 1) % suggestions.length)
                  } else if (event.key === 'ArrowUp') {
                    if (suggestions.length === 0) return
                    event.preventDefault()
                    setSuggestOpen(true)
                    setSuggestIndex((idx) => (idx <= 0 ? suggestions.length - 1 : idx - 1))
                  } else if (event.key === ' ' || event.key === 'Enter') {
                    if (activeSuggestion) {
                      event.preventDefault()
                      applySuggestion(activeSuggestion.tag)
                    } else if (event.key === 'Enter') {
                      submitSearch()
                    }
                  } else if (event.key === 'Escape') {
                    setSuggestOpen(false)
                    setSuggestIndex(-1)
                  }
                },
                onFocus: () => setSuggestOpen(true),
                onBlur: () => setTimeout(() => setSuggestOpen(false), 120),
              }),
              suggestions.length > 0
                ? h('div', { className: 'pv-suggest' },
                  suggestions.map((suggestion, idx) =>
                    h('button', {
                      key: suggestion.tag,
                      className: `pv-suggest-item${idx === suggestIndex ? ' pv-active' : ''}`,
                      onMouseDown: (event) => { event.preventDefault(); applySuggestion(suggestion.tag) },
                      onMouseEnter: () => setSuggestIndex(idx),
                    },
                    h('span', null, `#${suggestion.tag}`),
                    suggestion.alias ? h('span', { className: 'pv-suggest-alias' }, suggestion.alias) : null,
                    ),
                  ),
                )
                : null,
            ),
            h('button', { className: 'pv-btn', onClick: submitSearch },
              svgIcon(ICONS.search, 13), t('search')),
          ),
          h('select', {
            className: 'pv-select', value: prefs.sort, 'aria-label': t('sort.' + prefs.sort),
            onChange: (event) => togglePref('sort', event.target.value),
          },
            SORTS.map((sort) => h('option', { key: sort.key, value: sort.key }, t(sort.labelKey))),
          ),
          h(Switch, {
            on: prefs.r18, label: t('r18'), title: t('r18.hint'),
            onChange: (value) => togglePref('r18', value),
          }),
          h(Switch, {
            on: prefs.hideAi, label: t('hideAi'),
            onChange: (value) => togglePref('hideAi', value),
          }),
          h('button', {
            className: `pv-icon-btn pv-tool-btn${filterOpen || filter ? ' pv-on' : ''}`,
            title: t('filter.toggle'),
            onClick: () => setFilterOpen((open) => !open),
          }, svgIcon(ICONS.funnel, 14)),
          filterOpen
            ? h('input', {
              className: 'pv-input pv-filter-input', type: 'text', placeholder: t('filterPlaceholder'), value: filter,
              onChange: (event) => setFilter(event.target.value),
              autoFocus: true,
              onKeyDown: (event) => {
                if (event.key === 'Escape') { setFilterOpen(false); setFilter('') }
              },
            })
            : null,
        ),
        mode === 'bookmarks'
          ? h('div', { className: 'pv-toolbar pv-tag-row' },
            bookmarkTagStats.length > 0
              ? h('div', { className: 'pv-presets' },
                bookmarkTagStats.map(([tag, count]) =>
                  h('button', {
                    key: tag, className: 'pv-preset',
                    title: TAG_ZH[tag] ?? '',
                    onClick: () => pickPreset(tag),
                  }, `#${tag}`, h('span', { className: 'pv-preset-count' }, `×${count}`)),
                ),
              )
              : (bkLoading || bookmarks === null
                ? h('div', { className: 'pv-presets pv-presets-hint' },
                  bkProgress ? fmt(t, t('bookmarks.loading'), { loaded: bkProgress.loaded, total: bkProgress.total }) : t('loading'))
                : null),
            h('select', {
              className: 'pv-select', value: tier,
              'aria-label': 'bookmark tier',
              onChange: (event) => {
                const value = event.target.value
                setTier(value)
                if (view.word || view.category || mode === 'bookmarks') commitView({ tier: value, page: 1 })
              },
            },
              TIERS.map((option) => h('option', { key: option.key, value: option.key }, t(option.labelKey))),
            ),
          )
          : (searchType === 'tag' || searchType === 'title' || searchType === 'user'
            ? h('div', { className: 'pv-toolbar pv-tag-row' },
              searchType === 'tag'
                ? h('div', { className: 'pv-presets' },
                  presets.map((tag) =>
                    h('button', {
                      key: tag, className: 'pv-preset',
                      title: TAG_ZH[tag] ?? '',
                      onClick: () => pickPreset(tag),
                    }, `#${tag}`),
                  ),
                )
                : null,
              h('select', {
                className: 'pv-select', value: tier,
                'aria-label': 'bookmark tier',
                onChange: (event) => {
                  const value = event.target.value
                  setTier(value)
                  // tier re-applies live to the current search / category
                  if (view.word || view.category) commitView({ tier: value, page: 1 })
                },
              },
                TIERS.map((option) => h('option', { key: option.key, value: option.key }, t(option.labelKey))),
              ),
            )
            : null),
        authorName && !view.category && mode !== 'bookmarks'
          ? h('div', { className: 'pv-banner' },
            svgIcon(ICONS.user, 14),
            h('span', null, fmt(t, t('author.works'), { name: authorName })),
            h('span', { className: 'pv-spacer' }),
            h('button', { className: 'pv-link', onClick: clearAuthor }, t('author.clear')),
          )
          : null,
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
            h('button', {
              className: 'pv-link',
              onClick: () => (mode === 'bookmarks' ? loadBookmarks() : setView((v) => ({ ...v, refreshTick: v.refreshTick + 1 }))),
            }, t('retry')),
          )
          : null,
        h('div', { className: 'pv-body' },
          loading
            ? h('div', { className: 'pv-state' }, h('div', { className: 'pv-spinner' }))
            : filtered.length === 0
              ? h('div', { className: 'pv-state' },
                mode === 'bookmarks'
                  ? (view.category || view.word ? t('empty.none') : t('empty.bookmarks'))
                  : (view.category || view.word ? t('empty.none') : t('empty.prompt')),
                status && !status.loggedIn
                  ? h('button', { className: 'pv-btn pv-primary', onClick: () => setLoginOpen(true) }, t('login'))
                  : null,
              )
              : h('div', { className: 'pv-grid' },
                filtered.map((item) =>
                  h(Card, {
                    key: item.id, item, t,
                    onOpen: openViewer,
                    onToggleBookmark: toggleBookmark,
                    notify,
                    dismissToast,
                  }),
                ),
              ),
        ),
        h('div', { className: 'pv-statusbar' },
          h('span', { className: 'pv-status-label', title: statusLabel }, statusLabel),
          mode === 'bookmarks'
            ? h('button', { className: 'pv-status-refresh', onClick: loadBookmarks },
              svgIcon(ICONS.refresh, 13), t('refresh'))
            : !view.category && !view.word
              ? h('button', { className: 'pv-status-refresh', onClick: refreshDaily },
                svgIcon(ICONS.refresh, 13), t('refresh'))
              : null,
          paginated && (total > 0 || hasMore)
            ? h('div', { className: 'pv-pager' },
              h('button', {
                className: 'pv-pager-btn', disabled: view.page <= 1,
                onClick: () => setView((v) => ({ ...v, page: Math.max(1, v.page - 1) })),
              }, `‹ ${t('prevPage')}`),
              h('span', { className: 'pv-pager-info' },
                fmt(t, t('pageOf'), { page: view.page }),
                total ? ` · ${fmt(t, t('totalItems'), { n: fmtCount(total) })}` : '',
              ),
              h('button', {
                className: 'pv-pager-btn', disabled: !hasMore,
                onClick: () => setView((v) => ({ ...v, page: v.page + 1 })),
              }, `${t('nextPage')} ›`),
            )
            : null,
        ),
        viewerItem
          ? h(Viewer, {
            items,
            index: viewerIndex,
            onClose: () => setViewerIndex(null),
            onNavigate: navigate,
            onToggleBookmark: toggleBookmark,
            onSearchTag: searchTag,
            onSearchAuthor: searchAuthor,
            notify,
            dismissToast,
          })
          : null,
        loginOpen
          ? h(LoginModal, {
            status,
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
        toasts.length > 0
          ? h('div', { className: 'pv-toast-stack' },
            toasts.map((item) =>
              h('div', {
                key: item.id,
                className: `pv-toast${item.tone === 'error' ? ' pv-error' : item.tone === 'success' ? ' pv-success' : ''}`,
              },
              item.sticky ? h('span', { className: 'pv-spinner pv-toast-spinner' }) : null,
              item.text),
            ),
          )
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
