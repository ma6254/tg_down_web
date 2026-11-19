import type { Setting } from "@/api/types"

export interface KnownSetting {
  key: string
  label: string
  description: string
  placeholder: string
  /** 未配置时展示/提交的默认值，与服务端 Item.Default 对齐。 */
  defaultValue: string
  /** 用于选择输入控件与校验方式。 */
  kind: "proxy" | "text" | "boolean"
  validate?: (value: string) => string | null
}

/** 服务端 config.items 的镜像：只登记可写、需要 UI 辅助的键。 */
export const knownSettings: Record<string, KnownSetting> = {
  http_proxy: {
    key: "http_proxy",
    label: "出站代理",
    description:
      "出站代理，支持 http/https/socks5/socks5h；登录与下载都会使用。",
    placeholder: "socks5://127.0.0.1:1080",
    defaultValue: "",
    kind: "proxy",
    validate: validateProxyUrl,
  },
  http_proxy_enabled: {
    key: "http_proxy_enabled",
    label: "启用 HTTP 代理",
    description:
      "关闭后即使配置了 http_proxy 也直连 Telegram；开关本身不会删除代理地址。",
    placeholder: "true",
    defaultValue: "true",
    kind: "boolean",
    validate: validateBoolean,
  },
}

/** 布尔值校验：服务端接受 true / false（大小写不敏感）。 */
export function validateBoolean(raw: string): string | null {
  const normalized = raw.trim().toLowerCase()
  return normalized === "true" || normalized === "false"
    ? null
    : "只接受 true 或 false"
}

/** 代理地址校验：与服务端 ValidateProxy 保持一致，前端只做即时提示。 */
export function validateProxyUrl(raw: string): string | null {
  const value = raw.trim()
  if (!value) {
    return "代理地址不能为空；如需关闭请使用「清除」"
  }

  let url: URL
  try {
    url = new URL(value)
  } catch {
    return "请输入合法 URL，例如 socks5://127.0.0.1:1080"
  }

  if (!["http:", "https:", "socks5:", "socks5h:"].includes(url.protocol)) {
    return "仅支持 http / https / socks5 / socks5h"
  }
  if (!url.hostname) {
    return "代理地址缺少主机与端口"
  }
  return null
}

export interface SettingRow {
  key: string
  value: string
  /** 服务端 Item.Default（已知键）或前端注册表默认值。 */
  defaultValue: string
  description: string
  known: boolean
  readOnly: boolean
  /** 服务端是否返回了该键；未配置的已知键会生成 configured=false 的占位行。 */
  configured: boolean
}

/**
 * 把服务端配置数组展开成页面行。
 *
 * 服务端只返回「已写入」的键，未配置的 http_proxy / http_proxy_enabled 不会出现；
 * 这里补占位行，让用户能在 Web 里首次设置而不是只能走 CLI。
 */
export function buildSettingRows(settings: Setting[]): SettingRow[] {
  const rows: SettingRow[] = settings.map((setting) => ({
    key: setting.key,
    value: setting.value,
    defaultValue:
      setting.default ?? knownSettings[setting.key]?.defaultValue ?? "",
    description: setting.description ?? "",
    known: setting.known,
    readOnly: setting.read_only ?? false,
    configured: true,
  }))

  const present = new Set(rows.map((row) => row.key))
  for (const item of Object.values(knownSettings)) {
    if (present.has(item.key)) {
      continue
    }
    rows.push({
      key: item.key,
      value: "",
      defaultValue: item.defaultValue,
      description: item.description,
      known: true,
      readOnly: false,
      configured: false,
    })
  }

  // 服务端按 key 排序；PUT 后返回的数组只含已写入键，补占位行后顺序会变。
  // 统一再排一次，避免保存开关后列表位置跳动。
  rows.sort((a, b) => a.key.localeCompare(b.key))

  return rows
}
