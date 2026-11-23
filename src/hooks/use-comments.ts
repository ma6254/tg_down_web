import { useInfiniteQuery } from "@tanstack/react-query"
import { api } from "@/api/endpoints"
import { queryKeys } from "@/api/query-keys"

/**
 * 读取帖子评论区；只在弹窗打开时启用，按 next_offset_id 分页。
 *
 * 评论区是点开才需要的内容，不跟着 preview 批量解析；staleTime 留 30s，
 * 避免反复开关弹窗时每次都联网。
 */
export function useComments(link: string | null, open: boolean) {
  return useInfiniteQuery({
    queryKey: queryKeys.comments(link ?? ""),
    queryFn: ({ pageParam, signal }) =>
      api.links.comments(
        {
          link: link ?? "",
          limit: 20,
          offset_id: pageParam,
        },
        signal
      ),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.next_offset_id || undefined,
    enabled: open && Boolean(link),
    staleTime: 30_000,
  })
}
