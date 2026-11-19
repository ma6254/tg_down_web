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
