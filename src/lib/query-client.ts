import { QueryClient } from "@tanstack/react-query"

/**
 * 创建 Query 客户端。
 *
 * 本地单用户应用，数据来自本机后端，默认值保持克制：
 * - staleTime 15s：同页多次挂载不重复请求，切换页面回来仍用缓存；
 * - retry 1：后端没启动时快速失败，由页面展示可操作的离线提示；
 * - refetchOnWindowFocus：切回窗口时对齐账号/配置的最新状态。
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 15_000,
        retry: 1,
        refetchOnWindowFocus: true,
      },
    },
  })
}

export const queryClient = createQueryClient()
