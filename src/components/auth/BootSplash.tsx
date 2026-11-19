import { LoaderCircleIcon } from "lucide-react"
import { Brand } from "@/components/layout/Brand"
import { useDocumentTitle } from "@/hooks/use-document-title"

/** 启动探测中的全屏等待页。 */
export function BootSplash() {
  useDocumentTitle("正在连接")

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-5">
      <Brand />
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <LoaderCircleIcon className="size-4 animate-spin" />
        正在连接 tg_down…
      </p>
    </div>
  )
}
