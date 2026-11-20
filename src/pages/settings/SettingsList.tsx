import { toast } from "sonner"
import { describeError } from "@/api/client"
import {
  groupSettingRows,
  isEditableRow,
  knownSettings,
  settingLabel,
  type SettingRow,
} from "@/lib/settings"
import { maskProxyUrl } from "@/lib/mask"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { useUpdateSettings } from "@/hooks/use-settings"

interface SettingsListProps {
  rows: SettingRow[]
  onEdit: (row: SettingRow) => void
  onClear: (row: SettingRow) => void
  /** 当前账号行：打开账号选择弹窗。 */
  onPickAccount: () => void
}

/**
 * 配置项列表：按语义分组成卡片（网络 / 账号 / 其他）。
 *
 * 已知可写键可编辑/清除，只读与未识别键只展示；每行以中文标题为主、
 * 原始键名作为次要信息，避免整页都是 http_proxy 这类裸键。
 */
export function SettingsList({
  rows,
  onEdit,
  onClear,
  onPickAccount,
}: SettingsListProps) {
  const groups = groupSettingRows(rows)

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <section
          key={group.key}
          className="overflow-hidden rounded-xl border bg-card"
          aria-labelledby={`settings-group-${group.key}`}
        >
          <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
            <div className="min-w-0 space-y-0.5">
              <h2
                id={`settings-group-${group.key}`}
                className="text-base font-medium"
              >
                {group.title}
              </h2>
              <p className="text-xs text-muted-foreground">
                {group.description}
              </p>
            </div>
          </div>
          <ul>
            {group.rows.map((row) => (
              <SettingItem
                key={row.key}
                row={row}
                onEdit={onEdit}
                onClear={onClear}
                onPickAccount={onPickAccount}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function SettingItem({
  row,
  onEdit,
  onClear,
  onPickAccount,
}: {
  row: SettingRow
  onEdit: (row: SettingRow) => void
  onClear: (row: SettingRow) => void
  onPickAccount: () => void
}) {
  const known = knownSettings[row.key]
  const isBoolean = known?.kind === "boolean" && !row.proxy
  const isCurrentAccount = row.key === "current_account_id"
  const label = settingLabel(row)
  const showKey = label !== row.key
  const proxyStatus = row.proxy
    ? !row.configured
      ? null
      : row.proxy.enabled
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
            {displayValue(row)}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
          {row.proxy ? <ProxyEnabledSwitch row={row} /> : null}
          {isBoolean ? (
            <>
              <BooleanSwitch row={row} />
              {row.configured ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onClear(row)}
                >
                  清除
                </Button>
              ) : null}
            </>
          ) : null}
          {isEditableRow(row) ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEdit(row)}
              >
                {row.configured ? "编辑" : "设置"}
              </Button>
              {row.configured ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onClear(row)}
                >
                  清除
                </Button>
              ) : null}
            </>
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

/**
 * http_proxy 行内的启用开关。
 *
 * 后端仍把 http_proxy_enabled 当作独立配置项，这里只把开关放进代理行：
 * 切换时单独写 http_proxy_enabled，不碰代理地址。
 */
function ProxyEnabledSwitch({ row }: { row: SettingRow }) {
  const update = useUpdateSettings()
  const toggle = row.proxy
  if (!toggle) {
    return null
  }

  function handleChange(checked: boolean) {
    if (update.isPending) {
      return
    }
    update.mutate(
      { http_proxy_enabled: checked ? "true" : "false" },
      {
        onSuccess: () => {
          toast.success(checked ? "已启用出站代理" : "已停用出站代理（直连）")
        },
        onError: (err) => toast.error(describeError(err)),
      }
    )
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">启用</span>
      <Switch
        checked={toggle.enabled}
        onCheckedChange={handleChange}
        disabled={!row.known || !row.configured || update.isPending}
        aria-label="启用出站代理"
        title={row.configured ? undefined : "先设置代理地址"}
      />
    </div>
  )
}

/** 通用布尔配置项的行内开关（例如「使用自定义 API」）。 */
function BooleanSwitch({ row }: { row: SettingRow }) {
  const update = useUpdateSettings()
  const checked = row.configured
    ? row.value === "true"
    : row.defaultValue === "true"

  function handleChange(next: boolean) {
    if (update.isPending) {
      return
    }
    update.mutate(
      { [row.key]: next ? "true" : "false" },
      {
        onSuccess: () => {
          toast.success(`${settingLabel(row)}：${next ? "已启用" : "已关闭"}`)
        },
        onError: (err) => toast.error(describeError(err)),
      }
    )
  }

  return (
    <Switch
      checked={checked}
      onCheckedChange={handleChange}
      disabled={update.isPending}
      aria-label={settingLabel(row)}
    />
  )
}

function displayValue(row: SettingRow): string {
  if (knownSettings[row.key]?.kind === "boolean") {
    if (!row.configured) {
      return row.defaultValue === "true"
        ? "未设置（默认启用）"
        : "未设置（默认关闭）"
    }
    return row.value.toLowerCase() === "true" ? "已启用" : "已停用"
  }
  if (row.key === "current_account_id") {
    return row.value ? `#${row.value}` : "未选择"
  }
  if (!row.configured) {
    return row.key === "http_proxy" ? "未配置（直连）" : "未配置"
  }
  if (row.key === "http_proxy") {
    return maskProxyUrl(row.value)
  }
  if (row.key === "api_hash") {
    return maskSecret(row.value)
  }
  return row.value || "—"
}

/** 脱敏展示密钥：保留首尾各 4 位。 */
function maskSecret(value: string): string {
  const text = value.trim()
  if (!text) {
    return "—"
  }
  if (text.length <= 8) {
    return "•".repeat(text.length)
  }
  return `${text.slice(0, 4)}${"•".repeat(8)}${text.slice(-4)}`
}
