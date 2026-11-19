import { RefreshCwIcon } from "lucide-react"
import type { Health } from "@/api/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { formatUptime } from "@/lib/format"

interface ServiceInfoCardProps {
  health?: Health
  error: string | null
  loading: boolean
  hasToken: boolean
  onRetry: () => void
}

/** 设置页侧栏：health 接口给出的版本、运行时长与鉴权模式。 */
export function ServiceInfoCard({
  health,
  error,
  loading,
  hasToken,
  onRetry,
}: ServiceInfoCardProps) {
  const online = health?.status === "ok"

  return (
    <section className="rounded-xl border bg-card p-4" aria-busy={loading}>
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-sm font-medium">服务信息</h2>
        {loading ? (
          <Skeleton className="h-4 w-16 rounded-full" />
        ) : error ? (
          <Badge variant="destructive">不可用</Badge>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            {online ? "运行正常" : health?.status || "未知状态"}
          </span>
        )}
      </div>

      <dl className="mt-3 space-y-2">
        <Info label="版本" value={health?.version || "—"} />
        <Info label="运行时长" value={formatUptime(health?.uptime_seconds)} />
        <Info label="鉴权模式" value={hasToken ? "token 鉴权" : "本地免鉴权"} />
        <Info label="接口" value="/api/v1" mono />
      </dl>

      {error ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3 text-xs text-destructive">
          <span className="min-w-0 break-words">{error}</span>
          <Button variant="outline" size="xs" onClick={onRetry}>
            <RefreshCwIcon />
            重试
          </Button>
        </div>
      ) : null}
    </section>
  )
}

function Info({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd
        className={
          mono
            ? "truncate text-right font-mono text-sm"
            : "truncate text-right text-sm font-medium"
        }
        title={value}
      >
        {value}
      </dd>
    </div>
  )
}
