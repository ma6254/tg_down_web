import { formatSpeed } from "@/lib/format"

export const BASE_TITLE = "tg_down"

export interface DocumentTitleStatus {
  /** 是否启用「网页标题速度显示」。 */
  enabled: boolean
  /** 当前所有运行中任务的总速度；null / 0 表示无活动。 */
  speed: number | null
}

/**
 * 拼接浏览器标题。
 *
 * 开启速度显示时前缀为速度或「无活动」；关闭时保持普通页面标题。
 */
export function formatDocumentTitle(
  title: string,
  status: DocumentTitleStatus
): string {
  if (!status.enabled) {
    return `${title} · ${BASE_TITLE}`
  }

  const prefix =
    status.speed !== null &&
    Number.isFinite(status.speed) &&
    status.speed > 0
      ? formatSpeed(status.speed)
      : "无活动"

  return `${prefix} · ${title} · ${BASE_TITLE}`
}
