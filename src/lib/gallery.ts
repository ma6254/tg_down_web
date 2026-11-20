import type { PreviewMedia } from "@/api/types"

/**
 * 正文卡片里的一张配图。
 *
 * urls 为空表示 Telegram 没给封面（例如机器人上传的大视频），
 * 页面要画占位而不是把这一项丢掉，否则相册会少显示。
 */
export interface GalleryImage {
  key: string
  /** 候选地址：大图优先，失败退到封面；空数组表示没有可用封面。 */
  urls: string[]
  video: boolean
  name: string
  size: number
  mime: string
  /** 视频时长（秒），无封面时用于占位展示。 */
  duration?: number
}

/**
 * 把一条消息的媒体（相册的全部成员，或单条消息的主媒体）转成正文图集。
 *
 * 音频、文档没有画面，不占正文空间；图片和视频始终保留，
 * 没有封面的由调用方渲染占位。
 */
export function mediaGallery(medias: PreviewMedia[]): GalleryImage[] {
  const out: GalleryImage[] = []
  medias.forEach((media, index) => {
    if (media.kind !== "photo" && media.kind !== "video") {
      return
    }
    const urls: string[] = []
    if (media.preview_url) {
      urls.push(media.preview_url)
    }
    if (media.thumbnail_url && media.thumbnail_url !== media.preview_url) {
      urls.push(media.thumbnail_url)
    }
    out.push({
      key: `${media.message_id ?? index}`,
      urls,
      video: media.kind === "video",
      name: media.file_name,
      size: media.size,
      mime: media.mime ?? "image/jpeg",
      duration: media.duration,
    })
  })
  return out
}
