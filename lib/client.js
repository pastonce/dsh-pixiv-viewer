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

    const VERSION = '0.5.0'
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
      'placeholder.tag': '搜索标签：| 并集、+ 交集、- 排除',
      'placeholder.title': '按作品名搜索',
      'placeholder.user': '输入作者用户 ID（点击作品上的作者名可自动搜索）',
      'placeholder.pid': '输入作品 ID（如 150702144）',
      'tier.none': '不限热度',
      'preset.tags': '预设标签',
      'hint.ops': '| 并集　+ 交集（或空格）　- 排除',
      'hint.keys': '↑↓ 选择联想，空格/回车填入',
      'author.works': '作者作品：{name}',
      'author.clear': '清除',
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
      'placeholder.tag': 'Search tags: | union, + intersect, - exclude',
      'placeholder.title': 'Search by title',
      'placeholder.user': 'Enter an artist user ID (click an author name on a work to search)',
      'placeholder.pid': 'Enter a work ID (e.g. 150702144)',
      'tier.none': 'Any bookmark tier',
      'preset.tags': 'Preset tags',
      'hint.ops': '| union  + intersect (or space)  - exclude',
      'hint.keys': '↑↓ pick suggestion, Space/Enter to insert',
      'author.works': 'Works by {name}',
      'author.clear': 'Clear',
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
.pv-search-wrap{position:relative;flex:1;min-width:160px;display:flex}
.pv-search-wrap .pv-input{flex:1}
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
.pv-hint{font-size:11px;color:var(--dsw-alias-label-tertiary);white-space:nowrap;flex:none}
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
.pv-viewer-close{grid-column:1;justify-self:start;flex:none;white-space:nowrap}
.pv-viewer-stage{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;position:relative;padding:8px 64px;box-sizing:border-box}
.pv-viewer-img{max-width:100%;max-height:100%;object-fit:contain;border-radius:6px;box-shadow:0 12px 48px rgba(0,0,0,.6);cursor:pointer}
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

    const PRESET_TAGS = [
      // 角色 / 画风
      '女の子', '美少女', '少女', '少年', 'yuri', 'オリジナル', '風景', '空', '星空', '海', '花',
      '夕焼け', '朝焼け', '月', '太陽', '宇宙', '惑星', 'オーロラ', '森', '山', '砂浜', 'ビーチ',
      '雪景色', '紅葉', '春', '夏', '秋', '冬', '花火', '祭り', '夜景', '雨', '雪', '桜',
      'クリスマス', 'ハロウィン', '食べ物', '料理', 'スイーツ', 'ケーキ', 'コーヒー', '紅茶',
      'ラーメン', '寿司', '猫', '犬', 'うさぎ', '鳥', '狐', '狼', 'ペンギン', 'パンダ', 'クラゲ',
      // 发型 / 发色 / 服饰
      '金髪', '黒髪', '白髪', '銀髪', '青髪', 'ピンク髪', 'ショートカット', 'ロングヘア', 'ボブ',
      'ツインテール', 'ポニーテール', 'アホ毛', '獣耳', '猫耳', '狐耳', '兎耳', 'ケモミミ',
      '眼鏡', 'メガネ', 'サングラス', 'リボン', 'フリル', 'ドレス', '和服', '浴衣', '着物',
      'チャイナドレス', 'ゴスロリ', 'ロリータ', 'セーラー服', '制服', 'メイド', 'メイド服',
      'バニーガール', 'ナース', '巫女', 'スクール水着', '体操服', 'ブルマ', '水着', 'マフラー', '手袋',
      // 身体 / 部位
      'ニーソックス', 'ニーハイ', 'タイツ', 'パンスト', '絶対領域', 'ふともも', '巨乳', '貧乳',
      'おへそ', '裸足',
      // 世界观
      'エルフ', '天使', '悪魔', '吸血鬼', 'ヴァンパイア', '竜', 'ドラゴン', 'ロボット', 'メカ', 'SF',
      'スチームパンク', 'サイバーパンク', 'ファンタジー', '魔法少女', '魔法使い', '魔女', '剣士',
      '騎士', '王女', '姫', 'アイドル', 'バーチャルYouTuber', 'VTuber', 'ボカロ', 'VOCALOID',
      // 游戏 / 动画角色
      '初音ミク', '巡音ルカ', '鏡音リン', '鏡音レン', '東方Project', '博麗霊夢', '霧雨魔理沙',
      'フランドール・スカーレット', 'レミリア・スカーレット', '十六夜咲夜', '原神', '崩壊：スターレイル',
      '崩壊3rd', 'ゼンレスゾーンゼロ', 'ブルーアーカイブ', 'アズールレーン', 'アークナイツ', 'ウマ娘',
      'プリンセスコネクト！', 'Fate/GrandOrder', 'FGO', 'ソードアート・オンライン', 'アスナ',
      'Re:ゼロから始める異世界生活', 'エミリア', 'レム', 'ラム', 'ご注文はうさぎですか？',
      '五等分の花嫁', 'かぐや様は告らせたい', '進撃の巨人', '鬼滅の刃', '呪術廻戦', 'チェンソーマン',
      'ぼっち・ざ・ろっく！', 'SPY×FAMILY', '葬送のフリーレン', '推しの子', 'ブルーロック',
      'ハイキュー!!', '名探偵コナン', 'リコリス・リコイル', 'ワンピース', 'NARUTO', 'ドラゴンボール',
      'エヴァンゲリオン', 'ジョジョの奇妙な冒険', '銀魂', 'ハンターハンター', 'ポケモン',
      'けものフレンズ', 'ラブライブ！', 'アイドルマスター', 'ホロライブ', 'にじさんじ', 'ダンジョン飯',
      '転生したらスライムだった件', 'オーバーロード', '無職転生', 'NieR',
    ]

    // Chinese input → the equivalent Japanese tag pixiv actually uses
    const SYNONYMS = {
      '女孩': '女の子', '少女': '少女', '美少女': '美少女', '男孩': '少年', '少年': '少年', '百合': 'yuri',
      '风景': '風景', '天空': '空', '星空': '星空', '大海': '海', '花': '花', '夕阳': '夕焼け',
      '晚霞': '夕焼け', '黄昏': '夕焼け', '日出': '朝焼け', '月亮': '月', '太阳': '太陽', '宇宙': '宇宙',
      '星球': '惑星', '极光': 'オーロラ', '森林': '森', '山': '山', '沙滩': '砂浜', '海滩': 'ビーチ',
      '雪景': '雪景色', '红叶': '紅葉', '春天': '春', '夏天': '夏', '秋天': '秋', '冬天': '冬',
      '樱花': '桜', '烟花': '花火', '夏日祭': '祭り', '食物': '食べ物', '料理': '料理', '甜点': 'スイーツ',
      '蛋糕': 'ケーキ', '咖啡': 'コーヒー', '红茶': '紅茶', '拉面': 'ラーメン', '寿司': '寿司',
      '圣诞': 'クリスマス', '圣诞节': 'クリスマス', '万圣节': 'ハロウィン',
      '猫': '猫', '狗': '犬', '兔子': 'うさぎ', '鸟': '鳥', '狼': '狼', '企鹅': 'ペンギン',
      '熊猫': 'パンダ', '水母': 'クラゲ',
      '金发': '金髪', '黑发': '黒髪', '白发': '白髪', '银发': '銀髪', '蓝发': '青髪', '粉发': 'ピンク髪',
      '短发': 'ショートカット', '长发': 'ロングヘア', '波波头': 'ボブ', '双马尾': 'ツインテール',
      '单马尾': 'ポニーテール', '呆毛': 'アホ毛', '兽耳': '獣耳', '猫耳': '猫耳', '猫娘': '猫耳',
      '狐狸': '狐耳', '狐娘': '狐耳', '兔耳': '兎耳', '眼镜': '眼鏡', '墨镜': 'サングラス',
      '缎带': 'リボン', '褶边': 'フリル', '连衣裙': 'ドレス', '礼服': 'ドレス', '和服': '和服',
      '浴衣': '浴衣', '旗袍': 'チャイナドレス', '哥特萝莉': 'ゴスロリ', '萝莉': 'ロリータ',
      '水手服': 'セーラー服', '制服': '制服', '女仆': 'メイド', '女仆装': 'メイド服', '兔女郎': 'バニーガール',
      '护士': 'ナース', '巫女': '巫女', '学校泳装': 'スクール水着', '体操服': '体操服', '泳装': '水着',
      '围巾': 'マフラー', '手套': '手袋',
      '过膝袜': 'ニーソックス', '丝袜': 'タイツ', '黑丝': '黒タイツ', '连裤袜': 'パンスト',
      '绝对领域': '絶対領域', '大腿': 'ふともも', '巨乳': '巨乳', '贫乳': '貧乳', '肚脐': 'おへそ', '裸足': '裸足',
      '精灵': 'エルフ', '天使': '天使', '恶魔': '悪魔', '吸血鬼': '吸血鬼', '龙': 'ドラゴン',
      '机器人': 'ロボット', '机甲': 'メカ', '科幻': 'SF', '蒸汽朋克': 'スチームパンク',
      '赛博朋克': 'サイバーパンク', '奇幻': 'ファンタジー', '魔法少女': '魔法少女', '魔法使': '魔法使い',
      '魔女': '魔女', '剑士': '剣士', '骑士': '騎士', '公主': '姫', '王女': '王女', '偶像': 'アイドル',
      '虚拟主播': 'VTuber', '初音': '初音ミク', '初音未来': '初音ミク', '东方': '東方Project',
      '东方project': '東方Project', '灵梦': '博麗霊夢', '博丽灵梦': '博麗霊夢', '魔理沙': '霧雨魔理沙',
      '芙兰朵露': 'フランドール・スカーレット', '蕾米莉亚': 'レミリア・スカーレット', '十六夜咲夜': '十六夜咲夜',
      '原神': '原神', '崩坏': '崩壊：スターレイル', '星穹铁道': '崩壊：スターレイル', '崩铁': '崩壊：スターレイル',
      '绝区零': 'ゼンレスゾーンゼロ', '碧蓝档案': 'ブルーアーカイブ', '明日方舟': 'アークナイツ',
      '碧蓝航线': 'アズールレーン', '赛马娘': 'ウマ娘', '公主连结': 'プリンセスコネクト！',
      '命运冠位指定': 'Fate/GrandOrder', 'FGO': 'FGO', 'fgo': 'FGO', '刀剑神域': 'ソードアート・オンライン',
      '亚丝娜': 'アスナ', '从零开始': 'Re:ゼロから始める異世界生活', '艾米莉亚': 'エミリア', '蕾姆': 'レム',
      '拉姆': 'ラム', '点兔': 'ご注文はうさぎですか？', '五等分的花嫁': '五等分の花嫁',
      '辉夜大小姐': 'かぐや様は告らせたい', '进击的巨人': '進撃の巨人', '鬼灭之刃': '鬼滅の刃',
      '咒术回战': '呪術廻戦', '电锯人': 'チェンソーマン', '孤独摇滚': 'ぼっち・ざ・ろっく！',
      '间谍过家家': 'SPY×FAMILY', '葬送的芙莉莲': '葬送のフリーレン', '我推的孩子': '推しの子',
      '推子': '推しの子', '蓝色监狱': 'ブルーロック', '排球少年': 'ハイキュー!!', '名侦探柯南': '名探偵コナン',
      '莉可丽丝': 'リコリス・リコイル', '海贼王': 'ワンピース', '火影忍者': 'NARUTO', '龙珠': 'ドラゴンボール',
      'EVA': 'エヴァンゲリオン', '新世纪福音战士': '新世紀エヴァンゲリオン', 'JOJO': 'ジョジョの奇妙な冒険',
      'jojo': 'ジョジョの奇妙な冒険', '银魂': '銀魂', '全职猎人': 'ハンターハンター', '宝可梦': 'ポケモン',
      '宠物小精灵': 'ポケモン', '口袋妖怪': 'ポケモン', '动物朋友': 'けものフレンズ', 'LoveLive': 'ラブライブ！',
      'lovelive': 'ラブライブ！', '偶像大师': 'アイドルマスター', 'Hololive': 'ホロライブ',
      'hololive': 'ホロライブ', '彩虹社': 'にじさんじ', '迷宫饭': 'ダンジョン飯',
      '转生史莱姆': '転生したらスライムだった件', '史莱姆': '転生したらスライムだった件',
      '骨王': 'オーバーロード', 'overlord': 'オーバーロード', '无职转生': '無職転生', '尼尔': 'NieR',
      'nier': 'NieR', 'yuri': 'yuri',
    }

    function tagSuggestions(input) {
      const token = input.trim().split(/\s+/).pop() ?? ''
      if (!token) return []
      const lower = token.toLowerCase()
      const out = []
      const seen = new Set()
      for (const tag of PRESET_TAGS) {
        if (out.length >= 8) break
        if (tag.toLowerCase().includes(lower)) {
          out.push({ tag, alias: null })
          seen.add(tag)
        }
      }
      for (const [zhName, tag] of Object.entries(SYNONYMS)) {
        if (out.length >= 8) break
        if (seen.has(tag) || zhName === tag) continue
        if (zhName.toLowerCase().includes(lower) || tag.toLowerCase().includes(lower)) {
          out.push({ tag, alias: zhName !== tag ? zhName : null })
          seen.add(tag)
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

      const goPrev = () => {
        if (multiPage && pageIdx > 0) setPageIdx((value) => value - 1)
        else onNavigate(-1)
      }
      const goNext = () => {
        if (multiPage && pageIdx < pages.length - 1) setPageIdx((value) => value + 1)
        else onNavigate(1)
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
          h('button', { className: 'pv-viewer-btn pv-viewer-close', onClick: onClose, 'aria-label': t0('close') },
            svgIcon(ICONS.close, 14), t0('close')),
          h('div', { className: 'pv-viewer-title', title: detail?.title ?? item.title }, detail?.title ?? item.title),
        ),
        h('div', { className: 'pv-viewer-stage' },
          h('button', {
            className: 'pv-viewer-nav pv-prev', 'aria-label': t0('prevPage'),
            onClick: goPrev, disabled: !canPrev,
          }, '‹'),
          loading
            ? h('div', { className: 'pv-spinner' })
            : imgFailed
              ? h('div', { className: 'pv-viewer-error' },
                h('div', null, t0('network.error')),
                h('button', {
                  className: 'pv-viewer-btn', onClick: () => { setImgFailed(false); setImgKey((key) => key + 1) },
                }, svgIcon(ICONS.refresh, 14), t0('retry')),
              )
              : h('img', {
                key: imgKey,
                className: 'pv-viewer-img', src: imgProxy(currentUrl), alt: detail?.title ?? item.title,
                draggable: false,
                onClick: goNext,
                onError: () => setImgFailed(true),
              }),
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
            h('span', { className: 'pv-viewer-author-name' }, detail?.userName ?? item.userName)),
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
        if (v.category) return `c:${v.category}:${v.r18 ? 1 : 0}:${v.hideAi ? 1 : 0}`
        if (v.word) return `s:${v.searchType}:${v.word}:${v.r18 ? 1 : 0}:${v.sort}:${v.page}:${v.hideAi ? 1 : 0}:${v.tier}`
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
          if (view.category) {
            result = await api(`/category?key=${encodeURIComponent(view.category)}&r18=${view.r18 ? '1' : '0'}&hideAi=${view.hideAi ? '1' : '0'}`)
            if (seq !== requestSeq.current) return
            setItems(result.items ?? [])
            setTotal(0)
            setPaginated(false)
            viewCacheSet(key, { items: result.items ?? [], total: 0, paginated: false })
          } else if (view.word) {
            const query = `word=${encodeURIComponent(view.word)}&type=${view.searchType}&r18=${view.r18 ? '1' : '0'}&sort=${view.sort}&page=${view.page}&hideAi=${view.hideAi ? '1' : '0'}&tier=${encodeURIComponent(view.tier)}`
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
        if (!value) return
        setSuggestOpen(false)
        setSuggestIndex(-1)
        setAuthorName(null)
        setFilter('')
        setWord(value)
        commitView({ category: '', word: value, searchType, tier, page: 1 })
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
        commitView({ category: '', word: tag, searchType: 'tag', tier: '', page: 1 })
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
          h('div', { className: 'pv-search-wrap' },
            h('input', {
              className: 'pv-input', type: 'text',
              placeholder: t('placeholder.' + searchType), value: word,
              onChange: (event) => { setWord(event.target.value); setSuggestOpen(true); setSuggestIndex(-1) },
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
          h('select', {
            className: 'pv-select', value: searchType,
            'aria-label': 'search type',
            onChange: (event) => { setSearchType(event.target.value); setSuggestOpen(false); setSuggestIndex(-1) },
          },
            TYPES.map((type) => h('option', { key: type.key, value: type.key }, t(type.labelKey))),
          ),
          h('button', { className: 'pv-btn', onClick: submitSearch },
            svgIcon(ICONS.search, 13), t('search')),
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
              ? h(React.Fragment, null,
                h('span', { className: 'pv-hint' }, t('preset.tags')),
                h('div', { className: 'pv-presets' },
                  presets.map((tag) =>
                    h('button', {
                      key: tag, className: 'pv-preset',
                      onClick: () => pickPreset(tag),
                    }, `#${tag}`),
                  ),
                ),
              )
              : null,
            h('span', { className: 'pv-spacer' }),
            h('span', { className: 'pv-hint' }, t('hint.ops')),
            h('span', { className: 'pv-hint' }, t('hint.keys')),
            h('select', {
              className: 'pv-select', value: tier,
              'aria-label': 'bookmark tier',
              onChange: (event) => {
                const value = event.target.value
                setTier(value)
                // tier behaves like sort: re-applies live to the current search
                if (view.word && !view.category) commitView({ tier: value, page: 1 })
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
          : !view.category && !view.word
            ? h('div', { className: 'pv-banner' },
              svgIcon(ICONS.refresh, 14),
              h('span', null, t('daily')),
              h('span', { className: 'pv-spacer' }),
              h('button', { className: 'pv-link', onClick: refreshDaily }, t('refresh')),
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
