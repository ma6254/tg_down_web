import { MenuIcon } from "lucide-react"
import { Link } from "react-router-dom"
import { Brand } from "@/components/layout/Brand"
import { Button } from "@/components/ui/button"

/** 移动端顶栏：打开导航 + 品牌标识；桌面端隐藏（侧栏常驻）。 */
export function Topbar({ onOpenMenu }: { onOpenMenu: () => void }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur lg:hidden">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="打开导航"
        onClick={onOpenMenu}
      >
        <MenuIcon />
      </Button>
      <Link to="/accounts" aria-label="返回账号页" className="min-w-0">
        <Brand />
      </Link>
    </header>
  )
}
