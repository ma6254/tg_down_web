import type {
  DownloadCreateResponse,
  DownloadStatus,
  DownloadTask,
} from "@/api/types"

/** 状态的中文标签。 */
export const DOWNLOAD_STATUS_LABELS: Record<DownloadStatus, string> = {
  pending: "排队中",
  running: "下载中",
  paused: "已暂停",
  done: "已完成",
  failed: "失败",
}

export function downloadStatusLabel(status: DownloadStatus): string {
  return DOWNLOAD_STATUS_LABELS[status] ?? status
}

/** 下载进度（0-100 的整数）；文件大小未知时返回 0。 */
export function downloadPercent(task: DownloadTask): number {
  if (!task.file_size || task.file_size <= 0) {
    return 0
  }
  const percent = (task.offset / task.file_size) * 100
  return Math.min(100, Math.max(0, Math.round(percent)))
}

/** 预计剩余秒数；只有 running 且速度有效时才有值。 */
export function downloadEta(task: DownloadTask): number | null {
  if (task.status !== "running" || !task.speed || task.speed <= 0) {
    return null
  }
  const remaining = task.file_size - task.offset
  if (remaining <= 0) {
    return 0
  }
  return Math.ceil(remaining / task.speed)
}

/** 把创建结果压成一句提示，例如「新建 2，跳过 1」。 */
export function summarizeCreateResult(resp: DownloadCreateResponse): string {
  const parts: string[] = []
  if (resp.created.length > 0) {
    parts.push(`新建 ${resp.created.length}`)
  }
  if (resp.existing.length > 0) {
    parts.push(`已存在 ${resp.existing.length}`)
  }
  if (resp.skipped?.length) {
    parts.push(`跳过 ${resp.skipped.length}`)
  }
  if (resp.failed?.length) {
    parts.push(`失败 ${resp.failed.length}`)
  }
  return parts.length > 0 ? parts.join("，") : "没有可下载的媒体"
}

/** 任务列表里是否还有会自己变化的任务（用于决定是否轮询）。 */
export function hasActiveDownloads(tasks: DownloadTask[]): boolean {
  return tasks.some((task) => task.status === "running" || task.status === "pending")
}

/** 状态对应的 Badge 样式。 */
export function downloadStatusVariant(
  status: DownloadStatus
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "running":
    case "pending":
      return "default"
    case "done":
      return "secondary"
    case "failed":
      return "destructive"
    default:
      return "outline"
  }
}
