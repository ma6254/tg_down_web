import { describe, expect, it } from "vitest"
import type {
  DownloadCache,
  DownloadHistoryEntry,
  PreviewItem,
  PreviewMedia,
  PreviewResponse,
} from "@/api/types"
import {
  draftCacheFromPreview,
  formatCacheSummary,
  formatHistorySummary,
  formatRelativeTime,
} from "./draft"

function media(patch: Partial<PreviewMedia> = {}): PreviewMedia {
  return {
    kind: "video",
    file_name: "clip.mp4",
    size: 1024,
    downloadable: true,
    max_size: 2 * 1024 ** 3,
    ...patch,
  }
}

function item(patch: Partial<PreviewItem> = {}): PreviewItem {
  return {
    link: "https://t.me/a/1",
    message_id: 1,
    chat: { kind: "channel", id: 1, title: "某频道" },
    text: "正文",
    media: media(),
    ...patch,
  }
}

function response(items: PreviewItem[], summary: Partial<PreviewResponse["summary"]> = {}): PreviewResponse {
  return {
    items,
    summary: {
      total: items.length,
      ok: items.filter((entry) => !entry.error).length,
      failed: items.filter((entry) => entry.error).length,
      expanded: 0,
      no_media: items.filter((entry) => !entry.error && !entry.media).length,
      ...summary,
    },
  }
}

describe("draftCacheFromPreview", () => {
  it("按白名单生成摘要并去重会话", () => {
    const longText = "长".repeat(300)
    const cache = draftCacheFromPreview(
      response(
        [
          item({ message_id: 1, text: longText }),
          item({
            link: "https://t.me/a/2",
            message_id: 2,
            media: media({
              kind: "photo",
              file_name: "cover.jpg",
              size: 2048,
              thumb_key: "a".repeat(64),
            }),
          }),
          item({
            link: "https://t.me/b/3",
            message_id: 3,
            chat: { kind: "group", id: 2, title: "某群" },
            media: undefined,
            text: "",
          }),
          item({
            link: "https://t.me/a/4",
            message_id: 4,
            error: "消息不存在",
          }),
        ],
        { total: 4, ok: 3, failed: 1, no_media: 1 }
      )
    )

    expect(cache.v).toBe(1)
    expect(cache.summary).toEqual({
      total: 4,
      ok: 3,
      failed: 1,
      no_media: 1,
      expanded: 0,
    })
    expect(cache.chats).toHaveLength(2)
    expect(cache.chats?.[0]).toMatchObject({ kind: "channel", title: "某频道" })
    expect(cache.items).toHaveLength(3)
    expect(cache.items?.[0].text).toHaveLength(200)
    expect(cache.items?.[1]).toMatchObject({
      media_kind: "photo",
      file_name: "cover.jpg",
      size: 2048,
      thumb_key: "a".repeat(64),
    })
    expect(cache.failures).toEqual([
      { link: "https://t.me/a/4", error: "消息不存在" },
    ])
  })

  it("裁剪到服务端上限", () => {
    const items: PreviewItem[] = []
    for (let i = 0; i < 25; i += 1) {
      items.push(
        item({
          link: `https://t.me/a/${i}`,
          message_id: i,
          chat: { kind: "channel", id: i, title: `频道 ${i}` },
        })
      )
    }
    for (let i = 0; i < 8; i += 1) {
      items.push(item({ link: `https://t.me/e/${i}`, error: `失败 ${i}` }))
    }

    const cache = draftCacheFromPreview(response(items, { failed: 8 }))
    expect(cache.items).toHaveLength(20)
    expect(cache.chats).toHaveLength(5)
    expect(cache.failures).toHaveLength(5)
  })

  it("没有会话或媒体时字段保持为空数组", () => {
    const cache = draftCacheFromPreview(response([{ link: "https://t.me/x/1", text: "hi" }]))
    expect(cache.chats).toEqual([])
    expect(cache.items?.[0]).toMatchObject({ message_id: undefined })
    expect(cache.items?.[0].media_kind).toBeUndefined()
    expect(cache.failures).toEqual([])
  })
})

function cache(patch: Partial<DownloadCache> = {}): DownloadCache {
  return {
    v: 1,
    summary: { total: 3, ok: 3, failed: 0, no_media: 0, expanded: 0 },
    chats: [{ kind: "channel", title: "某频道" }],
    items: [
      { media_kind: "video" },
      { media_kind: "video" },
      { media_kind: "photo" },
    ],
    ...patch,
  }
}

describe("formatCacheSummary", () => {
  it("拼接消息数、媒体与会话", () => {
    expect(formatCacheSummary(cache())).toBe("3 条消息 · 2 个视频 · 某频道")
  })

  it("多个会话时显示「等 N 个会话」", () => {
    expect(
      formatCacheSummary(
        cache({
          chats: [
            { kind: "channel", title: "频道 A" },
            { kind: "group", title: "群 B" },
          ],
        })
      )
    ).toBe("3 条消息 · 2 个视频 · 频道 A 等 2 个会话")
  })

  it("没有摘要或总数为 0 时返回空串", () => {
    expect(formatCacheSummary(null)).toBe("")
    expect(formatCacheSummary(cache({ summary: { total: 0, ok: 0, failed: 0, no_media: 0, expanded: 0 } }))).toBe("")
  })
})

function historyEntry(patch: Partial<DownloadHistoryEntry> = {}): DownloadHistoryEntry {
  return {
    id: 1,
    first_line: "https://t.me/a/1",
    line_count: 2,
    expand_text_links: false,
    overwrite: false,
    use_count: 1,
    cache_truncated: false,
    created_at: 1,
    last_used_at: 2,
    ...patch,
  }
}

describe("formatHistorySummary", () => {
  it("列表没有缓存条目时只显示消息数与会话", () => {
    expect(
      formatHistorySummary(
        historyEntry({
          summary: { total: 5, ok: 4, failed: 1, no_media: 1, expanded: 0 },
          chats: [{ kind: "channel", title: "频道 A" }],
        })
      )
    ).toBe("5 条消息 · 频道 A")
  })

  it("缺少摘要时返回空串", () => {
    expect(formatHistorySummary(historyEntry())).toBe("")
  })
})

describe("formatRelativeTime", () => {
  const now = 1_763_500_000_000

  it("按间隔输出相对时间", () => {
    expect(formatRelativeTime(now / 1000 - 30, now)).toBe("刚刚")
    expect(formatRelativeTime(now / 1000 - 5 * 60, now)).toBe("5 分钟前")
    expect(formatRelativeTime(now / 1000 - 3 * 3600, now)).toBe("3 小时前")
    expect(formatRelativeTime(now / 1000 - 2 * 86400, now)).toBe("2 天前")
  })

  it("超过一周退回日期时间", () => {
    expect(formatRelativeTime(now / 1000 - 8 * 86400, now)).toMatch(
      /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/
    )
  })

  it("无效值返回占位", () => {
    expect(formatRelativeTime(undefined, now)).toBe("—")
    expect(formatRelativeTime(0, now)).toBe("—")
  })
})
