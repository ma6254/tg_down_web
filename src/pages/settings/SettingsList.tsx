import { groupSettingRows, type SettingRow } from "@/lib/settings"
import { SettingItem } from "@/pages/settings/SettingItem"

interface SettingsListProps {
  rows: SettingRow[]
  onEdit: (row: SettingRow) => void
  onClear: (row: SettingRow) => void
  /** 当前账号行：打开账号选择弹窗。 */
  onPickAccount: () => void
}

/**
 * 配置项列表：按语义分组成卡片（网络 / 下载 / API / 账号 / 其他）。
 *
 * 分组、行内展示与写入操作分别由 `groupSettingRows` 与 `SettingItem` 负责，
 * 这里只负责卡片外壳与标题。
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
