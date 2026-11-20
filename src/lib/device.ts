import type { ProbeDevice } from "@/api/types"
import { formatDateTime } from "@/lib/format"

/** 判断当前设备是否为移动端（手机 / 平板）。 */
export function isMobileDevice(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false
  }

  const ua = navigator.userAgent || ""
  const uaMobile =
    /Android|iPhone|iPad|iPod|Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)
  // iPadOS 13+ 会伪装成 Macintosh，但支持多点触控。
  const touchMac = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1

  return uaMobile || touchMac
}

/**
 * 把已登录客户端拼成一行：应用 · 平台 · 机型 · 国家 · 最近活跃。
 *
 * 探测（ProbeDialog）与在线资料（AccountLiveSection）共用，避免两处格式漂移。
 */
export function deviceLabel(device: ProbeDevice): string {
  const parts = [
    device.app_name,
    device.platform,
    device.device_model,
    device.country,
    device.active_at ? `最近活跃 ${formatDateTime(device.active_at)}` : "",
  ].filter(Boolean)
  return parts.length > 0 ? parts.join(" · ") : "未知客户端"
}
