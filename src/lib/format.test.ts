import { describe, expect, it } from "vitest"
import {
  formatBirthday,
  formatBuildTime,
  formatBytes,
  formatDateTime,
  formatDuration,
  formatRuntime,
  formatSpeed,
  formatSpeedParts,
  formatUptime,
} from "./format"

describe("formatDateTime", () => {
  it("空值与非法值返回占位符", () => {
    expect(formatDateTime(undefined)).toBe("—")
    expect(formatDateTime(0)).toBe("—")
    expect(formatDateTime(Number.NaN)).toBe("—")
  })

  it("按本地时区格式化为 YYYY-MM-DD HH:mm", () => {
    const local = new Date(2026, 0, 2, 3, 4, 5).getTime() / 1000
    expect(formatDateTime(local)).toBe("2026-01-02 03:04")
  })
})

describe("formatBirthday", () => {
  it("空值与非法值返回占位符", () => {
    expect(formatBirthday(undefined)).toBe("—")
    expect(formatBirthday({ day: 0, month: 5 })).toBe("—")
    expect(formatBirthday({ day: 12, month: 0 })).toBe("—")
  })

  it("有年份时输出 YYYY-MM-DD", () => {
    expect(formatBirthday({ day: 2, month: 3, year: 2000 })).toBe("2000-03-02")
  })

  it("只公开月日时标注未公开年份", () => {
    expect(formatBirthday({ day: 12, month: 5 })).toBe("5 月 12 日（未公开年份）")
    expect(formatBirthday({ day: 12, month: 5, year: 0 })).toBe(
      "5 月 12 日（未公开年份）"
    )
  })
})

describe("formatUptime", () => {
  it("非法值返回占位符", () => {
    expect(formatUptime(undefined)).toBe("—")
    expect(formatUptime(-1)).toBe("—")
    expect(formatUptime(Number.NaN)).toBe("—")
  })

  it("按天/小时/分钟/秒展示", () => {
    expect(formatUptime(0)).toBe("0 秒")
    expect(formatUptime(45)).toBe("45 秒")
    expect(formatUptime(125)).toBe("2 分 5 秒")
    expect(formatUptime(3725)).toBe("1 小时 2 分")
    expect(formatUptime(93784)).toBe("1 天 2 小时")
  })
})

describe("formatSpeed", () => {
  it("在字节单位后追加 /s", () => {
    expect(formatSpeed(0)).toBe("0 B/s")
    expect(formatSpeed(1024)).toBe("1.0 KB/s")
    expect(formatSpeed(1536)).toBe("1.5 KB/s")
  })

  it("无效值返回占位符", () => {
    expect(formatSpeed(undefined)).toBe("—")
    expect(formatSpeed(-1)).toBe("—")
    expect(formatSpeed(Number.NaN)).toBe("—")
  })
})

describe("formatSpeedParts", () => {
  it("拆出数值与单位，供大字号排版", () => {
    expect(formatSpeedParts(0)).toEqual({ value: "0", unit: "B/s" })
    expect(formatSpeedParts(1536)).toEqual({ value: "1.5", unit: "KB/s" })
    expect(formatSpeedParts(10 * 1024 * 1024)).toEqual({
      value: "10.0",
      unit: "MB/s",
    })
  })

  it("无效值只返回占位符，不拼单位", () => {
    expect(formatSpeedParts(undefined)).toEqual({ value: "—", unit: "" })
    expect(formatSpeedParts(-1)).toEqual({ value: "—", unit: "" })
    expect(formatSpeedParts(Number.NaN)).toEqual({ value: "—", unit: "" })
  })
})

describe("formatBytes", () => {
  it("非法值返回占位符", () => {
    expect(formatBytes(undefined)).toBe("—")
    expect(formatBytes(-1)).toBe("—")
    expect(formatBytes(Number.NaN)).toBe("—")
  })

  it("按 1024 进制展示", () => {
    expect(formatBytes(0)).toBe("0 B")
    expect(formatBytes(512)).toBe("512 B")
    expect(formatBytes(1024)).toBe("1.0 KB")
    expect(formatBytes(1536)).toBe("1.5 KB")
    expect(formatBytes(324564430)).toBe("309.5 MB")
    expect(formatBytes(2 * 1024 ** 3)).toBe("2.0 GB")
  })
})

describe("formatDuration", () => {
  it("非法值返回占位符", () => {
    expect(formatDuration(undefined)).toBe("—")
    expect(formatDuration(-5)).toBe("—")
  })

  it("按分钟/小时展示", () => {
    expect(formatDuration(0)).toBe("0:00")
    expect(formatDuration(65)).toBe("1:05")
    expect(formatDuration(820)).toBe("13:40")
    expect(formatDuration(3723)).toBe("1:02:03")
  })
})

describe("formatBuildTime", () => {
  it("未注入或空值返回占位符", () => {
    expect(formatBuildTime(undefined)).toBe("—")
    expect(formatBuildTime("")).toBe("—")
    expect(formatBuildTime("  ")).toBe("—")
    expect(formatBuildTime("unknown")).toBe("—")
  })

  it("RFC3339 转成本地时间，不可解析时原样返回", () => {
    const at = new Date(2026, 10, 20, 15, 42, 7)
    expect(formatBuildTime(at.toISOString())).toBe("2026-11-20 15:42")
    expect(formatBuildTime("2026-11-20T15:42:07+08:00")).toMatch(
      /^2026-11-20 \d{2}:42$/
    )
    expect(formatBuildTime("v1.2.3")).toBe("v1.2.3")
  })
})

describe("formatRuntime", () => {
  it("缺失时返回占位符", () => {
    expect(formatRuntime(undefined)).toBe("—")
    expect(formatRuntime({})).toBe("—")
    expect(formatRuntime({ go_version: "  ", os: "", arch: "" })).toBe("—")
  })

  it("组合 go 版本与平台", () => {
    expect(
      formatRuntime({ go_version: "go1.27.1", os: "windows", arch: "amd64" })
    ).toBe("go1.27.1 · windows/amd64")
    // 平台字段不全时只展示能拼出的部分，不出现半截斜杠。
    expect(formatRuntime({ os: "linux" })).toBe("linux")
    expect(formatRuntime({ go_version: "go1.27.1" })).toBe("go1.27.1")
  })
})
