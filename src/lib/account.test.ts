import { describe, expect, it } from "vitest"
import { accountSourceLabel, canLogout } from "@/lib/account"

// TestCanLogout 确认桌面导入的账号不允许注销，其余来源都允许。
describe("canLogout", () => {
  it("桌面导入的账号只能删除", () => {
    expect(canLogout("desktop")).toBe(false)
  })

  it("手动登录与 Bot 账号可以注销", () => {
    expect(canLogout("manual")).toBe(true)
    expect(canLogout("bot")).toBe(true)
  })

  it("旧数据没有 source 时按可注销处理", () => {
    expect(canLogout(undefined)).toBe(true)
    expect(canLogout("")).toBe(true)
  })
})

// TestAccountSourceLabel 确认来源文案与旧数据兜底。
describe("accountSourceLabel", () => {
  it("已知来源显示中文标签", () => {
    expect(accountSourceLabel("desktop")).toBe("桌面导入")
    expect(accountSourceLabel("manual")).toBe("手动登录")
  })

  it("未知来源原样显示，空值显示未记录", () => {
    expect(accountSourceLabel("custom")).toBe("custom")
    expect(accountSourceLabel(undefined)).toBe("未记录")
  })
})
