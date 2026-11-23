import { describe, expect, it } from "vitest"
import type { CommentsResponse, PreviewComment } from "@/api/types"
import {
  commentAuthorName,
  commentButtonLabel,
  commentsTotal,
  flattenComments,
} from "./comments"

function comment(id: number, overrides: Partial<PreviewComment> = {}): PreviewComment {
  return { id, date: 1_700_000_000, ...overrides }
}

function page(comments: PreviewComment[], total = comments.length, next?: number): CommentsResponse {
  return {
    link: "https://t.me/a/1",
    message_id: 1,
    available: true,
    total,
    comments,
    next_offset_id: next,
  }
}

describe("flattenComments", () => {
  it("按页顺序摊平评论", () => {
    const pages = [page([comment(2), comment(1)]), page([comment(0)])]
    expect(flattenComments(pages).map((item) => item.id)).toEqual([2, 1, 0])
  })

  it("空结果返回空数组", () => {
    expect(flattenComments(undefined)).toEqual([])
    expect(flattenComments([])).toEqual([])
    expect(flattenComments([page([])])).toEqual([])
  })
})

describe("commentsTotal", () => {
  it("优先使用第一页的 total", () => {
    expect(commentsTotal([page([comment(1)], 8)])).toBe(8)
  })

  it("没有数据时退回 preview 摘要", () => {
    expect(commentsTotal(undefined, 3)).toBe(3)
    expect(commentsTotal([], 3)).toBe(3)
  })
})

describe("commentButtonLabel", () => {
  it("有评论数时带上数量", () => {
    expect(commentButtonLabel({ available: true, count: 2 })).toBe("评论（2）")
  })

  it("0 条或缺失时只显示评论", () => {
    expect(commentButtonLabel({ available: true, count: 0 })).toBe("评论")
    expect(commentButtonLabel(undefined)).toBe("评论")
  })
})

describe("commentAuthorName", () => {
  it("优先使用 sender.name", () => {
    expect(
      commentAuthorName(comment(1, { sender: { id: 1, name: " Alice " } }))
    ).toBe("Alice")
  })

  it("匿名评论显示匿名", () => {
    expect(commentAuthorName(comment(1))).toBe("匿名")
    expect(
      commentAuthorName(comment(1, { sender: { id: 1, name: "   " } }))
    ).toBe("匿名")
  })
})
