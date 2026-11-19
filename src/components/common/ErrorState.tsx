import { CircleAlertIcon, RefreshCwIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ErrorStateProps {
  title?: string
  message: string
  onRetry?: () => void
  className?: string
}

/** 页面级错误块：可展示的失败原因 + 重试。 */
export function ErrorState({
  title = "加载失败",
  message,
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-10 text-center",
        className
      )}
    >
      <span className="flex size-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <CircleAlertIcon className="size-5" />
      </span>
      <div className="space-y-1">
        <h2 className="text-base font-medium">{title}</h2>
        <p className="mx-auto max-w-md break-words text-sm text-muted-foreground">
          {message}
        </p>
      </div>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCwIcon />
          重试
        </Button>
      ) : null}
    </div>
  )
}
