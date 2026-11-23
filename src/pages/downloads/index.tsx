import { useEffect, useMemo, useRef, useState, type FormEvent } from "react"
import type { LucideIcon } from "lucide-react"
import {
  DownloadIcon,
  ExternalLinkIcon,
  FileIcon,
  FileJsonIcon,
  FileVideoIcon,
  HistoryIcon,
  ImageIcon,
  Loader2Icon,
  MessageCircleIcon,
  MessageSquareTextIcon,
  RefreshCwIcon,
  SearchIcon,
} from "lucide-react"
import { toast } from "sonner"
import { api, downloadFileUrl } from "@/api/endpoints"
import { describeError } from "@/api/client"
import type {
  DownloadHistoryEntry,
  DownloadTask,
  PreviewChat,
  PreviewItem,
  PreviewMedia,
} from "@/api/types"
import { JsonViewerDialog } from "@/components/common/JsonViewerDialog"
import { ModalDialog } from "@/components/common/ModalDialog"
import { PeerAvatar } from "@/components/common/PeerAvatar"
import { PicViewerDialog } from "@/components/PicViewer"
import { PicViewerMobileDialog } from "@/components/PicViewerMobile"
import { PageHeader } from "@/components/layout/PageHeader"
import { MessageText } from "@/components/messages/MessageText"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useCreateDownloads, useDownloads } from "@/hooks/use-downloads"
import { useDownloadDraft } from "@/hooks/use-download-draft"
import {
  useClearDownloadHistory,
  useDeleteDownloadHistory,
  useDownloadHistory,
  useRecordDownloadHistory,
} from "@/hooks/use-download-history"
import { usePreviewLinks } from "@/hooks/use-preview-links"
import { useSettings, useUpdateSettings } from "@/hooks/use-settings"
import {
  downloadStatusLabel,
  downloadStatusVariant,
  mediaKindLabel,
  summarizeCreateResult,
} from "@/lib/download"
import { draftCacheFromPreview, formatCacheSummary } from "@/lib/draft"
import { settingBool } from "@/lib/settings"
import { chatTypeLabel, commonChat } from "@/lib/chat"
import { commentButtonLabel } from "@/lib/comments"
import { formatBytes, formatDuration } from "@/lib/format"
import { mediaGallery, type GalleryImage } from "@/lib/gallery"
import { isMobileDevice } from "@/lib/device"
import { cn } from "@/lib/utils"
import { DownloadHistoryPanel } from "./DownloadHistoryPanel"
import { CommentsDialog } from "./CommentsDialog"

/**
 * 下载页：链接输入与解析结果预览。
 *
 * 解析走 POST /api/v1/links/preview，只读；下载任务由 POST /api/v1/downloads
 * 创建后在后台执行，任务列表、进度与控制在「下载队列」页查看。
 */
export function DownloadsPage() {
  // 输入草稿：挂载时恢复，变化时自动保存；历史是独立的最近解析批次。
  const draft = useDownloadDraft()
  const {
    links,
    cache,
    ready: draftReady,
    restored: draftRestored,
    status: draftStatus,
    setLinks,
    setCache,
    applyHistory,
    clearDraft,
    retrySave,
  } = draft

  // 两个开关都是全局配置，不在草稿里。
  const settings = useSettings()
  const updateSettings = useUpdateSettings()
  const settingsRows = settings.data?.settings
  const overwrite = settingBool(settingsRows, "download_overwrite")
  const expand = settingBool(settingsRows, "download_expand_text_links")
  const autoPreview = settingBool(settingsRows, "download_auto_preview", true)
  function saveSwitch(key: string, value: boolean) {
    updateSettings.mutate(
      { [key]: value ? "true" : "false" },
      { onError: (error) => toast.error(describeError(error)) }
    )
  }
  const [historyOpen, setHistoryOpen] = useState(false)
  // 正文卡片的「JSON」查看器；展示解析接口返回的消息原文。
  const [jsonOpen, setJsonOpen] = useState(false)
  // 评论弹窗：非 null 时打开，评论区按需加载。
  const [commentsItem, setCommentsItem] = useState<PreviewItem | null>(null)
  const history = useDownloadHistory()
  const recordHistory = useRecordDownloadHistory()
  const deleteHistory = useDeleteDownloadHistory()
  const clearHistory = useClearDownloadHistory()
  const historyItems = history.data?.items ?? []

  const preview = usePreviewLinks()
  // 任务状态用于媒体行的「下载 / 重新下载」判断；常驻侧栏的任务查询在有活动
  // 任务时每 2s 轮询，队列页还有 SSE，这里只读共享缓存、不重复轮询。
  const downloads = useDownloads({ poll: false })
  const createDownloads = useCreateDownloads()

  const targets = splitLinks(links)
  const data = preview.data
  const messages =
    data?.items.filter((item) => !item.expanded && !item.error) ?? []
  const failures = data?.items.filter((item) => item.error) ?? []
  const sharedChat = commonChat(messages)
  // 「JSON」按钮展示解析接口返回的消息原文；只有一条时直接给对象，便于阅读。
  const jsonItems = data?.items ?? []
  const jsonValue = jsonItems.length === 1 ? jsonItems[0] : jsonItems
  // 恢复草稿后、还没重新解析时展示上次摘要；解析结果存在时不重复展示。
  const restoredSummary =
    !data && cache && cache.summary.total > 0 ? formatCacheSummary(cache) : ""
  const isMobile = useMemo(() => isMobileDevice(), [])

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
   * allowOverLimit=true 用于用户二次确认后强行下载超过账号单文件上限的媒体。
   */
  function enqueue(links: string[], single = false, allowOverLimit = false) {
    if (links.length === 0) {
      return
    }
    createDownloads.mutate(
      { links, overwrite, single, allow_over_limit: allowOverLimit || undefined },
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
    runPreview()
  }

  /** 发起解析；overrides 供历史回填/自动预览使用，避免等状态更新。 */
  function runPreview(
    options: {
      links?: string
      /** 自动预览不写历史，避免每次打开页面都累加使用次数。 */
      record?: boolean
      /** 自动预览不弹 toast，错误仍显示在页面上。 */
      silent?: boolean
    } = {}
  ) {
    const { record = true, silent = false } = options
    setCommentsItem(null)
    const text = options.links ?? links
    const input = splitLinks(text)
    if (input.length === 0) {
      if (!silent) {
        toast.error("请先粘贴至少一条 Telegram 链接")
      }
      return
    }

    preview.mutate(
      { links: input, expand_text_links: expand },
      {
        onSuccess: (result) => {
          if (!silent) {
            if (result.summary.failed > 0) {
              toast.warning(
                `解析完成：成功 ${result.summary.ok}，失败 ${result.summary.failed}`
              )
            } else {
              toast.success(`已解析 ${result.summary.ok} 条消息`)
            }
          }
          // 摘要与输入一起保存，同时记录到历史（失败静默，不影响解析）。
          const summaryCache = draftCacheFromPreview(result)
          setCache(summaryCache)
          if (record) {
            recordHistory.mutate(
              {
                links: text,
                expand_text_links: expand,
                overwrite,
                cache: summaryCache,
              },
              { onError: () => {} }
            )
          }
        },
        onError: (error) => {
          if (!silent) {
            toast.error(describeError(error))
          }
        },
      }
    )
  }

  /** 回填历史并立即解析；成功后照常写回历史（累加使用次数与摘要）。 */
  async function fillFromHistory(entry: DownloadHistoryEntry) {
    try {
      const detail = await api.downloads.historyDetail(entry.id)
      // 两个开关都是全局配置，不随历史记录回填。
      applyHistory(detail.links)
      // 先用历史里的摘要占位，解析完成后会被新结果替换。
      setCache(detail.cache ?? null)
      preview.reset()
      setHistoryOpen(false)
      runPreview({ links: detail.links })
    } catch (error) {
      toast.error(describeError(error))
    }
  }

  function handleDeleteHistory(id: number) {
    deleteHistory.mutate(id, {
      onError: (error) => toast.error(describeError(error)),
    })
  }

  function handleClearHistory() {
    clearHistory.mutate(undefined, {
      onSuccess: (result) => toast.success(`已清空 ${result.removed} 条历史`),
      onError: (error) => toast.error(describeError(error)),
    })
  }

  // 打开页面时若恢复了草稿且输入非空，按设置自动解析一次刷新摘要与封面；
  // 自动解析不写历史，避免每次打开页面都累加使用次数。
  const autoPreviewed = useRef(false)
  useEffect(() => {
    if (
      autoPreviewed.current ||
      !draftReady ||
      !draftRestored ||
      settings.isLoading ||
      !autoPreview
    ) {
      return
    }
    if (splitLinks(links).length === 0) {
      return
    }
    autoPreviewed.current = true
    runPreview({ record: false, silent: true })
    // 只在草稿恢复完成且设置为开启时触发一次；之后仍由用户点「解析预览」。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftReady, draftRestored, autoPreview, settings.isLoading])

  const historyButton = (
    <Button
      type="button"
      variant="ghost"
      size="xs"
      className="text-muted-foreground"
    >
      <HistoryIcon />
      历史{historyItems.length > 0 ? `（${historyItems.length}）` : ""}
    </Button>
  )

  const renderHistoryPanel = (showHeader: boolean) => (
    <DownloadHistoryPanel
      showHeader={showHeader}
      items={historyItems}
      isLoading={history.isLoading}
      isError={history.isError}
      error={history.error}
      onRetry={() => void history.refetch()}
      onSelect={(entry) => void fillFromHistory(entry)}
      onDelete={handleDeleteHistory}
      onClear={handleClearHistory}
      clearing={clearHistory.isPending}
    />
  )

  // 桌面用 Popover，窄屏用底部 Sheet；内容复用同一个历史面板。
  const historyControl = isMobile ? (
    <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
      <SheetTrigger render={historyButton} />
      <SheetContent side="bottom" className="max-h-[85vh] gap-0">
        <SheetHeader className="border-b">
          <SheetTitle>下载历史</SheetTitle>
          <SheetDescription>
            最近解析过的输入；点击回填并自动解析。
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {renderHistoryPanel(false)}
        </div>
      </SheetContent>
    </Sheet>
  ) : (
    <Popover open={historyOpen} onOpenChange={setHistoryOpen}>
      <PopoverTrigger render={historyButton} />
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-[30rem] max-w-[calc(100vw-2rem)] p-0"
      >
        {renderHistoryPanel(true)}
      </PopoverContent>
    </Popover>
  )

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
          <div className="flex flex-wrap items-center gap-2">
            <Label htmlFor="download-links">下载链接</Label>
            <span className="text-xs text-muted-foreground">
              {targets.length > 0 ? `${targets.length} 条` : "一行一条"}
            </span>
            {historyControl}
            {draftStatus === "saving" ? (
              <span className="text-xs text-muted-foreground">保存中…</span>
            ) : draftStatus === "saved" ? (
              <span className="text-xs text-muted-foreground">已保存</span>
            ) : draftStatus === "error" ? (
              <button
                type="button"
                onClick={retrySave}
                className="text-xs text-destructive underline underline-offset-2"
              >
                保存失败，重试
              </button>
            ) : null}
          </div>
          {links.trim() ? (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="text-muted-foreground"
              onClick={() => {
                clearDraft()
                preview.reset()
                setCommentsItem(null)
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
                onCheckedChange={(value) =>
                  saveSwitch("download_expand_text_links", value)
                }
                disabled={settings.isLoading || updateSettings.isPending}
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
                onCheckedChange={(value) => saveSwitch("download_overwrite", value)}
                disabled={settings.isLoading || updateSettings.isPending}
                aria-label="覆盖同名文件"
              />
              <Label
                htmlFor="overwrite-files"
                className="text-xs font-normal text-muted-foreground"
                title="同名文件直接替换，不再生成「名称 (1).ext」；会从零重新下载。与设置页的「下载覆盖文件」是同一项配置。"
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

      {restoredSummary ? (
        <section
          className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/30 px-4 py-3"
          aria-label="上次解析摘要"
        >
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <HistoryIcon className="size-4 text-muted-foreground" />
              上次解析
            </p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {restoredSummary}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => runPreview()}
              disabled={preview.isPending || targets.length === 0}
            >
              {preview.isPending ? (
                <Loader2Icon className="animate-spin" />
              ) : (
                <RefreshCwIcon />
              )}
              重新解析
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="text-muted-foreground"
              onClick={() => setCache(null)}
            >
              清除摘要
            </Button>
          </div>
        </section>
      ) : null}

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
            onClick={() => {
              preview.reset()
              setCommentsItem(null)
            }}
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
            <CardAction>
              <Button
                type="button"
                variant="outline"
                size="xs"
                disabled={jsonItems.length === 0}
                onClick={() => setJsonOpen(true)}
                title={
                  jsonItems.length > 0
                    ? "查看解析接口返回的消息原始 JSON"
                    : "解析链接后可以查看消息原始 JSON"
                }
                aria-label="查看消息原始 JSON"
              >
                <FileJsonIcon />
                JSON
              </Button>
            </CardAction>
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
                    onOpenComments={setCommentsItem}
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
                      overwrite={overwrite}
                      busy={createDownloads.isPending}
                      onDownload={(allowOverLimit) =>
                        enqueue([row.link], true, allowOverLimit)
                      }
                    />
                  ))}
                </ul>
                <p className="mt-3 shrink-0 text-xs text-muted-foreground">
                  下载进度与暂停/重试在「下载队列」页查看。
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

      <JsonViewerDialog
        open={jsonOpen}
        onOpenChange={setJsonOpen}
        title="消息原始 JSON"
        description={
          data
            ? `解析接口返回的 ${data.items.length} 条消息原文，包含展开项与失败项。`
            : "还没有解析结果。"
        }
        value={jsonValue}
      />

      <CommentsDialog
        open={commentsItem !== null}
        item={commentsItem}
        onOpenChange={(open) => {
          if (!open) {
            setCommentsItem(null)
          }
        }}
        onDownload={(link) => enqueue([link], true)}
        downloading={createDownloads.isPending}
      />
    </>
  )
}

/** 会话展示名：标题优先，其次用户名。 */
function chatName(chat?: PreviewChat | null): string {
  return chat?.title ?? (chat?.username ? `@${chat.username}` : "未知会话")
}

/** 一条消息的正文：会话、配图（相册则整组）、正文与内嵌链接。 */
function MessageBlock({
  item,
  showChat = true,
  onOpenComments,
}: {
  item: PreviewItem
  showChat?: boolean
  onOpenComments: (item: PreviewItem) => void
}) {
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
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          {item.comment_section?.available ? (
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => onOpenComments(item)}
              title={`查看评论（${item.comment_section.count} 条）`}
              aria-label={`查看评论（${item.comment_section.count} 条）`}
            >
              <MessageCircleIcon />
              {commentButtonLabel(item.comment_section)}
            </Button>
          ) : null}
          <a
            href={item.link}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 hover:text-foreground hover:underline"
          >
            原消息
          </a>
        </div>
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
  overwrite,
  busy,
  onDownload,
}: {
  item: PreviewItem
  media: PreviewMedia
  task?: DownloadTask
  /** 覆盖同名文件开关；打开后允许对已完成/失败/暂停的任务重新下载。 */
  overwrite: boolean
  busy: boolean
  onDownload: (allowOverLimit?: boolean) => void
}) {
  const [forceOpen, setForceOpen] = useState(false)
  const meta = [
    item.chat?.title,
    mediaKindLabel(media.kind),
    formatBytes(media.size),
    media.duration ? formatDuration(media.duration) : "",
  ].filter(Boolean)

  const done = task?.status === "done"
  const openUrl = done && task ? downloadFileUrl(task.id) : null
  const openLabel = fileActionLabel(media.kind)
  const canOpen = Boolean(openUrl)
  /** 与「下载队列」一致：在新标签页打开已下载文件（图片原图、音视频播放）。 */
  function openFile() {
    if (!openUrl) {
      return
    }
    window.open(openUrl, "_blank", "noopener,noreferrer")
  }

  const active =
    task?.status === "pending" || task?.status === "running"
  // 只有覆盖模式才允许重跑已停止的任务；排队中/下载中不能打断。
  const canRestart = Boolean(task) && overwrite && !active
  // 超过上限不再禁用按钮，点击后走二次确认再强制提交。
  const disabled = active || busy || (Boolean(task) && !canRestart)

  const actionTitle = task
    ? active
      ? `已在下载任务中（${downloadStatusLabel(task.status)}）`
      : overwrite
        ? "覆盖同名文件并重新下载"
        : `已在下载任务中（${downloadStatusLabel(task.status)}）；打开「覆盖同名文件」可重新下载`
    : media.downloadable
      ? "只下载这个文件（相册不会整组展开）"
      : "超过当前账号的单文件上限；点击后二次确认仍可强行下载"
  const actionLabel = canRestart
    ? `覆盖并重新下载 ${media.file_name}`
    : task
      ? `${media.file_name} 已在下载任务中`
      : media.downloadable
        ? `只下载 ${media.file_name}`
        : `强行下载 ${media.file_name}`

  return (
    <>
      <li
        className={cn(
          "flex items-start gap-3 border-b py-2.5 first:pt-0 last:border-b-0 last:pb-0",
          canOpen && "cursor-pointer rounded-md transition-colors hover:bg-muted/40"
        )}
        role={canOpen ? "button" : undefined}
        tabIndex={canOpen ? 0 : undefined}
        title={canOpen ? `点击${openLabel}` : undefined}
        aria-label={canOpen ? `${openLabel}：${media.file_name}` : undefined}
        onClick={(event) => {
          if (!canOpen) {
            return
          }
          const target = event.target as HTMLElement
          // 行内按钮/链接的点击不触发「打开文件」。
          if (target.closest("button, a, input, textarea, select")) {
            return
          }
          openFile()
        }}
        onKeyDown={(event) => {
          if (!canOpen || event.target !== event.currentTarget) {
            return
          }
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault()
            openFile()
          }
        }}
      >
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
          {canOpen && openUrl ? (
            <a
              href={openUrl}
              target="_blank"
              rel="noreferrer"
              title={openLabel}
              aria-label={`${openLabel}：${media.file_name}`}
              className={buttonVariants({ variant: "outline", size: "icon-sm" })}
            >
              <ExternalLinkIcon />
            </a>
          ) : null}
          <Button
            variant="outline"
            size="icon-sm"
            disabled={disabled}
            onClick={() => {
              if (!media.downloadable) {
                setForceOpen(true)
                return
              }
              onDownload()
            }}
            title={actionTitle}
            aria-label={actionLabel}
          >
            {canRestart ? <RefreshCwIcon /> : <DownloadIcon />}
          </Button>
        </div>
      </li>

      <ModalDialog
        open={forceOpen}
        onOpenChange={setForceOpen}
        title="超过单文件上限"
        description={media.file_name}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setForceOpen(false)}>
              取消
            </Button>
            <Button
              onClick={() => {
                setForceOpen(false)
                onDownload(true)
              }}
            >
              仍要下载
            </Button>
          </>
        }
      >
        <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">
          <p>
            文件大小 {formatBytes(media.size)}，当前账号单文件上限{" "}
            {formatBytes(media.max_size)}。
          </p>
          <p>
            继续会强制创建下载任务；Telegram 仍可能拒绝超过账号上限的文件，
            任务可能失败。
          </p>
        </div>
      </ModalDialog>
    </>
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

/** 已完成任务的打开方式：图片看原图，音视频在浏览器播放，其余下载文件。 */
function fileActionLabel(kind: PreviewMedia["kind"]): string {
  switch (kind) {
    case "photo":
      return "查看原图"
    case "video":
      return "播放视频"
    case "audio":
      return "播放音频"
    default:
      return "下载文件"
  }
}
