import { useState } from "react"
import { RefreshCwIcon } from "lucide-react"
import { toast } from "sonner"
import { describeError } from "@/api/client"
import type { Account } from "@/api/types"
import { AccountPickerDialog } from "@/components/accounts/AccountPickerDialog"
import { ErrorState } from "@/components/common/ErrorState"
import { PageHeader } from "@/components/layout/PageHeader"
import { Button } from "@/components/ui/button"
import { useSelectAccount } from "@/hooks/use-accounts"
import { useAuth } from "@/hooks/use-auth"
import { useHealthStatus, useSettings, useSystemInfo } from "@/hooks/use-settings"
import { buildSettingRows, type SettingRow } from "@/lib/settings"
import { ClearSettingDialog } from "@/pages/settings/ClearSettingDialog"
import { ServiceInfoCard } from "@/pages/settings/ServiceInfoCard"
import { SettingEditDialog } from "@/pages/settings/SettingEditDialog"
import { SettingsList } from "@/pages/settings/SettingsList"
import { SettingsSkeleton } from "@/pages/settings/SettingsSkeleton"
import { SettingsTips } from "@/pages/settings/SettingsTips"
import { SettingsWriteOverlay } from "@/pages/settings/SettingsWriteOverlay"
import { WebSettingsCard } from "@/pages/settings/WebSettingsCard"

/**
 * 设置页：左侧按语义分组的配置项，右侧服务信息与说明。
 *
 * 窄屏改单列，服务信息在前、配置在后。页面本身只负责数据获取、
 * 弹窗开关与布局；行展示、写入遮罩等细节见同目录下的子组件。
 */
export function SettingsPage() {
  const settingsQuery = useSettings()
  const healthQuery = useHealthStatus()
  const systemQuery = useSystemInfo()
  const select = useSelectAccount()
  const { token } = useAuth()
  const [editing, setEditing] = useState<SettingRow | null>(null)
  const [clearing, setClearing] = useState<SettingRow | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)

  const rows = settingsQuery.data
    ? buildSettingRows(settingsQuery.data.settings)
    : []
  const refreshing =
    settingsQuery.isFetching ||
    healthQuery.isFetching ||
    systemQuery.isFetching

  function refresh() {
    void settingsQuery.refetch()
    void healthQuery.refetch()
    void systemQuery.refetch()
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
        description="查看并修改服务端配置与网页偏好。"
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
            system={systemQuery.data}
            error={
              healthQuery.error ? describeError(healthQuery.error) : null
            }
            loading={healthQuery.isPending}
            hasToken={Boolean(token)}
            onRetry={refresh}
          />
          <SettingsTips />
        </aside>

        <div className="order-2 space-y-4 xl:order-1 xl:col-start-1 xl:row-start-1">
          <WebSettingsCard />
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
              onEdit={setEditing}
              onClear={setClearing}
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
      <SettingsWriteOverlay switchingAccount={select.isPending} />
    </div>
  )
}
