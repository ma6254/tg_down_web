import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// 开发时后端地址；设置 TG_DOWN_API_URL 可指向另一个实例（例如带 token 的测试端口）。
const apiTarget = process.env.TG_DOWN_API_URL || 'http://127.0.0.1:22429'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    // 固定端口：被占用时直接报错，避免静默换到 5174 后浏览器还开着旧实例。
    strictPort: true,
    // Windows 上编辑器/写文件工具常先写临时文件再改名（原子保存），
    // 原生 fs.watch 偶尔会漏掉这类事件，表现为「文件改了但页面不更新」。
    // 源码文件不多，轮询监听更稳，300ms 的性能开销可以接受。
    watch: {
      usePolling: process.platform === 'win32',
      interval: 300,
    },
    // 开发时把 /api 代理到 Go 后端，避免跨域；生产由 Go 同源托管。
    proxy: {
      '/api': apiTarget,
    },
  },
  // 预览构建产物时同样代理 /api，便于在后端未托管 dist 时自测。
  preview: {
    host: '127.0.0.1',
    port: 4173,
    proxy: {
      '/api': apiTarget,
    },
  },
})
