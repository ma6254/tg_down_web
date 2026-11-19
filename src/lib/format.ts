/** 秒级 Unix 时间戳 → 本地 `YYYY-MM-DD HH:mm`；无效值返回 `—`。 */
export function formatDateTime(unixSeconds?: number): string {
  if (!unixSeconds) {
    return "—"
  }
  const date = new Date(unixSeconds * 1000)
  if (Number.isNaN(date.getTime())) {
    return "—"
  }
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
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
