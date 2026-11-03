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

插件完全复用 pixiv 网页版接口，你只需粘贴一次浏览器里的会话 Cookie，不接触账号密码：

1. 浏览器中登录 https://www.pixiv.net/
2. 按 F12 → 「应用 / Application」标签 → 存储 → Cookie → https://www.pixiv.net → 复制 `PHPSESSID` 的值
3. 插件面板 → 「登录 pixiv」→ 粘贴 PHPSESSID → 「保存并登录」

插件会用这个 Cookie 验证登录并读取你的用户名；之后搜索、R18、热门排序、收藏同步全部走它。

Cookie 仅保存在本机 `~/.pixiv-viewer/`，不会被记录到日志。

> 注：PHPSESSID 与账号强相关，请勿泄露给他人。失效（登录状态过期）时在设置里重新粘贴即可。

## R18 与热门排序

R18 搜索与「热门」排序和普通搜索一样走网页版接口，登录后即可直接使用，无需额外配置。打开 R18 开关但未登录时，插件会自动弹出登录提示。

## 代理

国内网络环境需要代理。插件设置中配置代理地址（如 `http://127.0.0.1:7890`），留空则回退到 `HTTPS_PROXY` / `https_proxy` / `HTTP_PROXY` / `http_proxy` 环境变量。

## 账号安全说明

针对封号风险，插件内置了以下约束：

- 所有网页接口请求串行化，间隔 ≥ 1.5 秒
- 图片请求独立限速（250ms 间隔、并发 ≤ 3），走带 Referer 的本地代理
- 只使用你自己的 `PHPSESSID` 会话，本地存储、绝不输出日志
- 收藏写入复用网页版自身的 CSRF 令牌，仅在需要时刷新
- 不做 HTML 抓取、不做批量操作

尽管如此，插件并非 pixiv 官方客户端，任何第三方客户端的使用都存在账号风险，请自行斟酌。

## 开发

```bash
npm run check   # node --check 全部 lib 文件
```

结构：`lib/index.js`（宿主端，注入 HTTP 路由）、`lib/routes.js`（REST 接口）、`lib/pixiv.js`（pixiv API 客户端）、`lib/client.js`（浏览器端 UI）。

## License

MIT
