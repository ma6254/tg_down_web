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

/** 代理地址键；它的启用开关在页面上与它合并成一行。 */
export const PROXY_KEY = "http_proxy"
/** 代理开关键；后端 API 仍是独立配置项，只在展示层并入 http_proxy 行。 */
export const PROXY_ENABLED_KEY = "http_proxy_enabled"

/** 服务端 config.items 的镜像：只登记可写、需要 UI 辅助的键。 */
export const knownSettings: Record<string, KnownSetting> = {
  http_proxy: {
    key: "http_proxy",
    label: "出站代理",
    description:
      "出站代理，支持 http/https/socks5/socks5h；登录与下载都会使用。关闭「启用」开关则直连 Telegram，地址会保留。",
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

/** 合并到 http_proxy 行里的启用开关（对应后端的 http_proxy_enabled）。 */
export interface ProxyToggle {
  /** 当前开关值；未显式配置时取服务端默认值。 */
  enabled: boolean
  /** 服务端是否写入过 http_proxy_enabled。 */
  configured: boolean
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
  /** 只有 http_proxy 行带这个字段：与它合并展示的启用开关。 */
  proxy?: ProxyToggle
}

/**
 * 把服务端配置数组展开成页面行。
 *
 * 服务端只返回「已写入」的键，未配置的 http_proxy 不会出现；
 * 这里补占位行，让用户能在 Web 里首次设置而不是只能走 CLI。
 *
 * http_proxy_enabled 仍由服务端单独读写，但页面上不占一行：
 * 它的值挂到 http_proxy 行的 proxy 字段，由行内开关驱动。
 */
export function buildSettingRows(settings: Setting[]): SettingRow[] {
  const toggle = proxyToggleState(settings)

  const rows: SettingRow[] = []
  for (const setting of settings) {
    // 开关并入 http_proxy 行，不再单独展示。
    if (setting.key === PROXY_ENABLED_KEY) {
      continue
    }
    rows.push({
      key: setting.key,
      value: setting.value,
      defaultValue:
        setting.default ?? knownSettings[setting.key]?.defaultValue ?? "",
      description: setting.description ?? "",
      known: setting.known,
      readOnly: setting.read_only ?? false,
      configured: true,
    })
  }

  const present = new Set(rows.map((row) => row.key))
  for (const item of Object.values(knownSettings)) {
    if (item.key === PROXY_ENABLED_KEY || present.has(item.key)) {
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

  // 开关状态只挂在 http_proxy 行上；占位行同样带开关，便于首次设置前看到默认值。
  for (const row of rows) {
    if (row.key === PROXY_KEY) {
      row.proxy = toggle
    }
  }

  // 服务端按 key 排序；PUT 后返回的数组只含已写入键，补占位行后顺序会变。
  // 统一再排一次，避免保存开关后列表位置跳动。
  rows.sort((a, b) => a.key.localeCompare(b.key))

  return rows
}

/** 从配置数组里推导合并后的开关状态。 */
function proxyToggleState(settings: Setting[]): ProxyToggle {
  const setting = settings.find((item) => item.key === PROXY_ENABLED_KEY)
  const fallbackRaw =
    setting?.default ?? knownSettings[PROXY_ENABLED_KEY]?.defaultValue ?? ""
  const fallback = parseBool(fallbackRaw, false)
  return {
    enabled: setting ? parseBool(setting.value, fallback) : fallback,
    configured: Boolean(setting),
  }
}

/** 服务端只接受 true / false，无法识别时退回默认值。 */
function parseBool(raw: string, fallback: boolean): boolean {
  const normalized = raw.trim().toLowerCase()
  if (normalized === "true") {
    return true
  }
  if (normalized === "false") {
    return false
  }
  return fallback
}

/** knownSettings 之外的展示标题（只读键等）。 */
const extraLabels: Record<string, string> = {
  current_account_id: "当前账号",
}

/** 行的主标题：已知键用注册表里的中文名，其余退回键名。 */
export function settingLabel(row: SettingRow): string {
  return knownSettings[row.key]?.label ?? extraLabels[row.key] ?? row.key
}

/** 设置页的语义分组。 */
export type SettingGroupKey = "network" | "account" | "other"

export interface SettingGroup {
  key: SettingGroupKey
  title: string
  description: string
  rows: SettingRow[]
}

const groupOrder: SettingGroupKey[] = ["network", "account", "other"]

const groupMeta: Record<SettingGroupKey, { title: string; description: string }> = {
  network: {
    title: "网络",
    description: "登录与下载使用的出站代理。",
  },
  account: {
    title: "账号",
    description: "当前访问 Telegram 使用的账号；可在这里切换。",
  },
  other: {
    title: "其他配置",
    description: "服务端登记的其他配置项。",
  },
}

function groupKeyOf(key: string): SettingGroupKey {
  if (key === PROXY_KEY) {
    return "network"
  }
  if (key === "current_account_id") {
    return "account"
  }
  return "other"
}

/** 按语义把配置行分组，空组不返回，顺序固定为 网络 → 账号 → 其他。 */
export function groupSettingRows(rows: SettingRow[]): SettingGroup[] {
  const buckets: Record<SettingGroupKey, SettingRow[]> = {
    network: [],
    account: [],
    other: [],
  }
  for (const row of rows) {
    buckets[groupKeyOf(row.key)].push(row)
  }

  return groupOrder
    .map((key) => ({ key, ...groupMeta[key], rows: buckets[key] }))
    .filter((group) => group.rows.length > 0)
}
