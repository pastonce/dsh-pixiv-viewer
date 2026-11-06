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

    const VERSION = '0.6.0'
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
      'placeholder.tag': '标签：| 并集、+ 交集、- 排除；↑↓ 联想，空格/回车填入',
      'placeholder.title': '按作品名搜索',
      'placeholder.user': '输入作者用户 ID（点击作品上的作者名可自动搜索）',
      'placeholder.pid': '输入作品 ID（如 150702144）',
      'tier.none': '不限热度',
      'author.works': '作者作品：{name}',
      'author.clear': '清除',
      'status.results': '「{word}」的搜索结果',
      'status.category': '分类：{name}',
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
      'placeholder.tag': 'Tags: | union, + intersect, - exclude; ↑↓ suggest, Space/Enter insert',
      'placeholder.title': 'Search by title',
      'placeholder.user': 'Enter an artist user ID (click an author name on a work to search)',
      'placeholder.pid': 'Enter a work ID (e.g. 150702144)',
      'tier.none': 'Any bookmark tier',
      'author.works': 'Works by {name}',
      'author.clear': 'Clear',
      'status.results': 'Results for "{word}"',
      'status.category': 'Category: {name}',
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
.pv-icon-btn{
  display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;
  border:none;border-radius:var(--dsw-radius-sm);cursor:pointer;padding:0;
  background:rgba(0,0,0,.55);color:#fff;box-sizing:border-box;
}
.pv-icon-btn:hover{background:rgba(0,0,0,.75)}
.pv-icon-btn.pv-bookmarked{background:var(--dsw-alias-state-business-primary, #2b7fff)}
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
.pv-viewer-stage{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;position:relative;padding:8px 64px;box-sizing:border-box}
.pv-viewer-spinner{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none}
.pv-viewer-img{max-width:100%;max-height:100%;object-fit:contain;border-radius:6px;box-shadow:0 12px 48px rgba(0,0,0,.6);cursor:pointer}
.pv-viewer-img.pv-viewer-img-hidden{opacity:0}
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
.pv-viewer-btn.pv-bookmarked{border-color:transparent;background:#2b7fff;color:#fff}
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
          out.push({ tag, alias: tag === zh ? null : zh })
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

    function Viewer({ items, index, onClose, onNavigate, onToggleBookmark, notify, onSearchTag, onSearchAuthor }) {
      const [detail, setDetail] = React.useState(null)
      const [pageIdx, setPageIdx] = React.useState(0)
      const [loading, setLoading] = React.useState(true)
      const [pageLoading, setPageLoading] = React.useState(false)
      const [imgFailed, setImgFailed] = React.useState(false)
      const [imgKey, setImgKey] = React.useState(0)
      const [bookmarked, setBookmarked] = React.useState(false)
      const item = items[index]

      React.useEffect(() => {
        let alive = true
        setLoading(true)
        setPageIdx(0)
        setDetail(null)
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
          if (event.key === 'Escape') onClose()
          else if (event.key === 'ArrowLeft') goPrev()
          else if (event.key === 'ArrowRight') goNext()
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
      })

      const toggleBookmark = async () => {
        const want = !bookmarked
        setBookmarked(want)
        const ok = await onToggleBookmark(item.id, want)
        setBookmarked(ok ? want : !want)
      }

      const saveImage = () => {
        const filename = (detail?.title ?? item.title ?? 'pixiv').slice(0, 60)
        const link = document.createElement('a')
        link.href = `${imgProxy(currentUrl)}&dl=1&filename=${encodeURIComponent(filename)}`
        link.download = filename
        document.body.appendChild(link)
        link.click()
        link.remove()
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
        h('div', { className: 'pv-viewer-stage' },
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
                  className: `pv-viewer-img${pageLoading ? ' pv-viewer-img-hidden' : ''}`,
                  src: imgProxy(currentUrl), alt: detail?.title ?? item.title,
                  draggable: false,
                  onClick: goNext,
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
            h('button', { className: 'pv-viewer-btn', onClick: saveImage },
              svgIcon(ICONS.download, 14), t0('save')),
          ),
        ),
      )
    }

    function Card({ item, t, onOpen, onToggleBookmark }) {
      const [failed, setFailed] = React.useState(false)
      const [attempt, setAttempt] = React.useState(0)
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
          item.xRestrict > 0 ? h('span', { className: 'pv-r18-tag' }, 'R18') : null,
        ),
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
      const [toast, setToast] = React.useState(null)
      const [paginated, setPaginated] = React.useState(false)
      const [filterOpen, setFilterOpen] = React.useState(false)
      const [authorName, setAuthorName] = React.useState(null)
      const [suggestOpen, setSuggestOpen] = React.useState(false)
      const [suggestIndex, setSuggestIndex] = React.useState(-1)
      const presets = React.useMemo(() => shuffle([...PRESET_TAGS]), [])
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
        const seq = ++requestSeq.current
        fetchView(fetchKey, seq)
      }, [fetchKey, fetchView])

      const filtered = React.useMemo(() => {
        const query = filter.trim().toLowerCase()
        if (!query) return items
        return items.filter((item) =>
          (item.title ?? '').toLowerCase().includes(query)
          || (item.userName ?? '').toLowerCase().includes(query)
          || (item.tags ?? []).some((tag) => (tag.name ?? '').toLowerCase().includes(query)),
        )
      }, [items, filter])

      const hasMore = total === null ? items.length === 60 : view.page * 60 < total

      const activeCat = CATEGORIES.find((cat) => cat.key === view.category) ?? null
      const statusLabel = view.word
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
          if (status && !status.hasCookie) {
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
        // fills the input only; the search runs when the user submits
        setWord((value) => (value.trim() ? `${value.trim()} ${tag}` : tag))
        setSuggestOpen(false)
        setSuggestIndex(-1)
      }

      const applySuggestion = (tag) => {
        setWord((value) => {
          const tokens = value.trim().split(/\s+/).filter(Boolean)
          if (tokens.length === 0) return tag
          tokens[tokens.length - 1] = tag
          return tokens.join(' ')
        })
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

      const viewerItem = viewerIndex !== null ? items[viewerIndex] : null
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
            CATEGORIES.map((cat) =>
              h('button', {
                key: cat.key, className: `pv-cat${view.category === cat.key ? ' pv-on' : ''}`,
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
        searchType === 'tag' || searchType === 'title'
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
          : null,
        authorName && !view.category
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
            h('button', { className: 'pv-link', onClick: () => setView((v) => ({ ...v, refreshTick: v.refreshTick + 1 })) }, t('retry')),
          )
          : null,
        h('div', { className: 'pv-body' },
          loading
            ? h('div', { className: 'pv-state' }, h('div', { className: 'pv-spinner' }))
            : filtered.length === 0
              ? h('div', { className: 'pv-state' },
                view.category || view.word ? t('empty.none') : t('empty.prompt'),
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
                  }),
                ),
              ),
        ),
        h('div', { className: 'pv-statusbar' },
          h('span', { className: 'pv-status-label', title: statusLabel }, statusLabel),
          !view.category && !view.word
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
