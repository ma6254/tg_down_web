/**
 * HTTP 客户端：统一请求、错误归一、token 读写与 401 广播。
 *
 * 页面不直接调用 fetch；所有接口走 src/api/endpoints.ts。
 */

const API_BASE = "/api/v1"

export const TOKEN_STORAGE_KEY = "tg_down.token"

/** 任意请求返回 401 时广播，由 AuthProvider 统一跳登录页。 */
export const UNAUTHORIZED_EVENT = "tg_down:unauthorized"

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH"

export interface RequestOptions {
  method?: HttpMethod
  body?: unknown
  signal?: AbortSignal
  /** 默认 20s；probe 这类长请求单独传 310_000。 */
  timeoutMs?: number
  /**
   * 覆盖本次请求使用的 token：
   * - 不传：使用 localStorage 里的 token；
   * - null：不发送 Authorization（登录前探测用）；
   * - 字符串：使用指定 token（登录校验用，不写回存储）。
   */
  token?: string | null
  /** 默认 true；登录校验等场景传 false，避免把「候选 token 错误」当成全局登出。 */
  handleUnauthorized?: boolean
  /** 为 true 时允许请求在页面卸载后继续（草稿 pagehide 兜底保存）。 */
  keepalive?: boolean
}

/** 归一后的接口错误。status 为 0 表示未收到响应（网络错误/超时/取消）。 */
export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.code = code
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

export function getStoredToken(): string | null {
  try {
    const value = localStorage.getItem(TOKEN_STORAGE_KEY)
    return value ? value.trim() || null : null
  } catch {
    return null
  }
}

export function setStoredToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token)
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY)
    }
  } catch {
    /* 隐私模式等场景下 localStorage 不可用：本次会话仍可通过 state 携带 token */
  }
}

/** 把异常翻译成可直接展示的中文文案。 */
export function describeError(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return error instanceof Error ? error.message : "未知错误"
  }
  switch (error.code) {
    case "network":
      return "无法连接后端服务，请确认 tg_down 已启动"
    case "timeout":
      return "连接后端超时，请检查进程是否卡住"
    case "aborted":
      return "请求已取消"
    default:
      break
  }
  if (error.status === 401) {
    return "token 无效或已过期"
  }
  if (error.status >= 500) {
    return `后端服务异常（HTTP ${error.status}）`
  }
  return error.message
}

interface ErrorBody {
  error?: {
    code?: string
    message?: string
  }
}

function parseError(status: number, text: string): ApiError {
  if (text) {
    try {
      const body = JSON.parse(text) as ErrorBody
      const code = body.error?.code || "http_error"
      const message = body.error?.message || `请求失败（HTTP ${status}）`
      return new ApiError(status, code, message)
    } catch {
      // 非 JSON（例如反向代理返回的 HTML 错误页）
    }
  }
  if (status >= 500) {
    return new ApiError(status, "bad_response", `后端返回了非 JSON 响应（HTTP ${status}），请确认后端已启动`)
  }
  return new ApiError(status, "http_error", `请求失败（HTTP ${status}）`)
}

/**
 * 发起一次 API 请求。
 *
 * - 404/409/422 等业务错误统一抛 ApiError，保留服务端 code/message；
 * - 401 默认清空 token 并广播 UNAUTHORIZED_EVENT；
 * - 网络错误、超时、主动取消都以 ApiError（status=0）区分。
 */
export async function request<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const {
    method = "GET",
    body,
    signal,
    timeoutMs = 20_000,
    token: tokenOverride,
    handleUnauthorized = true,
    keepalive = false,
  } = options

  const token = tokenOverride === undefined ? getStoredToken() : tokenOverride

  const headers: Record<string, string> = { Accept: "application/json" }
  if (body !== undefined) {
    headers["Content-Type"] = "application/json"
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  if (signal?.aborted) {
    throw new ApiError(0, "aborted", "请求已取消")
  }

  const controller = new AbortController()
  let timedOut = false
  const timer = window.setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)
  const onAbort = () => controller.abort()
  signal?.addEventListener("abort", onAbort, { once: true })

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
      keepalive,
    })

    const text = await response.text().catch(() => "")

    if (!response.ok) {
      if (response.status === 401 && handleUnauthorized) {
        setStoredToken(null)
        window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
      }
      throw parseError(response.status, text)
    }

    if (!text) {
      return undefined as T
    }

    try {
      return JSON.parse(text) as T
    } catch {
      throw new ApiError(
        response.status,
        "bad_response",
        "后端返回了非 JSON 响应，请确认接口路径与代理配置"
      )
    }
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }
    if (timedOut) {
      throw new ApiError(0, "timeout", `请求超时（${Math.round(timeoutMs / 1000)}s）`)
    }
    if (signal?.aborted) {
      throw new ApiError(0, "aborted", "请求已取消")
    }
    throw new ApiError(0, "network", "无法连接后端服务")
  } finally {
    window.clearTimeout(timer)
    signal?.removeEventListener("abort", onAbort)
  }
}
