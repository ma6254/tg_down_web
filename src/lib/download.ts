import type {
  DownloadCreateResponse,
  DownloadStatus,
  DownloadTask,
  MediaKind,
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

/** 任务行速度与剩余时间使用的滑动平均窗口（毫秒）。 */
export const SPEED_SMOOTH_WINDOW_MS = 10_000

/** 一次速度采样。 */
export interface SpeedSample {
  at: number
  speed: number
}

/**
 * 把一次速度采样加入滑动窗口，返回窗口内的平均速度。
 *
 * samples 会被原地裁剪到最近 window 内；at 为毫秒时间戳，speed 为 B/s。
 */
export function smoothSpeedSample(
  samples: SpeedSample[],
  at: number,
  speed: number
): number {
  const value = Number.isFinite(speed) ? Math.max(0, speed) : 0
  samples.push({ at, speed: value })

  const cutoff = at - SPEED_SMOOTH_WINDOW_MS
  let drop = 0
  while (drop < samples.length && samples[drop].at < cutoff) {
    drop += 1
  }
  if (drop > 0) {
    samples.splice(0, drop)
  }

  const total = samples.reduce((sum, sample) => sum + sample.speed, 0)
  return Math.round(total / samples.length)
}

/**
 * 图片查看器的候选地址。
 *
 * `preview_url` 是大图，但 token 约 30 分钟失效，进程重启后也会失效；
 * 加载失败后依次退到 `thumbnail_url` 与按任务 ID 惰性生成的
 * `/downloads/{id}/thumbnail`（服务端会重新解析并缓存封面）。
 * 地址去重，空值忽略；最后一项始终存在，作为兜底。
 */
export function downloadPreviewSources(task: DownloadTask): string[] {
  const candidates = [
    task.preview_url,
    task.thumbnail_url,
    `/api/v1/downloads/${task.id}/thumbnail`,
  ]
  return Array.from(
    new Set(candidates.filter((src): src is string => Boolean(src)))
  )
}

/** 预计剩余秒数；只有 running 且速度有效时才有值。 */
export function downloadEta(
  task: DownloadTask,
  speed = task.speed
): number | null {
  if (task.status !== "running" || !speed || speed <= 0) {
    return null
  }
  const remaining = task.file_size - task.offset
  if (remaining <= 0) {
    return 0
  }
  return Math.ceil(remaining / speed)
}

/** 把创建结果压成一句提示，例如「新建 2，跳过 1」。 */
export function summarizeCreateResult(resp: DownloadCreateResponse): string {
  const parts: string[] = []
  if (resp.created.length > 0) {
    parts.push(`新建 ${resp.created.length}`)
  }
  if (resp.restarted?.length) {
    parts.push(`重新下载 ${resp.restarted.length}`)
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

/** 任务是否处于活动状态：正在下载或排队等待。 */
function isActiveDownload(task: DownloadTask): boolean {
  return task.status === "running" || task.status === "pending"
}

/** 任务列表里是否还有会自己变化的任务（用于决定是否轮询）。 */
export function hasActiveDownloads(tasks: DownloadTask[]): boolean {
  return tasks.some(isActiveDownload)
}

/** 活动任务数：正在下载 + 排队中，不含暂停与已结束的任务。 */
export function countActiveDownloads(tasks: DownloadTask[]): number {
  let count = 0
  for (const task of tasks) {
    if (isActiveDownload(task)) {
      count += 1
    }
  }
  return count
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

/** 媒体类型的中文标签。 */
export function mediaKindLabel(kind?: MediaKind): string {
  switch (kind) {
    case "photo":
      return "图片"
    case "video":
      return "视频"
    case "audio":
      return "音频"
    case "document":
      return "文件"
    default:
      return "文件"
  }
}
