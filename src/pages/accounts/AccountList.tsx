import { LoaderCircleIcon } from "lucide-react"
import type { Account } from "@/api/types"
import { AccountAvatar } from "@/components/accounts/AccountAvatar"
import { accountKindLabels, accountSourceLabel } from "@/lib/account"
import { maskPhone } from "@/lib/mask"
import { AccountStateBadge } from "@/pages/accounts/AccountStateBadge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface AccountListProps {
  accounts: Account[]
  /** 正在切换的账号 ID；非 null 时所有切换按钮禁用。 */
  selectingId: number | null
  onSelect: (account: Account) => void
  onDetail: (account: Account) => void
  onLogout: (account: Account) => void
  /** 仅删除本地记录（桌面导入账号使用）。 */
  onDelete: (account: Account) => void
}

/** 账号列表：桌面表格 + 窄屏卡片，共用同一组操作。 */
export function AccountList({
  accounts,
  selectingId,
  onSelect,
  onDetail,
  onLogout,
  onDelete,
}: AccountListProps) {
  return (
    <>
      <AccountTable
        accounts={accounts}
        selectingId={selectingId}
        onSelect={onSelect}
        onDetail={onDetail}
        onLogout={onLogout}
        onDelete={onDelete}
      />
      <AccountCards
        accounts={accounts}
        selectingId={selectingId}
        onSelect={onSelect}
        onDetail={onDetail}
        onLogout={onLogout}
        onDelete={onDelete}
      />
    </>
  )
}

function AccountTable({
  accounts,
  selectingId,
  onSelect,
  onDetail,
  onLogout,
  onDelete,
}: AccountListProps) {
  return (
    <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
      <Table aria-label="账号列表">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[88px]">状态</TableHead>
            <TableHead>账号</TableHead>
            <TableHead className="w-[96px]">类型</TableHead>
            <TableHead className="w-[104px]">来源</TableHead>
            <TableHead>手机号</TableHead>
            <TableHead className="w-[72px]">当前</TableHead>
            <TableHead className="w-[224px] text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {accounts.map((account) => {
            const selecting = selectingId === account.id
            const disabled = selectingId !== null || account.state !== "authed"

            return (
              <TableRow key={account.id}>
                <TableCell>
                  <AccountStateBadge
                    state={account.state}
                    error={account.last_error}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <AccountAvatar
                      name={account.name}
                      src={`/api/v1/accounts/${account.id}/avatar`}
                    />
                    <div className="min-w-0">
                      <p className="truncate font-medium" title={account.name}>
                        {account.name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {account.username ? `@${account.username}` : "—"}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {accountKindLabels[account.kind] ?? account.kind}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {accountSourceLabel(account.source)}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground tabular-nums">
                  {maskPhone(account.phone)}
                </TableCell>
                <TableCell>
                  {account.current ? (
                    <Badge variant="secondary">当前</Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDetail(account)}
                    >
                      详情
                    </Button>
                    {account.current ? null : (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={disabled}
                        title={
                          account.state !== "authed"
                            ? "账号未登录，无法切换"
                            : undefined
                        }
                        onClick={() => onSelect(account)}
                      >
                        {selecting ? (
                          <LoaderCircleIcon className="animate-spin" />
                        ) : null}
                        设为当前
                      </Button>
                    )}
                    {account.source === "desktop" ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        disabled={selectingId !== null}
                        title="只删除本地记录，不影响 Telegram Desktop"
                        onClick={() => onDelete(account)}
                      >
                        删除
                      </Button>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      disabled={selectingId !== null}
                      title={
                        account.source === "desktop"
                          ? "注销会同时让 Telegram Desktop 退出登录"
                          : undefined
                      }
                      onClick={() => onLogout(account)}
                    >
                      {account.source === "desktop" ? "注销" : "登出"}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

function AccountCards({
  accounts,
  selectingId,
  onSelect,
  onDetail,
  onLogout,
  onDelete,
}: AccountListProps) {
  return (
    <div className="space-y-3 md:hidden">
      {accounts.map((account) => {
        const selecting = selectingId === account.id
        const disabled = selectingId !== null || account.state !== "authed"

        return (
          <div key={account.id} className="rounded-xl border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <AccountAvatar
                  name={account.name}
                  src={`/api/v1/accounts/${account.id}/avatar`}
                />
                <div className="min-w-0">
                  <p className="truncate font-medium" title={account.name}>
                    {account.name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {account.username ? `@${account.username}` : "—"}
                  </p>
                </div>
              </div>
              {account.current ? <Badge variant="secondary">当前</Badge> : null}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
              <AccountStateBadge
                state={account.state}
                error={account.last_error}
              />
              <Badge variant="outline">
                {accountKindLabels[account.kind] ?? account.kind}
              </Badge>
              <Badge variant="outline">
                {accountSourceLabel(account.source)}
              </Badge>
              <span className="tabular-nums">{maskPhone(account.phone)}</span>
            </div>
            <div className="mt-3 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => onDetail(account)}
              >
                详情
              </Button>
              {account.current ? null : (
                <Button
                  size="sm"
                  className="flex-1"
                  disabled={disabled}
                  title={
                    account.state !== "authed"
                      ? "账号未登录，无法切换"
                      : undefined
                  }
                  onClick={() => onSelect(account)}
                >
                  {selecting ? (
                    <LoaderCircleIcon className="animate-spin" />
                  ) : null}
                  设为当前
                </Button>
              )}
              {account.source === "desktop" ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  disabled={selectingId !== null}
                  onClick={() => onDelete(account)}
                >
                  删除
                </Button>
              ) : null}
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
                disabled={selectingId !== null}
                onClick={() => onLogout(account)}
              >
                {account.source === "desktop" ? "注销" : "登出"}
              </Button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

