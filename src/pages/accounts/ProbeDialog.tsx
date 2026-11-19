import { useEffect, useRef, useState, type FormEvent } from "react"
import {
  CircleAlertIcon,
  CircleCheckIcon,
  LoaderCircleIcon,
  XCircleIcon,
} from "lucide-react"
import { describeError, isApiError } from "@/api/client"
import type { ProbeResponse } from "@/api/types"
import { ModalDialog } from "@/components/common/ModalDialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useProbeAccounts } from "@/hooks/use-accounts"
import { deviceLabel } from "@/lib/device"
import { maskPhone } from "@/lib/mask"

interface ProbeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * 从本机 Telegram Desktop 的 tdata 探测账号。
 *
 * 服务端同步执行（默认 30s、上限 300s），所以这里带计时与取消；
 * 关闭弹窗会中止请求，但服务端可能仍会完成本次探测。
 */
export function ProbeDialog({ open, onOpenChange }: ProbeDialogProps) {
  const probe = useProbeAccounts()
  const [tdata, setTdata] = useState("")
  const [passcode, setPasscode] = useState("")
  const [timeoutSeconds, setTimeoutSeconds] = useState("30")
  const [shouldImport, setShouldImport] = useState(true)
  const [result, setResult] = useState<ProbeResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const controllerRef = useRef<AbortController | null>(null)
  const dismissedRef = useRef(false)

  useEffect(() => {
    if (!probe.isPending || startedAt === null) {
      return
    }
    const timer = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [probe.isPending, startedAt])

  function handleOpenChange(next: boolean) {
    if (!next) {
      dismissedRef.current = true
      controllerRef.current?.abort()
      controllerRef.current = null
      setResult(null)
      setError(null)
      setStartedAt(null)
      setTdata("")
      setPasscode("")
      setTimeoutSeconds("30")
      setShouldImport(true)
    } else {
      dismissedRef.current = false
      setResult(null)
      setError(null)
    }
    onOpenChange(next)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (probe.isPending) {
      return
    }

    const timeoutNumber =
      timeoutSeconds.trim() === "" ? 30 : Number(timeoutSeconds)
    if (
      !Number.isInteger(timeoutNumber) ||
      timeoutNumber < 5 ||
      timeoutNumber > 300
    ) {
      setError("超时需为 5–300 秒的整数。")
      return
    }

    dismissedRef.current = false
    const controller = new AbortController()
    controllerRef.current = controller
    setError(null)
    setResult(null)
    setStartedAt(Date.now())
    setElapsed(0)

    probe.mutate(
      {
        body: {
          tdata: tdata.trim() || undefined,
          tdata_passcode: passcode || undefined,
          timeout_seconds: timeoutNumber,
          import: shouldImport,
        },
        signal: controller.signal,
      },
      {
        onSuccess: (data) => {
          if (!dismissedRef.current) {
            setResult(data)
          }
        },
        onError: (err) => {
          if (dismissedRef.current) {
            return
          }
          setError(
            isApiError(err) && err.code === "aborted"
              ? "已取消探测"
              : describeError(err)
          )
        },
        onSettled: () => {
          if (controllerRef.current === controller) {
            controllerRef.current = null
          }
        },
      }
    )
  }

  function handleCancel() {
    if (probe.isPending) {
      controllerRef.current?.abort()
      return
    }
    handleOpenChange(false)
  }

  return (
    <ModalDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={result ? "探测结果" : "从 Telegram Desktop 导入"}
      description={
        result
          ? "以下账号来自本机 tdata，探测时已使用其中已有的授权。"
          : "读取本机 Telegram Desktop 的 tdata，校验其中的登录账号；不会修改 tdata。"
      }
      size="lg"
      footer={
        result ? (
          <>
            <Button
              variant="outline"
              type="button"
              onClick={() => {
                setResult(null)
                setError(null)
              }}
            >
              再次探测
            </Button>
            <Button type="button" onClick={() => handleOpenChange(false)}>
              完成
            </Button>
          </>
        ) : (
          <>
            <Button variant="outline" type="button" onClick={handleCancel}>
              {probe.isPending ? "取消探测" : "取消"}
            </Button>
            <Button
              type="submit"
              form="probe-form"
              disabled={probe.isPending}
              aria-busy={probe.isPending}
            >
              {probe.isPending ? (
                <LoaderCircleIcon className="animate-spin" />
              ) : null}
              {probe.isPending ? `探测中… ${elapsed}s` : "开始探测"}
            </Button>
          </>
        )
      }
    >
      {result ? (
        <ProbeResultView result={result} imported={shouldImport} />
      ) : (
        <form id="probe-form" className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="probe-tdata">tdata 目录</Label>
            <Input
              id="probe-tdata"
              value={tdata}
              onChange={(event) => setTdata(event.target.value)}
              placeholder="留空自动查找"
              disabled={probe.isPending}
              spellCheck={false}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              默认查找 %APPDATA%\Telegram Desktop\tdata；也可以粘贴完整路径。
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="probe-passcode">本地密码（可选）</Label>
              <Input
                id="probe-passcode"
                type="password"
                value={passcode}
                onChange={(event) => setPasscode(event.target.value)}
                placeholder="设置了本地密码时填写"
                autoComplete="off"
                disabled={probe.isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="probe-timeout">超时（秒）</Label>
              <Input
                id="probe-timeout"
                type="number"
                min={5}
                max={300}
                step={1}
                inputMode="numeric"
                value={timeoutSeconds}
                onChange={(event) => setTimeoutSeconds(event.target.value)}
                disabled={probe.isPending}
              />
              <p className="text-xs text-muted-foreground">
                范围 5–300，默认 30。
              </p>
            </div>
          </div>

          <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="probe-import">导入到账号列表</Label>
              <p className="text-xs text-muted-foreground">
                关闭后只探测，不写入 sessions 与数据库。
              </p>
            </div>
            <Switch
              id="probe-import"
              checked={shouldImport}
              onCheckedChange={(checked) => setShouldImport(checked)}
              disabled={probe.isPending}
            />
          </div>

          {probe.isPending ? (
            <p
              role="status"
              aria-live="polite"
              className="flex items-center gap-1.5 text-xs text-muted-foreground"
            >
              <LoaderCircleIcon className="size-3.5 animate-spin" />
              正在连接 Telegram，通常需要数秒到数十秒；可随时取消。
            </p>
          ) : null}

          {error ? (
            <p
              role="alert"
              className="flex items-start gap-1.5 whitespace-pre-wrap break-words rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive"
            >
              <CircleAlertIcon className="mt-0.5 size-3.5 shrink-0" />
              <span>{error}</span>
            </p>
          ) : null}
        </form>
      )}
    </ModalDialog>
  )
}

function ProbeResultView({
  result,
  imported,
}: {
  result: ProbeResponse
  imported: boolean
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
        <p>
          <span className="text-foreground">tdata：</span>
          <span className="font-mono break-all">
            {result.tdata_path || "自动查找"}
          </span>
        </p>
        <p className="mt-1">
          {imported
            ? `导入 ${result.imported} 个，跳过 ${result.skipped} 个`
            : "仅探测，未写入数据库"}
          {result.selected_account_id
            ? `；当前账号已设为 ID ${result.selected_account_id}`
            : ""}
        </p>
      </div>

      {result.accounts.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          没有探测到已登录账号。请确认 Telegram Desktop 已登录，或检查 tdata 路径。
        </p>
      ) : (
        <ul className="max-h-72 space-y-2 overflow-y-auto pr-1">
          {result.accounts.map((account) => (
            <li key={account.index} className="rounded-lg border p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {account.name || `账号 #${account.index}`}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {account.username
                      ? `@${account.username}`
                      : account.phone
                        ? maskPhone(account.phone)
                        : "—"}
                  </p>
                </div>
                {account.error ? (
                  <Badge variant="destructive">
                    <XCircleIcon />
                    失败
                  </Badge>
                ) : (
                  <Badge variant="secondary">
                    <CircleCheckIcon />
                    成功
                  </Badge>
                )}
              </div>
              {account.error ? (
                <p className="mt-2 whitespace-pre-wrap break-words text-xs text-destructive">
                  {account.error}
                </p>
              ) : null}
              {account.devices && account.devices.length > 0 ? (
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {account.devices.map((device, index) => (
                    <li
                      key={`${account.index}-${index}`}
                      className="flex items-start gap-1.5"
                    >
                      <span
                        className={
                          device.current
                            ? "text-emerald-500"
                            : "text-muted-foreground/50"
                        }
                      >
                        {device.current ? "●" : "○"}
                      </span>
                      <span className="break-words">{deviceLabel(device)}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

