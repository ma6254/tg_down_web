import { formatDateTime } from "@/lib/format"
import type {
  DownloadCache,
  DownloadCacheChat,
  DownloadCacheItem,
  DownloadCacheSummary,
  DownloadHistoryEntry,
  MediaKind,
  PreviewResponse,
} from "@/api/types"

/** 与服务端一致的裁剪上限：items ≤ 20、chats ≤ 5、failures ≤ 5、文本 200 字。 */
export const DRAFT_CACHE_LIMITS = {
  items: 20,
  chats: 5,
  failures: 5,
  text: 200,
} as const

/** 按字符（不是 UTF-16 码元）截断，避免把 emoji 切成半个。 */
function truncate(value: string | undefined, limit: number): string {
  const text = (value ?? "").trim()
  if (!text) {
    return ""
  }
  const chars = Array.from(text)
  return chars.length <= limit ? text : chars.slice(0, limit).join("")
}

/**
 * 从预览响应裁剪出一份草稿/历史摘要。
 *
 * 只保留展示需要的字段：计数、会话、消息正文前 200 字与主媒体信息；
 * 缩略图地址、entities、file_id 等会过期或敏感的内容不会进入缓存。
 * 服务端还会再按同一套白名单裁剪一次。
 */
export function draftCacheFromPreview(data: PreviewResponse): DownloadCache {
  const chats: DownloadCacheChat[] = []
  const seenChats = new Set<string>()
  for (const item of data.items) {
    if (chats.length >= DRAFT_CACHE_LIMITS.chats) {
      break
    }
    const chat = item.chat
    if (!chat) {
      continue
    }
    const key = `${chat.kind}:${chat.id}`
    if (seenChats.has(key)) {
      continue
    }
    seenChats.add(key)
    chats.push({
      kind: chat.kind,
      title: truncate(chat.title, DRAFT_CACHE_LIMITS.text),
      ...(chat.username ? { username: truncate(chat.username, 64) } : {}),
    })
  }

  const items: DownloadCacheItem[] = []
  for (const item of data.items) {
    if (item.error) {
      continue
    }
    if (items.length >= DRAFT_CACHE_LIMITS.items) {
      break
    }
    const media = item.media ?? item.medias?.[0]
    items.push({
      message_id: item.message_id,
      chat_title: truncate(item.chat?.title, DRAFT_CACHE_LIMITS.text),
      text: truncate(item.text, DRAFT_CACHE_LIMITS.text),
      media_kind: media?.kind,
      file_name: truncate(media?.file_name, 255),
      size: media?.size,
      thumb_key: media?.thumb_key,
    })
  }

  const failures = data.items
    .filter((item) => item.error)
    .slice(0, DRAFT_CACHE_LIMITS.failures)
    .map((item) => ({
      link: truncate(item.link, DRAFT_CACHE_LIMITS.text),
      error: truncate(item.error, DRAFT_CACHE_LIMITS.text),
    }))

  return {
    v: 1,
    summary: {
      total: data.summary.total,
      ok: data.summary.ok,
      failed: data.summary.failed,
      no_media: data.summary.no_media,
      expanded: data.summary.expanded,
    },
    chats,
    items,
    failures,
  }
}

/** 摘要卡的一句话说明，例如「3 条消息 · 2 个视频 · 某频道」；没有内容时返回空串。 */
export function formatCacheSummary(cache?: DownloadCache | null): string {
  return summarize(cache?.summary, cache?.chats, cache?.items)
}

/** 历史列表行的一句话摘要（列表没有缓存条目，只统计消息数与会话）。 */
export function formatHistorySummary(
  entry: Pick<DownloadHistoryEntry, "summary" | "chats">
): string {
  return summarize(entry.summary, entry.chats)
}

function summarize(
  summary?: DownloadCacheSummary,
  chats?: DownloadCacheChat[],
  items?: DownloadCacheItem[]
): string {
  if (!summary || summary.total <= 0) {
    return ""
  }

  const parts = [`${summary.total} 条消息`]
  if (items && items.length > 0) {
    const counts = new Map<MediaKind, number>()
    for (const item of items) {
      if (!item.media_kind) {
        continue
      }
      counts.set(item.media_kind, (counts.get(item.media_kind) ?? 0) + 1)
    }
    const videos = counts.get("video") ?? 0
    const photos = counts.get("photo") ?? 0
    const files = (counts.get("audio") ?? 0) + (counts.get("document") ?? 0)
    if (videos > 0) {
      parts.push(`${videos} 个视频`)
    } else if (photos > 0) {
      parts.push(`${photos} 张图片`)
    }
    if (files > 0) {
      parts.push(`${files} 个文件`)
    }
  }

  const titles = (chats ?? []).map((chat) => chat.title).filter(Boolean)
  if (titles.length === 1) {
    parts.push(titles[0])
  } else if (titles.length > 1) {
    parts.push(`${titles[0]} 等 ${titles.length} 个会话`)
  }
  return parts.join(" · ")
}

/**
 * 相对时间：`刚刚` / `5 分钟前` / `3 小时前` / `2 天前`；
 * 超过一周退回 `YYYY-MM-DD HH:mm`。
 */
export function formatRelativeTime(
  unixSeconds?: number,
  now: number = Date.now()
): string {
  if (!unixSeconds || unixSeconds <= 0) {
    return "—"
  }
  const diff = Math.max(0, now - unixSeconds * 1000)
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour
  if (diff < minute) {
    return "刚刚"
  }
  if (diff < hour) {
    return `${Math.floor(diff / minute)} 分钟前`
  }
  if (diff < day) {
    return `${Math.floor(diff / hour)} 小时前`
  }
  if (diff < 7 * day) {
    return `${Math.floor(diff / day)} 天前`
  }
  return formatDateTime(unixSeconds)
}
