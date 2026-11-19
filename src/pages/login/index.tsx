import { useState, type FormEvent } from "react"
import { CircleAlertIcon, EyeIcon, EyeOffIcon, InfoIcon, LoaderCircleIcon } from "lucide-react"
import { Navigate, useLocation } from "react-router-dom"
import { toast } from "sonner"
import { describeError } from "@/api/client"
import { AuthShell } from "@/components/auth/AuthShell"
import { BootSplash } from "@/components/auth/BootSplash"
import { OfflineScreen } from "@/components/auth/OfflineScreen"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/hooks/use-auth"
import { useDocumentTitle } from "@/hooks/use-document-title"

/** 只接受站内路径，避免登录后跳到外部地址。 */
function safeFrom(state: unknown): string {
  const from = (state as { from?: unknown } | null)?.from
  if (typeof from === "string" && from.startsWith("/") && !from.startsWith("//") && from !== "/login") {
    return from
  }
  return "/accounts"
}

/** 登录页：校验 token 后写入 localStorage，再回到登录前想去的页面。 */
export function LoginPage() {
  const { status, login, notice } = useAuth()
  const location = useLocation()
  const [token, setToken] = useState("")
  const [visible, setVisible] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // checking/offline/ready 分别由 BootSplash、OfflineScreen 或目标页接管标题。
  const showLoginForm =
    status !== "checking" && status !== "offline" && status !== "ready"
  useDocumentTitle(showLoginForm ? "登录" : undefined)

  const from = safeFrom(location.state)

  if (status === "checking") {
    return <BootSplash />
  }
  if (status === "offline") {
    return <OfflineScreen />
  }
  if (status === "ready") {
    return <Navigate to={from} replace />
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) {
      return
    }
    const value = token.trim()
    if (!value) {
      setError("请输入 token")
      return
    }

    setPending(true)
    setError(null)
    try {
      await login(value)
      toast.success("已连接 tg_down")
    } catch (err) {
      setError(describeError(err))
      setPending(false)
    }
  }

  return (
    <AuthShell>
      <Card>
        <CardHeader>
          <CardTitle>登录 tg_down</CardTitle>
          <CardDescription>
            后端已启用 token 鉴权。请输入启动时通过 --auth-token 或
            TG_DOWN_TOKEN 配置的 token。
          </CardDescription>
        </CardHeader>
        <CardContent>
          {notice ? (
            <p className="mb-4 flex items-start gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-400">
              <InfoIcon className="mt-0.5 size-3.5 shrink-0" />
              <span>{notice}</span>
            </p>
          ) : null}
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="auth-token">Token</Label>
              <div className="relative">
                <Input
                  id="auth-token"
                  type={visible ? "text" : "password"}
                  value={token}
                  onChange={(event) => setToken(event.target.value)}
                  placeholder="粘贴 token"
                  autoComplete="off"
                  spellCheck={false}
                  autoFocus
                  disabled={pending}
                  className="pr-9"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="absolute top-1/2 right-1 -translate-y-1/2"
                  aria-label={visible ? "隐藏 token" : "显示 token"}
                  onClick={() => setVisible((value) => !value)}
                >
                  {visible ? <EyeOffIcon /> : <EyeIcon />}
                </Button>
              </div>
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
            <Button
              type="submit"
              className="w-full"
              disabled={pending}
              aria-busy={pending}
            >
              {pending ? <LoaderCircleIcon className="animate-spin" /> : null}
              {pending ? "正在验证…" : "连接"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="text-xs text-muted-foreground">
          token 只保存在本机浏览器（localStorage），不会上传到其他服务。
        </CardFooter>
      </Card>
    </AuthShell>
  )
}
