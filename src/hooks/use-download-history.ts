import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/api/endpoints"
import { queryKeys } from "@/api/query-keys"
import type { DownloadHistoryInput } from "@/api/types"

/** 最近 20 条历史输入；面板打开时读缓存，记录/删除后失效重取。 */
export function useDownloadHistory() {
  return useQuery({
    queryKey: queryKeys.downloadHistory,
    queryFn: ({ signal }) => api.downloads.history(20, signal),
  })
}

/** 单条历史详情（展开缓存条目时才请求）；id 为空时不发请求。 */
export function useDownloadHistoryDetail(id: number | null) {
  return useQuery({
    queryKey: queryKeys.downloadHistoryItem(id ?? 0),
    queryFn: ({ signal }) => api.downloads.historyDetail(id as number, signal),
    enabled: id !== null,
  })
}

/** 记录一次成功解析；失败静默，由调用方决定是否提示。 */
export function useRecordDownloadHistory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: DownloadHistoryInput) => api.downloads.recordHistory(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.downloadHistory })
    },
  })
}

/** 删除单条历史。 */
export function useDeleteDownloadHistory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.downloads.removeHistory(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.downloadHistory })
    },
  })
}

/** 清空全部历史。 */
export function useClearDownloadHistory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.downloads.clearHistory(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.downloadHistory })
    },
  })
}
