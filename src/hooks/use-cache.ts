import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { describeError } from "@/api/client"
import { api } from "@/api/endpoints"
import { queryKeys } from "@/api/query-keys"

/** 本地缓存规模；设置页打开时拉一次，清空后重新拉。 */
export function useCacheStats() {
  return useQuery({
    queryKey: queryKeys.cache,
    queryFn: ({ signal }) => api.cache.stats(signal),
    // 缓存规模变化不频繁，切回页面时不必每次都重新统计。
    staleTime: 30_000,
  })
}

/** 清空本地缓存；成功后刷新规模并提示删除了多少行。 */
export function useClearCache() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.cache.clear(),
    onSuccess: (removed) => {
      const total = removed.messages + removed.peers + removed.threads
      toast.success(
        total > 0 ? `已清空缓存（${total} 行）` : "缓存本来就是空的"
      )
      void queryClient.invalidateQueries({ queryKey: queryKeys.cache })
    },
    onError: (error) => toast.error(describeError(error)),
  })
}
