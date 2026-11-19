import { Link } from "react-router-dom"
import type { SettingRow } from "@/lib/settings"
import { maskProxyUrl } from "@/lib/mask"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"

interface SettingsListProps {
  rows: SettingRow[]
  onEdit: (row: SettingRow) => void
  onClear: (row: SettingRow) => void
}

/** 配置项列表：已知可写键可编辑/清除，只读与未识别键只展示。 */
export function SettingsList({ rows, onEdit, onClear }: SettingsListProps) {
  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <h2 className="text-base font-medium">配置项</h2>
        <span className="text-xs text-muted-foreground">{rows.length} 项</span>
      </div>
      <ul>
        {rows.map((row) => {
          const editable = row.known && !row.readOnly
          const isCurrentAccount = row.key === "current_account_id"

          return (
            <li key={row.key} className="border-b last:border-b-0">
              <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs">
                      {row.key}
                    </code>
                    {!row.known ? (
                      <Badge variant="outline">未识别</Badge>
                    ) : null}
                    {row.readOnly ? (
                      <Badge variant="secondary">只读</Badge>
                    ) : null}
                  </div>
                  {row.description ? (
                    <p className="text-xs text-muted-foreground">
                      {row.description}
                    </p>
                  ) : null}
                  <p
                    className={cn(
                      "break-all text-sm",
                      row.configured &&
                        row.key !== "http_proxy_enabled" &&
                        "font-mono",
                      !row.configured && "text-muted-foreground"
                    )}
                  >
                    {displayValue(row)}
                  </p>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-1">
                  {editable ? (
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
                    <Link
                      to="/accounts"
                      className={buttonVariants({ variant: "ghost", size: "sm" })}
                    >
                      去账号页
                    </Link>
                  ) : null}
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function displayValue(row: SettingRow): string {
  if (row.key === "http_proxy_enabled") {
    if (!row.configured) {
      return row.defaultValue === "false" ? "已禁用（默认）" : "已启用（默认）"
    }
    if (row.value === "false") {
      return "已禁用（直连）"
    }
    return row.value === "true" ? "已启用" : row.value || "—"
  }
  if (!row.configured) {
    return row.key === "http_proxy" ? "未配置（直连）" : "未配置"
  }
  if (row.key === "http_proxy") {
    return maskProxyUrl(row.value)
  }
  return row.value || "—"
}
