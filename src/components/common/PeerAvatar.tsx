import { useState } from "react"
import { cn } from "@/lib/utils"

interface PeerAvatarProps {
  name: string
  src?: string
  className?: string
}

/**
 * 通用圆形头像：加载失败或没有地址时回退到名称首字符。
 *
 * 用于群聊头像、发送者头像等预览场景；账号页仍用 AccountAvatar。
 */
export function PeerAvatar({ name, src, className }: PeerAvatarProps) {
  const [failed, setFailed] = useState(false)
  const initial = name.trim().slice(0, 1).toUpperCase() || "?"

  if (src && !failed) {
    return (
      <img
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className={cn(
          "size-8 shrink-0 rounded-full border bg-muted object-cover",
          className
        )}
      />
    )
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full bg-muted font-medium text-muted-foreground",
        className
      )}
    >
      {initial}
    </span>
  )
}
