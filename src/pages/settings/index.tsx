import { useState } from "react"
import { RefreshCwIcon } from "lucide-react"
import { toast } from "sonner"
import { describeError } from "@/api/client"
import type { Account } from "@/api/types"
import { AccountPickerDialog } from "@/components/accounts/AccountPickerDialog"
import { ErrorState } from "@/components/common/ErrorState"
import { PageHeader } from "@/components/layout/PageHeader"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useSelectAccount } from "@/hooks/use-accounts"
import { useAuth } from "@/hooks/use-auth"
import { useHealthStatus, useSettings } from "@/hooks/use-settings"
import { buildSettingRows, type SettingRow } from "@/lib/settings"
import { ClearSettingDialog } from "@/pages/settings/ClearSettingDialog"
import { ServiceInfoCard } from "@/pages/settings/ServiceInfoCard"
import { SettingEditDialog } from "@/pages/settings/SettingEditDialog"
import { SettingsList } from "@/pages/settings/SettingsList"

/**
 * 设置页：左侧按语义分组的配置项，右侧服务信息与说明。
 *
 * 窄屏改单列，服务信息在前、配置在后。
 */
export function SettingsPage() {
  const settingsQuery = useSettings()
  const healthQuery = useHealthStatus()
  const select = useSelectAccount()
  const { token } = useAuth()
  const [editing, setEditing] = useState<SettingRow | null>(null)
  const [clearing, setClearing] = useState<SettingRow | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)

  const rows = settingsQuery.data
    ? buildSettingRows(settingsQuery.data.settings)
    : []
  const refreshing = settingsQuery.isFetching || healthQuery.isFetching

  function refresh() {
    void settingsQuery.refetch()
    void healthQuery.refetch()
  }

  function handlePickAccount(account: Account) {
    if (account.current) {
      toast.info(`当前账号已是 ${account.name}`)
      return
    }
    select.mutate(account.id, {
      onSuccess: () => {
        toast.success(`已切换为 ${account.name}`)
        // current_account_id 是只读配置项，切换后重新拉一次配置。
        void settingsQuery.refetch()
      },
      onError: (err) => toast.error(describeError(err)),
    })
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      <PageHeader
        title="设置"
        description="查看并修改服务端配置。"
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

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_17rem] xl:items-start">
        <aside className="order-1 space-y-4 xl:order-2 xl:col-start-2 xl:row-start-1">
          <ServiceInfoCard
            health={healthQuery.data}
            error={
              healthQuery.error ? describeError(healthQuery.error) : null
            }
            loading={healthQuery.isPending}
            hasToken={Boolean(token)}
            onRetry={() => void healthQuery.refetch()}
          />
          <SettingsTips />
        </aside>

        <div className="order-2 space-y-4 xl:order-1 xl:col-start-1 xl:row-start-1">
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
              onPickAccount={() => setPickerOpen(true)}
            />
          )}
        </div>
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
      <AccountPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onConfirm={handlePickAccount}
      />
    </div>
  )
}

/** 侧栏说明：修改时机与配置项来源。 */
function SettingsTips() {
  return (
    <section className="rounded-xl border bg-card p-4">
      <h2 className="text-sm font-medium">说明</h2>
      <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
        <li>修改立即生效；运行中的任务沿用旧连接。</li>
        <li>
          配置项由后端 config.items 定义，未登记的键只读展示，无法在 Web 中修改。
        </li>
      </ul>
    </section>
  )
}

function SettingsSkeleton() {
  return (
    <div
      className="space-y-4"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">正在加载配置…</span>
      {[0, 1].map((index) => (
        <div
          key={index}
          className="overflow-hidden rounded-xl border bg-card"
        >
          <div className="border-b px-4 py-3">
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="space-y-3 p-4">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-8 w-24" />
          </div>
        </div>
      ))}
    </div>
  )
}
