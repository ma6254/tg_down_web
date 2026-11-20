import type { PreviewEntity } from "@/api/types"

/**
 * 一段正文：文本 + 同时覆盖这段文字的实体。
 *
 * offset/length 以 UTF-16 码元计，与 Telegram 原始实体一致，
 * 因此可以直接用 JS 字符串下标切片，不需要额外换算。
 */
export interface RichSegment {
  text: string
  /** 覆盖本段的所有实体，已按「外层先、内层后」排序。 */
  entities: PreviewEntity[]
}

/**
 * 渲染顺序：外层实体排在前面，内层实体排在后面。
 *
 * 块级实体（pre / blockquote）必须最外层，否则样式会互相打架；
 * 未知类型统一排到最后，按普通文字渲染即可。
 */
const ENTITY_ORDER = [
  "pre",
  "blockquote",
  "bold",
  "italic",
  "underline",
  "strikethrough",
  "spoiler",
  "code",
  "text_link",
  "url",
  "email",
  "phone_number",
  "mention",
  "text_mention",
  "hashtag",
  "cashtag",
  "bot_command",
  "bank_card",
  "ton_address",
  "custom_emoji",
  "media_timestamp",
  "date_time",
  "diff_insert",
  "diff_delete",
  "diff_replace",
]

const ORDER_INDEX = new Map(ENTITY_ORDER.map((type, index) => [type, index]))
const UNKNOWN_ORDER = ENTITY_ORDER.length

function rank(type: string): number {
  return ORDER_INDEX.get(type) ?? UNKNOWN_ORDER
}

/** 实体的唯一标识，用于去重与 spoiler 的展开状态。 */
export function entityKey(entity: PreviewEntity): string {
  return [
    entity.type,
    entity.offset,
    entity.length,
    entity.url ?? "",
    entity.user_id ?? "",
    entity.document_id ?? "",
    entity.language ?? "",
    entity.collapsed ? "1" : "",
    entity.date ?? "",
    entity.date_format ?? "",
  ].join(":")
}

/** 去掉越界、空长度和完全重复的实体，并把跨边界的实体裁剪到正文内。 */
function normalizeEntities(
  text: string,
  entities?: PreviewEntity[] | null
): PreviewEntity[] {
  if (!entities || entities.length === 0) {
    return []
  }

  const seen = new Set<string>()
  const out: PreviewEntity[] = []
  for (const entity of entities) {
    if (!entity || !Number.isFinite(entity.offset) || !Number.isFinite(entity.length)) {
      continue
    }
    if (entity.offset < 0 || entity.length <= 0 || entity.offset >= text.length) {
      continue
    }
    const length = Math.min(entity.length, text.length - entity.offset)
    const clamped =
      entity.offset + entity.length <= text.length ? entity : { ...entity, length }
    const key = entityKey(clamped)
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    out.push(clamped)
  }
  return out
}

function compareEntities(a: PreviewEntity, b: PreviewEntity): number {
  const byRank = rank(a.type) - rank(b.type)
  if (byRank !== 0) {
    return byRank
  }
  // 同类型时跨度大的在外层，保证每次切段结果稳定。
  if (a.length !== b.length) {
    return b.length - a.length
  }
  return a.type.localeCompare(b.type)
}

function sameEntities(a: PreviewEntity[], b: PreviewEntity[]): boolean {
  return a.length === b.length && a.every((entity, index) => entity === b[index])
}

/**
 * 把正文按实体边界切成互不重叠的片段。
 *
 * 做法是收集所有实体的起止点作为切分点，逐段算「覆盖本段的实体」，
 * 再把实体集合相同的相邻片段合并。实体允许任意嵌套与重叠，
 * 不需要假设它们像 HTML 那样严格树状。
 */
export function splitRichText(
  text: string,
  entities?: PreviewEntity[] | null
): RichSegment[] {
  if (text.length === 0) {
    return []
  }

  const valid = normalizeEntities(text, entities)
  if (valid.length === 0) {
    return [{ text, entities: [] }]
  }

  const bounds = new Set<number>([0, text.length])
  for (const entity of valid) {
    bounds.add(entity.offset)
    bounds.add(entity.offset + entity.length)
  }
  const points = [...bounds].sort((a, b) => a - b)

  const segments: RichSegment[] = []
  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i]
    const end = points[i + 1]
    if (end <= start) {
      continue
    }

    const active = valid
      .filter((entity) => entity.offset <= start && entity.offset + entity.length >= end)
      .sort(compareEntities)
    const piece = text.slice(start, end)

    const previous = segments[segments.length - 1]
    if (previous && sameEntities(previous.entities, active)) {
      previous.text += piece
    } else {
      segments.push({ text: piece, entities: active })
    }
  }
  return segments
}

/** 把 date_time 实体渲染成本地化时间；无法解析时返回空串，调用方回退到原文。 */
export function formatEntityDate(entity: PreviewEntity, now: Date = new Date()): string {
  if (!entity.date) {
    return ""
  }
  const date = new Date(entity.date * 1000)
  if (Number.isNaN(date.getTime())) {
    return ""
  }

  switch (entity.date_format) {
    case "relative":
      return formatRelative(date, now)
    case "time":
      return new Intl.DateTimeFormat(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      }).format(date)
    case "time_long":
      return new Intl.DateTimeFormat(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(date)
    case "date":
      return new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
      }).format(date)
    case "date_long":
      return new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      }).format(date)
    case "weekday":
      return new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(date)
    default:
      return ""
  }
}

const RELATIVE_STEPS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
  ["second", 1],
]

function formatRelative(date: Date, now: Date): string {
  const diff = (date.getTime() - now.getTime()) / 1000
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" })
  for (const [unit, seconds] of RELATIVE_STEPS) {
    if (Math.abs(diff) >= seconds || unit === "second") {
      return formatter.format(Math.round(diff / seconds), unit)
    }
  }
  return formatter.format(0, "second")
}
