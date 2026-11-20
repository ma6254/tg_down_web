import type { AccountKind, AccountState } from "@/api/types"

export const accountKindLabels: Record<AccountKind, string> = {
  mtproto: "MTProto",
  botapi: "Bot API",
}

export const accountStateLabels: Record<AccountState, string> = {
  authed: "已登录",
  unauthed: "未登录",
  error: "异常",
}

export const accountSourceLabels: Record<string, string> = {
  manual: "手动登录",
  desktop: "桌面导入",
  bot: "Bot",
}

/** 来源为空（旧数据）时显示“未记录”。 */
export function accountSourceLabel(source?: string): string {
  if (!source) {
    return "未记录"
  }
  return accountSourceLabels[source] ?? source
}

/**
 * 能否从 tg_down 注销该账号。
 *
 * 桌面导入的账号与 Telegram Desktop 共用 auth key，注销会连带桌面端退出登录，
 * 因此服务端拒绝注销（409），前端对这些账号只提供「删除本地副本」。
 */
export function canLogout(source?: string): boolean {
  return source !== "desktop"
}
