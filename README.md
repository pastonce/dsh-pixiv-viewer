# dsh-pixiv-viewer

DeepSeek Harness 的 Pixiv 看图插件：左侧栏入口、缩略图浏览、搜索 / 标签筛选、R18 开关、大图查看、保存与账号同步收藏。

## 功能

- 左侧菜单栏一键入口，进入独立的缩略图列表页
- 关键词 / 标签搜索，支持「最新 / 最旧 / 热门」排序
- 在筛选结果内二次过滤（标题 / 标签 / 画师）
- R18 开关、隐藏 AI 作品开关
- 预置分类：原神、崩坏：星穹铁道、绝区零、未定事件簿
- 点击缩略图查看大图（多页作品翻页、键盘 ←/→/Esc）
- 保存图片到本地
- 收藏 / 取消收藏，与 pixiv 账号数据实时同步

## 安装

```bash
dsh plugin add github:<你的用户名>/dsh-pixiv-viewer
```

本地目录安装：

```bash
dsh plugin add <插件目录绝对路径>
```

安装后需在 profile 的 `dsh.profile.bundles` 中确认 `dsh-pixiv-viewer` 已启用（`dsh plugin add` 会自动写入）。

## 登录（一次即可）

插件使用官方 App API 的 OAuth 流程，不接触你的账号密码：

1. 打开插件面板 → 「登录 pixiv」→ 「打开 Pixiv 登录页」
2. 在 pixiv 页面完成登录（支持插件内配置的代理）
3. 登录后浏览器可能停在 `accounts.pixiv.net/post-redirect` 的空白页——直接把地址栏整段地址复制粘贴回插件输入框，插件会自动提取下一步地址并在新标签页继续跳转
4. 跳转最终会停在一个空白页，其地址以 `…callback…` 开头且含 `code=`——把这段地址再复制粘贴回插件输入框 → 「用授权码登录」

也可以手动粘贴 `refresh_token` 登录（如何获取请自行检索，插件不提供抓取手段）。

令牌仅保存在本机 `~/.pixiv-viewer/`，每次刷新都会轮换，不会被记录到日志。

## R18 与热门排序

R18 搜索和「热门」排序走 pixiv 网页版 ajax 接口，需要额外提供 PHPSESSID：

1. 浏览器登录 https://www.pixiv.net/
2. 从浏览器 Cookie 中复制 `PHPSESSID` 的值
3. 插件设置 → 粘贴到 PHPSESSID 输入框 → 保存

打开 R18 开关但未配置 Cookie 时，插件会自动弹出设置提示。

## 代理

国内网络环境需要代理。插件设置中配置代理地址（如 `http://127.0.0.1:7890`），留空则回退到 `HTTPS_PROXY` / `https_proxy` / `HTTP_PROXY` / `http_proxy` 环境变量。

## 账号安全说明

针对封号风险，插件内置了以下约束：

- 所有 App API 请求串行化，间隔 ≥ 1.5 秒
- 图片请求独立限速（250ms 间隔、并发 ≤ 3），走带 Referer 的本地代理
- 只使用你自己的 `refresh_token`，本地存储、随刷新轮换、绝不输出日志
- 不做 HTML 抓取、不做批量操作

尽管如此，插件并非 pixiv 官方客户端，任何第三方客户端的使用都存在账号风险，请自行斟酌。

## 开发

```bash
npm run check   # node --check 全部 lib 文件
```

结构：`lib/index.js`（宿主端，注入 HTTP 路由）、`lib/routes.js`（REST 接口）、`lib/pixiv.js`（pixiv API 客户端）、`lib/client.js`（浏览器端 UI）。

## License

MIT
