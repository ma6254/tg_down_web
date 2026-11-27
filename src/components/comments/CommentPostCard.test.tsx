import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import type { PreviewItem, PreviewMedia } from "@/api/types"
import { CommentPostCard } from "./CommentPostCard"

const chat = {
  kind: "channel" as const,
  id: 1,
  title: "示例频道",
  username: "example_channel",
  broadcast: true,
}

function render(item: PreviewItem): string {
  return renderToStaticMarkup(<CommentPostCard item={item} />)
}

function baseItem(overrides: Partial<PreviewItem> = {}): PreviewItem {
  return {
    link: "https://t.me/example/101",
    message_id: 101,
    chat,
    text: "第 3 集已更新。",
    ...overrides,
  }
}

function photo(overrides: Partial<PreviewMedia> = {}): PreviewMedia {
  return {
    kind: "photo",
    file_name: "poster.jpg",
    size: 1024,
    downloadable: true,
    max_size: 2_147_483_648,
    thumbnail_url: "/api/v1/media/thumbnail/aaa",
    link: "https://t.me/example/101",
    ...overrides,
  }
}

describe("CommentPostCard", () => {
  it("显示频道名、用户名与原帖链接", () => {
    const html = render(baseItem())
    expect(html).toContain("示例频道")
    expect(html).toContain("@example_channel")
    expect(html).toContain('href="https://t.me/example/101"')
    expect(html).toContain("原帖")
  })

  it("渲染正文", () => {
    expect(render(baseItem())).toContain("第 3 集已更新。")
  })

  it("没有正文时给出占位", () => {
    const html = render(baseItem({ text: undefined }))
    expect(html).toContain("（该消息没有正文）")
  })

  it("单张照片显示图片而不是信息行", () => {
    const html = render(baseItem({ media: photo({ preview_url: "/big.jpg" }) }))
    expect(html).toContain('src="/big.jpg"')
    expect(html).toContain("查看大图：poster.jpg")
  })

  it("没有可用缩略图时退回文件名", () => {
    const html = render(
      baseItem({
        media: photo({
          kind: "document",
          file_name: "subtitle.ass",
          thumbnail_url: undefined,
        }),
      })
    )
    expect(html).toContain("subtitle.ass")
    expect(html).not.toContain("<img")
  })

  it("相册按格子渲染每张缩略图", () => {
    const html = render(
      baseItem({
        medias: [photo(), photo(), photo({ kind: "video", duration: 30 })],
      })
    )
    expect(html.match(/查看大图/g)?.length).toBe(3)
    expect(html).toContain("0:30")
  })

  it("相册超过 9 张时最后一格标剩余数量", () => {
    const medias = Array.from({ length: 12 }, (_, index) =>
      photo({ message_id: index })
    )
    const html = render(baseItem({ medias }))
    expect(html.match(/查看大图/g)?.length).toBe(9)
    expect(html).toContain("+3")
  })
})
