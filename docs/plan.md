# tg_down_web 开发规划

> 更新：2026-11-22。配套文档：后端规划 [plan.md](../../tg_down_server/doc/plan.md)、
> 接口契约 [api.md](../../tg_down_server/doc/api.md)。
>
> 本文按「现状 → 设计 → 路线图 → 附录」组织。实现细节以代码为准；
> 规划中的能力都标了状态，避免把设计当成已交付。

## 0. 导读

### 0.1 当前状态

- **已完成**：W0–W4（应用壳/鉴权/账号页/设置页/打磨）、W6（下载页 + SSE）、
  W7 的后端内嵌（单二进制，前端由 `-tags webdist` 打进后端）、W10（下载草稿）、W11（下载历史），
  以及下载页频道评论区（preview 摘要 + 按需加载）。
- **未开始**：W5a–W5c（仿 Telegram Desktop 的会话界面）、W8（监控页）、
  W9（RSS 订阅入口），均依赖后端尚未实现的接口。
- **已知限制**：`botapi` 账号与手机号/验证码登录没有前端入口；会话/消息、
  监控、RSS 没有页面；路由级拆包未做（主包约 769 KB，gzip 240 KB）。

### 0.2 状态图例

| 标记 | 含义 |
|---|---|
| 【已实现】 | 代码已落地并通过验收，可直接使用 |
| 【规划中】 | 设计已定，等后端接口或排期 |

### 0.3 文档结构

| 章节 | 内容 |
|---|---|
| §1 | 目标、边界与非目标 |
| §2 | 技术栈、目录、已实现页面、质量门禁、接口现状 |
| §3 | API 层、鉴权、SSE、路由与代码约定 |
| §4 | 各页面设计（已实现 + 规划） |
| §5 | 视觉与交互规范 |
| §6 | 工程规范、测试与验收 |
| §7 | 里程碑、依赖顺序与进度 |
| §8 | 后端契约需求（前端视角） |
| §9 | 风险与对策 |
| §10 | 已决定事项 |
| §11 | 附录：W0–W4 实施记录 |

## 1. 目标与边界

### 1.1 产品目标

- 单用户、本地优先：默认连 `127.0.0.1:22429` 的 Go 后端，不做多租户与权限分级。
- 打开 Web 即是完整应用壳：侧栏导航、页面标题、主题切换、后端连接状态。
- 账号与配置管理全部基于真实接口；下载页覆盖「解析 → 预览 → 入队 → 进度 → 控制」闭环。
- 后续目标：仿 Telegram Desktop 的只读会话界面（群 / 频道 / 私聊 / 收藏夹），
  以及群/频道监控、RSS 输出。
- 移动端基础可用、暗色模式可用；不追求精细适配。

### 1.2 非目标

- 多用户、注册、权限分级；i18n（界面固定中文）；PWA / 桌面壳。
- 上传、发消息、转发、在线播放、定时任务、非 Telegram 源。
- 在浏览器里执行监控检测或轮询：监控由后端 `serve` 常驻执行，前端只管理配置。
- 任务列表与消息列表的虚拟滚动暂时只给消息流预留方案，任务/账号列表先分页或全量。

### 1.3 原则

1. **不画死按钮**：后端没有的能力不渲染入口，空状态用文字说明「后端尚未提供」。
2. **契约集中**：DTO 与请求函数收敛在 `src/api/`，页面不直接 `fetch`。
3. **真实数据优先**：开发全程连真后端；mock 只在明确需要并行时引入。
4. **先能用再好看**：每个里程碑结束都要能在浏览器完整走一遍主路径。

## 2. 现状

### 2.1 技术栈

| 层 | 选择 |
|---|---|
| 框架 | React 19.3 + TypeScript 6.0 + Vite 8.3 |
| 样式 | Tailwind 4.3（`@tailwindcss/vite`）+ shadcn 4.23（`base-nova`，Base UI primitives） |
| 路由 | react-router-dom 7（`createBrowserRouter` + SPA fallback） |
| 服务端状态 | TanStack Query 5（缓存、失效、重试、轮询） |
| 客户端状态 | React Context（仅 auth）+ URL 参数，**不引入 zustand** |
| 图标 / 提示 | lucide-react / sonner |
| 测试 | Vitest 5（`pool: "threads"`，Node 环境；组件用 `renderToStaticMarkup`，不装 jsdom） |
| 日期/数字 | 原生 `Intl` + 手写格式化（不引 date-fns/dayjs） |

### 2.2 目录结构

```
src/
  api/
    client.ts        # fetch 封装、ApiError、token 读写、401 广播、超时
    endpoints.ts     # 按资源的类型化请求函数
    events.ts        # fetch 流式 SSE 客户端
    query-keys.ts    # TanStack Query key 工厂
    types.ts         # DTO，与 Go 结构体一一对应
  components/
    accounts/        # 账号头像、选择器、详情、探测
    auth/            # AuthGate / AuthProvider / AuthShell / OfflineScreen / BootSplash
    common/          # EmptyState / ErrorState / JsonViewerDialog / ModalDialog / PeerAvatar
    layout/          # AppShell / Sidebar / Topbar / PageHeader / Brand
    messages/        # MessageText（正文实体渲染）
    PicViewer/       # 桌面图片查看器
    PicViewerMobile/ # 移动端图片查看器
    ui/              # shadcn 生成物，勿手改
  hooks/             # use-auth / use-theme / use-accounts / use-settings /
                     # use-downloads / use-download-events / use-preview-links / use-comments / use-document-title
  lib/               # query-client、theme、format、mask、account、settings、chat、
                     # download、gallery、rich-text、clipboard、device、json、json-tree、comments、utils
  pages/             # accounts、downloads、queue、settings、login、not-found、route-error
  router.tsx         # 路由表
  main.tsx           # Provider 装配
  index.css          # Tailwind 入口 + shadcn 主题变量
docs/plan.md         # 本文
```

约定：

- 页面文件只做组合与路由参数，业务逻辑在 `hooks/` 与 `components/<feature>/`。
- 一个文件一个主组件；`index.tsx` 只用于页面目录，不做桶导出。
- 注释与文案用中文，与后端代码风格一致。

### 2.3 已实现页面

| 路由 | 页面 | 状态 | 主要接口 |
|---|---|---|---|
| `/login` | 登录 | 【已实现】 | `GET /health`（校验候选 token） |
| `/` → `/accounts` | 账号 | 【已实现】 | accounts 列表/详情/在线资料/切换/探测/删除/登出、头像 |
| `/settings` | 设置 | 【已实现】 | `GET/PUT /settings`、`GET /system`、health、账号选择 |
| `/downloads` | 下载 | 【已实现】 | 链接预览、下载草稿/历史、缩略图 |
| `/queue` | 下载队列 | 【已实现】 | 下载任务列表/进度/控制、SSE |
| `/chats`、`/chats/:peer` | 会话与消息 | 【规划中】 | 后端 chats/messages 未实现 |
| `/monitors` | 群/频道监控 | 【规划中】 | 后端 monitors 未实现 |
| `*` | 404 | 【已实现】 | — |

### 2.4 质量门禁

| 命令 | 现状 |
|---|---|
| `pnpm typecheck` | 通过 |
| `pnpm lint` | 通过（`src/components/ui/**` 关闭 `react-refresh/only-export-components`） |
| `pnpm test` | 通过：13 个文件、103 个用例（api / lib / hooks / 无 DOM 组件） |
| `pnpm build` | 通过；`tsc --noEmit && vite build`，产物 `dist/` |
| CI | 无；提交前本地跑 typecheck + lint + test + build |

### 2.5 接口现状

已接入（详见 [api.md](../../tg_down_server/doc/api.md)）：

| 分组 | 接口 |
|---|---|
| 基础 | `GET /health`、`GET /system` |
| 账号 | `GET /accounts`、`GET /accounts/{id}`、`GET /accounts/{id}/live`、`POST /accounts/{id}/select`、`POST /accounts/{id}/logout`、`DELETE /accounts/{id}`、`POST /accounts/probe`、`GET /accounts/{id}/avatar` |
| 设置 | `GET /settings`、`PUT /settings` |
| 链接 | `POST /links/preview`、`GET /links/comments`、`GET /media/thumbnail/{token}` |
| 下载 | `POST /downloads`、`GET /downloads`、`GET /downloads/{id}`、`GET /downloads/stats`、`GET /downloads/stats/history`、`POST /downloads/{id}/{action}`、`DELETE /downloads/{id}`、`GET /downloads/{id}/thumbnail` |
| 下载页 | `GET/PUT /downloads/draft`、`GET/POST /downloads/history`、`GET/DELETE /downloads/history/{id}`、`DELETE /downloads/history` |
| 实时 | `GET /events`（SSE：`task.update` / `task.progress` / `task.deleted`） |

尚未实现（前端已为其预留设计，见 §8）：Bot/手机号登录、会话列表与消息、标记已读、
`downloads/from-messages`、监控、RSS feed。

## 3. 架构

### 3.1 API 层

`client.ts`：

- base path 固定 `/api/v1`，与 Vite 代理和 Go 同源托管都兼容。
- 请求头：`Accept: application/json`；有 body 时 `Content-Type: application/json`；
  有 token 时带 `Authorization: Bearer <t>`。
- 超时：默认 20s；health 5s；probe 310s（服务端上限 300s）；用
  `AbortSignal.timeout` / `AbortSignal.any` 合并调用方 signal。
- 非 2xx 解析 `{error:{code,message}}`，抛 `ApiError { status, code, message }`；
  解析失败时用状态码生成兜底文案。
- 401：清空 token 并广播 `tg_down:unauthorized`，由 `AuthProvider` 统一处理；
  登录校验用 `handleUnauthorized: false`，避免候选 token 错误被当成全局登出。
- 不打印 token；错误日志只记 method / path / status。

`types.ts` 手写 DTO，与 Go 结构体一一对应；`endpoints.ts` 按资源分组；
`query-keys.ts` 统一 key 工厂。

Query key 与失效策略：

| key | 数据 | 失效时机 |
|---|---|---|
| `['health']` | 服务状态 | 30s stale |
| `['system']` | 版本/提交/编译信息 | 30s stale，失败不重试（老后端降级） |
| `['accounts']` | 账号列表 | probe/select/删除成功、窗口聚焦 |
| `['accounts', id]` | 账号详情 | 账号前缀失效时 |
| `['accounts', id, 'live']` | 在线资料 | 打开详情时按需请求 |
| `['settings']` | 配置数组 | PUT 成功后用响应回填 |
| `['downloads']` | 任务列表 | SSE 增量合并；通知派发后失效 |
| `['downloads', 'speed-history', window, bucket]` | 历史速度曲线 | 队列页轮询：活动 1s、空闲 10s；`downloads` 前缀失效时一并刷新 |

QueryClient 默认：`staleTime: 15_000`、`retry: 1`、`refetchOnWindowFocus: true`。

### 3.2 鉴权启动流程

```
读 localStorage['tg_down.token']
        │
        ▼
GET /health（带 token，如果有）
        │
   ┌────┼────────────────┬──────────────┐
   ▼    ▼                ▼              ▼
  200   401          网络错误        其他错误
   │    │                │              │
   ▼    ▼                ▼              ▼
 ready login        offline 屏幕     error 屏幕
```

- 没有匿名探测接口：**401 本身就是「需要 token」的信号**，200 表示免鉴权或 token 正确。
- 登录页提交时先用候选 token 请求 health，成功才写入 localStorage。
- 后端未启动：显示「无法连接后端」+ 启动命令提示 + 重试，不显示成 token 错误。
- 后续请求 401：清 token、清 Query 缓存、回登录页并提示 token 失效。
- 退出登录：清 token + `queryClient.clear()`；免鉴权时隐藏入口。

### 3.3 SSE

- 不用 `EventSource`：无法设置 `Authorization` 头，而 `/events` 在 token 模式下受保护。
- `fetch` + `ReadableStream` 手写解析：按行读、空行分事件、解析 `event:` 与 `data:`；
  `ping` 只刷新心跳时间。
- 重连：指数退避 2s → 4s → 8s → 16s → 30s 封顶；35s 无任何事件主动断开重连；
  重连成功先 `invalidateQueries(['downloads'])` 对齐，再接收增量。
- 卸载时 `AbortController.abort()`；页面隐藏保持连接。
- 合并：`task.update` 整条替换、`task.progress` 只更新 offset/speed、
  `task.deleted` 从列表移除；行组件 `memo` 避免整表重渲染。
- 断线期间退回 2 秒轮询，标题旁显示「已断开（轮询中）」。
- 连接由「下载队列」页的任务面板建立，离开该页即断开；侧栏常驻的任务查询
  在有活动任务时每 2s 轮询作为全局兜底，下载页的媒体行状态也读这份共享缓存。

### 3.4 路由

| 路径 | 页面 | 状态 | 备注 |
|---|---|---|---|
| `/login` | 登录 | 【已实现】 | 不带应用壳；已就绪时自动重定向 |
| `/` | → `/accounts` | 【已实现】 | 会话页上线后再评估改为 `/chats` |
| `/accounts` | 账号 | 【已实现】 | 详情用弹窗，不单独占路由 |
| `/settings` | 设置 | 【已实现】 | |
| `/downloads` | 下载 | 【已实现】 | 链接解析预览；任务面板在 `/queue` |
| `/queue` | 下载队列 | 【已实现】 | 任务列表、进度、暂停/恢复/重试/删除 |
| `/chats` | 会话列表 | 【规划中】 | 桌面端与 `/chats/:peer` 双栏 |
| `/chats/:peer` | 消息流 + 信息面板 | 【规划中】 | `peer` 形如 `channel:123`、`user:456` |
| `/monitors` | 群/频道监控 | 【规划中】 | 列表、规则、试运行与命中记录 |
| `*` | 404 | 【已实现】 | 壳内展示 |

- `createBrowserRouter` + `AuthGate` 作为根 element，内部 `Outlet`。
- `NavLink` 驱动激活态；页面切换滚动位置由浏览器处理，会话/消息页自行保存。

### 3.5 代码约定

- 组件 PascalCase，hook `useXxx`，文件与主导出同名。
- 类型导入用 `import type`（`verbatimModuleSyntax` 已开）；禁止 `any`。
- 不直接写 `localStorage`（统一走 `client.ts` 的 token 读写）。
- 组件不吞错误：交给 Query 的 `error`，或 `toast.error`。
- 提交信息：`feat(web): ...` / `fix(web): ...` / `docs(web): ...`；
  每个里程碑一个提交，提交前跑四件套。

## 4. 页面设计

### 4.1 应用壳

- 侧栏 15rem：Logo + 导航（账号 / 下载 / 下载队列 / 设置）+ 底部状态（连接状态、主题切换）；
  「下载队列」右侧显示正在下载 + 排队中的任务数（running / pending，0 时隐藏；
  有进行中任务时随任务列表每 2s 轮询更新）；会话、监控入口等后端接口就绪后再加。
- 顶栏：页面标题 + 说明；右侧刷新、主题切换、移动端菜单。
- 窄屏（< lg）：侧栏收进 `Sheet`，顶栏出现菜单按钮；表格切卡片。
- 暗色：自研 `ThemeProvider` + `index.html` 内联脚本预设 class，避免首屏闪白。
- 可访问性：skip link 指向 `<main id="main-content">`；路由切换后聚焦 `main`；
  页面标题由 `useDocumentTitle` 统一写入。

### 4.2 登录 / 离线

- 登录页：token 密码输入 + 显示切换、pending、内联错误、安全回跳；
  已存 token 失效时预填并提示。
- 说明文案：token 来自启动参数 `--auth-token`。
- 离线页：显示无法连接的后端地址、启动命令提示、错误原因与重试按钮。

### 4.3 账号页

布局：页头（标题 + 刷新 + 「从 Telegram Desktop 导入」）→ 概览条（总数 / 已登录 / 当前）
→ 列表（桌面表格 / 窄屏卡片）。

- 列：状态（已登录/未登录/异常，异常 tooltip 显示 `last_error`）、账号（名称 + `@username`）、
  类型徽章、脱敏手机号、当前标记、操作。
- 切换：行内「设为当前」或顶部「切换账号」（`AccountPickerDialog`）→
  `POST /accounts/{id}/select` → 失效 `['accounts']`；已是当前账号只提示。
- 详情弹窗：ID/类型/用户名/手机号/状态/时间/`session_present`/`last_error`；
  打开后自动请求 `/live` 展示在线资料与已登录客户端，失败展示原因与重试。
- 导入（probe）弹窗：tdata 路径（空=自动查找）、本地密码、超时 5–300s、是否导入；
  可取消（AbortController）；结果展示设备列表、导入/跳过数量与单账号错误。
- 登出/删除：普通账号提供「登出」（吊销 session + 删除本地记录）；
  桌面导入账号只提供「删除」，仅移除本地副本。
- 空状态：说明当前只有 tdata 导入一条路，不渲染禁用按钮。

### 4.4 设置页

- 布局：桌面两栏（配置 `1fr` + 右侧服务信息 `17rem`），窄屏单列且服务信息在前。
- 网页设置卡（配置列顶部）：
  - 主题（浅色/深色/跟随系统），读写服务端 `settings.web_theme`
    （`light` / `dark` / `system`，默认 `system`）；`localStorage.theme` 只用于首屏快速渲染，
    AppShell 拿到配置后以服务端值校正；配置接口失败时保留本地选择。
  - 网页标题速度开关，读写 `settings.web_title_speed`（布尔，默认 `false`）。开启后
    AppShell 汇总运行中任务的 `speed`，浏览器标题变为
    `1.2 MB/s · 下载队列 · tg_down`；无运行任务时显示
    `无活动 · 下载队列 · tg_down`。
  - 两个键都不进入通用配置列表，由卡片单独展示；写入成功后用右下角 toast 确认
    （与配置项开关一致），失败时保留本地主题并提示原因。
- 服务信息卡：健康状态、版本、提交、编译时间、运行环境（Go/OS/Arch）、运行时长、
  鉴权模式、接口前缀；取不到 `/system` 时对应行降级为 `—`。
- 配置按语义分组：**网络**（`http_proxy` + 行内启用开关）、**下载配置**
  （覆盖开关、展开正文链接、自动解析、下载评论区、并行文件数/线程数）、**Telegram API**、
  **账号**（`current_account_id` 只读 + 选择账号）、**其他配置**（未识别/未来键）。
- 每行中文标题为主，原始键名作为次要信息；徽章：已启用/已停用/只读/未识别。
- `http_proxy`：展示时密码固定 `***`；编辑校验 `http(s)/socks5/socks5h + host`；
  首次设置地址时顺带写 `http_proxy_enabled=true`；清除时同时清地址与开关。
- `current_account_id`：只读展示 `#id`，行内「选择账号」打开 `AccountPickerDialog`。
- 未知键只展示不提供编辑；PUT 成功后用响应全量回填缓存。
- 写入请求（编辑/清除、行内开关与网页设置、切换账号）期间显示全局遮罩等待层
  `GlobalLoadingOverlay`：遮罩立即挂载并拦截交互、延迟 150ms 淡入（本地快速响应不闪屏），
  保存中的弹窗不允许关闭，失败时仍能在弹窗内看到错误。所有配置写入共用
  `UPDATE_SETTINGS_MUTATION_KEY`，页面用 `useIsMutating` 统计在途写入。

### 4.5 下载页

已实现：

- 输入：多行链接（一行一条）、展开正文链接、覆盖同名文件三个开关；解析只读，不创建任务。
  其中「覆盖同名文件」「展开正文里的链接」读写系统配置
  `download_overwrite` / `download_expand_text_links`（`GET/PUT /settings`），与设置页同一项；
  只有链接文本存在下载页草稿里。打开页面时是否自动解析由 `download_auto_preview`（默认 true）控制。
- 解析结果：按消息分组展示聊天/发送人、正文（`MessageText` 渲染实体）与媒体；
  相册多行媒体；正文卡片为图片/视频封面提供占位（无封面或加载失败时显示图标 + 时长）。
- 正文卡片右上角「JSON」按钮：用公共组件 `JsonViewerDialog` 只读展示 `/links/preview`
  返回的消息原始 JSON（缩进宽度可切换 2/4/8 空格、行号、按层级着色的彩虹缩进
  与括号、数组对象元素的 `[index] =` 标注、语法着色、对象/数组可折叠、
  Ctrl/Cmd+A 全选 JSON 复制；手动选区跨折叠块时按原文展开折叠内容），
  便于核对接口字段。
- 正文卡片「评论（N）」按钮：`/links/preview` 的 `comment_section` 决定是否显示；
  点开 `CommentsDialog` 后按需请求 `GET /links/comments`（20 条/页、`next_offset_id` 加载更多），
  展示评论区讨论组、评论正文/实体、回复目标与媒体；评论媒体可直接创建下载任务。
  评论区不随 preview 批量预加载，避免 N+1 与 `FLOOD_WAIT`。
- 媒体列表：文件/会话/类型/大小/是否可下载；单行「下载」只提交该媒体（`single: true`），
  「全部下载」提交全部媒体；超过账号单文件上限显示「超过上限」，但按钮不再置灰——
  点击弹二次确认，确认后带 `allow_over_limit: true` 强制提交（Telegram 仍可能拒绝）。
  打开「覆盖同名文件」后，已完成/失败/暂停的媒体行下载按钮会变成「重新下载」并允许点击，
  由后端重置任务后从零覆盖；排队中/下载中的任务不能打断。
- 任务面板（已移至「下载队列」页）：状态页签（全部/等待/下载中/已暂停/已完成/失败）+ 数量；
  每行展示文件、会话、大小、进度条、速度、剩余时间、状态与操作（暂停/继续/重试/复制源链接/删除）；
  任务行的速度与剩余时间按最近 **10 秒滑动平均**计算（只影响展示与 ETA，接口原始 speed 不变）；
  图片任务可点缩略图看大图；删除可勾选「同时删除已下载文件」。
- 已完成任务在「已保存到 …」旁提供「查看原图 / 播放视频 / 播放音频 / 下载文件」，
  指向 `GET /downloads/{id}/file`（支持 Range）；只对 `done` 任务显示。
- 缩略图：优先用创建时登记的 token 地址，失败自动回退 `/downloads/{id}/thumbnail`
  惰性生成，两者都失败才显示类型图标。图片查看器优先用已完成任务的原文件
  （`/downloads/{id}/file`），失败后再按
  `preview_url → thumbnail_url → /downloads/{id}/thumbnail` 逐级回退：
  token 约 30 分钟失效（进程重启后也会失效），不能让查看器停在失效的大图地址。
- 下载队列页（`/queue`）：顶部是实时速度卡片（大号当前速度 + 运行任务/平均/峰值指标块 +
  canvas 曲线，最近 5 分钟、1s 粒度；
  曲线做 **10 秒滑动平均**，只影响绘制与「无活动」判断，卡片上的当前/平均/峰值仍是
  接口原始统计；纵轴按平滑后的峰值自适应，空载时用 1 MB 刻度；平滑后全为 0 时转灰并
  显示「无活动」，因此下载结束后约 10 秒才进入无活动态；数据来自
  `GET /downloads/stats/history`；活动时 1s 轮询、空闲 10s）；下方是任务面板
  （从下载页移入，SSE 实时进度 + 断线轮询兜底，见 §3.3）。
  平均/峰值统计可通过 `POST /downloads/stats/reset` 清空（曲线样本保留）；卡片暂未放按钮。

【已实现】下载草稿（W10）与输入历史（W11）：草稿保存 `links` 与上次解析摘要
（两个开关在系统配置里），刷新/换浏览器后恢复，且恢复出非空草稿时自动解析一次；
历史保留最近 20 条解析批次，每行带封面（来自后端 `thumbnail/` 磁盘缓存），
可回填并自动解析。后端接口 `downloads/draft`、`downloads/history` 已就绪。

### 4.6 会话与消息（W5a–W5c，【规划中】）

目标：群 / 频道 / 私聊 / 收藏夹的**只读**查看器，布局与交互仿 Telegram Desktop；
不发送、不转发、不删除。

- 依赖接口：`GET /chats`、`GET /chats/folders`、`GET /chats/{peer}`、
  `GET /chats/{peer}/messages`、`GET /chats/{peer}/pinned`、`POST /chats/{peer}/read`、
  `POST /downloads/from-messages`（均未实现）。
- 布局：≥1280px 四栏（侧栏 + 会话列表 22rem + 消息区 + 信息面板 20rem）；
  1024–1280px 信息面板改抽屉；<1024px 列表与对话两页，顶部返回。
- 会话列表：文件夹/归档页签（来自 `GET /chats/folders`）、头像、标题、最后消息、
  时间、置顶/静音、未读徽章、选中态；本地搜索 + `Ctrl/Cmd+K` 聚焦；置顶优先。
- 消息区：头部（头像/标题/刷新/标记已读/信息面板）、置顶条、日期分隔、发送人分组、
  回复引用、转发来源、服务消息、浏览量、已编辑；正文复用 `MessageText`；
  媒体复用预览的 `media`/`medias`，相册 2–3 列网格，查看器复用 `PicViewer`。
- 分页：初始最近 50 条，向上翻页，`@tanstack/react-virtual` 虚拟滚动；
  进入定位底部，「回到最新」浮钮；返回列表恢复滚动位置。
- 下载：单条悬浮下载；复选框 + Shift 范围多选，工具栏「下载选中 (n)」→
  `POST /downloads/from-messages`（一次最多 50 条，入队前二次确认）。
- 已读：默认不标已读；未读数 > 0 时提供「标记已读」按钮，并提示会同步到其他客户端。
- 信息面板：头像、标题、类型、`@username`、简介、成员/订阅数、置顶消息；
  「下载全部媒体」先只渲染禁用按钮（提示后续版本）。
- 数据层：keys `['chats', accountId, folder]`、`['chat', peer]`、`['messages', peer, mediaOnly]`；
  消息用 `useInfiniteQuery`（`offset_id` 翻页）；切换会话保留缓存与滚动位置。
- 一期用 15s 轮询；后端监控/updates 就绪后改 `chat.update` SSE。

### 4.7 监控与 RSS（W8 / W9，【规划中】）

- 依赖后端：`monitors` CRUD、`test`、`matches`、`resolve` 与 `monitor.*` SSE；
  `feeds` 创建 / 列表 / 删除 / 轮换。
- 列表：标题、类型（群/频道）、触发方式（新消息/置顶）、状态、最近命中、启停开关。
- 新建向导：粘贴链接或 `@username` → 解析预览 → 选择触发与过滤（媒体类型、
  发送人白/黑名单、置顶三态、关键词、大小/时长）→ 试运行展示命中/跳过原因 → 保存。
  只允许选择账号已加入的群/频道；未加入时提示先加入，不做自动加入或轮询。
- 详情抽屉：最近命中与跳过原因、关联下载任务、错误与重连状态；
  「RSS 订阅」区可创建 feed（mode/limit/enclosure）、一次性显示 URL 与 token、
  复制、停用/轮换；列表只显示掩码与最近访问时间，并提示「URL 即凭证」。
- 页面只管理配置；实际检测由后端 `serve` 常驻执行。

## 5. 视觉与交互规范

### 5.1 尺寸与排版

| 项 | 规范 |
|---|---|
| 侧栏 | 15rem，`border-r`，`bg-sidebar` |
| 内容 | 表格页 `px-6 py-6`（窄屏 `px-4`）；设置页 `max-w-4xl`（桌面两栏） |
| 圆角 | 沿用主题 `--radius`（0.625rem） |
| 字号 | 标题 `text-2xl font-semibold`；页说明 `text-sm text-muted-foreground` |
| 表格 | 行高 56px；表头 `text-xs text-muted-foreground` |
| 弹窗 | `ModalDialog`：sm 28rem / md 32rem / lg 36rem / xl 48rem；标题与底部固定，内容区滚动 |

### 5.2 状态语义

| 状态 | 文案 | 样式 |
|---|---|---|
| `authed` | 已登录 | 绿色圆点 + `text-emerald-600`（暗色 `emerald-400`） |
| `unauthed` | 未登录 | 灰色圆点 + muted |
| `error` | 异常 | 红色圆点 + `text-destructive`，tooltip 显示原因 |
| 当前账号 | 当前 | `Badge`（secondary） |
| `session_present:false` | 需要重新登录 | 琥珀色提示条 |
| 下载 `pending/running/paused/done/failed` | 等待/下载中/已暂停/已完成/失败 | 各自徽章 |

### 5.3 格式化函数

| 函数 | 行为与示例 |
|---|---|
| `formatBytes(n)` | 1024 进制；`0 B`、`512 B`、`1.5 KB`、`734 MB`、`1.2 GB` |
| `formatDuration(s)` | `13:40` / `1:02:03`（媒体时长） |
| `formatUptime(s)` | `5 分 30 秒` / `3 小时 12 分` / `1 天 2 小时` |
| `formatDateTime(sec)` | 本地时区 `YYYY-MM-DD HH:mm` |
| `formatBuildTime(raw)` | RFC3339 → 本地时间；`unknown`/空显示 `—` |
| `formatRuntime(info)` | `go1.27.1 · windows/amd64`；缺字段降级 |
| `maskPhone(raw)` | `8613754320364` → `+86 137****0364`；无法识别时原样 |
| `maskProxyUrl(raw)` | 解析 URL，密码替换 `***`；非法 URL 原样 |

手机号规则与 CLI 展示保持一致（国家码 + 前 3 + 后 4）。

### 5.4 加载 / 空 / 错误 / 文案

- 首屏鉴权检查：整页轻量骨架，不闪登录页。
- 列表加载：3–5 行骨架，宽度贴近真实内容，不用整页 spinner。
- 空状态：图标 + 一句解释 + 主操作（导入 / 去设置 / 去账号页）。
- 错误：页面级用 `ErrorState`（可重试）；操作失败用 toast；表单校验用字段内联错误。
  规则：用户能改的放内联，系统级的放 toast/页面。
- 破坏性操作统一 `ModalDialog` + 危险按钮二次确认。
- 写入等待：设置页的写请求用全局遮罩层（`GlobalLoadingOverlay`）阻断重复操作；
  弹窗内仍保留按钮级 pending 文案，不改动原有表单校验与 toast。
- 可访问性：弹窗有标题与描述；图标按钮带 `aria-label`；焦点环可见；
  状态不只靠颜色；骨架带 `role="status"` / `aria-busy`。
- 文案全中文、动词开头；服务端中文错误直接展示，不二次包装；
  技术名词保留原文（MTProto、Bot API、session、tdata、token）。
- 界面文案只描述用户能做什么、会发生什么，不暴露表名、localStorage、config.items
  等实现细节；异常兜底行为在发生时就地提示（例如保存失败 toast），不写进常态说明。

### 5.5 公共组件

`ModalDialog`：全站统一对话框外壳，参数 `open/onOpenChange`、`title/description`、
`size`（sm/md/lg/xl）、`footer`、`className/bodyClassName`；标题与 footer 固定，
内容区独立滚动；关闭/遮罩/Esc/焦点管理沿用 base-ui Dialog。

`AccountPickerDialog`：在 `ModalDialog` 上封装「从账号列表单选」，
参数 `open/onOpenChange`、`onConfirm(account)`、`title/description/confirmLabel`、
`defaultAccountId`；只有 `authed` 账号可选，关闭时清空手动选择，数据复用账号列表缓存。

`GlobalLoadingOverlay`：全屏遮罩等待层，参数 `open`、`label`、`description`、`className`；
铺满视口并拦截鼠标/触摸，`role="status"` / `aria-busy`，延迟 150ms 淡入以避开快速响应的闪屏，
用于设置页等「写入期间禁止继续操作」的场景。

## 6. 工程规范

### 6.1 脚本

| 命令 | 用途 |
|---|---|
| `pnpm dev` | 开发服务器（5173，`/api` 代理到 22429；`TG_DOWN_API_URL` 可覆盖） |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest（Node 环境） |
| `pnpm build` | 类型检查 + 生产构建 |
| `pnpm preview` | 预览构建产物（同样代理 `/api`） |

### 6.2 测试

- 范围：`src/api`（client/events）、`src/lib`（format/mask/settings/account/chat/download/
  gallery/rich-text/clipboard 等）、`src/hooks`（download events）、无 DOM 组件
  （`MessageText`、`GlobalLoadingOverlay` 用 `renderToStaticMarkup`）。
- 不写快照测试；不为 shadcn 组件写测试；不引入 jsdom（除非后续要测交互组件）。
- 当前：20 个文件、190 个用例全绿。

### 6.3 提交与验收

- 提交信息：`feat(web): ...` / `fix(web): ...` / `docs(web): ...`，一里程碑一提交。
- 每个里程碑结束：`typecheck` + `lint` + `test` + `build` 全绿；浏览器走一遍主路径，
  console 无应用错误；更新 §7 进度与相关文档。

## 7. 路线图

### 7.1 里程碑

| 阶段 | 内容 | 状态 | 依赖 |
|---|---|---|---|
| W0 基座清理 | 删模板、路由、AppShell、主题、QueryClient、Toaster、404、ErrorBoundary、lint 修复 | 【已实现】 | 无 |
| W1 API + 鉴权门 | client/types/endpoints/query-keys、AuthProvider、AuthGate、登录/离线页、401 处理 | 【已实现】 | 后端 health |
| W2 账号页 | 列表/卡片、切换、详情、probe 导入与结果、空/错/加载、脱敏 | 【已实现】 | W1 |
| W3 设置页 | 服务信息、配置分组、编辑/清除、只读/未知键、代理脱敏与开关 | 【已实现】 | W1 |
| W4 打磨 | 响应式、可访问性、骨架/空态、文案、移动端导航、文档 | 【已实现】 | W2/W3 |
| W5a 会话列表 | 文件夹/归档页签、头像、最后消息、未读/置顶、搜索、选中态 | 【规划中】 | 后端 chats/folders |
| W5b 消息流 | 头部、置顶条、标记已读、日期/发送人分组、回复/转发、分页、虚拟滚动 | 【规划中】 | 后端 messages/pinned/read |
| W5c 媒体与批量 | 相册网格、查看器、单条/多选下载（≤50）、信息面板、移动端 | 【规划中】 | `downloads/from-messages` |
| W6 下载 + SSE | 任务页、控制操作、SSE 合并、重连、断线轮询兜底 | 【已实现】 | 后端 downloads/events |
| W7 打包联调 | 后端 `go:embed`、SPA fallback、深链刷新、单二进制 | 【已实现】 | 后端 web 挂载 |
| W8 监控页 | 列表、创建向导、过滤规则、试运行、命中记录、状态 SSE | 【规划中】 | 后端 monitors/events |
| W9 RSS 入口 | 监控详情里的订阅区：创建/复制/停用/轮换 feed | 【规划中】 | 后端 feeds |
| W10 下载草稿 | 输入 + 上次解析摘要的保存/恢复、保存状态提示 | 【已实现】 | 后端 downloads/draft |
| W11 下载历史 | 历史面板、摘要展示、回填、删除/清空 | 【已实现】 | 后端 downloads/history |

### 7.2 依赖顺序

1. W5a → W5b → W5c：会话列表先落地，消息流需要 `peer` 与会话元数据，媒体批量依赖前两者。
2. W10、W11 与主线无强依赖，可在任意阶段并行；后端里程碑总表把对应的 M12/M13
   排在会话界面之后、监控之前（见 [服务端 plan.md §4.1](../../tg_down_server/doc/plan.md#41-里程碑总表)）。
3. W8 → W9：RSS 入口挂在监控详情里。
4. 拆包（路由级 `import()`）作为独立小项，等页面数量再增加时做。

### 7.3 进度记录

- 2026-11-19：W0–W4 完成。
- 2026-11-20：W6（下载 + SSE）完成。
- 2026-11-22：W7 的后端内嵌完成（默认构建产出单文件二进制）；W10/W11（下载草稿与历史）完成。
- 2026-11-22：任务面板移入「下载队列」页，并在页顶新增 canvas 实时速度曲线
  （`GET /downloads/stats/history`）。
- 2026-11-23：设置页写入请求接入全局遮罩等待层（`GlobalLoadingOverlay`），保存中禁止关闭弹窗。
- 2026-11-23：美化实时速度卡片（大号当前速度、指标块、活动/空闲状态徽章、
  加载/失败/空态占位，曲线改渐变描边 + 面积渐变 + 辉光终点）。
- 待办：W5a–W5c、W8–W9。

## 8. 后端契约需求（前端视角）

| 优先级 | 需求 | 用途 | 状态 |
|---|---|---|---|
| P0 | `POST /accounts/bot`、`POST /accounts/mtproto/{send-code,sign-in,password}` | 无 tdata 时也能新增账号 | 未实现 |
| P1 | `GET /chats/folders` | 文件夹/归档页签 | 未实现 |
| P1 | `GET /chats`、`GET /chats/{peer}`、`GET /chats/{peer}/messages`、`GET /chats/{peer}/pinned` | 会话与消息 | 未实现 |
| P1 | `POST /chats/{peer}/read` | 手动标记已读 | 未实现 |
| P1 | `POST /downloads/from-messages` | 私聊/收藏夹没有 `t.me` 链接时的批量下载 | 未实现 |
| P2 | `monitors` CRUD、`test`、`matches`、`resolve` + SSE | 监控页 | 未实现 |
| P2 | `feeds` 创建 / 列表 / 删除 / 轮换 | RSS 入口 | 未实现 |
| P2 | 打开下载目录 / 复制路径接口 | 任务行「打开所在目录」 | 未实现 |
| P2 | `GET/HEAD /downloads/{id}/file` | 任务行打开原文件、图片查看器原图、音视频 Range 播放 | 已实现 |
| P2 | `download_dir` / `max_concurrency` 登记为可写配置 | 设置页 | 未登记 |
| P3 | `GET/PUT /downloads/draft` | 输入草稿 | 已实现 |
| P3 | `/downloads/history` 列表/详情/记录/删除 | 输入历史 | 已实现 |

已解决、无需再提：settings 密码脱敏（`***`）、迁移并发安全、账号删除、
媒体缩略图接口、`downloads` CRUD 与 SSE、`GET /system`。

## 9. 风险与对策

| 风险 | 影响 | 对策 |
|---|---|---|
| 文档与实现漂移 | 按草案写出不存在的调用 | 以代码为准；§8 集中维护契约与状态 |
| 鉴权探测误判 | 把「后端未启动」显示成「token 错误」 | 严格区分 401 与网络错误；离线页单独设计 |
| probe 是长请求 | 网关/浏览器超时、用户以为卡死 | 客户端 310s 超时 + 计时 + 可取消 |
| SSE 带 token | `EventSource` 不可用 | 自写 fetch 流；统一重连与清理 |
| 401 循环 | 登录页反复请求 health | 登录页不自动重试；health 401 只置状态 |
| React 19 StrictMode 双执行 | SSE 建两次、probe 重复提交 | 副作用清理；按钮 pending 禁用；Query 去重 |
| 会话/消息量大 | 渲染卡顿、滚动掉帧 | 虚拟滚动 + 图片懒加载 + 行级 memo |
| 翻历史触发 FLOOD_WAIT | 消息加载失败 | 分页 + 并发限制 + 可读错误；不预取过多 |
| shadcn/Base UI 版本差异 | 新组件 API 与预期不同 | 只用 `shadcn add` 生成，不手改 `ui/` |
| Windows 路径输入 | 反斜杠被误解析 | 输入只 trim，不做路径拼接；给示例 |
| 首包偏大（约 743 KB，gzip 233 KB） | 首屏加载慢 | 路由级 `import()` 拆包；按需加载重组件 |
| 无 remote / 无 CI | 没有自动回归 | 提交前本地四件套；后续可选 GitHub Actions |

## 10. 已决定事项

1. **数据层**：TanStack Query，不自写 `useRequest`。
2. **客户端状态**：只有 auth 用 Context，其余放 URL / Query；不引入 zustand。
3. **SSE**：fetch 流而非 `EventSource`，为了携带 `Authorization` 并统一重连。
4. **类型**：手写 DTO 对齐 Go，暂不引入 `openapi-typescript`。
5. **主题**：自研 `ThemeProvider`（class 策略），不用 next-themes Provider。
6. **测试**：Vitest + Node 环境；不引 jsdom，组件只做无 DOM 渲染测试。
7. **首页**：当前用 `/` → `/accounts`；会话页上线后再评估改 `/chats`。

## 11. 附录：W0–W4 实施记录

### 11.1 时间线

| 里程碑 | 日期 | 主要产出 | 验证 |
|---|---|---|---|
| W0 基座 | 2026-11-19 | 应用壳、路由、主题、QueryClient、404/错误页、lint 修复 | 5173 可导航；暗色正常；四件套绿 |
| W1 API + 鉴权 | 2026-11-19 | client/types/endpoints、AuthProvider/AuthGate、登录/离线页、401 处理 | 无 token 直进；错 token 内联提示；离线页可重试 |
| W2 账号页 | 2026-11-19 | 列表/卡片、切换、详情、probe 导入、脱敏 | 真实账号与 tdata 导入通过；窄屏无溢出 |
| W3 设置页 | 2026-11-19 | 服务信息、配置分组、编辑/清除、代理合并行 | 代理修改/清除落库；非法值被拦截 |
| W4 打磨 | 2026-11-19 | skip link、焦点管理、标题、骨架、响应式、弹窗高度 | 键盘可操作；390px 无横向滚动 |

### 11.2 关键决定与坑

- **主题**：next-themes 的 Provider 会在 React 树里渲染 `<script>`，React 19 报错；
  改为自研 `ThemeProvider` + `index.html` 首帧脚本，仍用 `localStorage.theme`，
  shadcn `Toaster` 由 `AppToaster` 显式传 `resolvedTheme`。
- **Vitest**：`pool: "threads"`，本机受限环境不允许 fork 子进程（`spawn EPERM`）。
- **401 处理**：候选 token 校验用 `handleUnauthorized: false`，避免登录失败触发全局登出；
  运行时 401 统一清 token + 清缓存 + 回登录页。
- **配置元数据**：后端只返回已写入的键，前端用 `knownSettings` 镜像补占位行；
  后端补 known keys 元数据后可移除镜像。
- **后端并发迁移**：空库首次并发请求曾在 `CREATE INDEX ... already exists` 上 500，
  已由后端 `d7d2747` 修复（启动前迁移 + 串行化 + 重试 + WAL）。
- **配置密码回传**：W3 时 `GET /settings` 返回明文，已由后端改为 `***`，
  PUT 回 `***` 时沿用旧密码；前端展示与编辑逻辑兼容。

### 11.3 遗留与后续

- 路由级拆包未做（主包约 743 KB，gzip 233 KB），等页面增多后统一处理。
- 空库、非当前账号切换、未知配置键等分支主要靠单测覆盖，未在浏览器逐一验证。
- `useDocumentTitle` 依赖 `PageHeader`；新增页面若不用它需自行调用。
- 下载页草稿/历史（W10/W11）已实现，见 §4.5；剩余项见 §8。
