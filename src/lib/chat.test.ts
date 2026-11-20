import { describe, expect, it } from "vitest"
import { chatTypeLabel, commonChat } from "@/lib/chat"

describe("chatTypeLabel", () => {
  it("区分广播频道和超级群", () => {
    expect(chatTypeLabel({ kind: "channel", broadcast: true })).toBe("频道")
    expect(chatTypeLabel({ kind: "channel", broadcast: false })).toBe("群聊")
  })

  it("普通群聊", () => {
    expect(chatTypeLabel({ kind: "group" })).toBe("群聊")
  })

  it("私聊与收藏夹", () => {
    expect(chatTypeLabel({ kind: "user", self: false })).toBe("私聊")
    expect(chatTypeLabel({ kind: "user", self: true })).toBe("收藏夹")
  })

  it("没有会话信息时为空", () => {
    expect(chatTypeLabel(undefined)).toBe("")
    expect(chatTypeLabel(null)).toBe("")
  })
})

describe("commonChat", () => {
  const group = { kind: "channel" as const, id: 1, title: "群", broadcast: false }

  it("全部来自同一会话时返回该会话", () => {
    expect(commonChat([{ chat: group }, { chat: { ...group } }])).toEqual(group)
  })

  it("混合会话或没有会话时返回 null", () => {
    expect(commonChat([{ chat: group }, { chat: { ...group, id: 2 } }])).toBeNull()
    expect(commonChat([{}])).toBeNull()
    expect(commonChat([])).toBeNull()
  })
})
