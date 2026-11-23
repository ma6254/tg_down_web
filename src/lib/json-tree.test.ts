import { describe, expect, it } from "vitest"
import { formatJson } from "./json"
import {
  buildJsonTree,
  buildJsonViewLines,
  collectFoldPaths,
  plainJsonViewLines,
  selectedLineRange,
  type JsonTreeNode,
  type JsonViewLine,
} from "./json-tree"

function lineText(line: JsonViewLine): string {
  return line.tokens.map((token) => token.text).join("")
}

function bracketsOf(line: JsonViewLine) {
  return line.tokens.filter((token) => token.kind === "bracket")
}

function treeOf(text: string): JsonTreeNode {
  const tree = buildJsonTree(text)
  if (!tree) {
    throw new Error(`应能构建可折叠树：${text}`)
  }
  return tree
}

describe("buildJsonTree", () => {
  it("按格式化文本计算行号与行数", () => {
    const text = formatJson({ a: 1, b: { c: 2 }, d: [] })
    const tree = treeOf(text)

    expect(tree.line).toBe(1)
    expect(tree.lineCount).toBe(text.split("\n").length)
    expect(tree.kind).toBe("object")

    const [a, b, d] = tree.children
    expect(a.kind).toBe("number")
    expect(a.line).toBe(2)
    expect(a.lineCount).toBe(1)
    expect(b.kind).toBe("object")
    expect(b.line).toBe(3)
    expect(b.lineCount).toBe(3)
    expect(d.kind).toBe("array")
    expect(d.line).toBe(6)
    expect(d.lineCount).toBe(1)
  })

  it("顶层标量或无法解析的文本返回 null", () => {
    expect(buildJsonTree("5")).toBeNull()
    expect(buildJsonTree('"hello"')).toBeNull()
    expect(buildJsonTree("null")).toBeNull()
    expect(buildJsonTree("undefined")).toBeNull()
    expect(buildJsonTree("{bad")).toBeNull()
  })
})

describe("buildJsonViewLines", () => {
  const text = formatJson({ a: 1, b: { c: 2 }, d: [true, null] })
  const tree = treeOf(text)
  const noFolds = new Set<string>()

  it("全部展开时逐行还原格式化文本", () => {
    const value = {
      'a"b': 1,
      arr: [true, null, "x\ny"],
      obj: { emptyObject: {}, emptyArray: [] },
      s: 'quote " and \\',
    }
    const source = formatJson(value)
    const lines = buildJsonViewLines(treeOf(source), noFolds)

    expect(lines.map(lineText).join("\n")).toBe(source)
    expect(lines.map((line) => line.line)).toEqual(
      source.split("\n").map((_, index) => index + 1)
    )
  })

  it("缩进按层级拆成独立的 token", () => {
    const lines = buildJsonViewLines(tree, noFolds)
    // 第 4 行是 `    "c": 2`，深度 2。
    expect(lines[3].tokens.slice(0, 2)).toEqual([
      { kind: "indent", text: "  " },
      { kind: "indent", text: "  " },
    ])
    expect(lines[3].tokens[2].kind).toBe("key")
    // 第 5 行是 `  },`，深度 1。
    expect(lines[4].tokens[0]).toEqual({ kind: "indent", text: "  " })
  })

  it("缩进宽度可切换且与原文保持一致", () => {
    const source = formatJson({ a: 1, b: { c: 2 } }, 4)
    const lines = buildJsonViewLines(treeOf(source), noFolds, 4)

    expect(lines.map(lineText).join("\n")).toBe(source)
    // 第 4 行 `        "c": 2` 是深度 2，每层 4 个空格。
    expect(lines[3].tokens.slice(0, 2)).toEqual([
      { kind: "indent", text: "    " },
      { kind: "indent", text: "    " },
    ])
  })

  it("容器括号带嵌套层级，供查看器染色", () => {
    const lines = buildJsonViewLines(tree, noFolds)

    // 根 `{` / `}` 是第 1 层。
    expect(bracketsOf(lines[0])).toEqual([
      { kind: "bracket", text: "{", level: 1 },
    ])
    // `  "b": {` 开启第 2 层，闭合括号同为第 2 层。
    expect(bracketsOf(lines[2])).toEqual([
      { kind: "bracket", text: "{", level: 2 },
    ])
    expect(bracketsOf(lines[4])).toEqual([
      { kind: "bracket", text: "}", level: 2 },
    ])
    expect(bracketsOf(lines[9])).toEqual([
      { kind: "bracket", text: "}", level: 1 },
    ])
  })

  it("折叠摘要与空容器的括号也带层级", () => {
    const b = tree.children[1]
    const collapsed = buildJsonViewLines(tree, new Set([b.path]))
    expect(bracketsOf(collapsed[2])).toEqual([
      { kind: "bracket", text: "{", level: 2 },
      { kind: "bracket", text: "}", level: 2 },
    ])

    const empty = buildJsonViewLines(
      treeOf(formatJson({ a: {}, b: [] })),
      noFolds
    )
    expect(bracketsOf(empty[1])).toEqual([
      { kind: "bracket", text: "{}", level: 2 },
    ])
    expect(bracketsOf(empty[2])).toEqual([
      { kind: "bracket", text: "[]", level: 2 },
    ])
  })

  it("数组里的对象/数组元素带下标标注", () => {
    const source = formatJson({ arr: [{ a: 1 }, [], [1, 2]] })
    const lines = buildJsonViewLines(treeOf(source), noFolds)

    const labels = lines
      .map((line) => line.label)
      .filter((label): label is string => label !== undefined)
    expect(labels).toEqual(["[0] = ", "[1] = ", "[2] = "])

    // 标注只是视觉辅助，不在 token 里，行文本仍与原文逐字一致。
    expect(lines.map(lineText).join("\n")).toBe(source)
  })

  it("标量数组元素不插下标标注", () => {
    const lines = buildJsonViewLines(tree, noFolds)
    // `"d": [true, null]` 的两个元素。
    expect(lines[6].label).toBeUndefined()
    expect(lines[7].label).toBeUndefined()
  })

  it("折叠对象后隐藏子行，行号原样跳过", () => {
    const source = text.split("\n")
    const b = tree.children[1]
    const lines = buildJsonViewLines(tree, new Set([b.path]))

    expect(lines.map(lineText)).toEqual([
      source[0],
      source[1],
      '  "b": { … } 1 个字段,',
      source[5],
      source[6],
      source[7],
      source[8],
      source[9],
    ])
    expect(lines.map((line) => line.line)).toEqual([1, 2, 3, 6, 7, 8, 9, 10])
    expect(lines[2].fold).toMatchObject({
      path: b.path,
      collapsed: true,
      kind: "object",
      childCount: 1,
      lineCount: 3,
    })
  })

  it("折叠数组用「项」概括", () => {
    const d = tree.children[2]
    const lines = buildJsonViewLines(tree, new Set([d.path]))
    expect(lineText(lines[5])).toBe('  "d": [ … ] 2 项')
  })

  it("折叠根节点只剩一行摘要", () => {
    const lines = buildJsonViewLines(tree, new Set([tree.path]))
    expect(lines).toHaveLength(1)
    expect(lines[0].line).toBe(1)
    expect(lineText(lines[0])).toBe("{ … } 3 个字段")
    expect(lines[0].fold?.collapsed).toBe(true)
  })

  it("空对象与空数组没有折叠按钮", () => {
    const lines = [
      ...buildJsonViewLines(treeOf("{}"), noFolds),
      ...buildJsonViewLines(treeOf("[]"), noFolds),
    ]
    expect(lines.every((line) => line.fold === undefined)).toBe(true)
  })
})

describe("collectFoldPaths", () => {
  it("先序收集有子节点的容器路径", () => {
    const tree = treeOf(formatJson({ a: 1, b: { c: 2 }, d: [true, null] }))
    expect(collectFoldPaths(tree)).toEqual(["$", "$/1", "$/2"])
  })
})

describe("selectedLineRange", () => {
  it("合并普通行的起止行号", () => {
    expect(
      selectedLineRange([
        { start: 3, end: 3 },
        { start: 4, end: 4 },
      ])
    ).toEqual({ start: 3, end: 4, crossesFold: false })
  })

  it("折叠行扩展到节点结束行并标记 crossesFold", () => {
    expect(
      selectedLineRange([
        { start: 1, end: 1 },
        { start: 2, end: 5 },
        { start: 6, end: 6 },
      ])
    ).toEqual({ start: 1, end: 6, crossesFold: true })
  })

  it("空数据或非法行号返回 null", () => {
    expect(selectedLineRange([])).toBeNull()
    expect(selectedLineRange([{ start: 0, end: 0 }])).toBeNull()
    expect(selectedLineRange([{ start: 3, end: 2 }])).toBeNull()
    expect(selectedLineRange([{ start: Number.NaN, end: 1 }])).toBeNull()
  })
})

describe("plainJsonViewLines", () => {
  it("非 JSON 文本按普通行返回", () => {
    expect(plainJsonViewLines("undefined")).toEqual([
      { line: 1, tokens: [{ kind: "punctuation", text: "undefined" }] },
    ])
  })

  it("顶层标量仍按类型着色", () => {
    expect(plainJsonViewLines("5")[0].tokens).toEqual([
      { kind: "number", text: "5" },
    ])
  })
})
