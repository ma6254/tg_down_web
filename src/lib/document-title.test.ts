import { describe, expect, it } from "vitest"
import { formatDocumentTitle } from "./document-title"

describe("formatDocumentTitle", () => {
  it("关闭速度显示时不加前缀", () => {
    expect(
      formatDocumentTitle("下载", { enabled: false, speed: 5 * 1024 * 1024 })
    ).toBe("下载 · tg_down")
  })

  it("开启且有速度时显示速度", () => {
    expect(
      formatDocumentTitle("下载", {
        enabled: true,
        speed: 1.5 * 1024 * 1024,
      })
    ).toBe("1.5 MB/s · 下载 · tg_down")
  })

  it("开启但没有速度时显示无活动", () => {
    expect(
      formatDocumentTitle("下载", { enabled: true, speed: 0 })
    ).toBe("无活动 · 下载 · tg_down")
    expect(
      formatDocumentTitle("下载", { enabled: true, speed: null })
    ).toBe("无活动 · 下载 · tg_down")
  })
})
