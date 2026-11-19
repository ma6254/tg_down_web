import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  ApiError,
  TOKEN_STORAGE_KEY,
  UNAUTHORIZED_EVENT,
  describeError,
  request,
} from "./client"

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function createStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value)
    },
    removeItem: (key: string) => {
      values.delete(key)
    },
    clear: () => values.clear(),
    key: () => null,
    length: 0,
  }
}

let storage: ReturnType<typeof createStorage>
let target: EventTarget
let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  storage = createStorage()
  target = new EventTarget()

  vi.stubGlobal("localStorage", storage)
  vi.stubGlobal("window", {
    setTimeout: (callback: () => void, ms?: number) =>
      globalThis.setTimeout(callback, ms),
    clearTimeout: (timer: ReturnType<typeof setTimeout>) =>
      globalThis.clearTimeout(timer),
    dispatchEvent: (event: Event) => target.dispatchEvent(event),
    addEventListener: target.addEventListener.bind(target),
    removeEventListener: target.removeEventListener.bind(target),
  })

  fetchMock = vi.fn()
  vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("request", () => {
  it("把服务端错误体解析为 ApiError", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        { error: { code: "conflict", message: "账号的 session 文件不可用" } },
        409
      )
    )

    await expect(request("/accounts/1/select")).rejects.toMatchObject({
      status: 409,
      code: "conflict",
      message: "账号的 session 文件不可用",
    })
  })

  it("401 时清空 token 并广播事件", async () => {
    storage.setItem(TOKEN_STORAGE_KEY, "old-token")
    const onUnauthorized = vi.fn()
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
    fetchMock.mockResolvedValue(
      jsonResponse({ error: { code: "unauthorized", message: "token 错误" } }, 401)
    )

    await expect(request("/accounts")).rejects.toBeInstanceOf(ApiError)

    expect(storage.getItem(TOKEN_STORAGE_KEY)).toBeNull()
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
  })

  it("候选 token 校验失败时不广播全局登出", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: { code: "unauthorized", message: "token 错误" } }, 401)
    )
    const onUnauthorized = vi.fn()
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized)

    await expect(
      request("/health", { token: "candidate", handleUnauthorized: false })
    ).rejects.toBeInstanceOf(ApiError)

    expect(onUnauthorized).not.toHaveBeenCalled()
  })

  it("发送 Bearer token；显式 token 不写入 localStorage", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ status: "ok" }))

    await request("/health", { token: "candidate" })

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit
    const headers = new Headers(init.headers)
    expect(headers.get("Authorization")).toBe("Bearer candidate")
    expect(storage.getItem(TOKEN_STORAGE_KEY)).toBeNull()
  })

  it("网络错误归一为 status=0 的 network", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"))

    await expect(request("/health")).rejects.toMatchObject({
      status: 0,
      code: "network",
    })
  })

  it("超时归一为 timeout", async () => {
    fetchMock.mockImplementation(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"))
          })
        })
    )

    await expect(request("/slow", { timeoutMs: 20 })).rejects.toMatchObject({
      code: "timeout",
    })
  })

  it("非 JSON 的 5xx 响应给出可读兜底", async () => {
    fetchMock.mockResolvedValue(
      new Response("<html>bad gateway</html>", { status: 502 })
    )

    await expect(request("/health")).rejects.toMatchObject({
      status: 502,
      code: "bad_response",
    })
  })
})

describe("describeError", () => {
  it("把网络错误翻译成可展示文案", () => {
    expect(describeError(new ApiError(0, "network", "x"))).toContain(
      "无法连接后端服务"
    )
    expect(describeError(new ApiError(401, "unauthorized", "x"))).toContain(
      "token 无效"
    )
  })
})
