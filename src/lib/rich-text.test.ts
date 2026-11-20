import { describe, expect, it } from "vitest"
import type { PreviewEntity } from "../api/types"
import { formatEntityDate, splitRichText } from "./rich-text"

/** 构造实体，默认 type=bold；offset/length 按 UTF-16 码元。 */
function entity(offset: number, length: number, patch: Partial<PreviewEntity> = {}): PreviewEntity {
  return { type: "bold", offset, length, ...patch }
}

describe("splitRichText", () => {
  it("没有实体时返回单段原文", () => {
    expect(splitRichText("hello")).toEqual([{ text: "hello", entities: [] }])
  })

  it("空正文返回空数组", () => {
    expect(splitRichText("")).toEqual([])
    expect(splitRichText("", [entity(0, 5)])).toEqual([])
  })

  it("单个实体覆盖全文时只有一段", () => {
    const bold = entity(0, 11)
    expect(splitRichText("hello world", [bold])).toEqual([
      { text: "hello world", entities: [bold] },
    ])
  })

  it("嵌套实体按边界切段，外层实体先出现", () => {
    // 看=1 这=1 里=1 !=1
    const bold = entity(0, 4)
    const link = entity(1, 2, { type: "text_link", url: "https://t.me/x/1" })
    const segments = splitRichText("看这里!", [bold, link])

    expect(segments.map((segment) => segment.text)).toEqual(["看", "这里", "!"])
    expect(segments[0].entities).toEqual([bold])
    expect(segments[1].entities).toEqual([bold, link])
    expect(segments[2].entities).toEqual([bold])
  })

  it("emoji 按双码元计长，不会切错位置", () => {
    const bold = entity(3, 2) // 👋=2，空格=1，hi 从下标 3 开始
    expect(splitRichText("👋 hi", [bold])).toEqual([
      { text: "👋 ", entities: [] },
      { text: "hi", entities: [bold] },
    ])
  })

  it("越界实体被裁剪，完全越界的被丢弃", () => {
    const tail = entity(2, 10)
    expect(splitRichText("abc", [tail])).toEqual([
      { text: "ab", entities: [] },
      { text: "c", entities: [entity(2, 1)] },
    ])
    expect(splitRichText("abc", [entity(5, 10)])).toEqual([{ text: "abc", entities: [] }])
  })

  it("部分重叠的实体也能正确切段", () => {
    const bold = entity(0, 4)
    const italic = entity(2, 4, { type: "italic" })
    const segments = splitRichText("abcdef", [bold, italic])

    expect(segments.map((segment) => segment.text)).toEqual(["ab", "cd", "ef"])
    expect(segments[0].entities).toEqual([bold])
    expect(segments[1].entities).toEqual([bold, italic])
    expect(segments[2].entities).toEqual([italic])
  })

  it("重复实体只保留一份", () => {
    const bold = entity(0, 3)
    expect(splitRichText("abc", [bold, { ...bold }])).toEqual([{ text: "abc", entities: [bold] }])
  })

  it("块级实体排在内层样式之前", () => {
    const code = entity(0, 4, { type: "code" })
    const pre = entity(0, 4, { type: "pre", language: "go" })
    const [segment] = splitRichText("code", [code, pre])

    expect(segment.entities.map((item) => item.type)).toEqual(["pre", "code"])
  })

  it("切段结果拼接后与原文一致", () => {
    const bold = entity(0, 6)
    const link = entity(2, 2, { type: "url" })
    const segments = splitRichText("abcdef", [bold, link])

    expect(segments.map((segment) => segment.text).join("")).toBe("abcdef")
  })
})

describe("formatEntityDate", () => {
  it("没有时间戳或格式未知时返回空串", () => {
    expect(formatEntityDate({ type: "date_time", offset: 0, length: 4 })).toBe("")
    expect(
      formatEntityDate({ type: "date_time", offset: 0, length: 4, date: 1794931200 })
    ).toBe("")
    expect(
      formatEntityDate({
        type: "date_time",
        offset: 0,
        length: 4,
        date: 1794931200,
        date_format: "unknown" as never,
      })
    ).toBe("")
  })

  it("按格式渲染时间", () => {
    const entity: PreviewEntity = {
      type: "date_time",
      offset: 0,
      length: 4,
      date: 1794931200,
      date_format: "date_long",
    }
    expect(formatEntityDate(entity)).not.toBe("")
  })
})
