import { useState } from "react"
import {
  ChevronDownIcon,
  ClockIcon,
  ImageIcon,
  Loader2Icon,
  Trash2Icon,
} from "lucide-react"
import { describeError } from "@/api/client"
import { downloadHistoryCoverUrl } from "@/api/endpoints"
import type { DownloadHistoryEntry } from "@/api/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useDownloadHistoryDetail } from "@/hooks/use-download-history"
import { formatHistorySummary, formatRelativeTime } from "@/lib/draft"
import { mediaKindLabel } from "@/lib/download"
import { formatBytes } from "@/lib/format"
import { cn } from "@/lib/utils"

interface DownloadHistoryPanelProps {
  items: DownloadHistoryEntry[]
  isLoading: boolean
  isError: boolean
  error?: unknown
  onRetry: () => void
  /** 回填并立即解析（点击行或详情里的按钮都走这里）。 */
  onSelect: (entry: DownloadHistoryEntry) => void
  onDelete: (id: number) => void
  onClear: () => void
  clearing: boolean
  /** 外层（窄屏 Sheet）已有标题时传 false，只保留清空入口。 */
  showHeader?: boolean
  className?: string
}

/**
 * 下载历史面板：列表、缓存详情、回填并解析、删除与清空。
 *
 * 只负责展示与交互，回填与解析的副作用由下载页处理；
 * 桌面放在 Popover，窄屏放在 Sheet，内容复用同一个组件。
 */
export function DownloadHistoryPanel({
  items,
  isLoading,
  isError,
  error,
  onRetry,
  onSelect,
  onDelete,
  onClear,
  clearing,
  showHeader = true,
  className,
}: DownloadHistoryPanelProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [confirmingClear, setConfirmingClear] = useState(false)

  const clearControl =
    items.length === 0 ? null : confirmingClear ? (
      <div className="flex shrink-0 items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={() => setConfirmingClear(false)}
          disabled={clearing}
        >
          取消
        </Button>
        <Button
          type="button"
          variant="destructive"
          size="xs"
          onClick={() => {
            onClear()
            setConfirmingClear(false)
          }}
          disabled={clearing}
        >
          {clearing ? <Loader2Icon className="animate-spin" /> : null}
          确认清空
        </Button>
      </div>
    ) : (
      <Button
        type="button"
        variant="ghost"
        size="xs"
        className="shrink-0 text-muted-foreground"
        onClick={() => setConfirmingClear(true)}
      >
        清空历史
      </Button>
    )

  return (
    <section className={cn("flex flex-col", className)} aria-label="下载历史">
      {showHeader ? (
        <header className="flex items-start justify-between gap-2 border-b px-3 py-2.5">
          <div>
            <h2 className="flex items-center gap-1.5 text-sm font-medium">
              <ClockIcon className="size-4 text-muted-foreground" />
              下载历史
              {items.length > 0 ? (
                <Badge variant="secondary" className="font-normal">
                  {items.length}
                </Badge>
              ) : null}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              最近解析过的输入；点击回填并自动解析。
            </p>
          </div>
          {clearControl}
        </header>
      ) : items.length > 0 ? (
        <div className="flex justify-end border-b px-3 py-1.5">{clearControl}</div>
      ) : null}

      {isLoading ? (
        <div className="space-y-2 p-3" aria-busy="true">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-2/3" />
        </div>
      ) : isError ? (
        <div className="space-y-2 p-3 text-sm">
          <p role="alert" className="text-destructive">
            读取历史失败：{describeError(error)}
          </p>
          <Button type="button" variant="outline" size="xs" onClick={onRetry}>
            重试
          </Button>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
          <span className="flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <ClockIcon className="size-4" aria-hidden="true" />
          </span>
          <p className="text-sm text-muted-foreground">
            解析预览后会出现在这里。
          </p>
        </div>
      ) : (
        <ul className="divide-y">
          {items.map((entry) => {
            const summary = formatHistorySummary(entry)
            const title = entry.title || entry.first_line || "（空输入）"
            const expanded = expandedId === entry.id
            return (
              <li key={entry.id}>
                <div className="flex items-start gap-1 px-2 py-2">
                  <button
                    type="button"
                    onClick={() => onSelect(entry)}
                    className="flex min-w-0 flex-1 items-start gap-2 rounded-md px-1 py-1 text-left outline-none hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring/50"
                    title="填入并解析"
                    aria-label={`${title}，填入并解析`}
                  >
                    <HistoryCover id={entry.id} />
                    <span className="min-w-0 flex-1">
                      <span
                        className="block truncate text-sm font-medium"
                        title={entry.first_line}
                      >
                        {title}
                      </span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                        共 {entry.line_count} 条
                        {summary ? ` · ${summary}` : ""}
                        {" · "}
                        {formatRelativeTime(entry.last_used_at)}
                        {entry.use_count > 1 ? ` · 用过 ${entry.use_count} 次` : ""}
                      </span>
                      <span className="mt-1 flex flex-wrap gap-1">
                        {entry.expand_text_links ? (
                          <Badge variant="outline" className="font-normal">
                            展开正文链接
                          </Badge>
                        ) : null}
                        {entry.overwrite ? (
                          <Badge variant="outline" className="font-normal">
                            覆盖同名
                          </Badge>
                        ) : null}
                        {entry.cache_truncated ? (
                          <Badge variant="outline" className="font-normal">
                            摘要已截断
                          </Badge>
                        ) : null}
                      </span>
                    </span>
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setExpandedId(expanded ? null : entry.id)}
                    aria-label={expanded ? "收起详情" : "查看缓存详情"}
                    aria-expanded={expanded}
                  >
                    <ChevronDownIcon
                      className={cn("transition-transform", expanded && "rotate-180")}
                    />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => onDelete(entry.id)}
                    aria-label={`删除历史：${entry.first_line}`}
                    title="删除这条历史"
                  >
                    <Trash2Icon />
                  </Button>
                </div>
                {expanded ? (
                  <HistoryDetail
                    entry={entry}
                    onSelect={() => onSelect(entry)}
                  />
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

/** 历史卡片封面：取 thumbnail/ 磁盘缓存；没有封面或加载失败时显示图标。 */
function HistoryCover({ id }: { id: number }) {
  const [failed, setFailed] = useState(false)
  if (failed) {
    return (
      <span
        className="flex size-12 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
        aria-hidden="true"
      >
        <ImageIcon className="size-5" />
      </span>
    )
  }
  return (
    <img
      src={downloadHistoryCoverUrl(id)}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className="size-12 shrink-0 rounded-md border bg-muted object-cover"
    />
  )
}

/** 展开后的缓存详情：消息条目与失败原因（只读），以及回填并解析入口。 */
function HistoryDetail({
  entry,
  onSelect,
}: {
  entry: DownloadHistoryEntry
  onSelect: () => void
}) {
  const detail = useDownloadHistoryDetail(entry.id)
  const cache = detail.data?.cache
  const items = cache?.items ?? []
  const failures = cache?.failures ?? []

  return (
    <div className="space-y-3 border-t bg-muted/30 px-3 py-3">
      {detail.isLoading ? (
        <div className="space-y-1.5" aria-busy="true">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ) : detail.isError ? (
        <p role="alert" className="text-xs text-destructive">
          读取详情失败：{describeError(detail.error)}
        </p>
      ) : !cache || (items.length === 0 && failures.length === 0) ? (
        <p className="text-xs text-muted-foreground">
          没有可展示的解析摘要；回填只会恢复输入。
        </p>
      ) : (
        <>
          {items.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">
                缓存的消息（{items.length}）
              </p>
              <ul className="space-y-1.5">
                {items.map((item, index) => {
                  const meta = [
                    mediaKindLabel(item.media_kind),
                    item.file_name,
                    item.size ? formatBytes(item.size) : "",
                  ]
                    .filter(Boolean)
                    .join(" · ")
                  return (
                    <li
                      key={`${item.message_id ?? "item"}-${index}`}
                      className="rounded-md border bg-background/70 px-2 py-1.5"
                    >
                      <p className="text-xs text-muted-foreground">
                        {[
                          item.chat_title,
                          item.message_id ? `#${item.message_id}` : "",
                          meta,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      {item.text ? (
                        <p className="mt-0.5 line-clamp-2 text-xs break-words">
                          {item.text}
                        </p>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
              {entry.cache_truncated ? (
                <p className="text-xs text-muted-foreground">
                  只缓存了前 20 条消息。
                </p>
              ) : null}
            </div>
          ) : null}

          {failures.length > 0 ? (
            <div className="space-y-1">
              <p className="text-xs font-medium text-destructive">
                解析失败（{failures.length}）
              </p>
              <ul className="space-y-1">
                {failures.map((failure, index) => (
                  <li key={`${failure.link}-${index}`} className="text-xs break-words">
                    <span className="text-foreground">{failure.link}</span>
                    <span className="text-muted-foreground">：{failure.error}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}

      <div className="flex flex-wrap gap-1.5">
        <Button type="button" variant="outline" size="xs" onClick={onSelect}>
          填入并解析
        </Button>
      </div>
    </div>
  )
}
