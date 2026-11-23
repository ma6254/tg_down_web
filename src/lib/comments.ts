import type {
  CommentsResponse,
  PreviewComment,
  PreviewCommentSection,
} from "@/api/types"

/** 把分页结果摊平成评论列表（保持接口返回的倒序）。 */
export function flattenComments(
  pages: CommentsResponse[] | undefined
): PreviewComment[] {
  if (!pages || pages.length === 0) {
    return []
  }
  return pages.flatMap((page) => page.comments)
}

/**
 * 评论总数：优先用第一页的 total；未加载时退回 preview 的摘要。
 */
export function commentsTotal(
  pages: CommentsResponse[] | undefined,
  fallback = 0
): number {
  return pages?.[0]?.total ?? fallback
}

/** 评论区按钮文案：有评论数时显示「评论（N）」，否则只显示「评论」。 */
export function commentButtonLabel(section?: PreviewCommentSection): string {
  const count = section?.count ?? 0
  return count > 0 ? `评论（${count}）` : "评论"
}

/** 评论作者名：匿名评论（没有 sender）统一显示为「匿名」。 */
export function commentAuthorName(comment: PreviewComment): string {
  const name = comment.sender?.name?.trim()
  return name || "匿名"
}
