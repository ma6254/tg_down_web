import { useState } from "react"
import {
  DownloadIcon,
  FileIcon,
  FileVideoIcon,
  ImageIcon,
  Loader2Icon,
  MessageCircleIcon,
  RefreshCwIcon,
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
      <span className="text-xs text-muted-foreground">
        共 {total} 条评论
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
            {query.isFetchingNextPage ? <Loader2Icon className="animate-spin" /> : null}
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
      bodyClassName="space-y-4"
      footer={footer}
    >
      {query.isPending ? (
        <CommentsLoading />
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
        <div className="space-y-4">
          {first?.chat ? (
            <CommentChatHeader chat={first.chat} total={first.total} />
          ) : null}
          <ul className="space-y-4">
            {comments.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                onDownload={onDownload}
                downloading={downloading}
              />
            ))}
          </ul>
          {query.isError ? (
            <ErrorState
              title="加载更多失败"
              message={describeError(query.error)}
              onRetry={() => void query.fetchNextPage()}
            />
          ) : null}
        </div>
      )}
    </ModalDialog>
  )
}

function CommentsLoading() {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
      <Loader2Icon className="size-5 animate-spin" />
      正在加载评论…
    </div>
  )
}

function CommentChatHeader({ chat, total }: { chat: PreviewChat; total: number }) {
  const name = chatName(chat)
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
      <PeerAvatar name={name} src={chat.avatar_url} className="size-8 text-xs" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {chat.username ? `@${chat.username} · ` : ""}共 {total} 条评论
        </p>
      </div>
      <Badge variant="secondary" className="shrink-0 font-normal">
        评论区
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
    <li className="flex gap-3 border-b pb-4 last:border-b-0 last:pb-0">
      <PeerAvatar
        name={author}
        src={comment.sender?.avatar_url}
        className="mt-0.5 size-8 text-xs"
      />
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
          <span className="text-sm font-medium text-foreground">{author}</span>
          {comment.sender?.username ? (
            <span>@{comment.sender.username}</span>
          ) : null}
          <time dateTime={dateTime}>{formatDateTime(comment.date)}</time>
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
    <div className="rounded-md border-l-2 border-primary/30 bg-muted/30 px-2 py-1 text-xs text-muted-foreground">
      <span>回复 #{reply.message_id}</span>
      {reply.quote ? (
        <p className="mt-0.5 whitespace-pre-wrap break-words">{reply.quote}</p>
      ) : null}
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
          className="max-w-full truncate rounded-md border px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
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
    media.duration ? formatDuration(media.duration) : "",
    media.width && media.height ? `${media.width}×${media.height}` : "",
  ]
    .filter(Boolean)
    .join(" · ")
  const link = media.link
  const canDownload = Boolean(onDownload && media.downloadable && link)

  return (
    <div className="flex items-start gap-3 rounded-lg border p-2">
      {media.thumbnail_url && !failed ? (
        <img
          src={media.thumbnail_url}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="size-16 shrink-0 rounded-md bg-muted object-cover"
        />
      ) : (
        <span className="flex size-16 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <Icon className="size-5" />
        </span>
      )}
      <div className="min-w-0 flex-1 space-y-1">
        <p className="truncate text-sm font-medium" title={media.file_name}>
          {media.file_name}
        </p>
        <p className="text-xs text-muted-foreground">{meta}</p>
        {media.downloadable ? null : (
          <Badge variant="secondary" className="font-normal">
            超过上限
          </Badge>
        )}
      </div>
      {canDownload && link ? (
        <Button
          variant="outline"
          size="xs"
          onClick={() => onDownload?.(link)}
          disabled={downloading}
          title="下载这条评论里的媒体"
          aria-label={`下载 ${media.file_name}`}
        >
          <DownloadIcon />
          下载
        </Button>
      ) : null}
    </div>
  )
}

/** 会话展示名：标题优先，其次用户名。 */
function chatName(chat?: PreviewChat | null): string {
  return chat?.title ?? (chat?.username ? `@${chat.username}` : "未知会话")
}
