const pad = (value: number) => String(value).padStart(2, "0")

/** 秒级 Unix 时间戳 → 本地 `YYYY-MM-DD HH:mm`；无效值返回 `—`。 */
export function formatDateTime(unixSeconds?: number): string {
  if (!unixSeconds) {
    return "—"
  }
  const date = new Date(unixSeconds * 1000)
  if (Number.isNaN(date.getTime())) {
    return "—"
  }
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/**
 * 生日：`1990-05-12`；只公开月日时 `5 月 12 日（未公开年份）`；无效值返回 `—`。
 */
export function formatBirthday(birthday?: {
  day: number
  month: number
  year?: number
}): string {
  if (!birthday) {
    return "—"
  }
  const { day, month, year } = birthday
  if (!Number.isInteger(day) || !Number.isInteger(month) || day < 1 || month < 1) {
    return "—"
  }
  if (year && year > 0) {
    return `${year}-${pad(month)}-${pad(day)}`
  }
  return `${month} 月 ${day} 日（未公开年份）`
}

/** 运行时长：`1 天 2 小时` / `3 小时 12 分` / `5 分 30 秒`。 */
export function formatUptime(totalSeconds?: number): string {
  if (
    totalSeconds === undefined ||
    !Number.isFinite(totalSeconds) ||
    totalSeconds < 0
  ) {
    return "—"
  }
  const seconds = Math.floor(totalSeconds)
  if (seconds < 60) {
    return `${seconds} 秒`
  }

  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (days > 0) {
    return `${days} 天 ${hours} 小时`
  }
  if (hours > 0) {
    return `${hours} 小时 ${minutes} 分`
  }
  return `${minutes} 分 ${seconds % 60} 秒`
}

/** 字节数 → `512 B` / `1.5 KB` / `309.5 MB`；无效值返回 `—`。 */
export function formatBytes(bytes?: number): string {
  if (bytes === undefined || !Number.isFinite(bytes) || bytes < 0) {
    return "—"
  }
  if (bytes < 1024) {
    return `${Math.round(bytes)} B`
  }

  const units = ["KB", "MB", "GB", "TB"]
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value.toFixed(1)} ${units[unit]}`
}

/** 秒数 → `13:40` / `1:02:03`；无效值返回 `—`。 */
export function formatDuration(seconds?: number): string {
  if (seconds === undefined || !Number.isFinite(seconds) || seconds < 0) {
    return "—"
  }
  const total = Math.floor(seconds)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const rest = String(total % 60).padStart(2, "0")
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${rest}`
  }
  return `${minutes}:${rest}`
}
