import { describe, expect, it } from "vitest"
import type { Setting } from "@/api/types"
import {
  buildSettingRows,
  groupSettingRows,
  settingLabel,
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

describe("buildSettingRows", () => {
  const proxy: Setting = {
    key: "http_proxy",
    value: "socks5://127.0.0.1:1080",
    known: true,
    description: "出站代理",
  }

  it("缺少配置时只补一条代理占位行，并带默认开关状态", () => {
    const rows = buildSettingRows([])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      key: "http_proxy",
      configured: false,
      known: true,
      readOnly: false,
      defaultValue: "",
      proxy: { enabled: true, configured: false },
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

    expect(rows.map((row) => row.key)).toEqual(["http_proxy"])
    expect(rows[0]).toMatchObject({
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
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      key: "http_proxy",
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
    expect(rows[0].proxy).toMatchObject({ enabled: false, configured: true })
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
      "current_account_id",
      "foo",
      "http_proxy",
    ])
    expect(rows[0].readOnly).toBe(true)
    expect(rows[1].known).toBe(false)
    expect(rows[2].configured).toBe(false)
    expect(rows[2].proxy).toBeDefined()
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

  it("按网络 → 账号 → 其他排序并携带标题", () => {
    const groups = groupSettingRows(buildSettingRows([current, unknown, proxy]))

    expect(groups.map((group) => group.key)).toEqual([
      "network",
      "account",
      "other",
    ])
    expect(groups.map((group) => group.title)).toEqual([
      "网络",
      "账号",
      "其他配置",
    ])
    expect(groups[0].rows[0].key).toBe("http_proxy")
    expect(groups[1].rows[0].key).toBe("current_account_id")
    expect(groups[2].rows[0].key).toBe("foo")
  })

  it("空组不返回", () => {
    const groups = groupSettingRows(buildSettingRows([proxy]))

    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({ key: "network", rows: [{ key: "http_proxy" }] })
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
