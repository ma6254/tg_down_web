import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

// 单元测试只覆盖纯逻辑、API 客户端与无 DOM 的组件渲染（renderToStaticMarkup）。
export default defineConfig({
  resolve: {
    // 与 tsconfig 的 paths 对齐，测试里才能用 @/ 导入源码。
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
    // 本机沙箱不允许 fork 子进程，用 worker_threads 跑测试。
    pool: "threads",
  },
})
