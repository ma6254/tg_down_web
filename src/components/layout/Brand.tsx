import { DownloadIcon } from "lucide-react"
import { cn } from "@/lib/utils"

/** 应用标识：图标 + 名称，侧栏与登录页共用。 */
export function Brand({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
        <DownloadIcon className="size-4" aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="truncate text-sm font-semibold tracking-tight">tg_down</span>
        <span className="truncate text-[11px] text-muted-foreground">
          Telegram 下载工具
        </span>
      </span>
    </div>
  )
}
