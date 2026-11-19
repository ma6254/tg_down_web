import { useState } from "react"
import { CircleAlertIcon, LoaderCircleIcon } from "lucide-react"
import { toast } from "sonner"
import { describeError } from "@/api/client"
import type { SettingsPatch } from "@/api/types"
import type { SettingRow } from "@/lib/settings"
import { ModalDialog } from "@/components/common/ModalDialog"
import { Button } from "@/components/ui/button"
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
    const patch: SettingsPatch = { [row.key]: null }
    // http_proxy 行合并了启用开关：两个键一起恢复默认，
    // 避免留下「开关已启用、却没有代理地址」的半套配置。
    if (row.key === "http_proxy") {
      patch.http_proxy_enabled = null
    }
    update.mutate(patch, {
      onSuccess: () => {
        toast.success(
          row.key === "http_proxy" ? "已清除出站代理" : `已清除 ${row.key}`
        )
        onClose()
      },
      onError: (err) => setError(describeError(err)),
    })
  }

  return (
    <ModalDialog
      open={row !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
      title="清除配置"
      description={
        row?.key === "http_proxy"
          ? "确定清除出站代理？"
          : row
            ? `确定清除 ${row.key}？`
            : "确定清除该配置？"
      }
      size="sm"
      footer={
        <>
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
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {row?.key === "http_proxy"
            ? "清除后出站代理恢复默认：删除代理地址（直连），启用开关也回到默认值。"
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
      </div>
    </ModalDialog>
  )
}
