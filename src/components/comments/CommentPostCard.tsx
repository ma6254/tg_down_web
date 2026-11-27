import { useLayoutEffect, useMemo, useRef, useState } from "react"
import { FileIcon, FileVideoIcon, ImageIcon, PlayIcon } from "lucide-react"
import type { PreviewItem, PreviewMedia } from "@/api/types"
import { PeerAvatar } from "@/components/common/PeerAvatar"
import { PicViewerDialog } from "@/components/PicViewer"
import { PicViewerMobileDialog } from "@/components/PicViewerMobile"
import { MessageText } from "@/components/messages/MessageText"
import { chatName } from "@/lib/chat"
import { isMobileDevice } from "@/lib/device"
import { mediaGallery } from "@/lib/gallery"
import { mediaKindLabel } from "@/lib/download"
import { formatBytes, formatDuration } from "@/lib/format"
import { cn } from "@/lib/utils"

/**
 * 评论区正文卡片：弹窗里先看到「在评论哪条消息」。
 *
 * 内容直接复用下载页的解析结果（正文、实体、媒体、相册、发送者），不额外请求；
 * 长正文默认折叠到 6 行，需要时展开。图片/视频显示缩略图预览，文档类保留信息行。
 */
export function CommentPostCard({
  item,
  className,
}: {
  item: PreviewItem
  className?: string
}) {
  const [expanded, setExpanded] = useState(false)
  // 正文是否真的被 6 行裁掉了：按实际高度判断，避免短正文也出现「展开全文」。
  const textRef = useRef<HTMLDivElement | null>(null)
  const [clipped, setClipped] = useState(false)
  useLayoutEffect(() => {
    const el = textRef.current
    if (!el || expanded) {
      return
    }
    setClipped(el.scrollHeight > el.clientHeight + 1)
  }, [item.text, expanded])

  const chat = chatName(item.chat)
  const albumCount = item.medias?.length ?? 0
  const media = item.media

  // 图集顺序与 mediaGallery 一致：只有图片/视频进查看器，文档不参与翻页。
  const medias = albumCount > 0 ? (item.medias ?? []) : media ? [media] : []
  const gallery = mediaGallery(medias)
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)
  const isMobile = useMemo(() => isMobileDevice(), [])
  const viewerImage = viewerIndex === null ? null : gallery[viewerIndex]

  return (
    <>
    <section
      className={cn(
        "overflow-hidden rounded-xl border bg-card",
        className
      )}
      aria-label="原帖正文"
    >
      <div className="flex items-center gap-2.5 border-b bg-muted/20 px-3 py-2">
        <PeerAvatar
          name={chat}
          src={item.chat?.avatar_url}
          className="size-7 text-[10px]"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium">{chat}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {[item.sender?.name, item.chat?.username ? `@${item.chat.username}` : ""]
              .filter(Boolean)
              .join(" · ") || "原帖"}
          </p>
        </div>
        <a
          href={item.link}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 text-[11px] text-muted-foreground hover:text-foreground hover:underline"
        >
          原帖 ↗
        </a>
      </div>

      <div className="space-y-2 px-3 py-2.5">
        {item.text ? (
          <div ref={textRef} className={cn(!expanded && "line-clamp-6")}>
            <MessageText text={item.text} entities={item.entities} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">（该消息没有正文）</p>
        )}

        {clipped || expanded ? (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            {expanded ? "收起" : "展开全文"}
          </button>
        ) : null}

        {albumCount > 1 ? (
          <PostAlbum medias={item.medias ?? []} onOpen={setViewerIndex} />
        ) : media ? (
          <PostMedia media={media} onOpen={() => setViewerIndex(0)} />
        ) : null}
      </div>
    </section>

    {viewerImage ? (
      isMobile ? (
        <PicViewerMobileDialog
          open
          onOpenChange={(next) => {
            if (!next) {
              setViewerIndex(null)
            }
          }}
          src={viewerImage.urls[0]}
          alt={viewerImage.name}
          title={viewerImage.name}
          filePath={viewerImage.name}
          size={viewerImage.size}
          blobType={viewerImage.mime}
          hasPrev={viewerIndex !== null && viewerIndex > 0}
          hasNext={viewerIndex !== null && viewerIndex < gallery.length - 1}
          onPrev={() =>
            setViewerIndex((current) =>
              current === null ? 0 : Math.max(0, current - 1)
            )
          }
          onNext={() =>
            setViewerIndex((current) =>
              current === null ? 0 : Math.min(gallery.length - 1, current + 1)
            )
          }
        />
      ) : (
        <PicViewerDialog
          open
          onOpenChange={(next) => {
            if (!next) {
              setViewerIndex(null)
            }
          }}
          src={viewerImage.urls[0]}
          alt={viewerImage.name}
          filePath={viewerImage.name}
          blobSize={viewerImage.size}
          blobType={viewerImage.mime}
          hasPrev={viewerIndex !== null && viewerIndex > 0}
          hasNext={viewerIndex !== null && viewerIndex < gallery.length - 1}
          onPrev={() =>
            setViewerIndex((current) =>
              current === null ? 0 : Math.max(0, current - 1)
            )
          }
          onNext={() =>
            setViewerIndex((current) =>
              current === null ? 0 : Math.min(gallery.length - 1, current + 1)
            )
          }
        />
      )
    ) : null}
    </>
  )
}

/**
 * 原帖媒体：图片与视频直接显示预览，文档类保留信息行。
 *
 * 图片地址是 30 分钟有效的缩略图 token，点开在新标签页看原图；
 * 加载失败时退回信息行，不留破图。
 */
function PostMedia({
  media,
  onOpen,
}: {
  media: PreviewMedia
  onOpen?: () => void
}) {
  const [failed, setFailed] = useState(false)
  const src = media.preview_url || media.thumbnail_url
  const isVideo = media.kind === "video"

  if (!src || failed || (media.kind !== "photo" && !isVideo)) {
    return <MediaInfoRow media={media} />
  }

  return (
    <button
      type="button"
      onClick={() => onOpen?.()}
      className="group relative block w-fit max-w-full cursor-zoom-in overflow-hidden rounded-lg border bg-muted text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      aria-label={`查看大图：${media.file_name}`}
    >
      <img
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className="max-h-72 w-auto max-w-full object-contain transition-transform duration-200 group-hover:scale-[1.01]"
      />
      {isVideo ? (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/15">
          <span className="flex size-9 items-center justify-center rounded-full bg-black/60 text-white">
            <PlayIcon className="size-4" />
          </span>
        </span>
      ) : null}
      {media.duration ? (
        <span className="pointer-events-none absolute right-1.5 bottom-1.5 rounded bg-black/70 px-1 py-px text-[10px] font-medium text-white tabular-nums">
          {formatDuration(media.duration)}
        </span>
      ) : null}
    </button>
  )
}

/** 相册：按九宫格展示缩略图，超出 9 张在最后一格标 +N。 */
function PostAlbum({
  medias,
  onOpen,
}: {
  medias: PreviewMedia[]
  onOpen?: (index: number) => void
}) {
  const shown = medias.slice(0, 9)
  const rest = medias.length - shown.length

  // 与 mediaGallery 对齐：文档不参与查看器，所以只给图片/视频编号。
  const galleryIndexes: number[] = []
  let cursor = 0
  for (const item of medias) {
    const visual = item.kind === "photo" || item.kind === "video"
    galleryIndexes.push(visual ? cursor++ : -1)
  }

  return (
    <div
      className={cn(
        "grid gap-1.5",
        shown.length === 2 ? "grid-cols-2" : "grid-cols-3"
      )}
    >
      {shown.map((media, index) => (
        <AlbumTile
          key={`${media.message_id ?? "m"}-${index}`}
          media={media}
          extra={index === shown.length - 1 ? rest : 0}
          galleryIndex={galleryIndexes[index] ?? -1}
          onOpen={(target) => onOpen?.(target)}
        />
      ))}
    </div>
  )
}

function AlbumTile({
  media,
  extra,
  galleryIndex,
  onOpen,
}: {
  media: PreviewMedia
  extra: number
  galleryIndex: number
  onOpen: (index: number) => void
}) {
  const [failed, setFailed] = useState(false)
  const src = media.thumbnail_url || media.preview_url
  const isVideo = media.kind === "video"

  if (!src || failed) {
    return (
      <span className="flex aspect-square items-center justify-center rounded-lg border bg-muted text-muted-foreground">
        <MediaGlyph kind={media.kind} />
      </span>
    )
  }

  const overlays = (
    <>
      {isVideo ? (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/15">
          <span className="flex size-7 items-center justify-center rounded-full bg-black/60 text-white">
            <PlayIcon className="size-3.5" />
          </span>
        </span>
      ) : null}
      {media.duration ? (
        <span className="pointer-events-none absolute right-1 bottom-1 rounded bg-black/70 px-1 text-[10px] font-medium text-white tabular-nums">
          {formatDuration(media.duration)}
        </span>
      ) : null}
      {extra > 0 ? (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/60 text-sm font-medium text-white">
          +{extra}
        </span>
      ) : null}
    </>
  )

  const thumb = (
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className="size-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
    />
  )

  if (galleryIndex < 0) {
    return (
      <span className="relative block aspect-square overflow-hidden rounded-lg border bg-muted">
        {thumb}
        {overlays}
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={() => onOpen(galleryIndex)}
      className="group relative block aspect-square cursor-zoom-in overflow-hidden rounded-lg border bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      aria-label={`查看大图：${media.file_name}`}
    >
      {thumb}
      {overlays}
    </button>
  )
}

/** 文档类媒体：小缩略图（有就显示）+ 文件名与规格。 */
function MediaInfoRow({ media }: { media: PreviewMedia }) {
  const [failed, setFailed] = useState(false)
  return (
    <div className="flex items-center gap-2.5 rounded-lg border bg-muted/20 p-1.5">
      <span className="relative size-10 shrink-0 overflow-hidden rounded-md bg-muted">
        {media.thumbnail_url && !failed ? (
          <img
            src={media.thumbnail_url}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setFailed(true)}
            className="size-full object-cover"
          />
        ) : (
          <span className="flex size-full items-center justify-center text-muted-foreground">
            <MediaGlyph kind={media.kind} />
          </span>
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium">{media.file_name}</p>
        <p className="truncate text-[11px] text-muted-foreground">
          {mediaKindLabel(media.kind)} · {formatBytes(media.size)}
        </p>
      </div>
    </div>
  )
}

/** 按媒体类型选图标。 */
function MediaGlyph({
  kind,
  className,
}: {
  kind: PreviewMedia["kind"]
  className?: string
}) {
  const Icon =
    kind === "photo" ? ImageIcon : kind === "video" ? FileVideoIcon : FileIcon
  return <Icon className={cn("size-4", className)} />
}
