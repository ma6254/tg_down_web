import { describe, expect, it } from "vitest"
import { formatJson, splitTokenLines, tokenizeJson } from "./json"

describe("formatJson", () => {
  it("对象按 2 空格缩进", () => {
    expect(formatJson({ a: 1, b: [true, null] })).toBe(
      '{\n  "a": 1,\n  "b": [\n    true,\n    null\n  ]\n}'
    )
  })

  it("字符串本身是 JSON 时重新缩进", () => {
    expect(formatJson('{"a":1}')).toBe('{\n  "a": 1\n}')
  })

  it("支持自定义缩进宽度", () => {
    expect(formatJson({ a: 1 }, 4)).toBe('{\n    "a": 1\n}')
    expect(formatJson('{"a":1}', 4)).toBe('{\n    "a": 1\n}')
  })

  it("普通字符串原样返回", () => {
    expect(formatJson("hello")).toBe("hello")
  })

  it("undefined 也有可见结果，不会留空白", () => {
    expect(formatJson(undefined)).toBe("undefined")
  })
})

describe("tokenizeJson", () => {
  const text = formatJson({
    name: 'a"b',
    ok: true,
    n: 1.5,
    none: null,
  })

  it("拼接所有片段与输入完全一致（转义引号不丢字符）", () => {
    expect(tokenizeJson(text).map((token) => token.text).join("")).toBe(text)
  })

  it("键、字符串、数字、布尔与 null 分别标记", () => {
    const kinds = tokenizeJson(text)
      .filter((token) => token.kind !== "punctuation")
      .map((token) => token.kind)
    expect(kinds).toEqual([
      "key",
      "string",
      "key",
      "boolean",
      "key",
      "number",
      "key",
      "null",
    ])
  })

  it("区分键与字符串值，冒号归为标点", () => {
    expect(tokenizeJson('{"a": "a"}')).toEqual([
      { kind: "punctuation", text: "{" },
      { kind: "key", text: '"a"' },
      { kind: "punctuation", text: ":" },
      { kind: "punctuation", text: " " },
      { kind: "string", text: '"a"' },
      { kind: "punctuation", text: "}" },
    ])
  })
})

describe("splitTokenLines", () => {
  const text = formatJson({
    name: "第一行",
    nested: { ok: true },
    list: [1, 2],
  })

  it("行数与原文一致，逐行拼接后不丢字符", () => {
    const lines = splitTokenLines(tokenizeJson(text))
    const sourceLines = text.split("\n")
    expect(lines).toHaveLength(sourceLines.length)
    expect(lines.map((line) => line.map((token) => token.text).join(""))).toEqual(
      sourceLines
    )
  })

  it("token 内部的换行会被拆到相邻行", () => {
    const lines = splitTokenLines([{ kind: "punctuation", text: "}, {\n  " }])
    expect(lines).toEqual([
      [{ kind: "punctuation", text: "}, {" }],
      [{ kind: "punctuation", text: "  " }],
    ])
  })

  it("空片段得到一行空行", () => {
    expect(splitTokenLines([])).toEqual([[]])
  })
})
