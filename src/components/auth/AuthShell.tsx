import type { ReactNode } from "react"
import { Brand } from "@/components/layout/Brand"

/** 登录 / 离线页共用的居中布局。 */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted/30 p-6">
      <Brand />
      <div className="w-full max-w-sm">{children}</div>
    </div>
  )
}
