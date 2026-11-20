import { getStoredToken, UNAUTHORIZED_EVENT } from "@/api/client"

/** 一条 SSE 事件：event 是事件名，data 是解析后的 JSON。 */
export interface DownloadEvent {
  event: string
  data: unknown
}

const API_BASE = "/api/v1"

/**
 * 打开 /api/v1/events 的 SSE 流，直到连接断开或 signal 取消。
 *
 * 用 fetch 而不是 EventSource：EventSource 不能带 Authorization 头。
 * 调用方负责重连；本函数在连接断开时正常返回（不抛错）。
 */
export async function openDownloadEvents(
  signal: AbortSignal,
  handlers: {
    onOpen?: () => void
    onEvent: (event: DownloadEvent) => void
  }
): Promise<void> {
  const headers: Record<string, string> = { Accept: "text/event-stream" }
  const token = getStoredToken()
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const response = await fetch(`${API_BASE}/events`, { headers, signal })
  if (response.status === 401) {
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
    throw new Error("unauthorized")
  }
  if (!response.ok) {
    throw new Error(`实时事件连接失败（HTTP ${response.status}）`)
  }
  if (!response.body) {
    throw new Error("实时事件连接不支持流式响应")
  }

  handlers.onOpen?.()

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) {
        return
      }
      buffer += decoder.decode(value, { stream: true })
      buffer = consumeSSEFrames(buffer, handlers.onEvent)
    }
  } finally {
    reader.releaseLock()
  }
}

/**
 * 从缓冲区里切出完整的 SSE 帧（以空行分隔），返回未消费的尾巴。
 *
 * 抽成纯函数便于单测；服务端每帧是 `event: x\ndata: {...}\n\n`。
 */
export function consumeSSEFrames(
  buffer: string,
  onEvent: (event: DownloadEvent) => void
): string {
  let rest = buffer.replace(/\r\n/g, "\n")
  for (;;) {
    const index = rest.indexOf("\n\n")
    if (index < 0) {
      return rest
    }
    const frame = rest.slice(0, index)
    rest = rest.slice(index + 2)
    const parsed = parseSSEFrame(frame)
    if (parsed) {
      onEvent(parsed)
    }
  }
}

/** 解析单个 SSE 帧；没有 data 或 JSON 非法时返回 null（例如注释/保活空帧）。 */
export function parseSSEFrame(frame: string): DownloadEvent | null {
  let event = "message"
  const data: string[] = []

  for (const line of frame.split("\n")) {
    if (line === "" || line.startsWith(":")) {
      continue
    }
    const colon = line.indexOf(":")
    const field = colon === -1 ? line : line.slice(0, colon)
    let value = colon === -1 ? "" : line.slice(colon + 1)
    if (value.startsWith(" ")) {
      value = value.slice(1)
    }
    if (field === "event") {
      event = value
    } else if (field === "data") {
      data.push(value)
    }
  }

  if (data.length === 0) {
    return null
  }
  try {
    return { event, data: JSON.parse(data.join("\n")) }
  } catch {
    return null
  }
}
