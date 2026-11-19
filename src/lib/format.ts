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
