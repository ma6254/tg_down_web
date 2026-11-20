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
