import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { useQueryClient } from "@tanstack/react-query"
import {
  UNAUTHORIZED_EVENT,
  describeError,
  getStoredToken,
  isApiError,
  setStoredToken,
} from "@/api/client"
import { api } from "@/api/endpoints"
import { AuthContext, type AuthState, type AuthStatus } from "@/hooks/use-auth"

/**
 * 鉴权 Provider。
 *
 * 启动时用 GET /api/v1/health 探测：
 * - 200：ready（免鉴权，或本地 token 仍然有效）
 * - 401：清掉无效 token，进入 login
 * - 网络 / 超时 / 5xx：offline，可重试
 *
 * 任何后续请求返回 401 时，client 会广播 UNAUTHORIZED_EVENT，
 * 这里统一清 token、清缓存并回登录页。
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [token, setToken] = useState<string | null>(() => getStoredToken())
  const [status, setStatus] = useState<AuthStatus>("checking")
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const probe = useCallback(async (signal?: AbortSignal) => {
    try {
      await api.health({ signal })
      if (!signal?.aborted) {
        setStatus("ready")
      }
    } catch (err) {
      if (signal?.aborted) {
        return
      }
      if (isApiError(err) && err.status === 401) {
        // 启动时携带的 token 已失效（后端换了 token 或本地是旧值）。
        const hadToken = getStoredToken() !== null
        setStoredToken(null)
        setToken(null)
        setNotice(hadToken ? "保存的 token 已失效，请重新输入" : null)
        setStatus("login")
        return
      }
      setError(describeError(err))
      setStatus("offline")
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    // 启动探测必须发一次请求；所有 setState 都在 await 之后执行，不存在同步级联渲染。
    // 这条规则无法识别异步边界，因此按行豁免。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void probe(controller.signal)
    return () => controller.abort()
  }, [probe])

  useEffect(() => {
    const onUnauthorized = () => {
      setToken(null)
      setError(null)
      setNotice("登录状态已失效，请重新输入 token")
      setStatus("login")
      queryClient.clear()
    }
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
  }, [queryClient])

  const login = useCallback(async (candidate: string) => {
    const value = candidate.trim()
    if (!value) {
      throw new Error("请输入 token")
    }
    // 先验证再落盘：失败不覆盖已有的有效 token。
    await api.health({ token: value })
    setStoredToken(value)
    setToken(value)
    setError(null)
    setNotice(null)
    setStatus("ready")
  }, [])

  const logout = useCallback(() => {
    setStoredToken(null)
    setToken(null)
    setError(null)
    setNotice(null)
    setStatus("login")
    queryClient.clear()
  }, [queryClient])

  const retry = useCallback(() => {
    setStatus("checking")
    setError(null)
    void probe()
  }, [probe])

  const value = useMemo<AuthState>(
    () => ({ status, token, error, notice, login, logout, retry }),
    [status, token, error, notice, login, logout, retry]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
