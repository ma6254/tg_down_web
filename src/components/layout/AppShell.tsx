import { useEffect, useRef, useState } from "react"
import { Outlet, useLocation } from "react-router-dom"
import { Sidebar } from "@/components/layout/Sidebar"
import { Topbar } from "@/components/layout/Topbar"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet"

/**
 * 应用壳：桌面固定侧栏 + 内容区；窄屏侧栏收进 Sheet，由顶栏菜单打开。
 * 页面本身只负责标题与内容，不处理整体布局。
 */
export function AppShell() {
  const [navOpen, setNavOpen] = useState(false)
  const location = useLocation()
  const mainRef = useRef<HTMLElement>(null)
  const previousPath = useRef(location.pathname)

  // 路由切换后把焦点移到主内容，读屏与键盘用户不会停在旧页面的链接上。
  // 首次加载不抢焦点，保留「跳到主要内容」作为第一个 Tab 停靠点。
  useEffect(() => {
    if (previousPath.current === location.pathname) {
      return
    }
    previousPath.current = location.pathname
    mainRef.current?.focus({ preventScroll: true })
  }, [location.pathname])

  return (
    <div className="flex min-h-svh bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:ring-3 focus:ring-ring/50"
      >
        跳到主要内容
      </a>
      <Sidebar className="hidden h-svh lg:flex" />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenMenu={() => setNavOpen(true)} />
        <main
          ref={mainRef}
          id="main-content"
          tabIndex={-1}
          className="flex-1 px-4 py-6 outline-none sm:px-6 lg:px-8"
        >
          <div className="mx-auto w-full max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>
      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetContent side="left" className="w-72 max-w-[85vw] gap-0 p-0">
          <SheetTitle className="sr-only">导航菜单</SheetTitle>
          <SheetDescription className="sr-only">
            在账号与设置页面之间切换
          </SheetDescription>
          <Sidebar
            className="h-full w-full border-r-0"
            onNavigate={() => setNavOpen(false)}
          />
        </SheetContent>
      </Sheet>
    </div>
  )
}
