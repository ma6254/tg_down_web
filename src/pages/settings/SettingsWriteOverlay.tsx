import { useIsMutating } from "@tanstack/react-query"
import { GlobalLoadingOverlay } from "@/components/common/GlobalLoadingOverlay"
import { UPDATE_SETTINGS_MUTATION_KEY } from "@/hooks/use-settings"

interface SettingsWriteOverlayProps {
  /** 切换账号的 POST 是否在途；账号选择弹窗关闭后仍可能未完成。 */
  switchingAccount: boolean
}

/**
 * 设置页写入遮罩。
 *
 * 两类写请求共用一层遮罩：配置 PUT（`useUpdateSettings` 的 mutation key）
 * 与切换账号 POST。账号切换优先展示，避免两个提示同时出现。
 */
export function SettingsWriteOverlay({
  switchingAccount,
}: SettingsWriteOverlayProps) {
  const savingSettings =
    useIsMutating({ mutationKey: UPDATE_SETTINGS_MUTATION_KEY }) > 0

  if (switchingAccount) {
    return (
      <GlobalLoadingOverlay
        open
        label="正在切换账号…"
        description="正在同步 Telegram 登录状态，请稍候。"
      />
    )
  }

  return (
    <GlobalLoadingOverlay
      open={savingSettings}
      label="正在保存配置…"
      description="配置写入完成前请勿重复操作。"
    />
  )
}
