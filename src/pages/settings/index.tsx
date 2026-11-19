import { useState } from "react"
import { RefreshCwIcon } from "lucide-react"
import { describeError } from "@/api/client"
import { ErrorState } from "@/components/common/ErrorState"
import { PageHeader } from "@/components/layout/PageHeader"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/hooks/use-auth"
import { useHealthStatus, useSettings } from "@/hooks/use-settings"
import { buildSettingRows, type SettingRow } from "@/lib/settings"
import { ClearSettingDialog } from "@/pages/settings/ClearSettingDialog"
import { ServiceInfoCard } from "@/pages/settings/ServiceInfoCard"
import { SettingEditDialog } from "@/pages/settings/SettingEditDialog"
import { SettingsList } from "@/pages/settings/SettingsList"

/** 设置页：服务信息 + 配置项查看/编辑/清除。 */
export function SettingsPage() {
  const settingsQuery = useSettings()
  const healthQuery = useHealthStatus()
  const { token } = useAuth()
  const [editing, setEditing] = useState<SettingRow | null>(null)
  const [clearing, setClearing] = useState<SettingRow | null>(null)

  const rows = settingsQuery.data
    ? buildSettingRows(settingsQuery.data.settings)
    : []
  const refreshing = settingsQuery.isFetching || healthQuery.isFetching

  function refresh() {
    void settingsQuery.refetch()
    void healthQuery.refetch()
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader
        title="设置"
        description="查看并修改服务端配置。修改立即生效；运行中的任务沿用旧连接。"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={refreshing}
          >
            <RefreshCwIcon className={refreshing ? "animate-spin" : undefined} />
            刷新
          </Button>
        }
      />

      <div className="space-y-4">
        <ServiceInfoCard
          health={healthQuery.data}
          error={
            healthQuery.error ? describeError(healthQuery.error) : null
          }
          loading={healthQuery.isPending}
          hasToken={Boolean(token)}
          onRetry={() => void healthQuery.refetch()}
        />

        {settingsQuery.isPending ? (
          <SettingsSkeleton />
        ) : settingsQuery.error ? (
          <ErrorState
            title="读取配置失败"
            message={describeError(settingsQuery.error)}
            onRetry={() => void settingsQuery.refetch()}
          />
        ) : (
          <SettingsList
            rows={rows}
            onEdit={(row) => setEditing(row)}
            onClear={(row) => setClearing(row)}
          />
        )}

        <p className="text-xs text-muted-foreground">
          配置项由后端 config.items 定义；未登记的键只读展示，无法在 Web 中修改。
        </p>
      </div>

      <SettingEditDialog
        key={editing ? `edit-${editing.key}` : "edit-none"}
        row={editing}
        onClose={() => setEditing(null)}
      />
      <ClearSettingDialog
        key={clearing ? `clear-${clearing.key}` : "clear-none"}
        row={clearing}
        onClose={() => setClearing(null)}
      />
    </div>
  )
}

function SettingsSkeleton() {
  return (
    <div
      className="overflow-hidden rounded-xl border bg-card"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">正在加载配置…</span>
      <div className="border-b px-4 py-3">
        <Skeleton className="h-5 w-24" />
      </div>
      <div className="space-y-4 p-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
  )
}
