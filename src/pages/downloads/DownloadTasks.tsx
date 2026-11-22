import { useMemo, useState } from "react"
import {
  CopyIcon,
  DownloadIcon,
  FileAudioIcon,
  FileIcon,
  FileVideoIcon,
  ImageIcon,
  PauseIcon,
  PlayIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  Trash2Icon,
} from "lucide-react"
import { toast } from "sonner"
import { describeError } from "@/api/client"
import type { DownloadAction, DownloadStatus, DownloadTask } from "@/api/types"
import { PicViewerDialog } from "@/components/PicViewer"
import { PicViewerMobileDialog } from "@/components/PicViewerMobile"
import { ModalDialog } from "@/components/common/ModalDialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  useControlDownload,
  useDeleteDownload,
  useDownloads,
} from "@/hooks/use-downloads"
import { useDownloadEvents } from "@/hooks/use-download-events"
import {
  downloadEta,
  downloadPercent,
  downloadStatusLabel,
  downloadStatusVariant,
} from "@/lib/download"
import { copyText } from "@/lib/clipboard"
import { isMobileDevice } from "@/lib/device"
import { formatBytes, formatDuration } from "@/lib/format"
import { cn } from "@/lib/utils"

const FILTERS = [
  { value: "all", label: "全部" },
  { value: "running", label: "下载中" },
  { value: "pending", label: "排队中" },
  { value: "paused", label: "已暂停" },
  { value: "done", label: "已完成" },
  { value: "failed", label: "失败" },
] as const

type FilterValue = (typeof FILTERS)[number]["value"]

const ACTION_LABELS: Record<DownloadAction, string> = {
  pause: "已暂停",
  resume: "已恢复",
  retry: "已重新排队",
}

/**
 * 下载任务面板：状态筛选、进度轮询与暂停/恢复/重试/删除。
 *
 * 数据来自 useDownloads：有进行中任务时它每 2s 轮询一次，
 * 全部结束后自动停止。
 */
export function DownloadTasks() {
  const eventsStatus = useDownloadEvents()
  const downloads = useDownloads({ poll: eventsStatus !== "connected" })
  const control = useControlDownload()
  const remove = useDeleteDownload()

  const [filter, setFilter] = useState<FilterValue>("all")
  const [deleteTarget, setDeleteTarget] = useState<DownloadTask | null>(null)
  const [deleteFile, setDeleteFile] = useState(false)
  const [viewerTask, setViewerTask] = useState<DownloadTask | null>(null)
  const isMobile = useMemo(() => isMobileDevice(), [])

  const tasks = downloads.data ?? []
  const counts = countByStatus(tasks)
  const visible =
    filter === "all" ? tasks : tasks.filter((task) => task.status === filter)

  function handleControl(task: DownloadTask, action: DownloadAction) {
    control.mutate(
      { id: task.id, action },
      {
        onSuccess: () => toast.success(`${ACTION_LABELS[action]}：${task.file_name}`),
        onError: (error) => toast.error(describeError(error)),
      }
    )
  }

  async function handleCopy(task: DownloadTask) {
    try {
      await copyText(task.link)
      toast.success("已复制源链接")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "复制失败")
    }
  }

  // 只有图片任务支持点卡片看大图；视频/音频等不处理。
  function handlePreview(task: DownloadTask) {
    if (task.kind !== "photo") {
      return
    }
    setViewerTask(task)
  }

  function confirmDelete() {
    if (!deleteTarget) {
      return
    }
    const target = deleteTarget
    remove.mutate(
      { id: target.id, deleteFile },
      {
        onSuccess: () => {
          setDeleteTarget(null)
          toast.success(`已删除任务：${target.file_name}`)
        },
        onError: (error) => toast.error(describeError(error)),
      }
    )
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex flex-wrap items-center gap-2">
          下载任务
          {tasks.length > 0 ? (
            <Badge variant="secondary" className="font-normal">
              {tasks.length}
            </Badge>
          ) : null}
          <Badge
            variant="outline"
            className="gap-1.5 font-normal"
            title={
              eventsStatus === "connected"
                ? "进度通过 SSE 实时推送"
                : "SSE 未连接，改用每 2 秒轮询"
            }
          >
            <span
              className={cn(
                "size-1.5 rounded-full",
                eventsStatus === "connected"
                  ? "bg-emerald-500"
                  : eventsStatus === "connecting"
                    ? "bg-amber-500"
                    : "bg-muted-foreground"
              )}
              aria-hidden="true"
            />
            {eventsStatus === "connected"
              ? "实时更新"
              : eventsStatus === "connecting"
                ? "连接中"
                : "已断开（轮询中）"}
          </Badge>
        </CardTitle>
        <CardAction>
          <Button
            variant="ghost"
            size="xs"
            onClick={() => void downloads.refetch()}
            disabled={downloads.isFetching}
            aria-label="刷新任务列表"
          >
            <RefreshCwIcon className={cn(downloads.isFetching && "animate-spin")} />
            刷新
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent>
        {downloads.isError ? (
          <p
            role="alert"
            className="mb-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
          >
            加载下载任务失败：{describeError(downloads.error)}
          </p>
        ) : null}

        {tasks.length === 0 ? (
          <div className="flex min-h-32 flex-col items-center justify-center gap-2 text-center">
            <DownloadIcon className="size-5 text-muted-foreground" aria-hidden="true" />
            <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
              {downloads.isPending
                ? "正在加载任务…"
                : "还没有下载任务：解析链接后，在「媒体文件」里点下载，或直接点「全部下载」。"}
            </p>
          </div>
        ) : (
          <Tabs
            value={filter}
            onValueChange={(value) => setFilter(value as FilterValue)}
          >
            <TabsList
              variant="line"
              className="mb-3 w-fit max-w-full justify-start overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {FILTERS.map((item) => (
                <TabsTrigger
                  key={item.value}
                  value={item.value}
                  className="flex-none px-2.5"
                >
                  {item.label}
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {counts[item.value]}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value={filter}>
              {visible.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  这个状态下还没有任务。
                </p>
              ) : (
                <ul>
                  {visible.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      busy={control.isPending || remove.isPending}
                      onControl={handleControl}
                      onCopy={handleCopy}
                      onPreview={handlePreview}
                      onDelete={(target) => {
                        setDeleteFile(false)
                        setDeleteTarget(target)
                      }}
                    />
                  ))}
                </ul>
              )}
            </TabsContent>
          </Tabs>
        )}
      </CardContent>

      <ModalDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null)
          }
        }}
        title="删除下载任务"
        description={deleteTarget?.file_name}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={remove.isPending}
            >
              删除
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            删除后任务记录会消失；未完成的下载会取消，断点文件 `.part` 也会清理。
          </p>
          <div className="flex items-center gap-2">
            <Switch
              id="delete-download-file"
              checked={deleteFile}
              onCheckedChange={setDeleteFile}
            />
            <Label htmlFor="delete-download-file" className="font-normal">
              同时删除已下载的文件
            </Label>
          </div>
        </div>
      </ModalDialog>

      {viewerTask ? (
        isMobile ? (
          <PicViewerMobileDialog
            open
            onOpenChange={(next) => {
              if (!next) {
                setViewerTask(null)
              }
            }}
            src={
              viewerTask.preview_url ??
              viewerTask.thumbnail_url ??
              `/api/v1/downloads/${viewerTask.id}/thumbnail`
            }
            alt={viewerTask.file_name}
            title={viewerTask.file_name}
            filePath={viewerTask.file_name}
            size={viewerTask.file_size}
            blobType={viewerTask.mime ?? "image/jpeg"}
          />
        ) : (
          <PicViewerDialog
            open
            onOpenChange={(next) => {
              if (!next) {
                setViewerTask(null)
              }
            }}
            src={
              viewerTask.preview_url ??
              viewerTask.thumbnail_url ??
              `/api/v1/downloads/${viewerTask.id}/thumbnail`
            }
            alt={viewerTask.file_name}
            filePath={viewerTask.file_name}
            blobSize={viewerTask.file_size}
            blobType={viewerTask.mime ?? "image/jpeg"}
          />
        )
      ) : null}
    </Card>
  )
}

interface TaskRowProps {
  task: DownloadTask
  busy: boolean
  onControl: (task: DownloadTask, action: DownloadAction) => void
  onCopy: (task: DownloadTask) => void
  onPreview: (task: DownloadTask) => void
  onDelete: (task: DownloadTask) => void
}

function TaskRow({ task, busy, onControl, onCopy, onPreview, onDelete }: TaskRowProps) {
  const percent = downloadPercent(task)
  const eta = downloadEta(task)
  const running = task.status === "running"
  const showProgress =
    running || task.status === "pending" || task.status === "paused"
  const canPreview = task.kind === "photo"

  return (
    <li
      className={cn(
        "space-y-2 border-b py-3 first:pt-0 last:border-b-0 last:pb-0",
        canPreview && "cursor-zoom-in"
      )}
      role={canPreview ? "button" : undefined}
      tabIndex={canPreview ? 0 : undefined}
      aria-label={canPreview ? `查看大图：${task.file_name}` : undefined}
      onClick={(event) => {
        if (!canPreview) {
          return
        }
        // 行内按钮/链接的点击不触发预览。
        const target = event.target as HTMLElement
        if (target.closest("button, a, input, textarea, select")) {
          return
        }
        onPreview(task)
      }}
      onKeyDown={(event) => {
        if (!canPreview || event.target !== event.currentTarget) {
          return
        }
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onPreview(task)
        }
      }}
    >
      <div className="flex items-start gap-3">
        <TaskCover task={task} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium" title={task.file_name}>
            {task.file_name}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {taskMeta(task)}
          </p>
        </div>

        <Badge variant={downloadStatusVariant(task.status)} className="shrink-0">
          {downloadStatusLabel(task.status)}
        </Badge>

        <div className="flex shrink-0 items-center gap-1">
          {task.status === "running" || task.status === "pending" ? (
            <Button
              variant="outline"
              size="icon-sm"
              disabled={busy}
              onClick={() => onControl(task, "pause")}
              title="暂停"
              aria-label={`暂停 ${task.file_name}`}
            >
              <PauseIcon />
            </Button>
          ) : null}
          {task.status === "paused" ? (
            <Button
              variant="outline"
              size="icon-sm"
              disabled={busy}
              onClick={() => onControl(task, "resume")}
              title="继续"
              aria-label={`继续 ${task.file_name}`}
            >
              <PlayIcon />
            </Button>
          ) : null}
          {task.status === "failed" ? (
            <Button
              variant="outline"
              size="icon-sm"
              disabled={busy}
              onClick={() => onControl(task, "retry")}
              title="重试"
              aria-label={`重试 ${task.file_name}`}
            >
              <RotateCcwIcon />
            </Button>
          ) : null}
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => onCopy(task)}
            title="复制源链接"
            aria-label={`复制 ${task.file_name} 的源链接`}
          >
            <CopyIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={busy}
            onClick={() => onDelete(task)}
            title="删除任务"
            aria-label={`删除 ${task.file_name}`}
          >
            <Trash2Icon />
          </Button>
        </div>
      </div>

      {showProgress ? (
        <div className="space-y-1">
          <Progress value={percent} aria-label={`下载进度 ${percent}%`} />
          <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground tabular-nums">
            <span>
              {formatBytes(task.offset)} / {formatBytes(task.file_size)}（{percent}%）
            </span>
            <span>
              {running && task.speed > 0
                ? `${formatBytes(task.speed)}/s${eta !== null ? ` · 剩余 ${formatDuration(eta)}` : ""}`
                : downloadStatusLabel(task.status)}
            </span>
          </div>
        </div>
      ) : null}

      {task.status === "failed" && task.error ? (
        <p className="text-xs break-words text-destructive">{task.error}</p>
      ) : null}

      {task.status === "done" && task.save_path ? (
        <p className="truncate text-xs text-muted-foreground" title={task.save_path}>
          已保存到 {task.save_path}
        </p>
      ) : null}
    </li>
  )
}

/** 任务封面：优先用创建时登记的缩略图，失效时回退到按 ID 惰性生成的接口。 */
function TaskCover({ task }: { task: DownloadTask }) {
  // token 地址 30 分钟后过期、服务重启后全部失效，历史数据里还可能有重复前缀；
  // 第一个地址失败就换 /downloads/{id}/thumbnail 重新解析生成，两个都失败才用图标。
  const sources = [
    task.thumbnail_url,
    `/api/v1/downloads/${task.id}/thumbnail`,
  ].filter((src): src is string => Boolean(src))
  const [attempt, setAttempt] = useState(0)
  const src = sources[attempt]
  const Icon =
    task.kind === "photo"
      ? ImageIcon
      : task.kind === "video"
        ? FileVideoIcon
        : task.kind === "audio"
          ? FileAudioIcon
          : FileIcon

  if (src) {
    return (
      <img
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setAttempt((current) => current + 1)}
        className="size-10 shrink-0 rounded-md border bg-muted object-cover"
      />
    )
  }

  return (
    <span
      className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
      aria-hidden="true"
    >
      <Icon className="size-4" />
    </span>
  )
}

/** 会话 · 类型 · 大小。 */
function taskMeta(task: DownloadTask): string {
  return [
    task.chat_title,
    kindLabel(task.kind),
    formatBytes(task.file_size),
  ]
    .filter(Boolean)
    .join(" · ")
}

function kindLabel(kind?: string): string {
  switch (kind) {
    case "photo":
      return "图片"
    case "video":
      return "视频"
    case "audio":
      return "音频"
    case "document":
      return "文件"
    default:
      return ""
  }
}

/** 统计每个筛选项的任务数；all 是总数。 */
function countByStatus(tasks: DownloadTask[]): Record<FilterValue, number> {
  const counts: Record<FilterValue, number> = {
    all: tasks.length,
    running: 0,
    pending: 0,
    paused: 0,
    done: 0,
    failed: 0,
  }
  for (const task of tasks) {
    counts[task.status as DownloadStatus] += 1
  }
  return counts
}
