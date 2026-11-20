import { describe, expect, it, vi } from "vitest"
import { copyText } from "./clipboard"

describe("copyText", () => {
  it("优先调用 Clipboard API", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal("navigator", { clipboard: { writeText } })
    await copyText("https://t.me/a/1")
    expect(writeText).toHaveBeenCalledWith("https://t.me/a/1")
    vi.unstubAllGlobals()
  })

  it("空文本直接报错", async () => {
    await expect(copyText("")).rejects.toThrow("没有可复制的内容")
  })
})
