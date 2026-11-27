import { formatDateTime } from "@/lib/format"
import { formatRelativeTime } from "@/lib/draft"

/** 消息卡片上的缓存状态。 */
export type PreviewCacheStatus = {
  /** none 表示不显示任何缓存提示（新读到的结果）。 */
  kind: "none" | "cached" | "stale" | "gone"
  /** 卡片上显示的短文案。 */
  label: string
  /** 悬停提示，含绝对时间。 */
  title: string
}

/** previewCacheStatus 的输入：预览结果里与缓存相关的字段。 */
export type PreviewCacheFields = {
  cached?: boolean
  stale?: boolean
  gone?: boolean
  /** 缓存快照的获取时间（Unix 秒）。 */
  cached_at?: number
}

/**
 * 把预览结果的缓存标记翻译成界面文案。
 *
 * 优先级：已失效 > 未更新 > 缓存命中。失效消息展示的是快照，
 * 所以两者都要带上快照时间，避免用户以为内容是刚刚读到的。
 */
export function previewCacheStatus(
  item: PreviewCacheFields,
  now: number = Date.now()
): PreviewCacheStatus {
  const at = item.cached_at ?? 0
  const relative = at > 0 ? formatRelativeTime(at, now) : ""
  const exact = at > 0 ? formatDateTime(at) : ""
  const snapshot = at > 0 ? `快照取自 ${exact}（${relative}）` : ""

  if (item.gone) {
    return {
      kind: "gone",
      label: "已失效",
      title: snapshot
        ? `消息已删除或当前账号不可见，不能下载；${snapshot}`
        : "消息已删除或当前账号不可见，不能下载",
    }
  }
  if (item.stale) {
    return {
      kind: "stale",
      label: "未更新",
      title: snapshot
        ? `缓存已过期，重新获取失败；${snapshot}。点「强制刷新」可以再试一次`
        : "缓存已过期，重新获取失败；点「强制刷新」可以再试一次",
    }
  }
  if (item.cached && at > 0) {
    return {
      kind: "cached",
      label: `缓存于 ${relative}`,
      title: `缓存于 ${exact}`,
    }
  }
  return { kind: "none", label: "", title: "" }
}
