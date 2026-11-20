import { useState } from "react"
import {
  ArrowLeftRightIcon,
  ImportIcon,
  LoaderCircleIcon,
  RefreshCwIcon,
  UsersIcon,
} from "lucide-react"
import { toast } from "sonner"
import { describeError } from "@/api/client"
import type { Account } from "@/api/types"
import { AccountPickerDialog } from "@/components/accounts/AccountPickerDialog"
import { ModalDialog } from "@/components/common/ModalDialog"
import { EmptyState } from "@/components/common/EmptyState"
import { ErrorState } from "@/components/common/ErrorState"
import { PageHeader } from "@/components/layout/PageHeader"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  useAccounts,
  useDeleteAccount,
  useLogoutAccount,
  useSelectAccount,
} from "@/hooks/use-accounts"
import { AccountDetailDialog } from "@/pages/accounts/AccountDetailDialog"
import { AccountList } from "@/pages/accounts/AccountList"
import { AccountSummary } from "@/pages/accounts/AccountSummary"
import { ProbeDialog } from "@/pages/accounts/ProbeDialog"

/** 账号页：列表、当前账号切换、详情与 tdata 导入。 */
export function AccountsPage() {
  const accountsQuery = useAccounts()
  const select = useSelectAccount()
  const logout = useLogoutAccount()
  const remove = useDeleteAccount()
  const [detailId, setDetailId] = useState<number | null>(null)
  const [probeOpen, setProbeOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [logoutTarget, setLogoutTarget] = useState<Account | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Account | null>(null)

  const accounts = accountsQuery.data?.accounts ?? []

  function handleSelect(account: Account) {
    select.mutate(account.id, {
      onSuccess: () => toast.success(`已切换为 ${account.name}`),
      onError: (error) => toast.error(describeError(error)),
    })
  }

  function handlePickAccount(account: Account) {
    if (account.current) {
      toast.info(`当前账号已是 ${account.name}`)
      return
    }
    handleSelect(account)
  }

  function confirmLogout() {
    if (!logoutTarget) {
      return
    }
    const target = logoutTarget
    logout.mutate(target.id, {
      onSuccess: (result) => {
        setLogoutTarget(null)
        if (result.revoked) {
          toast.success(`已登出 ${target.name}`)
        } else {
          toast.warning(`已删除本地账号 ${target.name}，但 Telegram 端注销失败`)
        }
      },
      onError: (error) => toast.error(describeError(error)),
    })
  }

  function confirmDelete() {
    if (!deleteTarget) {
      return
    }
    const target = deleteTarget
    remove.mutate(target.id, {
      onSuccess: () => {
        setDeleteTarget(null)
        toast.success(`已删除本地账号 ${target.name}`)
      },
      onError: (error) => toast.error(describeError(error)),
    })
  }

  return (
    <>
      <PageHeader
        title="账号"
        description="管理用于访问 Telegram 的账号。"
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void accountsQuery.refetch()}
              disabled={accountsQuery.isFetching}
            >
              <RefreshCwIcon
                className={accountsQuery.isFetching ? "animate-spin" : undefined}
              />
              刷新
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPickerOpen(true)}
              disabled={accounts.length < 2}
              title={
                accounts.length < 2 ? "至少需要两个账号才能切换" : undefined
              }
            >
              <ArrowLeftRightIcon />
              切换账号
            </Button>
            <Button size="sm" onClick={() => setProbeOpen(true)}>
              <ImportIcon />
              从 Telegram Desktop 导入
            </Button>
          </>
        }
      />

      {accountsQuery.isPending ? (
        <AccountsSkeleton />
      ) : accountsQuery.error ? (
        <ErrorState
          title="读取账号失败"
          message={describeError(accountsQuery.error)}
          onRetry={() => void accountsQuery.refetch()}
        />
      ) : accounts.length === 0 ? (
        <EmptyState
          icon={UsersIcon}
          title="还没有账号"
          description="tg_down 通过读取本机 Telegram Desktop 的 tdata 导入账号，不需要验证码，也不会修改 tdata。"
          action={
            <Button onClick={() => setProbeOpen(true)}>
              <ImportIcon />
              从 Telegram Desktop 导入
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          <AccountSummary accounts={accounts} />
          <AccountList
            accounts={accounts}
            selectingId={select.isPending ? (select.variables ?? null) : null}
            onSelect={handleSelect}
            onDetail={(account) => setDetailId(account.id)}
            onLogout={setLogoutTarget}
            onDelete={setDeleteTarget}
          />
        </div>
      )}

      <AccountDetailDialog
        accountId={detailId}
        onClose={() => setDetailId(null)}
      />
      <ProbeDialog open={probeOpen} onOpenChange={setProbeOpen} />
      <AccountPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onConfirm={handlePickAccount}
      />

      <ModalDialog
        open={logoutTarget !== null}
        onOpenChange={(open) => {
          if (!open && !logout.isPending) {
            setLogoutTarget(null)
          }
        }}
        title={logoutTarget?.source === "desktop" ? "注销账号" : "退出登录"}
        description={
          logoutTarget
            ? `确定要${logoutTarget.source === "desktop" ? "注销" : "登出"} ${logoutTarget.name} 吗？`
            : undefined
        }
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setLogoutTarget(null)}
              disabled={logout.isPending}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={confirmLogout}
              disabled={logout.isPending}
            >
              {logout.isPending ? (
                <LoaderCircleIcon className="animate-spin" />
              ) : null}
              {logoutTarget?.source === "desktop" ? "注销" : "登出"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          {logoutTarget?.source === "desktop"
            ? "桌面导入的账号与 Telegram Desktop 共用登录，注销会同时让桌面端退出登录；本地账号记录与 session 文件也会删除，不可恢复。"
            : "会向 Telegram 注销该 session，并删除本地账号记录与 session 文件，不可恢复；已下载的文件不受影响。"}
        </p>
      </ModalDialog>

      <ModalDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !remove.isPending) {
            setDeleteTarget(null)
          }
        }}
        title="删除账号"
        description={
          deleteTarget ? `确定要删除 ${deleteTarget.name} 吗？` : undefined
        }
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={remove.isPending}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={remove.isPending}
            >
              {remove.isPending ? (
                <LoaderCircleIcon className="animate-spin" />
              ) : null}
              删除
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          只会删除本地账号记录与 session
          文件，不会注销 Telegram 会话，也不影响 Telegram Desktop
          的登录；已下载的文件不受影响。
        </p>
      </ModalDialog>
    </>
  )
}

function AccountsSkeleton() {
  return (
    <div
      className="space-y-4"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">正在加载账号…</span>
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <Skeleton key={index} className="h-[70px] rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  )
}
