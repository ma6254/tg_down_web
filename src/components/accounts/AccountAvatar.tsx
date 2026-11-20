import { useState } from "react"
import { cn } from "@/lib/utils"

interface AccountAvatarProps {
  name: string
  /** 头像地址；没有或加载失败时回退到名称首字符。 */
  src?: string
  className?: string
  /** 图片实际加载成功/失败时通知调用方（用于决定能否点开查看器）。 */
  onLoadChange?: (loaded: boolean) => void
}

/**
 * 账号头像：优先显示后端缓存的头像，失败或没有时退回名称首字符方块。
 *
 * 头像接口是 `GET /api/v1/accounts/{id}/avatar`，服务端会缓存到磁盘，
 * 前端用浏览器缓存即可，不做额外存储。
 */
export function AccountAvatar({
  name,
  src,
  className,
  onLoadChange,
}: AccountAvatarProps) {
  const [failed, setFailed] = useState(false)
  const initial = name.trim().slice(0, 1).toUpperCase() || "?"

  if (src && !failed) {
    return (
      <img
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        onLoad={() => onLoadChange?.(true)}
        onError={() => {
          setFailed(true)
          onLoadChange?.(false)
        }}
        className={cn(
          "size-8 shrink-0 rounded-lg border bg-muted object-cover",
          className
        )}
      />
    )
  }

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
