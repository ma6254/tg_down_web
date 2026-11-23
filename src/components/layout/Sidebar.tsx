import {
  DownloadIcon,
  ListOrderedIcon,
  LogOutIcon,
  SettingsIcon,
  UsersIcon,
} from "lucide-react"
import { NavLink } from "react-router-dom"
import { Brand } from "@/components/layout/Brand"
import { ThemeToggle } from "@/components/ThemeToggle"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/use-auth"
import { useDownloads } from "@/hooks/use-downloads"
import { countActiveDownloads } from "@/lib/download"
import { cn } from "@/lib/utils"

const navItems = [
  { to: "/accounts", label: "账号", icon: UsersIcon },
  { to: "/downloads", label: "下载", icon: DownloadIcon },
  { to: "/queue", label: "下载队列", icon: ListOrderedIcon },
  { to: "/settings", label: "设置", icon: SettingsIcon },
]

interface SidebarProps {
  className?: string
  onNavigate?: () => void
}

/** 侧栏：品牌、主导航、底部连接状态与主题/退出入口；移动端复用放进 Sheet。 */
export function Sidebar({ className, onNavigate }: SidebarProps) {
  const { token, logout } = useAuth()

  // 侧栏常驻在所有页面：这里订阅任务列表，队列入队/开始时徽标能跟着更新。
  // 有进行中任务（running / pending）时 useDownloads 每 2s 轮询，全部结束后自动停止。
  const downloads = useDownloads()
  const activeCount = countActiveDownloads(downloads.data ?? [])

  return (
    <aside
      className={cn(
        "flex h-svh w-60 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground",
        className
      )}
    >
      <div className="flex h-14 items-center border-b px-4">
        <NavLink to="/accounts" onClick={onNavigate} aria-label="返回账号页">
          <Brand />
        </NavLink>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-2" aria-label="主导航">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
              )
            }
          >
            <Icon className="size-4" />
            {label}
            {to === "/queue" && activeCount > 0 ? (
              <Badge
                className="ml-auto min-w-5 justify-center px-1.5 tabular-nums"
                title={`${activeCount} 个任务正在下载或排队`}
              >
                <span className="sr-only">，{activeCount} 个任务正在下载或排队</span>
                <span aria-hidden="true">{activeCount}</span>
              </Badge>
            ) : null}
          </NavLink>
        ))}
      </nav>
      <div className="border-t p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
            <span
              className="size-1.5 shrink-0 rounded-full bg-emerald-500"
              aria-hidden="true"
            />
            <span className="truncate">
              {token ? "token 鉴权" : "本地免鉴权"}
            </span>
          </div>
          <div className="flex shrink-0 items-center">
            {token ? (
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="退出登录"
                onClick={logout}
              >
                <LogOutIcon />
              </Button>
            ) : null}
            <ThemeToggle />
          </div>
        </div>
      </div>
    </aside>
  )
}
