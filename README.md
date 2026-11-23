# tg_down_web

Telegram 下载工具的前端：React + TypeScript + Vite + Tailwind CSS，UI 基于 shadcn（Base UI primitives）。

开发时独立跑 Vite，通过 `/api` 代理访问 Go 后端；发布时 `pnpm build` 产出 `dist/`，由后端 `go:embed` 打进单文件二进制。

> **状态：W0–W4、W6（下载 + SSE）、W7 的后端内嵌与 W10/W11（下载草稿与历史）已完成**。账号页、设置页、下载页与下载队列页均已接入真实接口：
> 账号列表/切换/详情/tdata 导入/删除，服务信息与配置项查看/编辑/清除，链接解析预览，
> 下载任务列表、SSE 进度与控制、队列页 canvas 实时速度曲线，下载页频道评论区查看，
> 以及输入草稿自动保存与最近 20 条历史回填。
> 下一步是 W5a–W5c（群 / 频道 / 私聊 / 收藏夹，仿 Telegram Desktop 的会话界面）、W8（监控页）、W9（RSS 订阅入口），分别依赖后端 chats/messages、monitors 与 feeds。
> 整体规划见 [规划文档](../tg_down_server/doc/plan.md)，前端实施细则见 [前端开发规划](./docs/plan.md)。

## 技术栈

| 项 | 版本 / 说明 |
|---|---|
| React | 19.3 |
| TypeScript | 6.0（单 `tsconfig.json`，`paths` 别名，无 `baseUrl`） |
| 构建 | Vite 8，`@vitejs/plugin-react` |
| 样式 | Tailwind CSS 4（`@tailwindcss/vite`，**无 `tailwind.config.js`**） |
| 组件 | shadcn 4.23，`base-nova` 风格 + Base UI（`@base-ui/react`），图标用 lucide-react |
| 路由 | react-router-dom 7，`createBrowserRouter` + SPA fallback |
| 数据 | TanStack Query 5（服务端状态缓存、失效与重试） |
| 测试 | Vitest 5（`src/api`、`src/lib`、`src/hooks` 与无 DOM 组件，Node 环境） |

## 目录结构

```
src/
  api/              # client（token/401/超时）、endpoints、types、query-keys、events（SSE）
  components/
    accounts/       # 账号头像、切换、详情、探测
    auth/           # AuthGate / AuthProvider / AuthShell / OfflineScreen / BootSplash
    common/         # EmptyState / ErrorState / GlobalLoadingOverlay / JsonViewerDialog / ModalDialog / PeerAvatar
    layout/         # AppShell / Sidebar / Topbar / PageHeader / Brand
    messages/       # MessageText（正文实体渲染）
    PicViewer/      # 桌面图片查看器
    PicViewerMobile/
    ui/             # shadcn 生成的基础组件，勿手改
  hooks/            # use-auth、use-theme、use-accounts、use-settings、use-downloads、use-preview-links、use-comments、use-download-events、use-document-title
  lib/              # query-client、theme、format、mask、account、settings、chat、download、gallery、rich-text、clipboard、device、json、json-tree、comments、utils
  pages/            # accounts、downloads、queue、settings、登录、404、路由错误
  router.tsx        # 路由表
  main.tsx          # Provider 装配
  index.css         # Tailwind 入口 + shadcn 主题变量
vite.config.ts      # @ 别名、/api 代理、dev/preview 端口
vitest.config.ts    # 单元测试配置（Node 环境）
components.json     # shadcn 配置（style/baseColor/CSS 变量）
docs/plan.md        # 前端开发规划
```

## 开发

```bash
pnpm install
pnpm dev            # http://127.0.0.1:5173
```

后端未启动时，`/api/*` 会返回 5xx（代理连接被拒），属正常现象。

| 项 | 地址 |
|---|---|
| 前端 dev server | `http://127.0.0.1:5173` |
| Go 后端（代理目标） | `http://127.0.0.1:22429` |

端口是刻意固定并避让过的：8080 被本机其他服务占用；5173 被占用时 Vite 现在会直接报错
（`strictPort`），请先停掉旧的 dev server，不再静默顺延到 5174。Windows 上开启了文件轮询
（`server.watch.usePolling`），避免编辑器原子保存时 Vite 漏掉变更；如果仍不更新，重启一次
`pnpm dev` 并硬刷新页面。

可以用 `TG_DOWN_API_URL` 把 `/api` 代理到别的后端实例（见下节）。

### 鉴权模式

| 后端启动方式 | 前端行为 |
|---|---|
| 默认（127.0.0.1、无 `--auth-token`） | health 返回 200，直接进入；侧栏显示「本地免鉴权」 |
| 带 `--auth-token`（没有环境变量入口） | health 返回 401 → 登录页；token 存 `localStorage['tg_down.token']`，刷新免登录 |
| 任意请求返回 401 | 清 token、清查询缓存，回登录页并提示 |

token 模式下侧栏底部有「退出登录」。验证 token 流程时不要动现有 22429 实例，另起一个端口：

```bash
# 终端 A：带 token 的后端
cd tg_down_server
go run . serve --listen 127.0.0.1:22430 --auth-token test-token

# 终端 B：把 /api 指向 22430
cd tg_down_web
$env:TG_DOWN_API_URL='http://127.0.0.1:22430'; pnpm dev --port 5175
```

Bash 下写作 `TG_DOWN_API_URL=http://127.0.0.1:22430 pnpm dev --port 5175`。

## 构建与检查

```bash
pnpm build          # tsc --noEmit && vite build → dist/
pnpm typecheck      # 只做类型检查
pnpm lint           # eslint
pnpm test           # vitest（api / lib / hooks / 无 DOM 组件）
pnpm preview        # 本地预览构建产物
```

生产环境不需要独立部署前端：`dist/` 会被后端构建脚本打包进 `go:embed`。

## 约定

- **路径别名**：`@/*` → `./src/*`，由 [tsconfig.json](./tsconfig.json) 与 [vite.config.ts](./vite.config.ts) 共同保证。
- **加 shadcn 组件**：`pnpm dlx shadcn@latest add <name>`，生成到 `src/components/ui/`；直接手写请用 `cn()` 合并类名。
- **Tailwind 4 没有 config 文件**：主题色、圆角、字体都在 [src/index.css](./src/index.css) 的 `:root` / `@theme inline` 里，改主题改这里。
- **不要手改 `components/ui/`**：后续用 `shadcn add` 覆盖更新。
- **主题**：用自研 `ThemeProvider`（[src/lib/theme.tsx](./src/lib/theme.tsx)），不直接用 `next-themes` 的 Provider——后者会在 React 树里渲染 `<script>`，React 19 会报警；首屏 class 由 [index.html](./index.html) 的内联脚本提前写入。
- **API 调用**：页面不直接 `fetch`，统一走 [src/api/endpoints.ts](./src/api/endpoints.ts)；错误是 `ApiError`（`status` / `code`），401 由 [client.ts](./src/api/client.ts) 广播给 auth。
- **token**：只由 `client.ts` 读写 `localStorage['tg_down.token']`，不要拼进 URL 或日志。
- **可访问性**：`AppShell` 提供「跳到主要内容」；路由切换后聚焦 `main`（首次加载不抢焦点）；
  页面标题通过 `useDocumentTitle`/`PageHeader` 写入 `document.title`；异步骨架用
  `role="status"`，对话框焦点由 Base UI 管理；新增交互控件必须带可读标签。

## 待办

- [x] 清理 Vite 模板，接入 `react-router`、AppShell、主题与 TanStack Query（W0）。
- [x] `api` 封装（token header、错误归一、超时/401）与 token 鉴权门（W1）。
- [x] 账号页：列表、切换、详情、tdata 导入，补 client/format/mask 单元测试（W2）。
- [x] 设置页：服务信息、配置查看/编辑/清除、只读/未识别键、代理脱敏（W3）。
- [x] 响应式与可访问性打磨、文档收尾（W4）。
- [x] 下载页：链接解析预览（W6）；任务列表、SSE 进度与控制已移至「下载队列」页，
  页顶提供 canvas 实时速度曲线（最近 5 分钟，活动 1s / 空闲 10s 轮询）。
- [x] 后端内嵌前端与单二进制构建（W7，后端完成）。
- [ ] W5a 会话列表（群/频道/私聊/收藏夹，真实文件夹/归档，后端 chats/folders 未实现）。
- [ ] W5b 消息流（置顶条、标记已读、分组、分页、虚拟滚动，后端 messages/pinned/read 未实现）。
- [ ] W5c 媒体与批量下载（相册、信息面板、多选 ≤50 条，后端 downloads/from-messages 未实现）。
- [ ] 群 / 频道监控页（W8，规划，依赖后端 monitors 接口与 SSE）。
- [ ] 监控详情 RSS 订阅入口（W9，规划，依赖后端 feeds 接口）。
- [x] 下载页输入草稿持久化（W10，草稿 + 上次解析摘要，后端 downloads/draft）。
- [x] 下载页输入历史（W11，最近 20 条、回填与清空，后端 downloads/history）。
- [x] 下载页频道评论区（preview 摘要 + 点开加载 `/links/comments`，支持分页与评论媒体下载）。

## 相关文档

- [整体规划](../tg_down_server/doc/plan.md)
- [前端开发规划](./docs/plan.md)
- [API 文档](../tg_down_server/doc/api.md)
- [参考实现分析](../tg_down_server/doc/reference.md)
