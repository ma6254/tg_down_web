/**
 * 与 tg_down_server 的 Go 结构体一一对应的 DTO。
 *
 * 以服务端实际实现为准（tg_down_server/internal/server/*.go），
 * 不要按 doc/api.md 的草案臆造字段；后端新增字段时同步更新这里。
 */

export type AccountKind = "mtproto" | "botapi"
export type AccountState = "unauthed" | "authed" | "error"

export interface Health {
  status: string
  version: string
  uptime_seconds: number
}

export interface Account {
  id: number
  kind: AccountKind
  name: string
  username?: string
  phone?: string
  state: AccountState
  last_error?: string
  created_at: number // Unix 秒
  current: boolean
}

export interface AccountDetail extends Account {
  updated_at?: number
  session_present: boolean
}

export interface AccountsResponse {
  accounts: Account[]
  current_account_id?: number
}

export interface ProbeRequest {
  tdata?: string
  tdata_passcode?: string
  timeout_seconds?: number // 5–300，默认 30
  import?: boolean // 默认 true
}

export interface ProbeDevice {
  current: boolean
  app_name?: string
  app_version?: string
  platform?: string
  device_model?: string
  system_version?: string
  country?: string
  created_at?: number
  active_at?: number
}

export interface ProbeAccount {
  index: number
  user_id: number
  name?: string
  username?: string
  phone?: string
  devices?: ProbeDevice[]
  error?: string
}

export interface ProbeResponse {
  tdata_path?: string
  accounts: ProbeAccount[]
  imported: number
  skipped: number
  selected_account_id?: number
}

export interface Setting {
  key: string
  /** 值的逻辑类型（string / integer / boolean），由服务端 config.items 定义。 */
  type?: string
  /** 未配置时使用的默认值；为空表示没有默认值。 */
  default?: string
  value: string
  description?: string
  known: boolean
  read_only?: boolean
}

export interface SettingsResponse {
  settings: Setting[]
}

/** PUT /settings 的补丁：值为 null 表示删除该配置项，未出现的键保持原值。 */
export type SettingsPatch = Record<string, string | null>

export interface SelectAccountResponse {
  ok: boolean
  current_account_id: number
}
