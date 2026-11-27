import type { PreviewChat } from "@/api/types"

type ChatInfo = Pick<PreviewChat, "kind" | "broadcast" | "self">

/** 会话类型标签：频道 / 群聊 / 私聊 / 收藏夹；无会话信息时返回空串。 */
export function chatTypeLabel(chat?: ChatInfo | null): string {
  if (!chat) {
    return ""
  }
  if (chat.kind === "user") {
    return chat.self ? "收藏夹" : "私聊"
  }
  if (chat.kind === "channel") {
    return chat.broadcast ? "频道" : "群聊"
  }
  return "群聊"
}

/**
 * 所有条目都来自同一个会话时返回该会话；混合会话或没有会话时返回 null。
 * 用于把群名/频道名提到「消息正文」卡片标题区。
 */
export function commonChat(
  items: Array<{ chat?: PreviewChat | null }>
): PreviewChat | null {
  let found: PreviewChat | null = null
  for (const item of items) {
    const chat = item.chat
    if (!chat) {
      continue
    }
    if (!found) {
      found = chat
      continue
    }
    if (found.kind !== chat.kind || found.id !== chat.id) {
      return null
    }
  }
  return found
}

/** 会话展示名：标题优先，其次用户名。 */
export function chatName(chat?: PreviewChat | null): string {
  return chat?.title ?? (chat?.username ? `@${chat.username}` : "未知会话")
}
