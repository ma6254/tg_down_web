import { createContext, useContext } from "react"

/** 鉴权状态：checking = 启动探测中，ready = 可用，login = 需要 token，offline = 连不上后端。 */
export type AuthStatus = "checking" | "ready" | "login" | "offline"

export interface AuthState {
  status: AuthStatus
  /** 当前使用的 token；null 表示本地免鉴权模式。 */
  token: string | null
  /** offline / 启动失败时的可展示原因。 */
  error: string | null
  /** 登录页提示（例如上次 token 已失效）；null 表示无提示。 */
  notice: string | null
  /** 校验并保存 token；失败会抛出 ApiError，由登录页展示。 */
  login: (token: string) => Promise<void>
  /** 清空 token 与查询缓存，回到登录页。 */
  logout: () => void
  /** 重新探测后端（离线页使用）。 */
  retry: () => void
}

export const AuthContext = createContext<AuthState | null>(null)

export function useAuth(): AuthState {
  const value = useContext(AuthContext)
  if (!value) {
    throw new Error("useAuth 必须在 <AuthProvider> 内使用")
  }
  return value
}
