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

/** 设置页顶部：health 接口给出的版本、运行时长与鉴权模式。 */
export function ServiceInfoCard({
  health,
  error,
  loading,
  hasToken,
  onRetry,
}: ServiceInfoCardProps) {
  const online = health?.status === "ok"

  return (
    <section className="rounded-xl border bg-card p-5" aria-busy={loading}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-base font-medium">服务信息</h2>
          <p className="text-xs text-muted-foreground">
            来自 GET /api/v1/health，用于确认版本与运行状态。
          </p>
        </div>
        {loading ? (
          <Skeleton className="h-5 w-20 rounded-full" />
        ) : error ? (
          <Badge variant="destructive">不可用</Badge>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            {online ? "运行正常" : health?.status || "未知状态"}
          </span>
        )}
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Info label="版本" value={health?.version || "—"} />
        <Info label="运行时长" value={formatUptime(health?.uptime_seconds)} />
        <Info label="鉴权模式" value={hasToken ? "token 鉴权" : "本地免鉴权"} />
        <Info label="接口" value="/api/v1" mono />
      </dl>

      {error ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-destructive">
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={onRetry}>
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
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={
          mono ? "truncate font-mono text-sm" : "truncate text-sm font-medium"
        }
        title={value}
      >
        {value}
      </dd>
    </div>
  )
}
