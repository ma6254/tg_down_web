import { useState } from "react"
import { ImportIcon, RefreshCwIcon, UsersIcon } from "lucide-react"
import { toast } from "sonner"
import { describeError } from "@/api/client"
import type { Account } from "@/api/types"
import { EmptyState } from "@/components/common/EmptyState"
import { ErrorState } from "@/components/common/ErrorState"
import { PageHeader } from "@/components/layout/PageHeader"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useAccounts, useSelectAccount } from "@/hooks/use-accounts"
import { AccountDetailDialog } from "@/pages/accounts/AccountDetailDialog"
import { AccountList } from "@/pages/accounts/AccountList"
import { AccountSummary } from "@/pages/accounts/AccountSummary"
import { ProbeDialog } from "@/pages/accounts/ProbeDialog"

/** 账号页：列表、当前账号切换、详情与 tdata 导入。 */
export function AccountsPage() {
  const accountsQuery = useAccounts()
  const select = useSelectAccount()
  const [detailId, setDetailId] = useState<number | null>(null)
  const [probeOpen, setProbeOpen] = useState(false)

  const accounts = accountsQuery.data?.accounts ?? []

  function handleSelect(account: Account) {
    select.mutate(account.id, {
      onSuccess: () => toast.success(`已切换为 ${account.name}`),
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
          />
        </div>
      )}

      <AccountDetailDialog
        accountId={detailId}
        onClose={() => setDetailId(null)}
      />
      <ProbeDialog open={probeOpen} onOpenChange={setProbeOpen} />
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
