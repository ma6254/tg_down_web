import { LoaderCircleIcon } from "lucide-react"
import { toast } from "sonner"
import { describeError } from "@/api/client"
import type { AccountDetail } from "@/api/types"
import { ErrorState } from "@/components/common/ErrorState"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { useAccountDetail, useSelectAccount } from "@/hooks/use-accounts"
import { accountKindLabels } from "@/lib/account"
import { formatDateTime } from "@/lib/format"
import { maskPhone } from "@/lib/mask"
import { AccountStateBadge } from "@/pages/accounts/AccountStateBadge"

interface AccountDetailDialogProps {
  accountId: number | null
  onClose: () => void
}

/** 账号详情：session 状态、时间与最后错误，并可直接切换为当前账号。 */
export function AccountDetailDialog({
  accountId,
  onClose,
}: AccountDetailDialogProps) {
  const { data, isPending, error, refetch } = useAccountDetail(accountId)
  const select = useSelectAccount()

  function handleSelect() {
    if (!data) {
      return
    }
    const account = data
    select.mutate(account.id, {
      onSuccess: () => {
        toast.success(`已切换为 ${account.name}`)
        onClose()
      },
      onError: (err) => toast.error(describeError(err)),
    })
  }

  return (
    <Dialog
      open={accountId !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
    >
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{data?.name ?? "账号详情"}</DialogTitle>
          <DialogDescription>
            {accountId !== null ? `账号 ID ${accountId}` : "账号详情"}
          </DialogDescription>
        </DialogHeader>

        {isPending ? (
          <DetailSkeleton />
        ) : error ? (
          <ErrorState
            className="py-8"
            title="读取详情失败"
            message={describeError(error)}
            onRetry={() => void refetch()}
          />
        ) : data ? (
          <DetailBody account={data} />
        ) : null}

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>关闭</DialogClose>
          {data &&
          !data.current &&
          data.state === "authed" &&
          data.session_present ? (
            <Button onClick={handleSelect} disabled={select.isPending}>
              {select.isPending ? (
                <LoaderCircleIcon className="animate-spin" />
              ) : null}
              设为当前
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DetailBody({ account }: { account: AccountDetail }) {
  return (
    <div className="space-y-4">
      {!account.session_present ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
          session 文件缺失，需要重新登录后才能使用该账号。
        </p>
      ) : null}
      {account.last_error ? (
        <p className="whitespace-pre-wrap break-words rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
          {account.last_error}
        </p>
      ) : null}
      <dl className="grid grid-cols-[5rem_1fr] items-center gap-x-4 gap-y-2.5 text-sm">
        <dt className="text-muted-foreground">状态</dt>
        <dd>
          <AccountStateBadge
            state={account.state}
            error={account.last_error}
          />
        </dd>
        <dt className="text-muted-foreground">类型</dt>
        <dd>{accountKindLabels[account.kind] ?? account.kind}</dd>
        <dt className="text-muted-foreground">用户名</dt>
        <dd className="break-all">
          {account.username ? `@${account.username}` : "—"}
        </dd>
        <dt className="text-muted-foreground">手机号</dt>
        <dd className="break-all tabular-nums">{maskPhone(account.phone)}</dd>
        <dt className="text-muted-foreground">session</dt>
        <dd>
          {account.session_present ? (
            <Badge variant="secondary">已就绪</Badge>
          ) : (
            <Badge variant="destructive">缺失</Badge>
          )}
        </dd>
        <dt className="text-muted-foreground">当前账号</dt>
        <dd>{account.current ? "是" : "否"}</dd>
        <dt className="text-muted-foreground">创建时间</dt>
        <dd className="tabular-nums">{formatDateTime(account.created_at)}</dd>
        <dt className="text-muted-foreground">更新时间</dt>
        <dd className="tabular-nums">{formatDateTime(account.updated_at)}</dd>
      </dl>
    </div>
  )
}

function DetailSkeleton() {
  return (
    <div className="space-y-3" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">正在加载账号详情…</span>
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-4 w-3/5" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-4 w-2/5" />
    </div>
  )
}
