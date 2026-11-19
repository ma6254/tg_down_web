import { cn } from "@/lib/utils"

interface AccountAvatarProps {
  name: string
  className?: string
}

/**
 * 账号头像占位：取名称首字符。
 *
 * 后端没有头像接口（Telegram 侧头像需要额外下载，见账号页需求），
 * 这里只提供可复用的首字母方块，账号列表与账号选择弹窗共用。
 */
export function AccountAvatar({ name, className }: AccountAvatarProps) {
  const initial = name.trim().slice(0, 1).toUpperCase() || "?"
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-medium text-muted-foreground",
        className
      )}
    >
      {initial}
    </span>
  )
}
