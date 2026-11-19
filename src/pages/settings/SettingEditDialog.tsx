import { useState, type FormEvent } from "react"
import { CircleAlertIcon, LoaderCircleIcon } from "lucide-react"
import { toast } from "sonner"
import { describeError } from "@/api/client"
import { knownSettings, type SettingRow } from "@/lib/settings"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useUpdateSettings } from "@/hooks/use-settings"

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
    update.mutate(
      { [row.key]: trimmed },
      {
        onSuccess: () => {
          toast.success(`已保存 ${row.key}`)
          onClose()
        },
        onError: (err) => setError(describeError(err)),
      }
    )
  }

  return (
    <Dialog
      open={row !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
    >
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {row?.configured ? "编辑配置" : "设置配置"}
            {known ? `：${known.label}` : ""}
          </DialogTitle>
          <DialogDescription>
            {row ? `配置项 ${row.key}` : "配置项"}
          </DialogDescription>
        </DialogHeader>

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
                  修改只影响新连接，运行中的任务会沿用旧代理。
                </p>
              ) : null}
            </div>
          )}

          {error ? (
            <p
              role="alert"
              className="flex items-start gap-1.5 whitespace-pre-wrap break-words rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive"
            >
              <CircleAlertIcon className="mt-0.5 size-3.5 shrink-0" />
              <span>{error}</span>
            </p>
          ) : null}
        </form>

        <DialogFooter>
          <Button variant="outline" type="button" onClick={onClose}>
            取消
          </Button>
          <Button type="submit" form="setting-form" disabled={update.isPending}>
            {update.isPending ? (
              <LoaderCircleIcon className="animate-spin" />
            ) : null}
            {update.isPending ? "保存中…" : "保存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
