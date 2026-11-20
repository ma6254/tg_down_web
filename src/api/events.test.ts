import { describe, expect, it } from "vitest"
import { consumeSSEFrames, parseSSEFrame } from "./events"

describe("parseSSEFrame", () => {
  it("解析 event 与 JSON data", () => {
    expect(parseSSEFrame('event: task.update\ndata: {"id":1,"status":"running"}')).toEqual({
      event: "task.update",
      data: { id: 1, status: "running" },
    })
  })

  it("多行 data 会拼接成一个 JSON", () => {
    const frame = 'event: task.progress\ndata: {"id":1,\ndata: "offset":1024}'
    expect(parseSSEFrame(frame)).toEqual({
      event: "task.progress",
      data: { id: 1, offset: 1024 },
    })
  })

  it("忽略注释与没有 data 的帧", () => {
    expect(parseSSEFrame(": keep-alive")).toBeNull()
    expect(parseSSEFrame("event: ping")).toBeNull()
  })

  it("JSON 非法时返回 null 而不是抛错", () => {
    expect(parseSSEFrame("event: ping\ndata: {")).toBeNull()
  })
})

describe("consumeSSEFrames", () => {
  it("切出完整帧并保留不完整的尾巴", () => {
    const events: string[] = []
    const rest = consumeSSEFrames(
      'event: ping\ndata: {}\n\nevent: task.deleted\ndata: {"id":2}\n\nevent: task.up',
      (event) => events.push(event.event)
    )
    expect(events).toEqual(["ping", "task.deleted"])
    expect(rest).toBe("event: task.up")
  })

  it("兼容 CRLF 换行", () => {
    const events: string[] = []
    consumeSSEFrames('event: ping\r\ndata: {}\r\n\r\n', (event) => events.push(event.event))
    expect(events).toEqual(["ping"])
  })

  it("空缓冲返回空串", () => {
    expect(consumeSSEFrames("", () => {})).toBe("")
  })
})
