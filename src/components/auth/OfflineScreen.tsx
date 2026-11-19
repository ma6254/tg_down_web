import { CircleAlertIcon, RefreshCwIcon } from "lucide-react"
import { AuthShell } from "@/components/auth/AuthShell"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useAuth } from "@/hooks/use-auth"
import { useDocumentTitle } from "@/hooks/use-document-title"

/** 后端不可达时的兜底页：给出启动命令与重试入口。 */
export function OfflineScreen() {
  const { error, retry } = useAuth()
  useDocumentTitle("无法连接后端")

  return (
    <AuthShell>
      <Card>
        <CardHeader>
          <CardTitle>无法连接后端</CardTitle>
          <CardDescription>
            前端已加载，但没有收到 tg_down 后端的响应。请确认进程已启动，然后重试。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">启动后端</p>
            <code className="mt-1 block font-mono text-[11px] text-foreground">
              go run . serve
            </code>
            <p className="mt-2">默认监听 127.0.0.1:22429。</p>
          </div>
          {error ? (
            <p
              role="alert"
              className="flex items-start gap-1.5 text-xs text-destructive"
            >
              <CircleAlertIcon className="mt-0.5 size-3.5 shrink-0" />
              <span>{error}</span>
            </p>
          ) : null}
          <Button className="w-full" onClick={retry}>
            <RefreshCwIcon />
            重试连接
          </Button>
        </CardContent>
      </Card>
    </AuthShell>
  )
}
