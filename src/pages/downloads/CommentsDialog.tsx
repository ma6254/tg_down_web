import { useState } from "react"
import {
  DownloadIcon,
  FileIcon,
  FileVideoIcon,
  ImageIcon,
  Loader2Icon,
  MessageCircleIcon,
  RefreshCwIcon,
  ReplyIcon,
} from "lucide-react"
import { describeError } from "@/api/client"
import type {
  PreviewChat,
  PreviewComment,
  PreviewCommentReply,
  PreviewItem,
  PreviewLink,
  PreviewMedia,
} from "@/api/types"
import { EmptyState } from "@/components/common/EmptyState"
import { ErrorState } from "@/components/common/ErrorState"
import { ModalDialog } from "@/components/common/ModalDialog"
import { CommentPostCard } from "@/components/comments/CommentPostCard"
import { PeerAvatar } from "@/components/common/PeerAvatar"
import { MessageText } from "@/components/messages/MessageText"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useComments } from "@/hooks/use-comments"
import {
  commentAuthorName,
  commentsTotal,
  flattenComments,
} from "@/lib/comments"
import { mediaKindLabel } from "@/lib/download"
import { formatBytes, formatDateTime, formatDuration } from "@/lib/format"
import { formatRelativeTime } from "@/lib/draft"
import { chatName } from "@/lib/chat"
import { cn } from "@/lib/utils"

interface CommentsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 当前要查看评论的预览消息；关闭时可传 null。 */
  item: PreviewItem | null
  /** 评论媒体下载入口；不传时隐藏下载按钮。 */
  onDownload?: (link: string) => void
  downloading?: boolean
}

/**
 * 频道帖子评论区弹窗。
 *
 * 评论按需加载：打开时才请求 /links/comments，按 next_offset_id 分页；
 * 评论里的媒体可以直接交给下载任务，但评论本身不写数据库。
 */
export function CommentsDialog({
  open,
  onOpenChange,
  item,
  onDownload,
  downloading = false,
}: CommentsDialogProps) {
  const query = useComments(item?.link ?? null, open)
  if (!item) {
    return null
  }

  const pages = query.data?.pages ?? []
  const comments = flattenComments(pages)
  const first = pages[0]
  const total =
    first && !first.available
      ? 0
      : commentsTotal(pages, item.comment_section?.count ?? 0)
  const title = total > 0 ? `评论（${total}）` : "评论"
  const description = first?.chat
    ? `评论区：${chatName(first.chat)}`
    : item.chat
      ? `帖子：${chatName(item.chat)}`
      : "读取帖子关联讨论组里的评论"

  const footer = first ? (
    <div className="flex w-full flex-wrap items-center justify-between gap-2">
      <span className="text-xs text-muted-foreground tabular-nums">
        共 {total} 条
        {comments.length > 0 ? ` · 已显示 ${comments.length} 条` : ""}
      </span>
      <div className="flex items-center gap-2">
        {query.hasNextPage ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => void query.fetchNextPage()}
            disabled={query.isFetchingNextPage}
          >
            {query.isFetchingNextPage ? (
              <Loader2Icon className="animate-spin" />
            ) : null}
            {query.isFetchingNextPage ? "加载中…" : "加载更多"}
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void query.refetch()}
            disabled={query.isFetching}
          >
            <RefreshCwIcon className={cn(query.isFetching && "animate-spin")} />
            刷新
          </Button>
        )}
      </div>
    </div>
  ) : undefined

  return (
    <ModalDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      size="xl"
      bodyClassName="space-y-3 p-3 sm:p-4"
      footer={footer}
    >
      <div className="space-y-3">
        <CommentPostCard item={item} />

        {query.isPending ? (
          <CommentsSkeleton />
        ) : query.isError && !first ? (
          <ErrorState
            title="评论加载失败"
            message={describeError(query.error)}
            onRetry={() => void query.refetch()}
          />
        ) : first && !first.available ? (
          <EmptyState
            icon={MessageCircleIcon}
            title="评论区不可用"
            description={first.reason || "该帖子没有开启评论。"}
          />
        ) : comments.length === 0 ? (
          <EmptyState
            icon={MessageCircleIcon}
            title="还没有评论"
            description="这个帖子的评论区暂时是空的。"
          />
        ) : (
          <>
            {first?.chat ? (
              <CommentChatHeader chat={first.chat} total={total} />
            ) : null}

            <ul className="divide-y overflow-hidden rounded-xl border bg-card">
              {comments.map((comment) => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  onDownload={onDownload}
                  downloading={downloading}
                />
              ))}
            </ul>

            {query.isFetchingNextPage ? (
              <p className="flex items-center justify-center gap-2 py-1 text-xs text-muted-foreground">
                <Loader2Icon className="size-3.5 animate-spin" />
                正在加载更早的评论…
              </p>
            ) : null}

            {query.isError ? (
              <ErrorState
                title="加载更多失败"
                message={describeError(query.error)}
                onRetry={() => void query.fetchNextPage()}
              />
            ) : null}
          </>
        )}
      </div>
    </ModalDialog>
  )
}

/** 加载骨架：正文卡已经先渲染，这里只占评论列表的位置。 */
function CommentsSkeleton() {
  return (
    <div className="space-y-3">
      <span className="sr-only">正在加载评论…</span>
      <div className="divide-y overflow-hidden rounded-xl border bg-card" aria-hidden="true">
        {[0, 1, 2].map((index) => (
          <div key={index} className="flex gap-3 p-3 sm:p-4">
            <div className="size-9 shrink-0 animate-pulse rounded-full bg-muted" />
            <div className="flex-1 space-y-2 py-1">
              <div className="h-3 w-1/4 animate-pulse rounded bg-muted" />
              <div className="h-3 w-full animate-pulse rounded bg-muted" />
              <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** 评论区上下文：讨论组是哪个、有多少条评论。 */
function CommentChatHeader({
  chat,
  total,
}: {
  chat: PreviewChat
  total: number
}) {
  const name = chatName(chat)
  return (
    <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
      <PeerAvatar
        name={name}
        src={chat.avatar_url}
        className="size-5 text-[9px]"
      />
      <span className="truncate">
        讨论组：{name}
        {chat.username ? ` @${chat.username}` : ""}
      </span>
      <span className="shrink-0 tabular-nums">· 共 {total} 条评论</span>
      <Badge variant="secondary" className="ml-auto shrink-0 font-normal">
        讨论组
      </Badge>
    </div>
  )
}

function CommentItem({
  comment,
  onDownload,
  downloading,
}: {
  comment: PreviewComment
  onDownload?: (link: string) => void
  downloading: boolean
}) {
  const author = commentAuthorName(comment)
  const parsedDate = new Date(comment.date * 1000)
  const dateTime = Number.isNaN(parsedDate.getTime())
    ? undefined
    : parsedDate.toISOString()

  return (
    <li className="flex gap-3 p-3 transition-colors hover:bg-muted/30 sm:p-4">
      <PeerAvatar
        name={author}
        src={comment.sender?.avatar_url}
        className="mt-0.5 size-9 text-xs"
      />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-sm font-medium">{author}</span>
          {comment.sender?.username ? (
            <span className="text-xs text-muted-foreground">
              @{comment.sender.username}
            </span>
          ) : null}
          <time
            dateTime={dateTime}
            title={formatDateTime(comment.date)}
            className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums"
          >
            {formatRelativeTime(comment.date)}
          </time>
        </div>

        {comment.reply_to ? <CommentReplyLine reply={comment.reply_to} /> : null}

        {comment.text ? (
          <MessageText text={comment.text} entities={comment.entities} />
        ) : null}

        {comment.links && comment.links.length > 0 ? (
          <CommentLinks links={comment.links} />
        ) : null}

        {comment.media ? (
          <CommentMedia
            media={comment.media}
            onDownload={onDownload}
            downloading={downloading}
          />
        ) : null}

        {comment.media_error ? (
          <p className="text-xs text-destructive">
            媒体解析失败：{comment.media_error}
          </p>
        ) : null}
      </div>
    </li>
  )
}

function CommentReplyLine({ reply }: { reply: PreviewCommentReply }) {
  return (
    <div className="flex gap-2 rounded-lg border-l-2 border-primary/40 bg-muted/40 py-1.5 pr-2.5 pl-2.5">
      <ReplyIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 text-xs">
        <span className="text-muted-foreground tabular-nums">
          回复 #{reply.message_id}
        </span>
        {reply.quote ? (
          <p className="mt-0.5 line-clamp-3 whitespace-pre-wrap break-words text-foreground/80">
            {reply.quote}
          </p>
        ) : null}
      </div>
    </div>
  )
}

function CommentLinks({ links }: { links: PreviewLink[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {links.slice(0, 12).map((link, index) => (
        <a
          key={`${link.url}-${index}`}
          href={link.url}
          target="_blank"
          rel="noreferrer"
          className="max-w-full truncate rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:bg-accent hover:text-foreground"
        >
          {link.text || link.url}
        </a>
      ))}
      {links.length > 12 ? (
        <span className="px-1 text-xs text-muted-foreground">
          +{links.length - 12}
        </span>
      ) : null}
    </div>
  )
}

function CommentMedia({
  media,
  onDownload,
  downloading,
}: {
  media: PreviewMedia
  onDownload?: (link: string) => void
  downloading: boolean
}) {
  const [failed, setFailed] = useState(false)
  const Icon =
    media.kind === "photo"
      ? ImageIcon
      : media.kind === "video"
        ? FileVideoIcon
        : FileIcon
  const meta = [
    mediaKindLabel(media.kind),
    formatBytes(media.size),
    media.width && media.height ? `${media.width}×${media.height}` : "",
  ]
    .filter(Boolean)
    .join(" · ")
  const link = media.link
  const canDownload = Boolean(onDownload && media.downloadable && link)

  return (
    <figure className="group flex items-center gap-3 rounded-xl border bg-card p-2 pr-2.5 transition-colors hover:border-primary/40">
      <div className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-muted">
        {media.thumbnail_url && !failed ? (
          <img
            src={media.thumbnail_url}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setFailed(true)}
            className="size-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
          />
        ) : (
          <span className="flex size-full items-center justify-center text-muted-foreground">
            <Icon className="size-5" />
          </span>
        )}
        {media.duration ? (
          <span className="absolute right-1 bottom-1 rounded bg-black/70 px-1 py-px text-[10px] font-medium text-white tabular-nums">
            {formatDuration(media.duration)}
          </span>
        ) : null}
      </div>

      <figcaption className="min-w-0 flex-1 space-y-0.5">
        <p className="truncate text-sm font-medium" title={media.file_name}>
          {media.file_name}
        </p>
        <p className="truncate text-xs text-muted-foreground">{meta}</p>
        {media.downloadable ? null : (
          <Badge variant="secondary" className="mt-0.5 font-normal">
            超过上限
          </Badge>
        )}
      </figcaption>

      {canDownload && link ? (
        <Button
          variant="outline"
          size="icon-sm"
          className="shrink-0"
          onClick={() => onDownload?.(link)}
          disabled={downloading}
          title="下载这条评论里的媒体"
          aria-label={`下载 ${media.file_name}`}
        >
          <DownloadIcon />
        </Button>
      ) : null}
    </figure>
  )
}
