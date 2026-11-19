import { describe, expect, it } from "vitest"
import { formatDateTime, formatUptime } from "./format"

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
