import { describe, expect, it } from "vitest"
import type { Setting } from "@/api/types"
import {
  buildSettingRows,
  formatSettingValue,
  groupSettingRows,
  isEditableRow,
  settingBool,
  settingLabel,
  settingSwitchChecked,
  validateAPIHash,
  validateAPIID,
  validateBoolean,
  validateDownloadCount,
  validateProxyUrl,
  validateWebTheme,
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

describe("validateDownloadCount", () => {
  it("只接受 1-8 的整数", () => {
    expect(validateDownloadCount("1")).toBeNull()
    expect(validateDownloadCount("8")).toBeNull()
    expect(validateDownloadCount("0")).not.toBeNull()
    expect(validateDownloadCount("9")).not.toBeNull()
    expect(validateDownloadCount("1.5")).not.toBeNull()
    expect(validateDownloadCount("abc")).not.toBeNull()
  })
})

describe("validateWebTheme", () => {
  it("只接受 light / dark / system", () => {
    expect(validateWebTheme("light")).toBeNull()
    expect(validateWebTheme("dark")).toBeNull()
    expect(validateWebTheme("system")).toBeNull()
    expect(validateWebTheme("DARK")).toBeNull()
    expect(validateWebTheme("auto")).not.toBeNull()
    expect(validateWebTheme("")).not.toBeNull()
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

  it("缺少配置时补代理、API 与下载占位行，并带默认开关状态", () => {
    const rows = buildSettingRows([])
    expect(rows.map((row) => row.key)).toEqual([
      "api_custom_enabled",
      "api_hash",
      "api_id",
      "download_auto_preview",
      "download_comments",
      "download_expand_text_links",
      "download_overwrite",
      "download_threads",
      "download_workers",
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
    expect(rows.find((row) => row.key === "download_overwrite")).toMatchObject({
      configured: false,
      defaultValue: "false",
    })
    expect(
      rows.find((row) => row.key === "download_expand_text_links")
    ).toMatchObject({
      configured: false,
      defaultValue: "false",
    })
    expect(rows.find((row) => row.key === "download_auto_preview")).toMatchObject({
      configured: false,
      defaultValue: "true",
    })
    expect(rows.find((row) => row.key === "download_comments")).toMatchObject({
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
      "download_auto_preview",
      "download_comments",
      "download_expand_text_links",
      "download_overwrite",
      "download_threads",
      "download_workers",
      "http_proxy",
    ])
    expect(rows.find((row) => row.key === "http_proxy")).toMatchObject({
      configured: true,
      value: "socks5://127.0.0.1:1080",
      proxy: { enabled: false, configured: true },
    })
  })

  it("web_theme 与 web_title_speed 由网页设置卡片展示，不进入通用配置列表", () => {
    const theme: Setting = {
      key: "web_theme",
      type: "string",
      default: "system",
      value: "dark",
      known: true,
    }
    const titleSpeed: Setting = {
      key: "web_title_speed",
      type: "boolean",
      default: "false",
      value: "true",
      known: true,
    }

    const rows = buildSettingRows([theme, titleSpeed])

    expect(rows.some((row) => row.key === "web_theme")).toBe(false)
    expect(rows.some((row) => row.key === "web_title_speed")).toBe(false)
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
      "download_auto_preview",
      "download_comments",
      "download_expand_text_links",
      "download_overwrite",
      "download_threads",
      "download_workers",
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
      "download_auto_preview",
      "download_comments",
      "download_expand_text_links",
      "download_overwrite",
      "download_threads",
      "download_workers",
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

describe("formatSettingValue", () => {
  it("布尔项展示启用状态", () => {
    const rows = buildSettingRows([
      { key: "api_custom_enabled", value: "true", known: true },
      { key: "download_comments", value: "false", known: true },
    ])

    expect(
      formatSettingValue(rows.find((row) => row.key === "api_custom_enabled")!)
    ).toBe("已启用")
    expect(
      formatSettingValue(rows.find((row) => row.key === "download_comments")!)
    ).toBe("已停用")
  })

  it("未配置的布尔项说明默认值", () => {
    const rows = buildSettingRows([])

    expect(
      formatSettingValue(
        rows.find((row) => row.key === "download_auto_preview")!
      )
    ).toBe("未设置（默认启用）")
    expect(
      formatSettingValue(rows.find((row) => row.key === "download_overwrite")!)
    ).toBe("未设置（默认关闭）")
  })

  it("当前账号显示 #id，空值显示未选择", () => {
    const configured = buildSettingRows([
      { key: "current_account_id", value: "42", known: true, read_only: true },
    ])
    const empty = buildSettingRows([
      { key: "current_account_id", value: "", known: true, read_only: true },
    ])

    expect(
      formatSettingValue(
        configured.find((row) => row.key === "current_account_id")!
      )
    ).toBe("#42")
    expect(
      formatSettingValue(empty.find((row) => row.key === "current_account_id")!)
    ).toBe("未选择")
  })

  it("代理未配置显示直连，配置后脱敏密码", () => {
    const configured = buildSettingRows([
      {
        key: "http_proxy",
        value: "socks5://user:pass@127.0.0.1:1080",
        known: true,
      },
    ])
    const missing = buildSettingRows([])

    expect(
      formatSettingValue(configured.find((row) => row.key === "http_proxy")!)
    ).toBe("socks5://user:***@127.0.0.1:1080")
    expect(
      formatSettingValue(missing.find((row) => row.key === "http_proxy")!)
    ).toBe("未配置（直连）")
  })

  it("api_hash 脱敏，其他文本空值显示占位", () => {
    const rows = buildSettingRows([
      {
        key: "api_hash",
        value: "0123456789abcdef0123456789abcdef",
        known: true,
      },
      { key: "api_id", value: "", known: true },
      { key: "foo", value: "bar", known: false },
    ])

    expect(
      formatSettingValue(rows.find((row) => row.key === "api_hash")!)
    ).toBe("0123••••••••cdef")
    expect(formatSettingValue(rows.find((row) => row.key === "api_id")!)).toBe(
      "—"
    )
    expect(formatSettingValue(rows.find((row) => row.key === "foo")!)).toBe(
      "bar"
    )
  })
})

describe("settingSwitchChecked", () => {
  it("已配置读 value，未配置读默认值", () => {
    const rows = buildSettingRows([
      { key: "download_overwrite", value: "true", known: true },
    ])
    const placeholders = buildSettingRows([])

    expect(
      settingSwitchChecked(rows.find((row) => row.key === "download_overwrite")!)
    ).toBe(true)
    expect(
      settingSwitchChecked(
        placeholders.find((row) => row.key === "download_auto_preview")!
      )
    ).toBe(true)
    expect(
      settingSwitchChecked(
        placeholders.find((row) => row.key === "download_overwrite")!
      )
    ).toBe(false)
  })
})

describe("settingBool", () => {
  it("读取布尔项，缺失或非法时退回默认值", () => {
    const settings: Setting[] = [
      { key: "download_overwrite", value: "true", known: true },
      { key: "api_custom_enabled", value: "bad", known: true },
    ]
    expect(settingBool(settings, "download_overwrite")).toBe(true)
    expect(settingBool(settings, "api_custom_enabled")).toBe(false)
    expect(settingBool(settings, "api_custom_enabled", true)).toBe(true)
    expect(settingBool(settings, "missing")).toBe(false)
    expect(settingBool(undefined, "download_overwrite", true)).toBe(true)
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

  it("按网络 → 下载 → API → 账号 → 其他排序并携带标题", () => {
    const groups = groupSettingRows(buildSettingRows([current, unknown, proxy]))

    expect(groups.map((group) => group.key)).toEqual([
      "network",
      "download",
      "api",
      "account",
      "other",
    ])
    expect(groups.map((group) => group.title)).toEqual([
      "网络",
      "下载配置",
      "Telegram API",
      "账号",
      "其他配置",
    ])
    expect(groups[0].rows[0].key).toBe("http_proxy")
    expect(groups[1].rows.map((row) => row.key)).toEqual([
      "download_auto_preview",
      "download_comments",
      "download_expand_text_links",
      "download_overwrite",
      "download_threads",
      "download_workers",
    ])
    expect(groups[2].rows[0].key).toBe("api_custom_enabled")
    expect(groups[3].rows[0].key).toBe("current_account_id")
    expect(groups[4].rows.map((row) => row.key)).toEqual(["foo"])
  })

  it("空组不返回", () => {
    // 代理之外还会补下载与 API 占位行，因此剩下网络、下载、API 三组。
    const groups = groupSettingRows(buildSettingRows([proxy]))

    expect(groups).toHaveLength(3)
    expect(groups[0]).toMatchObject({
      key: "network",
      rows: [{ key: "http_proxy" }],
    })
    expect(groups[1]).toMatchObject({
      key: "download",
      title: "下载配置",
      rows: [
        { key: "download_auto_preview" },
        { key: "download_comments" },
        { key: "download_expand_text_links" },
        { key: "download_overwrite" },
        { key: "download_threads" },
        { key: "download_workers" },
      ],
    })
    expect(groups[2].key).toBe("api")
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
