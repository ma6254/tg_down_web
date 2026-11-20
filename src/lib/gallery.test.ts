import { describe, expect, it } from "vitest"
import type { PreviewMedia } from "@/api/types"
import { mediaGallery } from "./gallery"

const base = {
  size: 100,
  downloadable: true,
  max_size: 2 * 1024 ** 3,
}

function photo(overrides: Partial<PreviewMedia> = {}): PreviewMedia {
  return {
    kind: "photo",
    file_name: "a.jpg",
    message_id: 1,
    thumbnail_url: "/thumb/a",
    preview_url: "/preview/a",
    mime: "image/jpeg",
    ...base,
    ...overrides,
  }
}

function video(overrides: Partial<PreviewMedia> = {}): PreviewMedia {
  return {
    kind: "video",
    file_name: "b.mp4",
    message_id: 2,
    mime: "video/mp4",
    duration: 462,
    ...base,
    ...overrides,
  }
}

describe("mediaGallery", () => {
  it("视频没有封面时仍然保留，交给页面画占位", () => {
    const gallery = mediaGallery([photo(), video()])
    expect(gallery).toHaveLength(2)
    expect(gallery[0]).toMatchObject({
      video: false,
      urls: ["/preview/a", "/thumb/a"],
    })
    expect(gallery[1]).toMatchObject({
      video: true,
      urls: [],
      duration: 462,
      name: "b.mp4",
    })
  })

  it("大图优先，缩略图作为降级；两者相同时去重", () => {
    const gallery = mediaGallery([
      photo({ preview_url: "/same", thumbnail_url: "/same" }),
    ])
    expect(gallery[0].urls).toEqual(["/same"])
  })

  it("只有缩略图时也能展示", () => {
    const gallery = mediaGallery([video({ thumbnail_url: "/thumb/b" })])
    expect(gallery[0].urls).toEqual(["/thumb/b"])
  })

  it("音频与文档不占正文", () => {
    const gallery = mediaGallery([
      photo(),
      { ...video(), kind: "audio", file_name: "c.mp3" },
      { ...video(), kind: "document", file_name: "d.pdf" },
    ])
    expect(gallery.map((item) => item.name)).toEqual(["a.jpg"])
  })

  it("key 用消息 ID，缺省时退回下标", () => {
    const gallery = mediaGallery([
      photo({ message_id: undefined }),
      video({ message_id: 9 }),
    ])
    expect(gallery.map((item) => item.key)).toEqual(["0", "9"])
  })
})
