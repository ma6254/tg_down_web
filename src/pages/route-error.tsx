import { CircleAlertIcon } from "lucide-react"
import { isRouteErrorResponse, Link, useRouteError } from "react-router-dom"
import { Brand } from "@/components/layout/Brand"
import { buttonVariants } from "@/components/ui/button"
import { useDocumentTitle } from "@/hooks/use-document-title"

/** 路由级错误页：路由渲染/加载抛错时兜底，避免整页白屏。 */
export function RouteErrorPage() {
  useDocumentTitle("页面出错了")
  const error = useRouteError()
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : "未知错误"

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 p-6">
      <Brand />
      <div className="w-full max-w-md space-y-4 rounded-xl border bg-card p-6 text-center">
        <span className="mx-auto flex size-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <CircleAlertIcon className="size-5" />
        </span>
        <div className="space-y-1.5">
          <h1 className="text-lg font-medium">页面出错了</h1>
          <p className="break-words text-sm text-muted-foreground">{message}</p>
        </div>
        <Link to="/accounts" className={buttonVariants({ className: "w-full" })}>
          返回账号页
        </Link>
      </div>
    </div>
  )
}
