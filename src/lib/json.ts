/**
 * JSON 查看器用到的纯函数：序列化与语法着色切片。
 *
 * 放在 lib 里便于用 Node 环境单测；组件只负责渲染与交互。
 */

/** 着色片段类型：键、字符串、数字、布尔、null、标点、括号、折叠摘要与缩进。 */
export type JsonTokenKind =
  | "key"
  | "string"
  | "number"
  | "boolean"
  | "null"
  | "punctuation"
  /** 对象/数组的括号；按 level 取缩进层级颜色。 */
  | "bracket"
  /** 折叠节点的摘要（`… 5 个字段`），不是 JSON 原文的一部分。 */
  | "summary"
  /** 每层一个的缩进 token，查看器按层级着色。 */
  | "indent"

export interface JsonToken {
  kind: JsonTokenKind
  text: string
  /** 仅 bracket：容器嵌套层级（1 基），查看器据此选择颜色。 */
  level?: number
}

/**
 * 匹配 JSON 文本里的值：带引号的字符串（后面紧跟冒号则是键）、
 * 数字、布尔与 null。字符串分支同时吃掉转义序列，避免在 `\"` 处截断。
 */
const JSON_VALUE_RE =
  /("(?:\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*")([ \t]*:)?|\b(?:true|false)\b|\bnull\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g

/**
 * 把任意数据格式化成便于阅读的 JSON 文本。
 *
 * `indent` 是每层缩进的空格数，默认 2；必须为正数，否则输出会挤成一行，
 * 基于行号的折叠展示将失去意义。字符串本身是对象/数组形式的 JSON 时重新
 * 缩进，否则原样展示；undefined、BigInt、循环引用等无法序列化的值用
 * `String()` 兜底，保证查看器不会出现整块空白。
 */
export function formatJson(value: unknown, indent = 2): string {
  const spaces = Number.isFinite(indent) && indent > 0 ? Math.floor(indent) : 2

  if (typeof value === "string") {
    const trimmed = value.trim()
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        return JSON.stringify(JSON.parse(trimmed), null, spaces)
      } catch {
        // 不是合法 JSON，按普通文本展示。
      }
    }
    return value
  }

  try {
    return JSON.stringify(value, null, spaces) ?? String(value)
  } catch {
    return String(value)
  }
}

/**
 * 按 JSON 语法把文本切成片段，供查看器着色。
 *
 * 只扫描「值」token，token 之间的内容（括号、逗号、冒号、空白）统一归为标点，
 * 因此这些字符不会丢失：拼接所有片段与输入完全一致。
 */
export function tokenizeJson(text: string): JsonToken[] {
  const tokens: JsonToken[] = []
  let cursor = 0

  for (const match of text.matchAll(JSON_VALUE_RE)) {
    const index = match.index ?? 0
    if (index > cursor) {
      tokens.push({ kind: "punctuation", text: text.slice(cursor, index) })
    }

    const raw = match[0]
    const quoted = match[1]
    const colon = match[2]
    if (quoted && colon) {
      // 后面紧跟冒号的字符串是键；缩进空白与冒号单独作为标点，
      // 保持配色只作用于键本身。
      tokens.push({ kind: "key", text: quoted })
      const suffix = raw.slice(quoted.length)
      if (suffix) {
        tokens.push({ kind: "punctuation", text: suffix })
      }
    } else if (quoted) {
      tokens.push({ kind: "string", text: quoted })
    } else if (raw === "true" || raw === "false") {
      tokens.push({ kind: "boolean", text: raw })
    } else if (raw === "null") {
      tokens.push({ kind: "null", text: raw })
    } else {
      tokens.push({ kind: "number", text: raw })
    }

    cursor = index + raw.length
  }

  if (cursor < text.length) {
    tokens.push({ kind: "punctuation", text: text.slice(cursor) })
  }
  return tokens
}

/**
 * 按逻辑行切分着色片段，供带行号的查看器逐行渲染。
 *
 * token 内部也可能带换行（例如标点片段 `}, {\n  `），所以先把每个 token
 * 按换行拆开；返回数组的长度就是行数，行内片段拼接后与原文逐行一致。
 */
export function splitTokenLines(tokens: JsonToken[]): JsonToken[][] {
  const lines: JsonToken[][] = [[]]
  for (const token of tokens) {
    const parts = token.text.split("\n")
    for (let index = 0; index < parts.length; index += 1) {
      if (index > 0) {
        lines.push([])
      }
      const text = parts[index]
      if (text) {
        lines[lines.length - 1].push({ kind: token.kind, text })
      }
    }
  }
  return lines
}
