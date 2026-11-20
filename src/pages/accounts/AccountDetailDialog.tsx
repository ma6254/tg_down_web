import { useMemo, useState } from "react"
import { LoaderCircleIcon } from "lucide-react"
import { toast } from "sonner"
import { describeError } from "@/api/client"
import type { AccountDetail } from "@/api/types"
import { AccountAvatar } from "@/components/accounts/AccountAvatar"
import { ErrorState } from "@/components/common/ErrorState"
import { ModalDialog } from "@/components/common/ModalDialog"
import { PicViewerDialog } from "@/components/PicViewer"
import { PicViewerMobileDialog } from "@/components/PicViewerMobile"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DialogClose } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { useAccountDetail, useSelectAccount } from "@/hooks/use-accounts"
import { accountKindLabels, accountSourceLabel } from "@/lib/account"
import { isMobileDevice } from "@/lib/device"
import { formatDateTime } from "@/lib/format"
import { maskPhone } from "@/lib/mask"
import { cn } from "@/lib/utils"
import { AccountLiveSection } from "@/pages/accounts/AccountLiveSection"
import { AccountStateBadge } from "@/pages/accounts/AccountStateBadge"

interface AccountDetailDialogProps {
  accountId: number | null
  onClose: () => void
}

/** 账号详情：session 状态、时间、最后错误与联网查询的在线资料，并可直接切换为当前账号。 */
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
    <ModalDialog
      open={accountId !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
      title={data?.name ?? "账号详情"}
      description={
        accountId !== null ? `账号 ID ${accountId}` : "账号详情"
      }
      size="md"
      footer={
        <>
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
        </>
      }
    >
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
        <DetailBody key={data.id} account={data} />
      ) : null}
    </ModalDialog>
  )
}

function DetailBody({ account }: { account: AccountDetail }) {
  const [avatarLoaded, setAvatarLoaded] = useState(false)
  const [viewerOpen, setViewerOpen] = useState(false)
  const isMobile = useMemo(() => isMobileDevice(), [])
  const avatarSrc = `/api/v1/accounts/${account.id}/avatar`

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-2">
        <button
          type="button"
          disabled={!avatarLoaded}
          aria-label={avatarLoaded ? `查看头像：${account.name}` : undefined}
          title={avatarLoaded ? "查看头像" : undefined}
          onClick={() => setViewerOpen(true)}
          className={cn(
            "rounded-full outline-none transition-shadow",
            "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            avatarLoaded && "cursor-zoom-in"
          )}
        >
          <AccountAvatar
            name={account.name}
            src={avatarSrc}
            className="size-20 rounded-full border-2 text-2xl"
            onLoadChange={setAvatarLoaded}
          />
        </button>
        <div className="text-center">
          <p className="font-medium">{account.name}</p>
          <p className="text-xs text-muted-foreground">
            {account.username ? `@${account.username}` : "—"}
          </p>
        </div>
      </div>
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
        <dt className="text-muted-foreground">来源</dt>
        <dd>{accountSourceLabel(account.source)}</dd>
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
      <AccountLiveSection account={account} />

      {viewerOpen ? (
        isMobile ? (
          <PicViewerMobileDialog
            open
            onOpenChange={(open) => {
              if (!open) {
                setViewerOpen(false)
              }
            }}
            src={avatarSrc}
            alt={`${account.name} 的头像`}
            title={`${account.name} 的头像`}
            filePath={`${account.name}-avatar.jpg`}
            blobType="image/jpeg"
          />
        ) : (
          <PicViewerDialog
            open
            onOpenChange={(open) => {
              if (!open) {
                setViewerOpen(false)
              }
            }}
            src={avatarSrc}
            alt={`${account.name} 的头像`}
            filePath={`${account.name}-avatar.jpg`}
            blobType="image/jpeg"
          />
        )
      ) : null}
    </div>
  )
}

function DetailSkeleton() {
  return (
    <div className="space-y-3" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">正在加载账号详情…</span>
      <div className="flex justify-center pb-1">
        <Skeleton className="size-20 rounded-full" />
      </div>
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-4 w-3/5" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-4 w-2/5" />
    </div>
  )
}
