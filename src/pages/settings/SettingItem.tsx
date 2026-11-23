import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  formatSettingValue,
  isEditableRow,
  knownSettings,
  settingLabel,
  type SettingRow,
} from "@/lib/settings"
import { cn } from "@/lib/utils"
import {
  BooleanSwitch,
  ProxySwitch,
} from "@/pages/settings/SettingToggles"

interface SettingItemProps {
  row: SettingRow
  onEdit: (row: SettingRow) => void
  onClear: (row: SettingRow) => void
  /** 当前账号行：打开账号选择弹窗。 */
  onPickAccount: () => void
}

/**
 * 单个配置行。
 *
 * 已知可写键可编辑/清除，只读与未识别键只展示；以中文标题为主、
 * 原始键名作为次要信息，避免整页都是 http_proxy 这类裸键。
 */
export function SettingItem({
  row,
  onEdit,
  onClear,
  onPickAccount,
}: SettingItemProps) {
  const known = knownSettings[row.key]
  // 代理行的开关单独渲染；布尔项则走通用行内开关。
  const isBoolean = known?.kind === "boolean" && !row.proxy
  const isCurrentAccount = row.key === "current_account_id"
  const editable = isEditableRow(row)
  const canClear = row.configured && (isBoolean || editable)
  const label = settingLabel(row)
  const showKey = label !== row.key
  const proxyStatus = row.proxy && row.configured
    ? row.proxy.enabled
      ? { text: "已启用", variant: "secondary" as const }
      : { text: "已停用", variant: "outline" as const }
    : null

  return (
    <li className="border-b last:border-b-0">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-medium">{label}</h3>
            {proxyStatus ? (
              <Badge variant={proxyStatus.variant}>{proxyStatus.text}</Badge>
            ) : null}
            {row.readOnly ? (
              <Badge variant="secondary">只读</Badge>
            ) : null}
            {!row.known ? <Badge variant="outline">未识别</Badge> : null}
            {showKey ? (
              <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                {row.key}
              </code>
            ) : null}
          </div>
          {row.description ? (
            <p className="text-xs text-muted-foreground">{row.description}</p>
          ) : null}
          <p
            className={cn(
              "break-all text-sm",
              row.configured && "font-mono",
              !row.configured && "text-muted-foreground"
            )}
          >
            {formatSettingValue(row)}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
          {row.proxy ? <ProxySwitch row={row} /> : null}
          {isBoolean ? <BooleanSwitch row={row} /> : null}
          {editable ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(row)}
            >
              {row.configured ? "编辑" : "设置"}
            </Button>
          ) : null}
          {canClear ? (
            <Button variant="ghost" size="sm" onClick={() => onClear(row)}>
              清除
            </Button>
          ) : null}
          {isCurrentAccount ? (
            <Button variant="outline" size="sm" onClick={onPickAccount}>
              选择账号
            </Button>
          ) : null}
        </div>
      </div>
    </li>
  )
}
