import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const sizeClasses = {
  sm: "sm:max-w-md",
  md: "sm:max-w-lg",
  lg: "sm:max-w-xl",
  xl: "sm:max-w-3xl",
} as const

export type ModalSize = keyof typeof sizeClasses

export interface ModalDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  /** 宽度档位，默认 md（32rem）；sm 28rem / lg 36rem / xl 48rem。 */
  size?: ModalSize
  /** 底部操作区；不传时没有 footer。 */
  footer?: ReactNode
  children: ReactNode
  className?: string
  /** 内容区附加样式（例如表单间距）。 */
  bodyClassName?: string
}

/**
 * 全站统一的模态对话框。
 *
 * 标题与底部操作区固定，内容区独立滚动，避免长内容把标题/按钮顶出视口；
 * 调用方只提供 title / description / 内容 / footer，不用再各自拼
 * DialogContent + max-h + overflow。需要更特殊的布局时用 className 覆写。
 */
export function ModalDialog({
  open,
  onOpenChange,
  title,
  description,
  size = "md",
  footer,
  children,
  className,
  bodyClassName,
}: ModalDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex max-h-[calc(100svh-2rem)] flex-col gap-0 overflow-hidden p-0",
          sizeClasses[size],
          className
        )}
      >
        <DialogHeader className="shrink-0 gap-1.5 border-b px-4 py-3 pr-12">
          <DialogTitle>{title}</DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : null}
        </DialogHeader>

        <div className={cn("min-h-0 flex-1 overflow-y-auto p-4", bodyClassName)}>
          {children}
        </div>

        {footer ? (
          <DialogFooter className="mx-0 mb-0 shrink-0 rounded-b-xl px-4 py-3">
            {footer}
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
