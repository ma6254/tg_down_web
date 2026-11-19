import { CircleCheckIcon, StarIcon, UsersIcon, type LucideIcon } from "lucide-react"
import type { Account } from "@/api/types"

/** 账号页顶部概览：总数 / 已登录 / 当前账号。 */
export function AccountSummary({ accounts }: { accounts: Account[] }) {
  const authed = accounts.filter((account) => account.state === "authed").length
  const current = accounts.find((account) => account.current)

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <SummaryCard icon={UsersIcon} label="账号总数" value={String(accounts.length)} />
      <SummaryCard icon={CircleCheckIcon} label="已登录" value={String(authed)} />
      <SummaryCard
        icon={StarIcon}
        label="当前账号"
        value={current?.name ?? "未选择"}
        title={current?.name}
      />
    </div>
  )
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  title,
}: {
  icon: LucideIcon
  label: string
  value: string
  title?: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p
          className="truncate text-lg font-semibold leading-tight"
          title={title}
        >
          {value}
        </p>
      </div>
    </div>
  )
}
