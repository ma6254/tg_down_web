import { useState, type FormEvent } from "react"
import { LoaderCircleIcon } from "lucide-react"
import { toast } from "sonner"
import { describeError } from "@/api/client"
import { knownSettings, type SettingRow } from "@/lib/settings"
import { ModalDialog } from "@/components/common/ModalDialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useUpdateSettings } from "@/hooks/use-settings"
import { SettingError } from "@/pages/settings/SettingError"

interface SettingEditDialogProps {
  row: SettingRow | null
  onClose: () => void
}

/** 编辑/首次设置一个已知可写配置项。 */
export function SettingEditDialog({ row, onClose }: SettingEditDialogProps) {
  const known = row ? knownSettings[row.key] : undefined
  const initialValue =
    row?.value ||
    (known?.kind === "boolean"
      ? row?.defaultValue || known?.defaultValue || "true"
      : "")
  const [value, setValue] = useState(initialValue)
  const [error, setError] = useState<string | null>(null)
  const update = useUpdateSettings()

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!row || update.isPending) {
      return
    }

    const trimmed = value.trim()
    if (!trimmed) {
      setError("请输入配置值")
      return
    }
    const validation = known?.validate?.(trimmed)
    if (validation) {
      setError(validation)
      return
    }

    setError(null)
    // 首次设置代理地址时顺带启用开关：否则用户还要再回去拨一次行内开关，
    // 而且服务端默认值可能正好是禁用。已配置过地址时不改开关状态。
    const patch: Record<string, string> = { [row.key]: trimmed }
    if (known?.kind === "proxy" && !row.configured) {
      patch.http_proxy_enabled = "true"
    }
    update.mutate(patch, {
      onSuccess: () => {
        toast.success(`已保存 ${row.key}`)
        onClose()
      },
      onError: (err) => setError(describeError(err)),
    })
  }

  return (
    <ModalDialog
      open={row !== null}
      onOpenChange={(open) => {
        // 写入在途时不允许关闭：请求失败还要把错误留在弹窗里展示。
        if (!open && !update.isPending) {
          onClose()
        }
      }}
      title={
        <>
          {row?.configured ? "编辑配置" : "设置配置"}
          {known ? `：${known.label}` : ""}
        </>
      }
      description={row ? `配置项 ${row.key}` : "配置项"}
      size="md"
      footer={
        <>
          <Button
            variant="outline"
            type="button"
            onClick={onClose}
            disabled={update.isPending}
          >
            取消
          </Button>
          <Button type="submit" form="setting-form" disabled={update.isPending}>
            {update.isPending ? (
              <LoaderCircleIcon className="animate-spin" />
            ) : null}
            {update.isPending ? "保存中…" : "保存"}
          </Button>
        </>
      }
    >
      <form id="setting-form" className="space-y-4" onSubmit={handleSubmit}>
        {known?.kind === "boolean" ? (
          <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="setting-boolean">{known.label}</Label>
              <p className="text-xs text-muted-foreground">
                {known.description}
              </p>
            </div>
            <Switch
              id="setting-boolean"
              checked={value === "true"}
              onCheckedChange={(checked) =>
                setValue(checked ? "true" : "false")
              }
              disabled={update.isPending}
            />
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="setting-value">{known?.label ?? "值"}</Label>
            <Input
              id="setting-value"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder={known?.placeholder ?? "输入配置值"}
              autoComplete="off"
              spellCheck={false}
              autoFocus
              disabled={update.isPending}
            />
            {known?.description ? (
              <p className="text-xs text-muted-foreground">
                {known.description}
              </p>
            ) : null}
            {known?.kind === "proxy" ? (
              <p className="text-xs text-muted-foreground">
                {row?.configured
                  ? "修改只影响新连接，运行中的任务会沿用旧代理。"
                  : "首次设置会同时启用代理开关（http_proxy_enabled）。"}
              </p>
            ) : null}
          </div>
        )}

        {error ? <SettingError message={error} /> : null}
      </form>
    </ModalDialog>
  )
}
