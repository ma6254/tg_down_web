import { CircleAlertIcon, LoaderCircleIcon, RefreshCwIcon } from "lucide-react"
import { describeError } from "@/api/client"
import type { AccountDetail, AccountLiveInfo } from "@/api/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useAccountLive } from "@/hooks/use-accounts"
import { deviceLabel } from "@/lib/device"
import { formatBirthday, formatDateTime } from "@/lib/format"
import { maskPhone } from "@/lib/mask"

interface AccountLiveSectionProps {
  account: AccountDetail
}

/**
 * 在线资料：联网查询的最新资料与已登录客户端。
 *
 * 等价于 CLI 的 `account info <id> --live`；只有存在可用 session 的 MTProto
 * 账号才会发请求，查询结果不落库，失败时保留本地信息并给出重试入口。
 */
export function AccountLiveSection({ account }: AccountLiveSectionProps) {
  const canQuery = account.kind === "mtproto" && account.session_present
  const live = useAccountLive(account.id, canQuery)

  return (
    <section className="space-y-2 border-t pt-4" aria-label="在线资料">
      <header className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium">在线资料</h3>
        {canQuery ? (
          <Button
            variant="ghost"
            size="xs"
            onClick={() => void live.refetch()}
            disabled={live.isFetching}
            title="重新联网查询"
          >
            <RefreshCwIcon
              className={live.isFetching ? "animate-spin" : undefined}
            />
            重新查询
          </Button>
        ) : null}
      </header>

      {!canQuery ? (
        <p className="text-xs text-muted-foreground">
          {account.kind === "botapi"
            ? "Bot 账号没有 session 文件，无法联网查询。"
            : "session 文件缺失，无法联网查询。"}
        </p>
      ) : live.isPending ? (
        <LiveSkeleton />
      ) : live.error ? (
        <LiveError
          error={live.error}
          retrying={live.isFetching}
          onRetry={() => void live.refetch()}
        />
      ) : live.data ? (
        <LiveBody info={live.data} />
      ) : null}
    </section>
  )
}

function LiveBody({ info }: { info: AccountLiveInfo }) {
  return (
    <div className="space-y-3 text-sm">
      <dl className="grid grid-cols-[5rem_1fr] items-center gap-x-4 gap-y-2.5">
        <dt className="text-muted-foreground">名称</dt>
        <dd className="break-words">{info.name || "—"}</dd>
        <dt className="text-muted-foreground">用户名</dt>
        <dd className="break-all">
          {info.username ? `@${info.username}` : "—"}
        </dd>
        <dt className="text-muted-foreground">手机号</dt>
        <dd className="break-all tabular-nums">{maskPhone(info.phone)}</dd>
        <dt className="text-muted-foreground">账号属性</dt>
        <dd className="flex flex-wrap gap-1.5">
          {info.premium ? <Badge variant="secondary">Premium</Badge> : null}
          {info.bot ? <Badge variant="outline">Bot</Badge> : null}
          {!info.premium && !info.bot ? (
            <span className="text-muted-foreground">—</span>
          ) : null}
        </dd>
        <dt className="text-muted-foreground">生日</dt>
        <dd className="tabular-nums">{formatBirthday(info.birthday)}</dd>
        <dt className="text-muted-foreground">简介</dt>
        <dd className="whitespace-pre-wrap break-words">{info.about || "—"}</dd>
      </dl>

      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">
          已登录客户端（{info.devices.length}）
        </p>
        {info.devices.length > 0 ? (
          <ul className="space-y-1 text-xs text-muted-foreground">
            {info.devices.map((device, index) => (
              <li key={index} className="flex items-start gap-1.5">
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
        ) : (
          <p className="text-xs text-muted-foreground">—</p>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        查询于 {formatDateTime(info.fetched_at)}
      </p>
    </div>
  )
}

function LiveSkeleton() {
  return (
    <div
      className="space-y-2"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">正在联网查询在线资料…</span>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <LoaderCircleIcon className="size-3.5 animate-spin" />
        正在连接 Telegram 查询，最多 30 秒。
      </p>
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-4 w-3/5" />
    </div>
  )
}

function LiveError({
  error,
  retrying,
  onRetry,
}: {
  error: unknown
  retrying: boolean
  onRetry: () => void
}) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive"
    >
      <CircleAlertIcon className="mt-0.5 size-3.5 shrink-0" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="whitespace-pre-wrap break-words">
          {describeError(error)}
        </p>
        <Button variant="outline" size="xs" onClick={onRetry} disabled={retrying}>
          {retrying ? "重试中…" : "重试"}
        </Button>
      </div>
    </div>
  )
}
