import { CircleAlertIcon } from "lucide-react"

/** 配置写入失败时的内联错误块；编辑与清除弹窗共用。 */
export function SettingError({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="flex items-start gap-1.5 whitespace-pre-wrap break-words rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive"
    >
      <CircleAlertIcon className="mt-0.5 size-3.5 shrink-0" />
      <span>{message}</span>
    </p>
  )
}
