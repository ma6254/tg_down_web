import type { ProbeDevice } from "@/api/types"
import { formatDateTime } from "@/lib/format"

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
