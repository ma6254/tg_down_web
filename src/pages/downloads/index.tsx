import { useMemo, useState, type FormEvent } from "react"
import type { LucideIcon } from "lucide-react"
import {
  DownloadIcon,
  FileIcon,
  FileVideoIcon,
  ImageIcon,
  Loader2Icon,
  MessageSquareTextIcon,
  SearchIcon,
} from "lucide-react"
import { toast } from "sonner"
import { describeError } from "@/api/client"
import type {
  DownloadTask,
  MediaKind,
  PreviewChat,
  PreviewItem,
  PreviewMedia,
} from "@/api/types"
import { PeerAvatar } from "@/components/common/PeerAvatar"
import { PicViewerDialog } from "@/components/PicViewer"
import { PicViewerMobileDialog } from "@/components/PicViewerMobile"
import { PageHeader } from "@/components/layout/PageHeader"
import { MessageText } from "@/components/messages/MessageText"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useCreateDownloads, useDownloads } from "@/hooks/use-downloads"
import { usePreviewLinks } from "@/hooks/use-preview-links"
import {
  downloadStatusLabel,
  downloadStatusVariant,
  summarizeCreateResult,
} from "@/lib/download"
import { chatTypeLabel, commonChat } from "@/lib/chat"
import { formatBytes, formatDuration } from "@/lib/format"
import { mediaGallery, type GalleryImage } from "@/lib/gallery"
import { isMobileDevice } from "@/lib/device"
import { cn } from "@/lib/utils"
import { DownloadTasks } from "./DownloadTasks"

/**
 * 下载页：链接输入、解析结果预览与任务列表。
 *
 * 解析走 POST /api/v1/links/preview，只读；下载任务由 POST /api/v1/downloads
 * 创建后在后台执行，进度通过 SSE 推送。
 */
export function DownloadsPage() {
  const [links, setLinks] = useState("")
  const [expand, setExpand] = useState(false)
  const [overwrite, setOverwrite] = useState(false)
  const preview = usePreviewLinks()
  // 进度由下方任务面板的 SSE 更新共享缓存，这里只读不轮询。
  const downloads = useDownloads({ poll: false })
  const createDownloads = useCreateDownloads()

  const targets = splitLinks(links)
  const data = preview.data
  const messages =
    data?.items.filter((item) => !item.expanded && !item.error) ?? []
  const failures = data?.items.filter((item) => item.error) ?? []
  const sharedChat = commonChat(messages)

  // 相册会返回多条媒体：把每个 items[].medias 摊平成一行一个媒体。
  const mediaRows = useMemo(() => {
    const rows: Array<{ item: PreviewItem; media: PreviewMedia; link: string }> = []
    for (const item of data?.items ?? []) {
      if (item.error) {
        continue
      }
      const medias = item.medias?.length
        ? item.medias
        : item.media
          ? [item.media]
          : []
      for (const media of medias) {
        rows.push({ item, media, link: media.link ?? item.link })
      }
    }
    return rows
  }, [data])

  // 同一条链接只会有一个任务：用 link 反查，在媒体行上显示状态。
  const tasksByLink = useMemo(() => {
    const map = new Map<string, DownloadTask>()
    for (const task of downloads.data ?? []) {
      map.set(task.link, task)
    }
    return map
  }, [downloads.data])

  /**
   * 提交下载任务。
   *
   * single=true 时后端只下载链接指向的那条消息，不把相册展开成整组，
   * 供媒体列表里的单行按钮使用；「全部下载」与表单提交保持整组语义。
   */
  function enqueue(links: string[], single = false) {
    if (links.length === 0) {
      return
    }
    createDownloads.mutate(
      { links, overwrite, single },
      {
        onSuccess: (result) => {
          const summary = summarizeCreateResult(result)
          if (result.failed?.length) {
            toast.warning(`已提交：${summary}`)
          } else {
            toast.success(`已提交：${summary}`)
          }
        },
        onError: (error) => toast.error(describeError(error)),
      }
    )
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (targets.length === 0) {
      toast.error("请先粘贴至少一条 Telegram 链接")
      return
    }

    preview.mutate(
      { links: targets, expand_text_links: expand },
      {
        onSuccess: (result) => {
          if (result.summary.failed > 0) {
            toast.warning(
              `解析完成：成功 ${result.summary.ok}，失败 ${result.summary.failed}`
            )
          } else {
            toast.success(`已解析 ${result.summary.ok} 条消息`)
          }
        },
        onError: (error) => toast.error(describeError(error)),
      }
    )
  }

  return (
    <>
      <PageHeader
        title="下载"
        description="粘贴 Telegram 链接，解析消息正文与媒体文件。"
      />

      <form
        onSubmit={handleSubmit}
        className="mb-6 rounded-xl border bg-card p-4 sm:p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="download-links">下载链接</Label>
            <span className="text-xs text-muted-foreground">
              {targets.length > 0 ? `${targets.length} 条` : "一行一条"}
            </span>
          </div>
          {links.trim() ? (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="text-muted-foreground"
              onClick={() => {
                setLinks("")
                preview.reset()
              }}
            >
              清空
            </Button>
          ) : null}
        </div>

        <Textarea
          id="download-links"
          value={links}
          onChange={(event) => setLinks(event.target.value)}
          rows={3}
          spellCheck={false}
          placeholder={
            "https://t.me/somechannel/123\nhttps://t.me/somechannel/123?comment=456"
          }
          className="mt-2 min-h-24 font-mono text-xs"
          aria-describedby="download-links-help"
        />

        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <div className="flex items-center gap-2">
              <Switch
                id="expand-text-links"
                checked={expand}
                onCheckedChange={setExpand}
                aria-label="展开正文里的链接"
              />
              <Label
                htmlFor="expand-text-links"
                className="text-xs font-normal text-muted-foreground"
              >
                展开正文里的链接（只展开一层）
              </Label>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="overwrite-files"
                checked={overwrite}
                onCheckedChange={setOverwrite}
                aria-label="覆盖同名文件"
              />
              <Label
                htmlFor="overwrite-files"
                className="text-xs font-normal text-muted-foreground"
                title="同名文件直接替换，不再生成「名称 (1).ext」；会从零重新下载"
              >
                覆盖同名文件
              </Label>
            </div>
          </div>

          <Button
            type="submit"
            size="sm"
            className="w-full sm:w-auto"
            disabled={targets.length === 0 || preview.isPending}
          >
            {preview.isPending ? (
              <Loader2Icon className="animate-spin" />
            ) : (
              <SearchIcon />
            )}
            {preview.isPending ? "解析中…" : "解析预览"}
          </Button>
        </div>

        <p
          id="download-links-help"
          className="mt-3 text-xs leading-relaxed text-muted-foreground"
        >
          支持频道帖子、讨论组评论、私有频道（t.me/c/…）与话题链接；解析只读取消息，
          不会创建下载任务。
        </p>
      </form>

      {preview.isError ? (
        <p
          role="alert"
          className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          解析失败：{describeError(preview.error)}
        </p>
      ) : null}

      {data ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="text-sm font-medium text-foreground">解析结果</span>
            <span>共 {data.summary.total} 条</span>
            <Badge variant="secondary" className="font-normal">
              成功 {data.summary.ok}
            </Badge>
            {data.summary.failed > 0 ? (
              <Badge variant="destructive" className="font-normal">
                失败 {data.summary.failed}
              </Badge>
            ) : null}
            {data.summary.expanded > 0 ? (
              <Badge variant="outline" className="font-normal">
                展开 {data.summary.expanded}
              </Badge>
            ) : null}
            {data.summary.no_media > 0 ? (
              <Badge variant="outline" className="font-normal">
                无媒体 {data.summary.no_media}
              </Badge>
            ) : null}
            {data.summary.skipped_links ? (
              <Badge variant="outline" className="font-normal">
                跳过 {data.summary.skipped_links}
              </Badge>
            ) : null}
            {data.summary.truncated ? (
              <Badge variant="outline" className="font-normal">
                展开已达上限
              </Badge>
            ) : null}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="text-muted-foreground"
            onClick={() => preview.reset()}
          >
            清空结果
          </Button>
        </div>
      ) : null}

      {failures.length > 0 ? (
        <div className="mb-4">
          <FailureList items={failures} />
        </div>
      ) : null}

      <div className="mb-6 grid gap-4 xl:grid-cols-7">
        <Card className="flex h-full flex-col xl:col-span-4">
          <CardHeader className="border-b">
            <CardTitle className="flex min-w-0 items-center gap-2">
              <MessageSquareTextIcon className="size-4 text-muted-foreground" />
              消息正文
              {data ? (
                <Badge variant="secondary" className="font-normal">
                  {messages.length}
                </Badge>
              ) : null}
              {sharedChat ? (
                <span className="flex min-w-0 items-center gap-1.5 text-sm font-normal text-muted-foreground">
                  <PeerAvatar
                    name={chatName(sharedChat)}
                    src={sharedChat.avatar_url}
                    className="size-5 text-[10px]"
                  />
                  <span className="truncate">{chatName(sharedChat)}</span>
                  {chatTypeLabel(sharedChat) ? (
                    <Badge variant="outline" className="shrink-0 font-normal">
                      {chatTypeLabel(sharedChat)}
                    </Badge>
                  ) : null}
                </span>
              ) : null}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex min-h-40 flex-1 flex-col">
            {preview.isPending ? (
              <CardLoading text="正在解析消息…" />
            ) : messages.length > 0 ? (
              <div className="max-h-[28rem] min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
                {messages.map((item, index) => (
                  <MessageBlock
                    key={`${item.link}-${index}`}
                    item={item}
                    showChat={!sharedChat}
                  />
                ))}
              </div>
            ) : (
              <CardHint
                icon={MessageSquareTextIcon}
                text={
                  data
                    ? "没有解析到消息正文。"
                    : "解析链接后，这里显示消息正文与内嵌链接。"
                }
              />
            )}
          </CardContent>
        </Card>

        <Card className="flex h-full flex-col xl:col-span-3">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2">
              <FileVideoIcon className="size-4 text-muted-foreground" />
              媒体文件
              {data ? (
                <Badge variant="secondary" className="font-normal">
                  {mediaRows.length}
                </Badge>
              ) : null}
            </CardTitle>
            <CardAction>
              <Button
                variant="outline"
                size="xs"
                disabled={mediaRows.length === 0 || createDownloads.isPending}
                onClick={() => enqueue(mediaRows.map((row) => row.link))}
                title={
                  mediaRows.length === 0 ? "没有可下载的媒体" : "为全部媒体创建下载任务"
                }
                aria-label="全部下载"
              >
                <DownloadIcon />
                全部下载
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="flex min-h-40 flex-1 flex-col">
            {preview.isPending ? (
              <CardLoading text="正在解析媒体…" />
            ) : mediaRows.length > 0 ? (
              <>
                <ul className="max-h-[28rem] min-h-0 flex-1 overflow-y-auto">
                  {mediaRows.map((row, index) => (
                    <MediaRow
                      key={`${row.link}-${index}`}
                      item={row.item}
                      media={row.media}
                      task={tasksByLink.get(row.link)}
                      busy={createDownloads.isPending}
                      onDownload={() => enqueue([row.link], true)}
                    />
                  ))}
                </ul>
                <p className="mt-3 shrink-0 text-xs text-muted-foreground">
                  下载进度与暂停/重试在下方「下载任务」里查看。
                </p>
              </>
            ) : (
              <CardHint
                icon={FileVideoIcon}
                text={
                  data
                    ? "没有解析到可下载的媒体文件。"
                    : "解析链接后，这里显示每个媒体文件的名称、大小、类型与是否可下载。"
                }
              />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <DownloadTasks />
      </div>
    </>
  )
}

/** 会话展示名：标题优先，其次用户名。 */
function chatName(chat?: PreviewChat | null): string {
  return chat?.title ?? (chat?.username ? `@${chat.username}` : "未知会话")
}

/** 一条消息的正文：会话、配图（相册则整组）、正文与内嵌链接。 */
function MessageBlock({ item, showChat = true }: { item: PreviewItem; showChat?: boolean }) {
  const chat = chatName(item.chat)
  const chatType = chatTypeLabel(item.chat)
  const isGroup = chatType === "群聊"
  const gallery = albumGallery(item)
  const albumCount = item.medias?.length ?? 1
  const isMobile = useMemo(() => isMobileDevice(), [])
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)
  const viewerImage = viewerIndex === null ? null : gallery[viewerIndex]
  // 封面加载失败（缩略图 token 过期、网络错误等）时也要有占位，不能留破图。
  const [brokenCovers, setBrokenCovers] = useState<Set<string>>(new Set())
  const markCoverBroken = (key: string) =>
    setBrokenCovers((prev) => (prev.has(key) ? prev : new Set(prev).add(key)))
  const coverBroken = (image: GalleryImage) => brokenCovers.has(image.key)

  return (
    <article className="space-y-2 border-b pb-4 last:border-b-0 last:pb-0">
      <div className="flex items-start justify-between gap-2 text-xs text-muted-foreground">
        <div className="flex min-w-0 items-start gap-2">
          {showChat && isGroup ? (
            <PeerAvatar
              name={chat}
              src={item.chat?.avatar_url}
              className="mt-0.5 size-8 text-xs"
            />
          ) : null}
          <div className="min-w-0 space-y-1">
            {showChat || albumCount > 1 ? (
              <div className="flex min-w-0 items-center gap-2">
                {showChat ? <span className="truncate">{chat}</span> : null}
                {showChat && chatType ? (
                  <Badge variant="secondary" className="shrink-0 font-normal">
                    {chatType}
                  </Badge>
                ) : null}
                {albumCount > 1 ? (
                  <Badge variant="outline" className="shrink-0 font-normal">
                    相册 {albumCount} 项
                  </Badge>
                ) : null}
              </div>
            ) : null}
            {isGroup && item.sender ? (
              <div className="flex min-w-0 items-center gap-1.5">
                <PeerAvatar
                  name={item.sender.name}
                  src={item.sender.avatar_url}
                  className="size-4 text-[9px]"
                />
                <span className="truncate">{item.sender.name}</span>
                {item.sender.username ? (
                  <span className="shrink-0">@{item.sender.username}</span>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
        <a
          href={item.link}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 hover:text-foreground hover:underline"
        >
          原消息
        </a>
      </div>

      {gallery.length === 1 ? (
        gallery[0].urls.length > 0 && !coverBroken(gallery[0]) ? (
          <button
            type="button"
            onClick={() => setViewerIndex(0)}
            className="block w-fit max-w-full cursor-zoom-in rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            aria-label={`查看大图：${gallery[0].name}`}
          >
            <GalleryThumb
              urls={gallery[0].urls}
              className="max-h-72 w-auto max-w-full rounded-lg border object-contain"
              onFailed={() => markCoverBroken(gallery[0].key)}
            />
          </button>
        ) : (
          <GalleryPlaceholder image={gallery[0]} />
        )
      ) : gallery.length > 1 ? (
        <div
          className={cn(
            "grid gap-2",
            gallery.length % 2 === 0 ? "grid-cols-2" : "grid-cols-3"
          )}
        >
          {gallery.map((image, index) =>
            image.urls.length > 0 && !coverBroken(image) ? (
              <button
                key={image.key}
                type="button"
                onClick={() => setViewerIndex(index)}
                className="relative aspect-[4/3] cursor-zoom-in overflow-hidden rounded-lg border bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                aria-label={`查看大图 ${index + 1}：${image.name}`}
              >
                <GalleryThumb
                  urls={image.urls}
                  className="h-full w-full object-cover"
                  onFailed={() => markCoverBroken(image.key)}
                />
                {image.video ? (
                  <span className="absolute right-1.5 bottom-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] leading-none text-white">
                    {galleryDurationLabel(image)}
                  </span>
                ) : null}
              </button>
            ) : (
              <div
                key={image.key}
                className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg border bg-muted text-muted-foreground"
                aria-label={`${image.video ? "视频" : "图片"}（${
                  image.urls.length === 0 ? "无封面" : "封面加载失败"
                }）：${image.name}`}
              >
                {image.video ? (
                  <FileVideoIcon className="size-6" />
                ) : (
                  <ImageIcon className="size-6" />
                )}
                {image.video ? (
                  <span className="absolute right-1.5 bottom-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] leading-none text-white">
                    {galleryDurationLabel(image)}
                  </span>
                ) : null}
              </div>
            )
          )}
        </div>
      ) : null}

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

      {item.text ? (
        <MessageText text={item.text} entities={item.entities} />
      ) : gallery.length > 0 ? null : (
        <p className="text-sm text-muted-foreground">（该消息没有正文）</p>
      )}

      {item.links && item.links.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {item.links.slice(0, 24).map((link, index) => (
            <a
              key={`${link.url}-${index}`}
              href={link.url}
              target="_blank"
              rel="noreferrer"
              className="max-w-full truncate rounded-md border px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              {link.text || link.url}
            </a>
          ))}
          {item.links.length > 24 ? (
            <span className="px-1 text-xs text-muted-foreground">
              +{item.links.length - 24}
            </span>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}

/** 一行媒体文件：封面、名称、会话、类型、大小与下载入口。 */
function MediaRow({
  item,
  media,
  task,
  busy,
  onDownload,
}: {
  item: PreviewItem
  media: PreviewMedia
  task?: DownloadTask
  busy: boolean
  onDownload: () => void
}) {
  const meta = [
    item.chat?.title,
    mediaKindLabel(media.kind),
    formatBytes(media.size),
    media.duration ? formatDuration(media.duration) : "",
  ].filter(Boolean)

  return (
    <li className="flex items-start gap-3 border-b py-2.5 first:pt-0 last:border-b-0 last:pb-0">
      <MediaCover media={media} />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="truncate text-sm font-medium" title={media.file_name}>
          {media.file_name}
        </p>
        <p className="text-xs leading-relaxed break-words text-muted-foreground">
          {meta.join(" · ")}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {task ? (
          <Badge variant={downloadStatusVariant(task.status)} className="shrink-0">
            {downloadStatusLabel(task.status)}
          </Badge>
        ) : null}
        {media.downloadable ? null : (
          <Badge variant="secondary" className="shrink-0">
            超过上限
          </Badge>
        )}
        <Button
          variant="outline"
          size="icon-sm"
          disabled={!media.downloadable || Boolean(task) || busy}
          onClick={onDownload}
          title={
            task
              ? `已在下载任务中（${downloadStatusLabel(task.status)}）`
              : media.downloadable
                ? "只下载这个文件（相册不会整组展开）"
                : "超过当前账号的单文件上限"
          }
          aria-label={
            task
              ? `${media.file_name} 已在下载任务中`
              : `只下载 ${media.file_name}`
          }
        >
          <DownloadIcon />
        </Button>
      </div>
    </li>
  )
}

/** 媒体封面：有缩略图时懒加载小图，失败或没有时退回类型图标。 */
function MediaCover({ media }: { media: PreviewMedia }) {
  const [failed, setFailed] = useState(false)
  const Icon =
    media.kind === "photo"
      ? ImageIcon
      : media.kind === "video"
        ? FileVideoIcon
        : FileIcon

  if (media.thumbnail_url && !failed) {
    return (
      <img
        src={media.thumbnail_url}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className="size-12 shrink-0 rounded-md bg-muted object-cover"
      />
    )
  }

  return (
    <span
      className="flex size-12 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
      aria-hidden="true"
    >
      <Icon className="size-5" />
    </span>
  )
}

/** 逐条展示解析失败的链接与原因。 */
function FailureList({ items }: { items: PreviewItem[] }) {
  return (
    <section className="mb-6 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-medium text-destructive">解析失败</h2>
        <Badge variant="destructive" className="font-normal">
          {items.length}
        </Badge>
      </div>
      <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs text-muted-foreground">
        {items.slice(0, 10).map((item, index) => (
          <li key={`${item.link}-${index}`} className="truncate">
            <span className="text-foreground">{item.link}</span>：{item.error}
          </li>
        ))}
      </ul>
      {items.length > 10 ? (
        <p className="mt-1 text-xs text-muted-foreground">
          …还有 {items.length - 10} 条
        </p>
      ) : null}
    </section>
  )
}

function CardHint({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center gap-3 text-center">
      <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
        {text}
      </p>
    </div>
  )
}

function CardLoading({ text }: { text: string }) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center gap-3 text-center">
      <Loader2Icon
        className="size-5 animate-spin text-muted-foreground"
        aria-hidden="true"
      />
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  )
}

/** 按行拆分链接：一行一条，去掉空行与首尾空白。 */
function splitLinks(raw: string): string[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
}

/**
 * 正文里展示的配图：相册取全部图片/视频封面，单条消息取主媒体。
 * 具体规则见 lib/gallery（没有封面的视频也会保留，由页面画占位）。
 */
function albumGallery(item: PreviewItem): GalleryImage[] {
  const medias = item.medias?.length
    ? item.medias
    : item.media
      ? [item.media]
      : []
  return mediaGallery(medias)
}

/**
 * 带降级的封面：大图失败退到缩略图；全部失败时通知调用方渲染占位。
 *
 * 每条消息/相册成员各一个，互不影响；失败状态由父组件记在 brokenCovers 里，
 * 这样占位不会随重渲染丢失，也不会出现破图。
 */
function GalleryThumb({
  urls,
  className,
  onFailed,
}: {
  urls: string[]
  className?: string
  onFailed: () => void
}) {
  const [index, setIndex] = useState(0)
  const src = urls[index]
  if (!src) {
    return null
  }
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => {
        if (index + 1 < urls.length) {
          setIndex(index + 1)
          return
        }
        onFailed()
      }}
      className={className}
    />
  )
}

/** 媒体类型的中文标签。 */
function mediaKindLabel(kind: MediaKind): string {
  switch (kind) {
    case "photo":
      return "图片"
    case "video":
      return "视频"
    case "audio":
      return "音频"
    default:
      return "文件"
  }
}

/** 视频角标文案：有时长显示时长，否则退回「视频」。 */
function galleryDurationLabel(image: GalleryImage): string {
  return image.video && image.duration ? formatDuration(image.duration) : "视频"
}

/** 没有封面时的占位块：视频显示胶片图标与时长，图片显示图片图标。 */
function GalleryPlaceholder({ image }: { image: GalleryImage }) {
  const Icon = image.video ? FileVideoIcon : ImageIcon
  return (
    <div className="flex w-fit max-w-full flex-col items-center gap-2 rounded-lg border bg-muted px-8 py-10 text-muted-foreground">
      <Icon className="size-8" />
      <span className="max-w-full truncate text-xs" title={image.name}>
        {image.name}
      </span>
      {image.video && image.duration ? (
        <span className="text-[11px]">{formatDuration(image.duration)}</span>
      ) : null}
    </div>
  )
}
