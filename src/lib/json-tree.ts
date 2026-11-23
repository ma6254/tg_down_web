import { splitTokenLines, tokenizeJson, type JsonToken } from "./json"

/** JSON 树节点类型；对象与数组是容器，可折叠。 */
export type JsonTreeNodeKind =
  | "object"
  | "array"
  | "string"
  | "number"
  | "boolean"
  | "null"

/**
 * 由格式化文本反推出来的 JSON 节点。
 *
 * line / lineCount 按「全部展开」的缩进文本计算；折叠时行号仍指向原文，
 * 因此被隐藏的行会让可见行号跳号，与编辑器折叠的直觉一致。
 */
export interface JsonTreeNode {
  /** 结构路径：根为 `$`、第 n 个子节点为 `$/n`；折叠状态用它作键。 */
  path: string
  /** 对象字段名；数组元素与根节点没有。 */
  key?: string
  kind: JsonTreeNodeKind
  /** 起始行号（1 基）。 */
  line: number
  /** 在完整文本里占用的行数。 */
  lineCount: number
  children: JsonTreeNode[]
  /** 标量值的 JSON 文本；容器没有。 */
  scalar?: string
}

/** 一个可折叠节点的状态，挂在对应行的 fold 上。 */
export interface JsonFold {
  path: string
  collapsed: boolean
  kind: "object" | "array"
  childCount: number
  /** 节点在完整文本里的行数；复制跨折叠块的选区时用它展开原文。 */
  lineCount: number
}

/** 查看器的一行：原始行号 + 着色片段 + 可选折叠按钮与下标标注。 */
export interface JsonViewLine {
  line: number
  tokens: JsonToken[]
  fold?: JsonFold
  /** 数组里对象/数组元素前面的下标标注（视觉辅助，不属于 JSON 原文）。 */
  label?: string
}

interface LineCursor {
  line: number
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function scalarKind(value: unknown): JsonTreeNodeKind {
  if (value === null) {
    return "null"
  }
  switch (typeof value) {
    case "string":
      return "string"
    case "number":
      return "number"
    case "boolean":
      return "boolean"
    default:
      return "null"
  }
}

/** JSON 文本（带引号的字符串、数字、布尔、null）；解析自合法 JSON，不会返回 undefined。 */
function jsonText(value: unknown): string {
  return JSON.stringify(value) ?? "null"
}

function buildNode(
  value: unknown,
  key: string | undefined,
  path: string,
  cursor: LineCursor
): JsonTreeNode {
  const line = cursor.line

  if (Array.isArray(value)) {
    if (value.length === 0) {
      cursor.line += 1
      return { path, key, kind: "array", line, lineCount: 1, children: [] }
    }
    // 起止各占一行，子节点在两者之间。
    cursor.line += 1
    const children = value.map((item, index) =>
      buildNode(item, undefined, `${path}/${index}`, cursor)
    )
    cursor.line += 1
    return {
      path,
      key,
      kind: "array",
      line,
      lineCount: cursor.line - line,
      children,
    }
  }

  if (isPlainObject(value)) {
    const entries = Object.entries(value)
    if (entries.length === 0) {
      cursor.line += 1
      return { path, key, kind: "object", line, lineCount: 1, children: [] }
    }
    cursor.line += 1
    const children = entries.map(([childKey, childValue], index) =>
      buildNode(childValue, childKey, `${path}/${index}`, cursor)
    )
    cursor.line += 1
    return {
      path,
      key,
      kind: "object",
      line,
      lineCount: cursor.line - line,
      children,
    }
  }

  cursor.line += 1
  return {
    path,
    key,
    kind: scalarKind(value),
    line,
    lineCount: 1,
    children: [],
    scalar: jsonText(value),
  }
}

/**
 * 从格式化文本构建可折叠的 JSON 树。
 *
 * 顶层是对象/数组时才返回树；顶层标量、无法解析的文本返回 null，
 * 查看器会退回普通逐行展示。
 */
export function buildJsonTree(text: string): JsonTreeNode | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return null
  }
  if (!Array.isArray(parsed) && !isPlainObject(parsed)) {
    return null
  }
  return buildNode(parsed, undefined, "$", { line: 1 })
}

/**
 * 收集所有可折叠节点的路径（先序），供「折叠全部」使用。
 *
 * 空对象/空数组没有子节点，不可折叠；根节点也算一个。
 */
export function collectFoldPaths(tree: JsonTreeNode): string[] {
  const paths: string[] = []
  const walk = (node: JsonTreeNode) => {
    if (
      (node.kind === "object" || node.kind === "array") &&
      node.children.length > 0
    ) {
      paths.push(node.path)
      node.children.forEach(walk)
    }
  }
  walk(tree)
  return paths
}

function punctuation(text: string): JsonToken {
  return { kind: "punctuation", text }
}

/** 容器括号；level 从 1 开始，根容器的内容算第 1 层。 */
function bracket(text: string, level: number): JsonToken {
  return { kind: "bracket", text, level }
}

/**
 * 缩进拆成每层一个 token，查看器可以按层级分别着色。
 *
 * indentWidth 是每层空格数（默认 2）；仍然保留空格本身，保证展开状态下
 * 拼接所有 token 与格式化文本一致。
 */
function indentTokens(depth: number, indentWidth: number): JsonToken[] {
  const tokens: JsonToken[] = []
  const indent = " ".repeat(indentWidth)
  for (let level = 0; level < depth; level += 1) {
    tokens.push({ kind: "indent", text: indent })
  }
  return tokens
}

function keyTokens(key: string | undefined): JsonToken[] {
  if (key === undefined) {
    return []
  }
  return [{ kind: "key", text: jsonText(key) }, punctuation(": ")]
}

function pushNode(
  rows: JsonViewLine[],
  node: JsonTreeNode,
  depth: number,
  isLast: boolean,
  collapsed: ReadonlySet<string>,
  indentWidth: number,
  arrayIndex?: number
): void {
  const prefix = [
    ...indentTokens(depth, indentWidth),
    ...keyTokens(node.key),
  ]
  const comma: JsonToken[] = isLast ? [] : [punctuation(",")]

  if (node.kind === "object" || node.kind === "array") {
    const opening = node.kind === "object" ? "{" : "["
    const closing = node.kind === "object" ? "}" : "]"
    // 括号表示它包裹的内容层级：根容器的括号为第 1 层。
    const bracketLevel = depth + 1
    // 只给数组里的对象/数组元素加下标，便于在长数组里定位。
    const label = arrayIndex === undefined ? undefined : `[${arrayIndex}] = `

    if (node.children.length === 0) {
      rows.push({
        line: node.line,
        label,
        tokens: [...prefix, bracket(opening + closing, bracketLevel), ...comma],
      })
      return
    }

    const isCollapsed = collapsed.has(node.path)
    const fold: JsonFold = {
      path: node.path,
      collapsed: isCollapsed,
      kind: node.kind,
      childCount: node.children.length,
      lineCount: node.lineCount,
    }

    if (isCollapsed) {
      const summary =
        node.kind === "object"
          ? `${node.children.length} 个字段`
          : `${node.children.length} 项`
      rows.push({
        line: node.line,
        fold,
        label,
        tokens: [
          ...prefix,
          bracket(opening, bracketLevel),
          { kind: "summary", text: " … " },
          bracket(closing, bracketLevel),
          { kind: "summary", text: ` ${summary}` },
          ...comma,
        ],
      })
      return
    }

    rows.push({
      line: node.line,
      fold,
      label,
      tokens: [...prefix, bracket(opening, bracketLevel)],
    })
    node.children.forEach((child, index) => {
      pushNode(
        rows,
        child,
        depth + 1,
        index === node.children.length - 1,
        collapsed,
        indentWidth,
        node.kind === "array" ? index : undefined
      )
    })
    rows.push({
      line: node.line + node.lineCount - 1,
      tokens: [
        ...indentTokens(depth, indentWidth),
        bracket(closing, bracketLevel),
        ...comma,
      ],
    })
    return
  }

  rows.push({
    line: node.line,
    tokens: [
      ...prefix,
      { kind: node.kind, text: node.scalar ?? "null" },
      ...comma,
    ],
  })
}

/** 选中行在源码里的行号范围；折叠行用起止行覆盖被隐藏的内容。 */
export interface SelectedLineRange {
  start: number
  end: number
  /** 选中范围内是否包含折叠行（end > start）。 */
  crossesFold: boolean
}

/**
 * 合并选中的可见行，得到源码行范围。
 *
 * 每行是 `{ start, end }`：普通行 end = start；折叠行 end 是节点在源码里的
 * 结束行。任何一行非法时返回 null，让调用方退回浏览器默认复制。
 */
export function selectedLineRange(
  rows: Array<{ start: number; end: number }>
): SelectedLineRange | null {
  if (rows.length === 0) {
    return null
  }
  let start = Number.POSITIVE_INFINITY
  let end = 0
  let crossesFold = false
  for (const row of rows) {
    if (
      !Number.isInteger(row.start) ||
      !Number.isInteger(row.end) ||
      row.start < 1 ||
      row.end < row.start
    ) {
      return null
    }
    if (row.end > row.start) {
      crossesFold = true
    }
    start = Math.min(start, row.start)
    end = Math.max(end, row.end)
  }
  return { start, end, crossesFold }
}

/**
 * 生成查看器的可见行。
 *
 * 折叠只影响渲染：被折叠节点的子行与结束行不出现，行号保留原文中的位置；
 * 折叠行本身用 `{ … } N 个字段` / `[ … ] N 项` 概括。
 * `indentWidth` 必须与生成树时用的格式化缩进宽度一致，默认 2。
 */
export function buildJsonViewLines(
  tree: JsonTreeNode,
  collapsed: ReadonlySet<string>,
  indentWidth = 2
): JsonViewLine[] {
  const rows: JsonViewLine[] = []
  // 根节点没有兄弟，不能带逗号。
  pushNode(rows, tree, 0, true, collapsed, indentWidth)
  return rows
}

/** 顶层不是可折叠结构时的普通逐行展示（行号从 1 开始）。 */
export function plainJsonViewLines(text: string): JsonViewLine[] {
  return splitTokenLines(tokenizeJson(text)).map((tokens, index) => ({
    line: index + 1,
    tokens,
  }))
}
