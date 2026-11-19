import { describe, expect, it } from "vitest"
import type { Setting } from "@/api/types"
import { buildSettingRows, validateBoolean, validateProxyUrl } from "./settings"

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

  it("缺少可写键时补占位行", () => {
    const rows = buildSettingRows([])
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({
      key: "http_proxy",
      configured: false,
      known: true,
      readOnly: false,
      defaultValue: "",
    })
    expect(rows[1]).toMatchObject({
      key: "http_proxy_enabled",
      configured: false,
      known: true,
      readOnly: false,
      defaultValue: "true",
    })
  })

  it("已有 http_proxy 时只补代理开关行", () => {
    const rows = buildSettingRows([proxy])
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ key: "http_proxy", configured: true })
    expect(rows[1]).toMatchObject({
      key: "http_proxy_enabled",
      configured: false,
    })
  })

  it("已配置的代理开关保持原值", () => {
    const toggle: Setting = {
      key: "http_proxy_enabled",
      type: "boolean",
      default: "true",
      value: "false",
      known: true,
    }
    const rows = buildSettingRows([toggle])
    const row = rows.find((item) => item.key === "http_proxy_enabled")
    expect(row).toMatchObject({
      configured: true,
      value: "false",
      defaultValue: "true",
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
      "current_account_id",
      "foo",
      "http_proxy",
      "http_proxy_enabled",
    ])
    expect(rows[0].readOnly).toBe(true)
    expect(rows[1].known).toBe(false)
    expect(rows[2].configured).toBe(false)
    expect(rows[3].configured).toBe(false)
  })
})
