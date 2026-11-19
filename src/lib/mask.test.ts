import { describe, expect, it } from "vitest"
import { maskPhone, maskProxyUrl } from "./mask"

describe("maskPhone", () => {
  it("空值返回占位符", () => {
    expect(maskPhone(undefined)).toBe("—")
    expect(maskPhone("")).toBe("—")
  })

  it("中国大陆手机号保留国家码与前 3 后 4", () => {
    expect(maskPhone("8613754320364")).toBe("+86 137****0364")
    expect(maskPhone("+86 137 5432 0364")).toBe("+86 137****0364")
  })

  it("不带国家码的 11 位号码", () => {
    expect(maskPhone("13754320364")).toBe("137****0364")
  })

  it("其他国际号码按长度反推国家码", () => {
    expect(maskPhone("+1 (415) 555-2671")).toBe("+1 415****2671")
  })

  it("过短或无法识别的输入原样返回", () => {
    expect(maskPhone("123")).toBe("123")
  })
})

describe("maskProxyUrl", () => {
  it("只隐藏密码部分", () => {
    expect(maskProxyUrl("http://user:secret@127.0.0.1:1080")).toBe(
      "http://user:***@127.0.0.1:1080"
    )
  })

  it("无密码或空值时保持可读", () => {
    expect(maskProxyUrl("socks5://127.0.0.1:1080")).toBe(
      "socks5://127.0.0.1:1080"
    )
    expect(maskProxyUrl("")).toBe("—")
  })

  it("非法 URL 原样返回", () => {
    expect(maskProxyUrl("not a url")).toBe("not a url")
  })
})
