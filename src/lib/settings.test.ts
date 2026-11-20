import { describe, expect, it } from "vitest"
import type { Setting } from "@/api/types"
import {
  buildSettingRows,
  groupSettingRows,
  isEditableRow,
  settingLabel,
  validateAPIHash,
  validateAPIID,
  validateBoolean,
  validateProxyUrl,
} from "./settings"

describe("validateProxyUrl", () => {
  it("接受服务端支持的四类协议", () => {
    expect(validateProxyUrl("socks5://127.0.0.1:1080")).toBeNull()
    expect(validateProxyUrl("socks5h://127.0.0.1:1080")).toBeNull()
    expect(validateProxyUrl("http://127.0.0.1:8080")).toBeNull()
    expect(validateProxyUrl("https://user:pass@proxy.local:8443")).toBeNull()
  })

  it("拒绝空值、非法 URL 与不支持的协议", () => {
    expect(validateProxyUrl("")).not.toBeNull()
    expect(validateProxyUrl("not a url")).not.toBeNull()
    expect(validateProxyUrl("ftp://127.0.0.1:21")).not.toBeNull()
  })
})

describe("validateBoolean", () => {
  it("只接受 true / false", () => {
    expect(validateBoolean("true")).toBeNull()
    expect(validateBoolean("false")).toBeNull()
    expect(validateBoolean("TRUE")).toBeNull()
    expect(validateBoolean("")).not.toBeNull()
    expect(validateBoolean("1")).not.toBeNull()
  })
})

describe("validateAPIID", () => {
  it("只接受正整数", () => {
    expect(validateAPIID("123456")).toBeNull()
    expect(validateAPIID("0")).not.toBeNull()
    expect(validateAPIID("-1")).not.toBeNull()
    expect(validateAPIID("abc")).not.toBeNull()
    expect(validateAPIID("")).not.toBeNull()
  })
})

describe("validateAPIHash", () => {
  it("只接受 32 位十六进制", () => {
    expect(validateAPIHash("a".repeat(32))).toBeNull()
    expect(validateAPIHash("0123456789abcdef0123456789ABCDEF")).toBeNull()
    expect(validateAPIHash("a".repeat(31))).not.toBeNull()
    expect(validateAPIHash("z".repeat(32))).not.toBeNull()
  })
})

describe("buildSettingRows", () => {
  const proxy: Setting = {
    key: "http_proxy",
    value: "socks5://127.0.0.1:1080",
    known: true,
    description: "出站代理",
  }

  it("缺少配置时补代理与 API 占位行，并带默认开关状态", () => {
    const rows = buildSettingRows([])
    expect(rows.map((row) => row.key)).toEqual([
      "api_custom_enabled",
      "api_hash",
      "api_id",
      "http_proxy",
    ])

    const proxyRow = rows.find((row) => row.key === "http_proxy")
    expect(proxyRow).toMatchObject({
      configured: false,
      known: true,
      readOnly: false,
      defaultValue: "",
      proxy: { enabled: true, configured: false },
    })
    expect(rows.find((row) => row.key === "api_custom_enabled")).toMatchObject({
      configured: false,
      defaultValue: "false",
    })
  })

  it("http_proxy_enabled 不再单独占一行", () => {
    const toggle: Setting = {
      key: "http_proxy_enabled",
      type: "boolean",
      default: "true",
      value: "false",
      known: true,
    }

    const rows = buildSettingRows([proxy, toggle])

    expect(rows.map((row) => row.key)).toEqual([
      "api_custom_enabled",
      "api_hash",
      "api_id",
      "http_proxy",
    ])
    expect(rows.find((row) => row.key === "http_proxy")).toMatchObject({
      configured: true,
      value: "socks5://127.0.0.1:1080",
      proxy: { enabled: false, configured: true },
    })
  })

  it("只有开关时也并入代理占位行", () => {
    const toggle: Setting = {
      key: "http_proxy_enabled",
      type: "boolean",
      default: "true",
      value: "false",
      known: true,
    }
    const rows = buildSettingRows([toggle])
    expect(rows.map((row) => row.key)).toEqual([
      "api_custom_enabled",
      "api_hash",
      "api_id",
      "http_proxy",
    ])
    expect(rows.find((row) => row.key === "http_proxy")).toMatchObject({
      configured: false,
      proxy: { enabled: false, configured: true },
    })
  })

  it("开关值非法时退回服务端默认值", () => {
    const toggle: Setting = {
      key: "http_proxy_enabled",
      type: "boolean",
      default: "false",
      value: "",
      known: true,
    }
    const rows = buildSettingRows([proxy, toggle])
    expect(rows.find((row) => row.key === "http_proxy")?.proxy).toMatchObject({
      enabled: false,
      configured: true,
    })
  })

  it("保留只读键与未识别键", () => {
    const current: Setting = {
      key: "current_account_id",
      value: "1",
      known: true,
      read_only: true,
    }
    const unknown: Setting = { key: "foo", value: "bar", known: false }

    const rows = buildSettingRows([current, unknown])

    expect(rows.map((row) => row.key)).toEqual([
      "api_custom_enabled",
      "api_hash",
      "api_id",
      "current_account_id",
      "foo",
      "http_proxy",
    ])
    expect(rows.find((row) => row.key === "current_account_id")?.readOnly).toBe(
      true
    )
    expect(rows.find((row) => row.key === "foo")?.known).toBe(false)

    const proxyRow = rows.find((row) => row.key === "http_proxy")
    expect(proxyRow?.configured).toBe(false)
    expect(proxyRow?.proxy).toBeDefined()
  })
})

describe("groupSettingRows", () => {
  const current: Setting = {
    key: "current_account_id",
    value: "1",
    known: true,
    read_only: true,
  }
  const unknown: Setting = { key: "foo", value: "bar", known: false }
  const proxy: Setting = {
    key: "http_proxy",
    value: "socks5://127.0.0.1:1080",
    known: true,
  }

  it("按网络 → API → 账号 → 其他排序并携带标题", () => {
    const groups = groupSettingRows(buildSettingRows([current, unknown, proxy]))

    expect(groups.map((group) => group.key)).toEqual([
      "network",
      "api",
      "account",
      "other",
    ])
    expect(groups.map((group) => group.title)).toEqual([
      "网络",
      "Telegram API",
      "账号",
      "其他配置",
    ])
    expect(groups[0].rows[0].key).toBe("http_proxy")
    expect(groups[1].rows[0].key).toBe("api_custom_enabled")
    expect(groups[2].rows[0].key).toBe("current_account_id")
    expect(groups[3].rows[0].key).toBe("foo")
  })

  it("空组不返回", () => {
    // 代理之外还会补 API 占位行，因此只剩网络与 API 两组。
    const groups = groupSettingRows(buildSettingRows([proxy]))

    expect(groups).toHaveLength(2)
    expect(groups[0]).toMatchObject({
      key: "network",
      rows: [{ key: "http_proxy" }],
    })
    expect(groups[1].key).toBe("api")
  })
})

describe("settingLabel", () => {
  it("已知键用中文标题，只读键与未知键按注册表/键名兜底", () => {
    const rows = buildSettingRows([
      { key: "current_account_id", value: "1", known: true, read_only: true },
      { key: "foo", value: "bar", known: false },
    ])

    const proxyRow = rows.find((row) => row.key === "http_proxy")
    const accountRow = rows.find((row) => row.key === "current_account_id")
    const unknownRow = rows.find((row) => row.key === "foo")

    expect(proxyRow && settingLabel(proxyRow)).toBe("出站代理")
    expect(accountRow && settingLabel(accountRow)).toBe("当前账号")
    expect(unknownRow && settingLabel(unknownRow)).toBe("foo")
  })
})

describe("isEditableRow", () => {
  it("代理行可编辑：地址要能在页面里设置或修改", () => {
    const rows = buildSettingRows([])
    const proxyRow = rows.find((row) => row.key === "http_proxy")
    expect(proxyRow).toBeDefined()
    expect(isEditableRow(proxyRow!)).toBe(true)
  })

  it("布尔项用行内开关，不弹编辑框", () => {
    const rows = buildSettingRows([])
    const toggle = rows.find((row) => row.key === "api_custom_enabled")
    expect(toggle).toBeDefined()
    expect(isEditableRow(toggle!)).toBe(false)
  })

  it("只读键与未识别键不可编辑", () => {
    const rows = buildSettingRows([
      { key: "current_account_id", value: "4", known: true, read_only: true },
      { key: "legacy_key", value: "x", known: false },
    ])
    const readOnly = rows.find((row) => row.key === "current_account_id")
    const unknown = rows.find((row) => row.key === "legacy_key")
    expect(isEditableRow(readOnly!)).toBe(false)
    expect(isEditableRow(unknown!)).toBe(false)
  })
})
