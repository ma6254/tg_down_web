import { Switch } from "@/components/ui/switch"
import { useToggleSetting } from "@/hooks/use-settings"
import {
  PROXY_ENABLED_KEY,
  settingLabel,
  settingSwitchChecked,
  type SettingRow,
} from "@/lib/settings"

/** 通用布尔配置项的行内开关（例如「使用自定义 API」）。 */
export function BooleanSwitch({ row }: { row: SettingRow }) {
  const { toggle, pending } = useToggleSetting(row.key, (enabled) =>
    `${settingLabel(row)}：${enabled ? "已启用" : "已关闭"}`
  )

  return (
    <Switch
      checked={settingSwitchChecked(row)}
      onCheckedChange={toggle}
      disabled={pending}
      aria-label={settingLabel(row)}
    />
  )
}

/**
 * http_proxy 行内的启用开关。
 *
 * 后端仍把 http_proxy_enabled 当作独立配置项，这里只把开关放进代理行：
 * 切换时单独写 http_proxy_enabled，不碰代理地址。
 */
export function ProxySwitch({ row }: { row: SettingRow }) {
  const proxy = row.proxy
  const { toggle, pending } = useToggleSetting(PROXY_ENABLED_KEY, (enabled) =>
    enabled ? "已启用出站代理" : "已停用出站代理（直连）"
  )

  if (!proxy) {
    return null
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">启用</span>
      <Switch
        checked={proxy.enabled}
        onCheckedChange={toggle}
        disabled={!row.known || !row.configured || pending}
        aria-label="启用出站代理"
        title={row.configured ? undefined : "先设置代理地址"}
      />
    </div>
  )
}
