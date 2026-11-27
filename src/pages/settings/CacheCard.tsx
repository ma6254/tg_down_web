import { useState } from "react"
import { DatabaseIcon, Trash2Icon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ModalDialog } from "@/components/common/ModalDialog"
import { useCacheStats, useClearCache } from "@/hooks/use-cache"
import { cn } from "@/lib/utils"

/**
 * 本地缓存卡片：展示规模并提供一键清空。
 *
 * 清空只删数据库里的消息快照、会话定位与评论线程；
 * 磁盘缩略图有独立生命周期，不在这里处理。
 */
export function CacheCard({ className }: { className?: string }) {
  const stats = useCacheStats()
  const clear = useClearCache()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const data = stats.data
  const total = data ? data.messages + data.peers + data.threads : 0
  const rows = [
    { label: "消息快照", value: data?.messages },
    { label: "会话定位", value: data?.peers },
    { label: "评论线程", value: data?.threads },
  ]

  return (
    <section
      className={cn("overflow-hidden rounded-xl border bg-card", className)}
      aria-labelledby="cache-card-title"
    >
      <div className="flex items-start justify-between gap-4 border-b px-4 py-3">
        <div className="min-w-0">
          <h2
            id="cache-card-title"
            className="flex items-center gap-2 text-base font-medium"
          >
            <DatabaseIcon className="size-4 text-muted-foreground" />
            本地缓存
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            链接预览会复用本地缓存的内容；清空后第一次解析需要重新联网。
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="xs"
          className="shrink-0 text-destructive"
          disabled={stats.isPending || clear.isPending || total === 0}
          onClick={() => setConfirmOpen(true)}
        >
          <Trash2Icon />
          清空
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2 p-4">
        {rows.map((row) => (
          <div key={row.label} className="rounded-lg border bg-muted/30 px-3 py-2">
            <p className="text-xs text-muted-foreground">{row.label}</p>
            <p className="mt-0.5 text-lg font-medium tabular-nums">
              {row.value ?? "—"}
            </p>
          </div>
        ))}
      </div>

      <ModalDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="清空本地缓存"
        description={`共 ${total} 行`}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              取消
            </Button>
            <Button
              disabled={clear.isPending}
              onClick={() => {
                setConfirmOpen(false)
                clear.mutate()
              }}
            >
              清空
            </Button>
          </>
        }
      >
        <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">
          <p>
            会删除 {data?.messages ?? 0} 条消息快照、{data?.peers ?? 0} 条会话定位与{" "}
            {data?.threads ?? 0} 条评论线程。已下载的文件不受影响。
          </p>
          <p>清空后第一次预览会重新连接 Telegram，速度回到冷启动水平。</p>
        </div>
      </ModalDialog>
    </section>
  )
}
