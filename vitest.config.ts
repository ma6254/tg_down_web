import { defineConfig } from "vitest/config"

// 单元测试只覆盖纯逻辑与 API 客户端，不需要 DOM 环境。
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // 本机沙箱不允许 fork 子进程，用 worker_threads 跑测试。
    pool: "threads",
  },
})
