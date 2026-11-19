import { Navigate, Outlet, useLocation } from "react-router-dom"
import { BootSplash } from "@/components/auth/BootSplash"
import { OfflineScreen } from "@/components/auth/OfflineScreen"
import { useAuth } from "@/hooks/use-auth"

/** 鉴权门：checking → 等待；login → 登录页；offline → 离线页；ready → 应用。 */
export function AuthGate() {
  const { status } = useAuth()
  const location = useLocation()

  if (status === "checking") {
    return <BootSplash />
  }

  if (status === "login") {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    )
  }

  if (status === "offline") {
    return <OfflineScreen />
  }

  return <Outlet />
}
