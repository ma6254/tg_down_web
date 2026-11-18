# tg_down_web

Telegram 下载工具的前端：React + TypeScript + Vite + Tailwind CSS，UI 基于 shadcn（Base UI primitives）。

开发时独立跑 Vite，通过 `/api` 代理访问 Go 后端；发布时 `pnpm build` 产出 `dist/`，由后端 `go:embed` 打进单文件二进制。

> **状态：脚手架阶段（M0）**。UI 基座（Tailwind 4 + shadcn）已就绪，但 `src/App.tsx` 仍是 Vite 模板页，尚未开始写业务页面。规划见 [规划文档](../tg_down_server/doc/plan.md)。

## 技术栈

| 项 | 版本 / 说明 |
|---|---|
| React | 19.3 |
| TypeScript | 6.0（单 `tsconfig.json`，`paths` 别名，无 `baseUrl`） |
| 构建 | Vite 8，`@vitejs/plugin-react` |
| 样式 | Tailwind CSS 4（`@tailwindcss/vite`，**无 `tailwind.config.js`**） |
| 组件 | shadcn 4.23，`base-nova` 风格 + Base UI（`@base-ui/react`），图标用 lucide-react |
| 路由 | react-router-dom 7（尚未接入） |

## 目录结构

```
src/
  api/            # 后端请求封装、SSE 订阅（规划）
  components/     # 业务组件（规划）
  components/ui/  # shadcn 生成的基础组件，勿手改
  lib/            # utils（cn）、主题等
  pages/          # Login / Accounts / Chats / Downloads / Settings（规划）
  hooks/          # useSse、useTasks（规划）
  index.css       # Tailwind 入口 + shadcn 主题变量
  App.tsx         # 当前仍是模板页
vite.config.ts    # @ 别名、/api 代理、dev 端口
components.json   # shadcn 配置（style/baseColor/CSS 变量）
```

## 开发

```bash
pnpm install
pnpm dev            # http://127.0.0.1:5173
```

后端未启动时，`/api/*` 会返回 `502`，属正常现象。

| 项 | 地址 |
|---|---|
| 前端 dev server | `http://127.0.0.1:5173` |
| Go 后端（代理目标） | `http://127.0.0.1:22429` |

端口是刻意固定并避让过的：8080 被本机其他服务占用。

## 构建与检查

```bash
pnpm build          # tsc --noEmit && vite build → dist/
pnpm typecheck      # 只做类型检查
pnpm lint           # eslint
pnpm preview        # 本地预览构建产物
```

生产环境不需要独立部署前端：`dist/` 会被后端构建脚本打包进 `go:embed`。

## 约定

- **路径别名**：`@/*` → `./src/*`，由 [tsconfig.json](./tsconfig.json) 与 [vite.config.ts](./vite.config.ts) 共同保证。
- **加 shadcn 组件**：`pnpm dlx shadcn@latest add <name>`，生成到 `src/components/ui/`；直接手写请用 `cn()` 合并类名。
- **Tailwind 4 没有 config 文件**：主题色、圆角、字体都在 [src/index.css](./src/index.css) 的 `:root` / `@theme inline` 里，改主题改这里。
- **不要手改 `components/ui/`**：后续用 `shadcn add` 覆盖更新。

## 待办

- 用 Tailwind + shadcn 重写 `App.tsx`，删除 `App.css` 与模板图片资源。
- 接入 `react-router` 与 `Layout`，落地五个占位页。
- 实现 `api` 封装（token header、错误归一）与 SSE 进度订阅。

## 相关文档

- [整体规划](../tg_down_server/doc/plan.md)
- [API 草案](../tg_down_server/doc/api.md)
- [参考实现分析](../tg_down_server/doc/reference.md)
