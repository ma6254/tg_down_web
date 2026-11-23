import { LoaderCircleIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export interface GlobalLoadingOverlayProps {
  /** 是否显示；false 时不渲染任何节点。 */
  open: boolean
  /** 主提示，默认「正在保存…」。 */
  label?: string
  /** 可选的补充说明。 */
  description?: string
  className?: string
}

/**
 * 全局遮罩等待层：铺满视口并拦截鼠标/触摸，用于「请求期间不应继续操作」的写入场景。
 *
 * 遮罩挂载后先以 150ms 的延迟淡入，再显示转圈：本机服务响应很快时不会闪一下。
 * z-index 高于 Base UI 弹窗（z-50），因此保存中的对话框也会被一起挡住。
 */
export function GlobalLoadingOverlay({
  open,
  label = "正在保存…",
  description,
  className,
}: GlobalLoadingOverlayProps) {
  if (!open) {
    return null
  }

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      data-slot="global-loading-overlay"
      className={cn(
        "fixed inset-0 z-[100] flex cursor-progress items-center justify-center bg-background/70 p-4 backdrop-blur-sm",
        "animate-in fade-in-0 fill-mode-backwards delay-150 duration-150 select-none motion-reduce:animate-none",
        className
      )}
    >
      <div className="flex w-full max-w-xs flex-col items-center gap-3 rounded-xl border bg-popover px-6 py-5 text-center text-popover-foreground shadow-lg">
        <LoaderCircleIcon
          className="size-6 animate-spin text-primary motion-reduce:animate-none"
          aria-hidden="true"
        />
        <div className="space-y-1">
          <p className="text-sm font-medium">{label}</p>
          {description ? (
            <p className="text-xs leading-relaxed text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
