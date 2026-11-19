# tg_down_web 开发规划

> 依据：`tg_down_server/doc/plan.md`（整体规划）、`tg_down_server/doc/api.md`（接口草案）、
> 后端实际代码（commit `c93af5b`）与 2026-11-19 的本机实测。
> 本文只把「已验证的事实」写成约束；推断与取舍单独标注理由。
> **更新（2026-11-19）**：W0 已完成，见 §15；§1 的现状保留为开工时快照。

## 0. 结论摘要

1. 基座可用、业务为空：Tailwind 4 + shadcn + React 19 已就绪，`src/App.tsx` 仍是 Vite 模板。
2. 后端当前只实现了 **6 个接口**（健康检查、账号探测/列表/详情/切换、配置读写），
   聊天、消息、下载与 SSE 都还没有；因此前端不能按 `api.md` 草案直接开写全部页面。
3. 先交付 **Phase 1（应用壳 + 鉴权门 + 账号页 + 设置页）**，全部基于真实接口，约 **4 天**。
4. 聊天页与下载页等后端接口落地后再做；如要并行，另立 mock 方案（见 §13）。
5. 关键选型：TanStack Query 管服务端状态；**不引入 zustand**；SSE 用 fetch 流而非
   `EventSource`（为了带 `Authorization`）；API 类型手写对齐 Go 结构体，暂不引入代码生成。

## 1. 现状盘点

### 1.1 仓库与工具链（已验证）

| 项 | 现状 |
|---|---|
| Git | `338ca49 初始化仓库`，工作区干净，无 remote |
| Node / pnpm | v22.23.1 / 11.21.0 |
| 框架 | React 19.3.1 + TypeScript 6.0 + Vite 8.3.6 |
| 样式 | Tailwind 4.3.5（`@tailwindcss/vite`，无 config 文件）+ shadcn 4.23（`base-nova`，Base UI primitives） |
| 已装但未用 | `react-router-dom` 7.18、`next-themes`、`sonner` |
| 未装 | TanStack Query、测试框架 |
| 类型检查 | `pnpm typecheck` 通过 |
| Lint | **失败**：`badge.tsx` / `button.tsx` / `tabs.tsx` 触发 `react-refresh/only-export-components` |
| 构建 | `pnpm build` 可产出 `dist/`，但内容仍是模板页 + 模板图片 |

### 1.2 代码资产

```
src/
  App.tsx             Vite 模板页（将被删除）
  App.css             模板样式（将被删除）
  main.tsx            只有 createRoot，无路由/Provider
  index.css           Tailwind + shadcn 主题变量（保留，后续微调）
  lib/utils.ts        cn()
  components/ui/      14 个 shadcn 组件（保留，勿手改）
  assets/             hero.png / react.svg / vite.svg（模板资源，删除）
public/
  favicon.svg         疑似项目图标（保留）
  icons.svg           Vite 模板图标（删除）
```

现有 `components/ui`：`badge button card dialog dropdown-menu input progress select
skeleton sonner table tabs textarea tooltip`。
后续按需补：`label`、`switch`、`separator`、`scroll-area`、`sheet`（移动端导航）、
`alert-dialog`（破坏性确认）。

### 1.3 后端接口现状（已验证）

真实运行的实例：`http://127.0.0.1:22429`，`/api/v1/health` 返回
`{"status":"ok","uptime_seconds":1519,"version":"dev"}`。本机已有 1 个 mtproto 账号
（`ma6254`，当前账号）、2 项配置（`http_proxy`、`current_account_id`），Telegram Desktop
的 `tdata` 存在，账号页可以立刻做真实联调。

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/v1/health` | `status` / `version` / `uptime_seconds` |
| POST | `/api/v1/accounts/probe` | 读取本机 tdata，校验并导入账号；同步执行，最长 300s |
| GET | `/api/v1/accounts` | `accounts[]` + `current_account_id` |
| GET | `/api/v1/accounts/{id}` | 详情，含 `updated_at`、`session_present` |
| POST | `/api/v1/accounts/{id}/select` | 设为当前账号；404 不存在、409 session 不可用 |
| GET/PUT | `/api/v1/settings` | 配置数组；PUT 为补丁，值为 `null` 表示删除 |

鉴权与错误：

- 配置了 `--auth-token` 时，**所有 `/api/*`（含 health）** 都要求 `Authorization: Bearer <t>`；
  静态资源与 `/api/openapi.json` 不需要。没有 `/api/v1/session` 之类的匿名探测接口。
- 错误统一为 `{"error":{"code":"...","message":"..."}}`，`code` 取值：
  `bad_request` / `unauthorized` / `not_found` / `conflict` / `probe_failed` /
  `probe_timeout` / `internal_error` / `not_implemented`。
- `GET /api/v1/settings` 返回的是数组，不是 `api.md` 里的对象：

  ```json
  {"settings":[
    {"key":"current_account_id","value":"1","description":"…","known":true,"read_only":true},
    {"key":"http_proxy","value":"http://127.0.0.1:7897","description":"…","known":true}
  ]}
  ```

  只允许写 `config.items` 里登记过的键；未知键返回 400。目前可写键只有 `http_proxy`，
  `current_account_id` 标记为只读。
- 尚无的接口：删除账号、Bot/手机号登录、会话列表、消息列表、下载任务、SSE 事件。
- 前端挂载尚未接线：`server.WebConfig` 存在，但 `cmd/serve.go` 没有传入，
  也没有 `--web-mode` / `--web-dir` 参数，所以 `http://127.0.0.1:22429/` 仍是占位页。
  **开发期只能用 Vite（5173）代理 `/api` 到 22429。**

### 1.4 文档漂移（需要顺手修）

| 文档 | 漂移点 |
|---|---|
| `doc/api.md` | `/health` 实际是 `/api/v1/health`；`/api/v1/session` 不存在；settings 实际是数组；`retry_after` 字段尚未实现；删除账号、SSE、下载接口都未实现 |
| `tg_down_server/README.md` | 仍写「HTTP 服务本体尚未接入（M1）」，实际已接入 |
| `tg_down_web/README.md` | 状态描述基本准确，但待办列表可以随实现更新 |

前端以**代码实际行为**为准；W1 结束前把 `api.md` 标注清楚「已实现 / 规划中」，
避免下一个人照草案写出不存在的调用。

### 1.5 基线质量

- `pnpm typecheck` 绿、`pnpm lint` 红、无测试、无 CI、无格式化工具。
- 仓库无 remote，提交直接走 `master`，约定用 `feat:` / `fix:` / `docs:` 前缀（与后端一致）。
- W0 的第一件事就是把 lint 修绿，否则后续每个里程碑都在噪音里看 lint。

## 2. 目标与边界

### 2.1 Phase 1 目标（现在就能交付）

- 打开 Web 即是完整应用壳：侧栏导航、页面标题、主题切换、后端连接状态。
- 鉴权门：后端开了 token 时要求输入并校验；本地免鉴权时直接进入；后端未启动时给出可操作提示。
- 账号页：账号列表、当前账号切换、详情、从 Telegram Desktop 导入（probe）。
- 设置页：服务信息（版本/运行时长）+ 配置项查看/编辑/清除，严格按服务端返回渲染。
- 移动端基础可用（不追求精细适配）、暗色模式可用。

### 2.2 后续阶段（后端 gate）

- 会话与消息浏览（`/chats`、`/chats/:chatId`）+ 媒体筛选 + 批量入队。
- 下载任务页：进度、速度、暂停/继续/重试/删除、SSE 实时刷新、断线重连。
- 打包联调：后端 `--web-mode` / `go:embed`，单二进制。

### 2.3 非目标（当前不做）

- 多用户、注册、权限分级；i18n（界面固定中文）；PWA / 桌面壳。
- 上传、发消息、在线播放、定时任务、非 Telegram 源。
- 任务列表虚拟滚动（先分页，数据量上来再评估）。
- 消息缩略图（后端没有缩略图接口，媒体卡片先只显示元数据）。

### 2.4 原则

1. **不画死按钮**：后端没有的能力不渲染入口，或在空状态里用文字说明「后端尚未提供」。
2. **契约集中**：所有 DTO 与请求函数收敛在 `src/api/`，页面不直接 `fetch`。
3. **真实数据优先**：Phase 1 全程连真后端；mock 只在明确要并行开发时引入。
4. **先能用再好看**：每阶段结束都能在浏览器里完整走一遍主路径。

## 3. 技术选型

| 决策 | 选择 | 理由 |
|---|---|---|
| 路由 | `react-router-dom` 7 的 `createBrowserRouter` | 已装；data router 便于统一错误页 |
| 服务端状态 | `@tanstack/react-query` 5（新增） | 账号/设置/会话/任务都是服务端状态，缓存、失效、重试、加载态开箱即用 |
| 客户端状态 | React Context（仅 auth）+ URL 参数 | 全局状态只有 token；当前浏览账号放 URL，刷新/回退不丢 |
| 状态库 | **不引入 zustand** | 与 `plan.md` §8 的差异：当前没有跨页客户端状态，用不上 |
| 表单 | 受控组件 + 局部 state | 只有登录、probe、设置编辑三个小表单，不引入 react-hook-form |
| 校验 | 手写 + 服务端兜底 | 规则少；服务端已有 `ValidateProxy`，前端只做即时提示 |
| SSE | 自写 fetch 流式客户端（Phase 3） | `EventSource` 不能带 `Authorization`；fetch 可统一重连/退避/清理 |
| API 类型 | 手写 `types.ts`，与 Go 结构体一一对应 | `openapi.json` 只覆盖已实现接口；手写可先行，字段少、变更可控 |
| 代码生成 | 暂不引入 `openapi-typescript` | 现阶段收益低于成本；后端接口稳定后再评估 |
| 图标 / 提示 | `lucide-react` / `sonner` | 已装 |
| 主题 | 自研 `ThemeProvider`（class 策略） | next-themes 会向 React 树注入 `<script>`，React 19 会报错；首屏由 index.html 内联脚本处理，主题仍存 `localStorage.theme` |
| 测试 | Vitest 5（`pool: "threads"`，Node 环境） | 已覆盖 `client`、`format`、`mask`、`settings`；组件测试延后 |
| 日期/数字 | 原生 `Intl` + 手写格式化 | 不引 date-fns / dayjs |

新增依赖只有 `@tanstack/react-query`（运行时）与 `vitest`（开发时）；
若测试要渲染组件，再加 `@testing-library/react` + `jsdom`，否则先不装。

## 4. 目录结构（目标态）

```
src/
  api/
    client.ts          # fetch 封装、ApiError、token 读写、401 广播、超时
    endpoints.ts       # 按资源的类型化函数（health/accounts/settings/...）
    query-keys.ts      # TanStack Query key 工厂
    types.ts           # DTO，与 Go struct 一一对应
    events.ts          # P3：fetch 流式 SSE 客户端
  components/
    layout/            # AppShell / Sidebar / Topbar / PageHeader / ConnectionBadge
    common/            # EmptyState / ErrorState / Loading / ConfirmDialog
    auth/              # AuthGate / LoginScreen / OfflineScreen
    accounts/          # AccountTable / AccountMobileList / AccountDetailDialog / ProbeDialog
    settings/          # ServiceInfoCard / SettingsTable / SettingEditDialog
    ui/                # shadcn 生成物，勿手改
  hooks/
    use-auth.tsx       # AuthProvider + useAuth（token、登录、退出、401 处理）
    use-health.ts
    use-accounts.ts
    use-settings.ts
    use-event-stream.ts  # P3
  lib/
    format.ts          # 字节/速度/ETA/日期/时长
    mask.ts            # 手机号、代理地址脱敏
    query-client.ts    # QueryClient 默认参数
    theme.tsx          # ThemeProvider
  pages/
    login/index.tsx
    accounts/index.tsx
    settings/index.tsx
    chats/index.tsx      # P2
    chats/detail.tsx     # P2
    downloads/index.tsx  # P3
    not-found.tsx
  router.tsx
  main.tsx
  index.css
docs/plan.md           # 本文
```

约定：

- 页面文件只做组合与路由参数，业务逻辑在 `hooks/` 与 `components/<feature>/`。
- 一个文件一个主组件；`index.tsx` 只用于页面目录，不做桶导出（避免循环依赖）。
- 注释与文案用中文，与后端代码风格一致。

## 5. API 层设计

### 5.1 `client.ts`

```ts
class ApiError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string)
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
  signal?: AbortSignal
  timeoutMs?: number   // 默认 20_000；probe 传 310_000
}
```

要点：

- base path 固定 `/api/v1`，与 Vite 代理和 Go 同源托管都兼容。
- 请求头：`Accept: application/json`；有 body 时 `Content-Type: application/json`；
  有 token 时带 `Authorization: Bearer <t>`。
- 超时：默认 20s，用 `AbortSignal.timeout` / `AbortSignal.any` 组合调用方的 signal；
  **probe 必须单独放宽到 310s**（服务端上限 300s，留余量），并允许用户取消。
- 响应：204/空 body 返回 `undefined`；否则解析 JSON。
- 非 2xx：解析 `{error:{code,message}}`，抛 `ApiError`；解析失败时用状态码生成兜底文案。
- 401：清空 token 并广播 `tg_down:unauthorized` 事件（由 `AuthProvider` 统一处理，
  避免每个页面各自跳转）。
- 不打印 token；错误日志只记 method/path/status。

### 5.2 `types.ts`（与 Go 结构体对齐）

```ts
export type AccountKind = 'mtproto' | 'botapi'
export type AccountState = 'unauthed' | 'authed' | 'error'

export interface Account {
  id: number
  kind: AccountKind
  name: string
  username?: string
  phone?: string
  state: AccountState
  last_error?: string
  created_at: number      // Unix 秒
  current: boolean
}

export interface AccountDetail extends Account {
  updated_at?: number
  session_present: boolean
}

export interface AccountsResponse {
  accounts: Account[]
  current_account_id?: number
}

export interface ProbeRequest {
  tdata?: string
  tdata_passcode?: string
  timeout_seconds?: number   // 5–300，默认 30
  import?: boolean           // 默认 true
}

export interface ProbeDevice {
  current: boolean
  app_name?: string
  app_version?: string
  platform?: string
  device_model?: string
  system_version?: string
  country?: string
  created_at?: number
  active_at?: number
}

export interface ProbeAccount {
  index: number
  user_id: number
  name?: string
  username?: string
  phone?: string
  devices?: ProbeDevice[]
  error?: string
}

export interface ProbeResponse {
  tdata_path?: string
  accounts: ProbeAccount[]
  imported: number
  skipped: number
  selected_account_id?: number
}

export interface Setting {
  key: string
  /** 服务端 config.items 定义的逻辑类型：string / integer / boolean。 */
  type?: string
  /** 未配置时使用的默认值；为空表示没有默认值。 */
  default?: string
  value: string
  description?: string
  known: boolean
  read_only?: boolean
}

export interface SettingsResponse { settings: Setting[] }

export type SettingsPatch = Record<string, string | null>

export interface Health {
  status: string
  version: string
  uptime_seconds: number
}
```

### 5.3 `endpoints.ts`

```ts
health(): Promise<Health>
accounts.list(): Promise<AccountsResponse>
accounts.get(id: number): Promise<AccountDetail>
accounts.select(id: number): Promise<{ ok: boolean; current_account_id: number }>
accounts.probe(req: ProbeRequest, signal?: AbortSignal): Promise<ProbeResponse>
settings.get(): Promise<SettingsResponse>
settings.update(patch: SettingsPatch): Promise<SettingsResponse>
```

Phase 2/3 的接口（chats/messages/downloads/events）等后端落地后再补，签名先按 `api.md` 预留注释。

### 5.4 Query key 与缓存策略

| key | 数据 | 失效时机 |
|---|---|---|
| `['health']` | 服务状态 | 30s 轮询（窗口聚焦时） |
| `['accounts']` | 账号列表 | probe 成功、select 成功、窗口聚焦 |
| `['accounts', id]` | 账号详情 | 对应列表失效时 |
| `['settings']` | 配置数组 | PUT 成功（用响应回填） |

QueryClient 默认值：`staleTime: 15_000`、`retry: 1`、`refetchOnWindowFocus: true`。
本地单用户应用，不需要 `refetchOnMount` 的额外控制。

### 5.5 鉴权启动流程

```
读 localStorage['tg_down.token']
        │
        ▼
GET /api/v1/health（带 token，如果有）
        │
   ┌────┼────────────────┬──────────────────┐
   ▼    ▼                ▼                  ▼
 200   401             网络错误            其他错误
   │    │                │                  │
   ▼    ▼                ▼                  ▼
 ready  login        offline 屏幕        error 屏幕
```

- 没有 `/session` 接口也没关系：**401 本身就是「需要 token」的信号**，
  200 说明「无需鉴权」或「token 正确」。健康检查在鉴权范围内，正好可用。
- 登录页提交时先用候选 token 请求 health，成功才写入 localStorage；失败不覆盖旧值。
- 后端未启动（fetch 抛 TypeError）：显示「无法连接后端」+ 启动命令提示 + 重试按钮，
  不要显示成「token 错误」。
- 任何后续请求返回 401：清 token、清 Query 缓存、回登录页，并提示「token 已失效」。
- 退出登录：清 token + `queryClient.clear()`；未启用鉴权时隐藏该入口。
- 静态资源本身不受 token 保护，所以登录页能正常加载。

### 5.6 错误映射

| HTTP / code | 展示策略 |
|---|---|
| 400 `bad_request` / `probe_failed` | 表单内联错误，原文展示（服务端文案已经可操作） |
| 401 `unauthorized` | 回登录页，提示 token 无效或已变更 |
| 404 `not_found` | 列表项不存在：toast + 刷新列表；详情：空状态 |
| 409 `conflict` | toast（账号 session 不可用） |
| 501 `not_implemented` | 防御性提示「后端未实现该能力」，不重试 |
| 504 `probe_timeout` | probe 弹窗内提示检查代理 / 调大超时 |
| 网络错误 | 区分「后端未启动」与「请求被取消」，前者给重试 |
| 500 | 通用 toast + 展开详情（message） |

### 5.7 SSE（Phase 3 设计，先写清楚避免返工）

- 不用 `EventSource`：它无法设置 `Authorization` 头，而 `/api/v1/events` 在 token 模式下受保护。
- 用 `fetch` + `ReadableStream` 手写解析：按行读、以空行分事件、解析 `event:` 与 `data:`；
  `ping` 只刷新心跳时间。
- 重连：指数退避 1s → 2s → 5s → 10s → 30s 封顶；45s 没收到任何事件视为断线主动重连；
  重连成功后先全量 `GET /downloads` 对齐，再接收增量。
- 页面隐藏（`visibilitychange`）时保留连接但降低处理频率；卸载时 `AbortController.abort()`。
- 数据合并：`queryClient.setQueryData(['downloads'], ...)` 按 id 合并，
  `task.done` / `task.failed` 触发列表重取；避免整表重渲染（行组件 `memo`）。
- Vite 代理与 Go 中间件都要保证不缓冲：Go 侧 `statusRecorder.Flush` 已实现，联调时验证。

## 6. 路由

| 路径 | 页面 | 阶段 | 备注 |
|---|---|---|---|
| `/login` | 登录 | P1 | 不带应用壳；已就绪时自动重定向 |
| `/` | 重定向 `/accounts` | P1 | 聊天页上线后可改为重定向 `/chats` |
| `/accounts` | 账号 | P1 | 账号详情用弹窗，不单独占路由 |
| `/settings` | 设置 | P1 | |
| `/chats` | 会话列表 | P2 | 桌面端与 `/chats/:chatId` 组成双栏 |
| `/chats/:chatId` | 消息 | P2 | 窄屏单独一页，带返回 |
| `/downloads` | 下载任务 | P3 | |
| `*` | 404 | P1 | 壳内展示 |

- 路由用 `createBrowserRouter`，`AuthGate` 作为根的 `element`，内部 `Outlet`。
- 顶部导航用 `NavLink`，激活态由路由驱动。
- 页面切换保留滚动位置由浏览器处理；会话/消息页自行保存列表滚动位置。

## 7. 页面设计

### 7.1 应用壳

- 侧栏 15rem：Logo + 导航（账号 / 会话 / 下载 / 设置）+ 底部状态（版本、连接点、主题切换）。
  P1 只有账号与设置可点，会话/下载入口先不渲染（不画死链接）。
- 顶栏：页面标题 + 一句说明；右侧放刷新、主题切换、移动端菜单按钮。
- 内容区：`max-w-none` 的表格页；设置页限制 `max-w-3xl`；统一 24/32px 内边距。
- 窄屏（< lg）：侧栏收进 `Sheet`，顶栏出现菜单按钮；表格切卡片。
- 暗色：自研 `ThemeProvider` + `index.html` 内联脚本预设 class，避免首屏闪白。

### 7.2 登录页

- 居中卡片：标题、token 输入（password + 显示/隐藏）、提交、错误区。
- 说明文案：token 来自启动参数 `--auth-token` 或 `TG_DOWN_TOKEN`。
- 已存 token 但失效时，预填并提示「上次的 token 已失效」。
- 网络错误单独区块：显示 `无法连接 http://127.0.0.1:22429`、检查后端是否启动、重试。

### 7.3 账号页

布局：页头（标题 + 刷新 + 主按钮「从 Telegram Desktop 导入」）→ 概览条（总数 / 已登录 / 当前）
→ 列表。

列表（桌面表格）：

| 列 | 内容 |
|---|---|
| 状态 | 圆点 + 文案（已登录 / 未登录 / 异常），异常时 tooltip 显示 `last_error` |
| 账号 | `name` + `@username`（没有则 `-`） |
| 类型 | `mtproto` / `botapi` 徽章 |
| 手机号 | 脱敏（`+86 137****0364`） |
| 当前 | 当前账号打勾/徽章 |
| 操作 | 「设为当前」/「详情」；当前账号禁用切换 |

窄屏改卡片：名称 + 状态 + 用户名/手机号 + 操作。

- 切换当前账号：`POST /accounts/{id}/select` → 失效 `['accounts']` → toast；409 原样提示。
- 详情弹窗：ID、类型、名称、用户名、手机号（脱敏）、状态、创建/更新时间、
  `session_present`（false 时醒目提示「session 文件缺失，需要重新登录」）、`last_error`。
- 空状态：说明「本工具目前通过读取本机 Telegram Desktop 的 tdata 导入账号」+ 导入按钮。

导入（probe）弹窗：

| 字段 | 默认 | 约束 |
|---|---|---|
| tdata 路径 | 空（自动查找） | 可粘贴 Windows 路径；提示自动查找顺序 |
| 本地密码 | 空 | 仅设置了本地密码时需要 |
| 超时 | 30 秒 | 5–300，number |
| 导入 | 勾选 | false 时只探测不落库 |

- 提交后显示已用时长 + 取消（AbortController）；最长 310s。
- 结果区：`tdata_path`、每个账号的名称/用户名/手机号/设备列表、单账号错误；
  汇总 `imported` / `skipped` / `selected_account_id`。
- 成功后关闭并刷新账号列表；`probe_failed` / `probe_timeout` 在弹窗内展示。
- 错误码为 400 时保留输入，便于改路径重试。

**暂不提供**：删除账号（无接口）、Bot 接入、手机号验证码登录（均无接口）。
空状态里用一句话说明当前只有 tdata 导入这一条路，不渲染禁用按钮。

### 7.4 设置页

- 服务信息卡：`status`、`version`、`uptime_seconds`（格式化为 `1 天 2 小时`）、
  当前鉴权模式（前端推断：有 token / 无 token）、接口地址。
- 配置表：每行 `key`、`description`、值、徽章（只读 / 未识别）、操作（编辑 / 清除）。
- 值脱敏：`http_proxy` 若带用户名密码，展示为 `http://user:***@host:port`
  （后端已返回 `***`，前端再做一次幂等展示；见 §11）。
- 编辑：只对 `known && !read_only` 的键开放。`http_proxy` 前端校验
  `socks5/socks5h/http/https + host`，与服务端规则一致；保存仍以服务端校验为准。
- 布尔项（`http_proxy_enabled`）用 Switch 编辑：关闭表示保留代理地址但直连；
  未配置时显示「已启用（默认）」，清除开关恢复默认启用。
- 清除：`PUT {"http_proxy": null}`；`http_proxy_enabled` 的清除语义是恢复默认（启用）。
- PUT 成功后用响应里的完整数组回填 `['settings']`，不额外发 GET。
- `current_account_id`：只读展示，附「去账号页切换」链接。
- 未知键（`known:false`）：只展示，不提供编辑（服务端会拒绝）。
- 空配置：`http_proxy` 未设置时显示「未配置（直连）」，`http_proxy_enabled` 显示「已启用（默认）」。

> 设置页不预设 `api.md` 里的 `download_dir` / `max_concurrency` 等键——
> 这些配置目前不在 `config.items` 里，后端也不会返回。等后端登记后自动出现，
> 编辑控件按 key 注册表（`http_proxy` 专用输入、`http_proxy_enabled` Switch，其余通用文本框）。

### 7.5 会话与消息（Phase 2，需后端接口）

- 依赖：`GET /accounts/{id}/chats`、`GET /accounts/{id}/chats/{chat_id}/messages`（均未实现）。
- 布局：桌面双栏（会话 20rem + 消息），窄屏两个路由。
- 账号切换：读 `current_account_id`；切换时调用 select 接口并跳回列表。
- 会话列表：搜索（先客户端过滤）、类型筛选（全部/频道/群/私聊）、`has_media` 标记；
  行显示标题、`@username`、类型。
- 消息列表：时间分组、文本/说明、媒体卡片（类型图标、文件名、大小、上限提示）；
  `downloadable:false` 置灰并说明原因；分页 `offset_id` + 「加载更早」；
  多选 + 「下载选中」入队（依赖 Phase 3 的下单接口）。
- 没有缩略图接口：媒体卡片只做元数据，不做图片网格；后续有 thumb 接口再升级。

### 7.6 下载任务（Phase 3，需后端接口）

- 依赖：`GET/POST /downloads`、pause/resume/retry/delete、`/events`。
- 顶部状态页签（全部/进行中/等待/已暂停/已完成/失败）+ 搜索。
- 列表列：文件（名称 + 会话）、大小、进度（offset/size + 进度条）、速度、剩余时间、
  状态、操作（暂停/继续/重试/删除）。
- 删除：确认弹窗，可选「同时删除已下载文件」；运行中任务先取消。
- SSE：行级更新，不整表重渲染；断线顶部横幅「实时更新已断开，正在重连」；
  重连后全量对齐。
- 空状态区分「还没有任务」与「筛选无结果」。
- 「打开所在目录」需要后端接口，暂不提供（或仅复制路径）。

## 8. 视觉与交互规范

### 8.1 尺寸与排版

| 项 | 规范 |
|---|---|
| 侧栏 | 15rem，`border-r`，`bg-sidebar` |
| 内容 | 表格页 `px-6 py-6`（窄屏 `px-4`）；设置页 `max-w-3xl` |
| 圆角 | 沿用主题 `--radius`（0.625rem） |
| 字号 | 标题 `text-2xl font-semibold`；页说明 `text-sm text-muted-foreground` |
| 表格 | 行高 56px；表头 `text-xs text-muted-foreground` |
| 弹窗 | 详情 520px、probe 640px；内容超高时内部滚动 |

### 8.2 状态语义

| 状态 | 文案 | 样式 |
|---|---|---|
| `authed` | 已登录 | 绿色圆点 + `text-emerald-600`（暗色 `emerald-400`） |
| `unauthed` | 未登录 | 灰色圆点 + muted |
| `error` | 异常 | 红色圆点 + `text-destructive`，tooltip 显示原因 |
| 当前账号 | 当前 | `Badge`（secondary） |
| `session_present:false` | 需要重新登录 | 琥珀色提示条 |
| 下载 `pending/running/paused/done/failed` | 等待/下载中/已暂停/已完成/失败 | 各自徽章，Phase 3 定稿 |

### 8.3 格式化函数（`lib/format.ts` / `lib/mask.ts`）

| 函数 | 行为与示例 |
|---|---|
| `formatBytes(n)` | 1024 进制；`0 B`、`512 B`、`1.5 KB`、`734 MB`、`1.2 GB` |
| `formatSpeed(n)` | `formatBytes(n) + '/s'` |
| `formatEta(s)` | `mm:ss` 或 `h:mm:ss`；未知显示 `--` |
| `formatDateTime(sec)` | 本地时区 `YYYY-MM-DD HH:mm` |
| `formatRelative(sec)` | `刚刚` / `N 分钟前` / `N 小时前` / 超过 24h 用日期 |
| `formatUptime(sec)` | `3 小时 12 分` / `1 天 2 小时` / `5 分 30 秒` |
| `maskPhone(raw)` | 去非数字；`8613754320364` → `+86 137****0364`；无法识别时原样返回 |
| `maskProxyUrl(raw)` | 解析 URL，密码替换为 `***`；非法 URL 原样返回 |

手机号规则与 CLI 的展示保持一致（国家码 + 前 3 + 后 4），避免两处看起来不一样。

### 8.4 加载 / 空 / 错误

- 首屏鉴权检查：整页轻量骨架（logo + 文案），不闪登录页。
- 列表加载：3–5 行骨架，宽度贴近真实内容，不用整页 spinner。
- 空状态：图标 + 一句解释 + 主操作（导入 / 去设置 / 去账号页）。
- 错误：页面级错误用 `ErrorState`（重试按钮）；操作失败用 toast；
  表单校验用字段内联错误。规则：**用户能改的放内联，系统级的放 toast/页面**。
- 破坏性操作（清除配置、后续删除任务）统一 `AlertDialog` 二次确认。
- 可访问性：弹窗有标题与描述；图标按钮带 `aria-label`；焦点环可见；
  状态不只靠颜色（都有文字）；`prefers-reduced-motion` 由动画库处理。

### 8.5 文案

- 全中文，动词开头，避免「操作成功」这类空话：
  「已切换当前账号」「已保存 http_proxy」「探测超时，请检查代理或调大超时」。
- 服务端返回的中文错误直接展示，前端不二次包装成「请求失败」。
- 技术名词保留原文：MTProto、Bot API、session、tdata、token。

## 9. 工程规范与质量

### 9.1 立即修掉的基线问题

- `eslint.config.js` 增加 override：对 `src/components/ui/**` 关闭
  `react-refresh/only-export-components`（shadcn 组件同时导出 variants 是既定写法），
  其余目录保持开启。
- 若 `dist/` 残留模板资源，`pnpm build` 后确认清理；`dist` 已被 gitignore。

### 9.2 脚本与检查

| 命令 | 用途 |
|---|---|
| `pnpm dev` | 开发服务器（5173，`/api` 代理到 22429） |
| `pnpm typecheck` | 类型检查 |
| `pnpm lint` | ESLint |
| `pnpm build` | 类型检查 + 生产构建 |
| `pnpm test` | Vitest（W1 之后添加） |
| `pnpm preview` | 预览产物（在 `vite.config.ts` 给 preview 也配 `/api` 代理，便于无后端托管时自测） |

### 9.3 测试范围（从少到多）

1. `format.ts` / `mask.ts` 的边界用例（0、负数、未知、非法 URL）。
2. `client.ts`：错误体解析、401 广播、超时/取消不误判为网络错误（`fetch` mock）。
3. `AuthGate` 的四个分支（checking/login/offline/ready），用 Testing Library + MSW 可选。
4. 不做快照测试；不为 shadcn 组件写测试。

### 9.4 代码约定

- 组件 PascalCase，hook `useXxx`，文件与主导出同名。
- 类型导入用 `import type`（`verbatimModuleSyntax` 已开）。
- 禁止 `any`；服务端返回的联合字符串用字面量联合类型。
- 不直接写 `localStorage`（统一走 `client.ts` 的 token 读写）。
- 组件不吞错误：要么交给 Query 的 `error`，要么 `toast.error`。
- 提交信息：`feat(web): ...` / `fix(web): ...` / `docs(web): ...`，每个里程碑一个提交，
  提交前跑 `typecheck + lint + build`。

### 9.5 验收方式

每个里程碑结束：

1. `pnpm dev` + 已运行的后端（22429）。
2. 用浏览器实际走主路径（登录、导入、切换、改配置），看 console 无报错、network 无 4xx 误报。
3. 截图留档；`pnpm build` 通过。
4. 更新本文的「进度」标记（或另建 `CHANGELOG`，保持轻量）。

## 10. 里程碑

> 单人、对代码逐步熟悉的速度估算；Phase 1 是当前可交付范围。

| 阶段 | 内容 | 预估 | 验收标准 | 依赖 |
|---|---|---|---|---|
| **W0 基座清理** | 删模板、路由、AppShell、主题、QueryClient、Toaster、404、ErrorBoundary、lint 修复、index.html 元信息 | 0.5 天 | 5173 打开是带侧栏的空壳；导航可切换占位页；暗色正常；typecheck/lint/build 全绿 | 无 |
| **W1 API + 鉴权门** | `client/types/endpoints/query-keys`、`AuthProvider`、`AuthGate`、登录页、离线页、401 处理、错误映射 | 1 天 | 免鉴权后端直接进；`--auth-token` 启动时出登录页；错 token 有明确错误；后端停掉显示离线页并可重试；刷新免登录 | 后端已具备 |
| **W2 账号页** | 列表（表格/卡片）、当前切换、详情弹窗、probe 弹窗与结果展示、空/错/加载态、脱敏 | 1.5 天 | 真实账号显示正确；probe 用本机 tdata 成功导入并刷新；切换后刷新仍生效；409/504 有可读提示；无死按钮 | W1 |
| **W3 设置页** | 服务信息、配置表、编辑/清除、只读/未知键、代理脱敏、PUT 回填 | 1 天 | 修改 `http_proxy` 经 API 确认已落库；清除生效；非法代理显示服务端 400 文案；`current_account_id` 只读 | W1 |
| **W4 打磨** | 响应式、可访问性、骨架/空态、文案、移动端导航、README/文档更新 | 0.5 天 | 窄屏无横向溢出；键盘可操作；主路径无 console 错误；文档与实现一致 | W2/W3 |
| **W5 会话/消息** | 会话列表、消息分页、媒体卡片、筛选、多选入队 | 2 天 | 后端接口就绪后：100 条会话可筛；消息「加载更早」正确；多选下单成功 | 后端 chats/messages |
| **W6 下载 + SSE** | 任务页、控制操作、SSE 合并、重连、断线横幅 | 3 天 | 进度实时更新且不整表闪烁；暂停/继续/重试/删除可用；断网重连后状态一致 | 后端 downloads/events |
| **W7 打包联调** | 后端 `--web-mode/--web-dir`、SPA fallback、`go:embed`、深链刷新 | 0.5–1 天 | 后端直接托管 `dist/`；深链刷新 200；带 hash 资源长缓存 | 后端 web 挂载 |

Phase 1（W0–W4）约 **4–4.5 天**；W5–W7 是后续约 **5.5–6 天**，由后端进度决定。

## 11. 后端契约需求（前端视角，按优先级）

| 优先级 | 需求 | 用途 | 备注 |
|---|---|---|---|
| P0（已修复） | `GET /api/v1/settings` 对 `http_proxy` 的密码脱敏 | 避免凭据回传浏览器 | 后端 `d7d2747` 已返回 `***`；PUT 回 `***` 时沿用旧密码 |
| P0（已修复） | 数据库迁移并发安全：并发首个请求会因 `CREATE INDEX ... already exists` 返回 500 | 新建库首次打开时稳定 | 后端 `d7d2747`：启动前迁移 + 进程内互斥 + 重试 + busy_timeout/WAL |
| P1 | `GET /api/v1/settings` 返回已知但未配置的键（或提供 known keys 元数据） | 前端不必维护 registry 占位行 | 当前用 [src/lib/settings.ts](../src/lib/settings.ts) 镜像 |
| P0 | `DELETE /api/v1/accounts/{id}` | 账号页退出登录 | 前端暂不渲染删除入口 |
| P0 | `POST /api/v1/accounts/bot`、`POST /api/v1/accounts/mtproto/{send-code,sign-in,password}` | 无 Telegram Desktop 时新增账号 | 否则账号页只有 probe 一条路 |
| P0 | 同步 `doc/api.md` 与实际实现 | 防止按草案写错 | 含 health 路径、settings 形状、已实现标记 |
| P1 | `GET /api/v1/accounts/{id}/chats`、`.../messages` | 会话/消息页 | 字段按 api.md，`downloadable` 必须给 |
| P1 | 消息缩略图接口（可选） | 媒体卡片升级 | 没有就先不做图片 |
| P2 | `downloads` CRUD + pause/resume/retry/delete | 下载页 | 含 `skipped` 语义 |
| P2 | `GET /api/v1/events`（SSE） | 实时进度 | 前端用 fetch 流，不需要为鉴权改协议 |
| P2 | 打开下载目录 / 复制路径接口（可选） | 任务操作 | 浏览器不能直接打开本地目录 |
| P2 | `download_dir` / `max_concurrency` 登记为可写配置 | 设置页 | 若继续只走命令行，则设置页不展示 |

说明：SSE 用 fetch 流可以正常带 `Authorization`，所以**不需要**给 `/events` 加
`?token=` 这类降级方案；但若后端坚持用 `EventSource` 兼容模式，再另议。

## 12. 风险与对策

| 风险 | 影响 | 对策 |
|---|---|---|
| 文档与实现漂移 | 按草案写出不存在的调用 | 以代码为准；W1 修 api.md；契约表（§5/§11）集中维护 |
| 鉴权探测误判 | 把「后端未启动」显示成「token 错误」 | 严格区分 401 与网络错误；离线页单独设计 |
| probe 是长请求 | 网关/浏览器超时、用户以为卡死 | 客户端 310s 超时 + 计时 + 可取消；服务端上限 300s |
| SSE 带 token | `EventSource` 不可用 | 自写 fetch 流；统一重连与清理 |
| 401 循环 | 登录页反复请求 health | 登录页不自动重试；health 401 只置状态不重定向 |
| React 19 StrictMode 双执行 | SSE 建两次、probe 重复提交 | 副作用清理；提交按钮 pending 禁用；Query 本身去重 |
| 无缩略图接口 | 消息页视觉单薄 | 媒体卡片做元数据 + 类型图标，等接口再升级 |
| 表格数据量大 | 渲染卡顿 | 先分页；超过 200 行再评估虚拟滚动 |
| shadcn/Base UI 版本差异 | 新组件 API 与预期不同 | 只用 `shadcn add` 生成，不手改 ui 目录；新增组件先看现有写法 |
| Windows 路径输入 | 反斜杠被误解析 | 输入框只做 trim，不做路径拼接；给示例路径 |
| 代理密码回传 | 凭据泄露 | 前端脱敏 + P0 后端修复 |
| 无 remote / 无 CI | 没有自动回归 | 提交前本地三件套；后续可选 GitHub Actions |

## 13. 待确认（开工前拍板）

1. **数据层**：是否接受引入 `@tanstack/react-query`？
   推荐接受；否则改用自写 `useRequest`，代码量增加但依赖更少。
2. **聊天/下载页**：等后端接口（推荐）还是先用 MSW/mock 并行做 UI？
   并行需要维护 mock 与真实契约两份，漂移风险高；当前后端只差这两块接口，
   建议先用真实接口把 Phase 1 做扎实。
3. **文档同步**：是否允许在 W1/W4 顺手修改 `tg_down_server/doc/api.md` 与两个 README
   的状态描述？推荐允许，否则文档会继续误导后续开发。
4. **首页**：Phase 1 是否接受 `/` → `/accounts`？
   推荐接受；聊天页上线后再评估是否改成 `/chats`。

## 14. W0 具体清单（确认后立即执行）

1. 删除 `src/App.tsx`、`src/App.css`、`src/assets/{hero.png,react.svg,vite.svg}`、
   `public/icons.svg`；`index.html` 改 `lang="zh-CN"`、标题、描述、主题色。
2. 新增 `src/lib/query-client.ts`、`src/lib/theme.tsx`；
   `main.tsx` 挂 `QueryClientProvider`、`ThemeProvider`、`Toaster`、`RouterProvider`。
3. 新增 `src/router.tsx`（`/`、`/accounts`、`/settings`、`/login`、`*`）、
   `components/layout/{AppShell,Sidebar,Topbar,PageHeader}.tsx`、
   `pages/{accounts,settings,login,not-found}` 占位。
4. 新增 `components/auth/AuthGate.tsx` 骨架与 `hooks/use-auth.tsx` 骨架（W1 接真实逻辑）。
5. 补 `components/ui` 需要的 `label`、`switch`、`separator`、`sheet`（按实际用到再加）。
6. `eslint.config.js` 加 ui 目录 override；跑 `typecheck`、`lint`、`build` 全绿。
7. 浏览器验收：`pnpm dev`，确认壳、导航、主题、404、移动端菜单可用，console 干净。

---

**进度记录**（实施时勾选）：

- [x] W0 基座清理（2026-11-19）
- [x] W1 API + 鉴权门（2026-11-19）
- [x] W2 账号页（2026-11-19）
- [x] W3 设置页（2026-11-19）
- [x] W4 打磨（2026-11-19）
- [ ] W5 会话/消息
- [ ] W6 下载 + SSE
- [ ] W7 打包联调

## 15. W0 实施记录

已完成：

- 删除 Vite 模板页与资源（`App.tsx`、`App.css`、`assets/*`、`public/icons.svg`），
  `index.html` 改为中文标题、描述、主题色，并加入首帧主题脚本。
- 接入 `createBrowserRouter`、`AuthGate`、`AppShell`（桌面侧栏 + 窄屏 Sheet）、
  `PageHeader`、`EmptyState`、`Brand`、`ThemeToggle`、404 与路由错误页。
- 接入 TanStack Query 5（`@tanstack/react-query@5.108.0`），`QueryClient` 默认
  `staleTime 15s / retry 1 / refetchOnWindowFocus`。
- 补 shadcn 组件：`sheet`、`label`、`separator`、`switch`；`eslint.config.js` 对
  `src/components/ui/**` 关闭 `react-refresh/only-export-components`。
- `vite.config.ts` 增加 `preview` 的 `/api` 代理；`index.css` 给 `#root` 最小高度。

与规划不同的两处（均已落地）：

1. **主题不用 next-themes 的 Provider**：它会在 React 树里固定渲染一个 `<script>`，
   React 19 在 console 报 “Encountered a script tag while rendering React component”。
   改为自研 `ThemeProvider`（`src/lib/theme.tsx` + `src/hooks/use-theme.ts`），
   保留 `light / dark / system`、多标签页同步与 `localStorage.theme`；
   shadcn 的 `Toaster` 仍用 next-themes 的 hook，但由 `AppToaster` 显式传入 `resolvedTheme`。
2. **登录页暂为说明页**：W0 还没有鉴权探测，`/login` 只说明本地免鉴权模式；
   W1 会换成真正的 token 表单与 401 处理（已完成，见 §16）。

验证（2026-11-19）：

| 项 | 结果 |
|---|---|
| `pnpm typecheck` | 通过 |
| `pnpm lint` | 通过（ui 目录 override 生效） |
| `pnpm build` | 通过；`index-*.js` 约 563 KB（gzip 181 KB），暂未拆包 |
| 桌面浏览器 | 侧栏、导航、标题、404、路由错误页正常；console 只有 Vite/React 开发提示 |
| 主题 | 亮/暗切换即时生效，刷新后保持（localStorage） |
| 窄屏（iframe 390×780） | 顶栏 + 抽屉导航正常，点击导航项后关闭抽屉并跳转 |
| 错误边界 | 已实测：Base UI 菜单用法错误时正确落到「页面出错了」，修复后恢复 |

遗留（按计划交给后续阶段）：

- 首包 563 KB，等 W5/W6 增加页面后做路由级 `import()` 拆包（或把 Base UI 重组件按需加载）。
- W0 未加测试；`vitest` 在 W1/W2 随 `format`、`mask`、`ApiError` 解析一起补。
- 5173 被既有 dev server 占用，本次验证走 5174；两者服务同一目录，5173 也能正常 HMR。

## 16. W1 实施记录

已完成：

- **API 层**（`src/api/`）
  - `client.ts`：`/api/v1` 前缀、`Authorization: Bearer`、localStorage token 读写、
    默认 20s / health 5s / probe 310s 超时、`AbortSignal` 合并、
    `ApiError { status, code, message }`、非 JSON 响应兜底、`describeError()`。
  - 401 处理：清 token、广播 `tg_down:unauthorized`；登录校验用
    `handleUnauthorized:false`，避免「候选 token 错」被当成全局登出。
  - `types.ts`：health / accounts / probe / settings 全部 DTO，与 Go 结构体对齐。
  - `endpoints.ts`：已覆盖 health、accounts.list/get/select/probe、settings.get/update，
    W2/W3 可直接用；`query-keys.ts` 提供 key 工厂。
- **鉴权门**
  - `AuthProvider` 启动请求 health：200 → ready；401 → 清失效 token、login；
    网络/超时/5xx → offline 并记录可展示原因。
  - `login()` 先验证再落盘；`logout()` 清 token 与 Query 缓存；`retry()` 供离线页重试。
  - 监听 401 广播：清 token、清缓存、回登录页并提示。
  - `AuthGate`：checking → BootSplash；login → `/login`（带 `from`）；offline → OfflineScreen；
    ready → 应用。
- **页面**
  - 登录页：密码输入 + 显示切换、pending、内联错误、安全回跳、失效 token 提示条。
  - 离线页：启动命令提示、错误原因、重试按钮。
  - 侧栏底部：连接状态（`本地免鉴权` / `token 鉴权`）、token 模式下「退出登录」。
  - Toast 改到右下角，避免遮挡页面标题。
- **开发支持**：Vite proxy 目标可用 `TG_DOWN_API_URL` 覆盖，
  便于另起 `22430` 带 token 的后端做联调；README 已写入命令。

实现说明：

- `react-hooks/set-state-in-effect` 对「effect 里调用异步 probe」报了误判：
  所有 setState 都在 `await` 之后执行，不存在同步级联渲染。已在该行加注释并定点豁免，
  没有全局关闭规则。
- StrictMode 下首个 health 请求会被 cleanup abort（network 里可见 `ERR_ABORTED`），
  第二个请求正常完成；这是预期的开发期双执行，不是错误。

验证（2026-11-19，浏览器实测）：

| 场景 | 结果 |
|---|---|
| 无 token 后端（22429 / 5173） | 直接进入，侧栏「本地免鉴权」，console 干净 |
| token 后端（22430 / 5175） | health 401 → 自动跳 `/login` |
| 错误 token | 内联提示「token 无效或已过期」，不写入存储 |
| 正确 token | 进入账号页，侧栏「token 鉴权」，右下角 toast「已连接 tg_down」 |
| 刷新页面 | 保持登录（health 带 token 返回 200） |
| 退出登录 | 清 token 回登录页，刷新仍是登录页 |
| 后端更换 token 后刷新 | 旧 token 401 → 登录页 + 「保存的 token 已失效，请重新输入」 |
| 停掉后端后刷新 | 离线页，显示 HTTP 502 与「重试连接」 |
| 后端恢复后点重试 | 重新探测成功（无 token 时转登录页），不再卡在离线页 |
| 已就绪时访问 `/login` | 自动跳回 `/accounts` |
| 质量门 | `typecheck` / `lint` / `build` 全绿；首包 576 KB（gzip 186 KB） |

遗留：

- **运行时 401 广播**已在 W2 用真实 token 后端验证（账号列表刷新 → 401 → 清 token → 登录页）；
  `client.test.ts` 也单独覆盖了清 token 与事件广播。
- 浏览器 console 会对 401/502 打印 `Failed to load resource`，这是网络层日志，
  不是应用异常；应用自身没有 console error。
- W2 已接入 `vitest`（`format` / `mask` / `client`），见 §17。
- 首包增至 576 KB（gzip 186 KB），拆包仍按计划留到 W5/W6。

## 17. W2 实施记录

已完成：

- **账号列表**（`src/pages/accounts/`）
  - 顶部概览：账号总数 / 已登录 / 当前账号。
  - 桌面表格 + 窄屏卡片，列：状态、账号（名称 + `@username`）、类型、脱敏手机号、
    当前标记、操作（详情 / 设为当前）。
  - 状态徽章：已登录（绿）、未登录（灰）、异常（红，hover 显示 `last_error`）。
  - 加载骨架、页面级错误（可重试）、空状态（引导 tdata 导入）。
  - 刷新按钮；切换中按钮禁用并显示 spinner。
- **账号详情**
  - 弹窗展示 ID、类型、用户名、手机号、状态、session 是否存在、当前标记、
    创建/更新时间与 `last_error`。
  - session 缺失时醒目提示；非当前且可用的账号可「设为当前」。
- **tdata 导入**
  - 表单：tdata 路径（留空自动查找）、本地密码、超时 5–300s、是否写入数据库。
  - 提交后计时 + 可取消；关闭弹窗会 abort 并重置表单。
  - 结果：tdata 路径、导入/跳过数量、单账号错误、已登录设备列表（当前设备高亮）。
  - 错误（路径不存在、探测超时、取消）在表单内展示，输入保留。
- **数据**
  - `useAccounts` / `useAccountDetail` / `useSelectAccount` / `useProbeAccounts`；
    切换与导入成功后失效整个 `accounts` key 前缀（列表 + 详情）。
  - `src/lib/format.ts`（`formatDateTime`）、`mask.ts`（`maskPhone`，含国际号码）、
    `account.ts`（类型/状态文案）。
  - `ErrorState` 通用组件。
- **测试**
  - 新增 Vitest 5 + `pnpm test`；15 个用例：`client.test.ts`（8）、
    `mask.test.ts`（5）、`format.test.ts`（2）。
  - 覆盖：错误体解析、401 清 token/广播、候选 token 不广播、Bearer 头、
    网络错误、超时、非 JSON 5xx、脱敏与时间格式化。
  - 配置 `pool: "threads"`：本机受限环境不允许 fork 子进程（`spawn EPERM`），
    worker_threads 可正常运行。

验证（2026-11-19，浏览器实测）：

| 场景 | 结果 |
|---|---|
| 真实账号列表（22429 / 5173） | 1 个 MTProto 账号，手机号显示 `+86 137****0364`，当前标记正确 |
| 详情弹窗 | 类型/用户名/session/时间/当前状态均正确；单一当前账号不显示切换按钮 |
| 非法 tdata 路径 | 服务端 400 文案原样展示，表单保留，可修改重试 |
| 真实 tdata 探测（import=true） | 导入 0、跳过 1（session 已存在），返回 2 台已登录设备 |
| 探测中取消 | 显示「已取消探测」，表单恢复可用 |
| 窄屏（iframe 390×780） | 概览卡纵向排列、账号卡片与操作按钮正常，无横向溢出 |
| 运行时 401（token 后端换 token 后刷新列表） | 清 token + 清缓存 → 登录页 + 「登录状态已失效，请重新输入 token」 |
| 质量门 | `typecheck` / `lint` / `test`（15 passed）/ `build` 全绿；首包 614 KB（gzip 196 KB） |

遗留：

- 本机只有 1 个账号，非当前账号的「设为当前」按钮未在浏览器里实际点击；
  接口与失效逻辑已就位，等第二个账号（或后续 Bot/手机号登录接口）再验证。
- 空状态未在真实空库上验证；组件与分支已实现。
- probe 的错误文案里路径是 Go `%q` 转义后的双反斜杠，属服务端输出；
  如需更好看可让后端改用普通引号。
- 首包 614 KB（gzip 196 KB），拆包仍留到 W5/W6。

## 18. W3 实施记录

已完成：

- **服务信息**（`ServiceInfoCard`）
  - health 的版本、运行时长（`formatUptime`）、鉴权模式、接口前缀；
  - 状态徽章（运行正常/不可用）、加载骨架、失败原因与重试。
- **配置项列表**（`SettingsList`）
  - 展示服务端返回的全部配置项：键、描述、值、`只读` / `未识别` 徽章；
  - `http_proxy` 的密码经 `maskProxyUrl` 脱敏展示；
  - `current_account_id` 只读，提供「去账号页」；
  - 已知可写键可编辑/清除；未识别键只展示。
- **首次设置 / 编辑 / 清除**
  - 服务端只返回已写入的键，`http_proxy` 未配置时列表补一条
    「未配置（直连）」占位行，可直接「设置」；
  - 编辑弹窗：前端校验 URL 协议/主机（与服务端 `ValidateProxy` 一致），
    失败内联提示；保存后 PUT，服务端返回全量配置直接回填 Query 缓存；
  - 清除弹窗二次确认，PUT `{"http_proxy": null}`，成功后占位行恢复。
- **工具与测试**
  - `src/lib/settings.ts`：known 配置注册表、代理校验、`buildSettingRows`；
  - `maskProxyUrl`、`formatUptime`；
  - 新增 10 个用例（mask 3、format 2、settings 5），总计 25 个。

验证（2026-11-19，浏览器实测）：

| 场景 | 结果 |
|---|---|
| 真实后端（22429 / 5173） | 服务信息 `dev / 1 小时 4 分 / 本地免鉴权`；2 项配置，`current_account_id` 只读，`http_proxy` 显示 `http://127.0.0.1:7897` |
| 编辑弹窗（真实后端） | 原始代理回填；追加非法字符后保存 → 「请输入合法 URL…」，未发出 PUT，配置未被修改 |
| 临时空库（22430 / 5175） | 配置区只有 `http_proxy` 占位行「未配置（直连）」与「设置」按钮 |
| 首次设置 | 输入 `socks5://127.0.0.1:1080` → toast「已保存 http_proxy」；`GET /settings` 确认已落库 |
| 清除 | 二次确认 → toast「已清除 http_proxy」；行恢复未配置，`GET /settings` 返回 `[]` |
| 窄屏（iframe 390×780） | 服务信息两列、配置行纵向堆叠、按钮不溢出 |
| 质量门 | `typecheck` / `lint` / `test`（25 passed）/ `build` 全绿；首包 624 KB（gzip 198 KB） |

实施中发现：

- **后端迁移并发问题**：临时空库首次并发请求时，服务端在
  `CREATE INDEX idx_accounts_created_at` 上返回 500（`already exists`）。
  前端 TanStack Query 的 `retry: 1` 自动重试后成功，页面无感。
  **已由后端 `d7d2747` 修复**：监听前完成迁移、AutoMigrate 进程内串行化 +
  重试、SQLite `busy_timeout`/WAL；双进程同时打开空库的验证已通过。
- **代理密码回传**：W3 时服务端 `GET /settings` 仍返回明文，只能靠前端展示层脱敏。
  **已由后端 `d7d2747` 修复**：接口返回 `***`，PUT 回 `***` 时服务端沿用旧密码；
  前端现有展示与编辑逻辑兼容。
- 服务端配置接口只返回已写入的键，未提供 known keys 元数据；
  前端用 `knownSettings` 注册表补占位行，后端补元数据后可移除镜像（P1 仍未做）。
- 后端 `344d875` 为 settings 增加了 `type` 字段（`string` / `integer` / `boolean`）；
  前端 `Setting` 类型已同步，UI 暂未使用该字段（W4 可据此驱动输入控件）。
- 后续新增 `http_proxy_enabled`（布尔，默认 true）：设置页增加 Switch；
  关闭后保留 `http_proxy` 但直连，清除恢复默认启用。
- 默认值已收敛到后端 `config.Item.Default`，并通过 settings API 暴露 `default`；
  前端 `KnownSetting.defaultValue` 与 `SettingRow.defaultValue` 用于未配置占位行，
  两边数值需保持一致（后端补 known keys 元数据后可去掉前端镜像）。
- 后端服务启动时若 `settings` 表为空，会写入 `http_proxy_enabled=true`（非空默认值）；
  空默认值（如 `http_proxy`）不落库，前端未配置占位行仍会显示。

遗留：

- 未识别键（`known:false`）只在单测里覆盖了 `buildSettingRows`，浏览器里没有造
  未知键数据；组件对未知键只展示，逻辑简单。
- 服务端 400 校验错误路径未在浏览器触发（前端规则与服务端一致，先被前端拦下）；
  编辑器仍会把服务端错误原文展示，后续可用非法但前端放行的值验证。
- health 的运行时长只在进入页面/手动刷新时更新，不做实时轮询。
- 现有 22429 进程仍是修复前的二进制；重启后代理脱敏与迁移修复才生效，
  W3 的脱敏验证走的是临时新后端。
- 首包 624 KB（gzip 198 KB），拆包仍留到 W5/W6。

## 19. W4 实施记录

已完成：

- **键盘与读屏**
  - `AppShell` 增加「跳到主要内容」skip link，指向 `<main id="main-content" tabIndex={-1}>`；
  - 路由切换后聚焦 `main`（`preventScroll`），首次加载不抢焦点，保留 skip link 作为第一个 Tab 停靠点；
  - `PageHeader` / 登录 / 离线 / BootSplash / 路由错误页统一用 `useDocumentTitle` 写 `document.title`；
  - 账号骨架、设置骨架、详情骨架增加 `role="status"` / `aria-busy` 与 sr-only 文案；
  - 账号表格增加 `aria-label="账号列表"`，头像改为装饰性 `aria-hidden`；
  - 登录、probe 提交按钮增加 `aria-busy`；probe 进行中提示改为 `role="status"`；
  - ErrorState 使用 `role="alert"`；品牌图标 aria-hidden，移动顶栏/侧栏品牌可返回账号页。
- **响应式**
  - 设置页内容限制在 `max-w-3xl`，与规划中的阅读宽度一致；
  - 移动 Sheet 恢复关闭按钮（原先手动隐藏），打开后可点 X 关闭；
  - 账号详情、probe、设置编辑、清除四个对话框加
    `max-h-[calc(100svh-2rem)] overflow-y-auto`，避免矮屏溢出；
  - 390px 下账号页卡片、设置页服务信息两列/配置行纵向堆叠均无横向滚动。
- **文档**
  - README 状态更新到 W4，补充可访问性约定、测试范围；
  - 本记录补验收结果与遗留。

验证（2026-11-19，5173 + 22429）：

| 场景 | 结果 |
|---|---|
| 桌面 1280 账号页 | 摘要卡、表格、行内操作正常；`document.title = 账号 · tg_down` |
| 桌面 1280 设置页 | 内容居中 768px；3 项配置；`document.title = 设置 · tg_down` |
| 390px 账号页 | 顶栏菜单可用；摘要卡与账号卡纵向堆叠，无横向溢出 |
| 390px 设置页 | 服务信息两列、配置项纵向堆叠，操作按钮在行下方，无横向溢出 |
| 移动侧栏 | 打开后关闭按钮可见且可点；导航项点击后关闭 Sheet |
| 键盘 | 首次 Tab 显示「跳到主要内容」浮层；按钮/链接均有可见焦点 |
| Console | 账号页/设置页无 error/warn，仅有 Vite 连接与 React DevTools 提示 |
| 质量门 | `typecheck` / `lint` / `test`（27 passed）/ `build` 全绿；首包 627 KB（gzip 199 KB） |

遗留：

- 390px 下只验证了首屏与侧栏，详情/probe/设置编辑等长弹窗只做了 CSS
  最大高度约束，未逐一打开截图；后续可补自动化视口测试。
- 首包 627 KB（gzip 199 KB），路由拆包仍留到 W5/W6。
- `useDocumentTitle` 依赖 `PageHeader`；新增页面若不用 `PageHeader`，需自行调用。
- 当前工作区改动尚未提交（按约定不执行 git 操作）。
