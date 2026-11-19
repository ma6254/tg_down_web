import { useState } from "react"
import { CircleAlertIcon, LoaderCircleIcon } from "lucide-react"
import { toast } from "sonner"
import { describeError } from "@/api/client"
import type { SettingRow } from "@/lib/settings"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useUpdateSettings } from "@/hooks/use-settings"

interface ClearSettingDialogProps {
  row: SettingRow | null
  onClose: () => void
}

/** 清除配置：值为 null 的 PUT 补丁；代理会回到直连。 */
export function ClearSettingDialog({ row, onClose }: ClearSettingDialogProps) {
  const [error, setError] = useState<string | null>(null)
  const update = useUpdateSettings()

  function handleClear() {
    if (!row || update.isPending) {
      return
    }
    setError(null)
    update.mutate(
      { [row.key]: null },
      {
        onSuccess: () => {
          toast.success(`已清除 ${row.key}`)
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
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>清除配置</DialogTitle>
          <DialogDescription>
            {row ? `确定清除 ${row.key}？` : "确定清除该配置？"}
          </DialogDescription>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          {row?.key === "http_proxy"
            ? "清除后 http_proxy 恢复为未配置（直连），后续新任务不再走代理。"
            : row?.key === "http_proxy_enabled"
              ? "清除后恢复默认（启用代理），不会删除已配置的 http_proxy 地址。"
              : "清除后该项配置会从服务端删除。"}
        </p>

        {error ? (
          <p
            role="alert"
            className="flex items-start gap-1.5 whitespace-pre-wrap break-words rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive"
          >
            <CircleAlertIcon className="mt-0.5 size-3.5 shrink-0" />
            <span>{error}</span>
          </p>
        ) : null}

        <DialogFooter>
          <Button variant="outline" type="button" onClick={onClose}>
            取消
          </Button>
          <Button
            variant="destructive"
            type="button"
            onClick={handleClear}
            disabled={update.isPending}
          >
            {update.isPending ? (
              <LoaderCircleIcon className="animate-spin" />
            ) : null}
            {update.isPending ? "清除中…" : "清除"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
