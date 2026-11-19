import type { AccountState } from "@/api/types"
import { cn } from "@/lib/utils"

const styles: Record<
  AccountState,
  { label: string; dot: string; text: string }
> = {
  authed: {
    label: "已登录",
    dot: "bg-emerald-500",
    text: "text-emerald-600 dark:text-emerald-400",
  },
  unauthed: {
    label: "未登录",
    dot: "bg-muted-foreground/40",
    text: "text-muted-foreground",
  },
  error: {
    label: "异常",
    dot: "bg-destructive",
    text: "text-destructive",
  },
}

/** 账号状态：圆点 + 文案；异常时 title 展示服务端原因。 */
export function AccountStateBadge({
  state,
  error,
}: {
  state: AccountState
  error?: string
}) {
  const style = styles[state] ?? {
    label: state,
    dot: "bg-muted-foreground/40",
    text: "text-muted-foreground",
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium",
        style.text
      )}
      title={error || undefined}
    >
      <span
        className={cn("size-1.5 shrink-0 rounded-full", style.dot)}
        aria-hidden="true"
      />
      {style.label}
    </span>
  )
}
