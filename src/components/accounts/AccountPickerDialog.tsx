import { useState } from "react"
import { CheckIcon, CircleAlertIcon } from "lucide-react"
import { describeError } from "@/api/client"
import type { Account } from "@/api/types"
import { AccountAvatar } from "@/components/accounts/AccountAvatar"
import { ModalDialog } from "@/components/common/ModalDialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useAccounts } from "@/hooks/use-accounts"
import { accountStateLabels } from "@/lib/account"
import { maskPhone } from "@/lib/mask"
import { cn } from "@/lib/utils"

export interface AccountPickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 确认选择；调用方决定是切换当前账号，还是把账号用于其他操作。 */
  onConfirm: (account: Account) => void
  title?: string
  description?: string
  /** 确认按钮文案，默认「确定」。 */
  confirmLabel?: string
  /** 打开时默认选中的账号；不传则默认当前账号。 */
  defaultAccountId?: number | null
}

/**
 * 账号选择对话框：在 ModalDialog 之上封装账号列表与单选逻辑。
 *
 * - 只允许选择 `state === "authed"` 的账号，其余置灰并标注状态；
 * - 默认选中当前账号（或用 `defaultAccountId` 指定）；
 * - 关闭时不发请求，打开后复用账号列表的 TanStack Query 缓存。
 */
export function AccountPickerDialog({
  open,
  onOpenChange,
  onConfirm,
  title = "选择账号",
  description = "选择用于后续操作的账号；只有状态正常的账号可选。",
  confirmLabel = "确定",
  defaultAccountId,
}: AccountPickerDialogProps) {
  const accountsQuery = useAccounts(open)
  const [selectedId, setSelectedId] = useState<number | null>(null)

  // 关闭时清掉手动选择，下次打开回到默认账号（当前账号 / defaultAccountId）。
  // 不用 effect：父组件通过 onOpenChange 关闭时会同步走到这里。
  function handleOpenChange(next: boolean) {
    if (!next) {
      setSelectedId(null)
    }
    onOpenChange(next)
  }

  const accounts = accountsQuery.data?.accounts ?? []
  const fallbackId =
    defaultAccountId ??
    accounts.find((account) => account.current)?.id ??
    null
  const selected = accounts.find(
    (account) => account.id === (selectedId ?? fallbackId)
  )
  const canConfirm = !accountsQuery.isPending && selected?.state === "authed"

  function handleConfirm() {
    if (!selected || selected.state !== "authed") {
      return
    }
    onConfirm(selected)
    handleOpenChange(false)
  }

  return (
    <ModalDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={title}
      description={description}
      size="md"
      footer={
        <>
          <Button
            variant="outline"
            type="button"
            onClick={() => handleOpenChange(false)}
          >
            取消
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirm}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {accountsQuery.isPending ? (
        <AccountListSkeleton />
      ) : accountsQuery.error ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive"
        >
          <CircleAlertIcon className="mt-0.5 size-3.5 shrink-0" />
          <div className="min-w-0 flex-1 space-y-2">
            <p className="whitespace-pre-wrap break-words">
              {describeError(accountsQuery.error)}
            </p>
            <Button
              variant="outline"
              size="xs"
              onClick={() => void accountsQuery.refetch()}
            >
              重试
            </Button>
          </div>
        </div>
      ) : accounts.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          还没有账号。请先在账号页从 Telegram Desktop 导入。
        </p>
      ) : (
        <ul
          role="radiogroup"
          aria-label="账号列表"
          className="space-y-2"
        >
          {accounts.map((account) => {
            const disabled = account.state !== "authed"
            const checked = account.id === selected?.id

            return (
              <li key={account.id}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  disabled={disabled}
                  onClick={() => setSelectedId(account.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors outline-none",
                    "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                    checked
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted/50",
                    disabled && "cursor-not-allowed opacity-60 hover:bg-transparent"
                  )}
                >
                  <AccountAvatar
                    name={account.name}
                    src={`/api/v1/accounts/${account.id}/avatar`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-medium">
                        {account.name}
                      </span>
                      {account.current ? (
                        <Badge variant="secondary">当前</Badge>
                      ) : null}
                      {disabled ? (
                        <Badge
                          variant={
                            account.state === "error" ? "destructive" : "outline"
                          }
                        >
                          {accountStateLabels[account.state] ?? account.state}
                        </Badge>
                      ) : null}
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                      <span className="truncate">
                        {account.username ? `@${account.username}` : "—"}
                      </span>
                      <span className="tabular-nums">
                        {maskPhone(account.phone)}
                      </span>
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    className={cn(
                      "flex size-4 shrink-0 items-center justify-center rounded-full border",
                      checked
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-muted-foreground/40"
                    )}
                  >
                    {checked ? <CheckIcon className="size-3" /> : null}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </ModalDialog>
  )
}

function AccountListSkeleton() {
  return (
    <div
      className="space-y-2"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">正在加载账号…</span>
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          className="flex items-center gap-3 rounded-lg border p-3"
        >
          <Skeleton className="size-8 rounded-lg" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )
}
