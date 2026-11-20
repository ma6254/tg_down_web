import { useMutation } from "@tanstack/react-query"
import { api } from "@/api/endpoints"
import type { PreviewLinksRequest } from "@/api/types"

/**
 * 解析消息链接（只读，不创建下载任务）。
 *
 * 用 mutation 而不是 query：解析由用户点击触发、参数不体现在 URL 里，
 * 也不需要在页面间缓存结果。
 */
export function usePreviewLinks() {
  return useMutation({
    mutationFn: (body: PreviewLinksRequest) => api.links.preview(body),
  })
}
