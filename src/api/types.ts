/**
 * 与 tg_down_server 的 Go 结构体一一对应的 DTO。
 *
 * 以服务端实际实现为准（tg_down_server/internal/server/*.go），
 * 不要按 doc/api.md 的草案臆造字段；后端新增字段时同步更新这里。
 */

export type AccountKind = "mtproto" | "botapi"
export type AccountState = "unauthed" | "authed" | "error"
/** 账号来源：手动登录、从 Telegram Desktop 导入，或 Bot 接入。 */
export type AccountSource = "manual" | "desktop" | "bot"

export interface Health {
  status: string
  version: string
  uptime_seconds: number
}

/**
 * GET /api/v1/system：编译期注入的版本信息与运行环境。
 *
 * commit / build_time 由构建脚本通过 -ldflags 注入；直接 go build 时
 * 分别是 none / unknown。
 */
export interface SystemInfo {
  version: string
  /** git 提交（短哈希或 tag）；未注入时为 none。 */
  commit: string
  /** 编译时间，RFC3339；未注入时为 unknown。 */
  build_time: string
  go_version: string
  os: string
  arch: string
  uptime_seconds: number
}

export interface Account {
  id: number
  kind: AccountKind
  /** 账号来源：manual（手动登录）/ desktop（桌面导入）/ bot；旧数据省略。 */
  source?: AccountSource
  name: string
  username?: string
  phone?: string
  /** Telegram 的 user.id；未绑定或未联网时省略（本地 id 只是数据库主键）。 */
  telegram_id?: number
  state: AccountState
  last_error?: string
  created_at: number // Unix 秒
  current: boolean
}

export interface AccountDetail extends Account {
  updated_at?: number
  session_present: boolean
}

/** POST /accounts/{id}/logout：本地一定删除，revoked 表示 Telegram 端是否注销成功。 */
export interface AccountLogoutResponse {
  ok: boolean
  revoked: boolean
  removed_session: boolean
}

/** DELETE /accounts/{id}：只删除本地记录，不注销 Telegram 会话。 */
export interface AccountDeleteResponse {
  ok: boolean
  removed_session: boolean
}

/** 在线资料里的生日；year 为 0 或省略表示对方只公开了月日。 */
export interface AccountBirthday {
  day: number
  month: number
  year?: number
}

/** GET /accounts/{id}/live：联网查询到的最新资料与已登录客户端（不落库）。 */
export interface AccountLiveInfo {
  /** Telegram 用户 ID，与本地账号记录的 id 无关。 */
  user_id: number
  name: string
  username?: string
  phone?: string
  bot?: boolean
  premium?: boolean
  about?: string
  birthday?: AccountBirthday
  devices: ProbeDevice[]
  fetched_at: number // Unix 秒
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

export type MediaKind = "photo" | "video" | "audio" | "document"

/** POST /links/preview：消息所在会话的摘要。 */
export interface PreviewChat {
  kind: "user" | "group" | "channel"
  id: number
  title: string
  username?: string
  /** 广播频道；kind=channel 时用来区分频道与超级群。 */
  broadcast?: boolean
  /** 用户会话就是当前账号，即收藏夹。 */
  self?: boolean
  /** 群聊头像地址（token，会过期）。 */
  avatar_url?: string
}

/** 群聊消息的发送者。 */
export interface PreviewSender {
  id: number
  name: string
  username?: string
  avatar_url?: string
}

/** 消息正文里的一段文字链接（text_link / url 实体）。 */
export interface PreviewLink {
  text?: string
  url: string
}

/**
 * 消息正文的富文本标注，字段命名对齐 Bot API 的 MessageEntity。
 *
 * offset/length 以 UTF-16 码元计，正好是 JS 字符串的下标单位；
 * 只有对应类型才会出现 url、user_id 等附加字段。
 */
export interface PreviewEntity {
  type: string
  offset: number
  length: number
  url?: string // text_link
  user_id?: number // text_mention
  language?: string // pre
  document_id?: number // custom_emoji
  collapsed?: boolean // blockquote（可折叠引用）
  date?: number // date_time：Unix 时间戳（秒）
  date_format?: "relative" | "time" | "time_long" | "date" | "date_long" | "weekday"
}

/** 消息里的可下载媒体。 */
export interface PreviewMedia {
  kind: MediaKind
  file_name: string
  size: number
  /** 媒体所在消息；相册里每张图对应不同消息。 */
  message_id?: number
  /** 这条消息的链接，相册成员可单独入队；无法拼出时省略。 */
  link?: string
  mime?: string
  duration?: number // 秒
  width?: number
  height?: number
  grouped_id?: number // 相册分组
  downloadable: boolean
  max_size: number // 当前账号的单文件上限
  /** 列表封面地址；没有可用缩略图时省略。 */
  thumbnail_url?: string
  /** 正文大图地址（比封面更大）；没有时前端退回 thumbnail_url。 */
  preview_url?: string
}

/** 一条链接的解析结果；error 非空时其它字段无意义。 */
export interface PreviewItem {
  link: string
  expanded?: boolean
  message_id?: number
  chat?: PreviewChat
  /** 群聊消息的发送者；私聊/频道省略。 */
  sender?: PreviewSender
  text?: string
  links?: PreviewLink[]
  /** 正文的富文本标注；缺失时按纯文本渲染。 */
  entities?: PreviewEntity[]
  media?: PreviewMedia
  /** 相册的全部媒体（按消息 ID 升序）；非相册消息省略，只用 media。 */
  medias?: PreviewMedia[]
  error?: string
}

export interface PreviewSummary {
  total: number
  ok: number
  failed: number
  expanded: number
  no_media: number
  skipped_links?: number
  truncated?: boolean
}

export interface PreviewResponse {
  items: PreviewItem[]
  summary: PreviewSummary
}

/** 解析链接只读：不写数据库、不创建下载任务。 */
export interface PreviewLinksRequest {
  links: string[]
  expand_text_links?: boolean
}

export type DownloadStatus = "pending" | "running" | "paused" | "done" | "failed"

/** 下载任务的状态快照，对应 GET /downloads 的数组元素。 */
export interface DownloadTask {
  id: number
  link: string
  account_id: number
  chat_id: number
  chat_title?: string
  message_id: number
  file_name: string
  file_size: number
  kind?: MediaKind
  mime?: string
  status: DownloadStatus
  /** 已下载字节数；续传时从 .part 大小开始。 */
  offset: number
  /** B/s，只有 running 时有意义。 */
  speed: number
  error?: string
  /** 最终文件路径；开始下载后即有值。 */
  save_path?: string
  /** 该任务会覆盖同名文件。 */
  overwrite?: boolean
  /** 任务卡片缩略图；没有可用封面时省略，前端回退到按任务 ID 的接口。 */
  thumbnail_url?: string
  /** 较大尺寸预览图（图片查看器用）；没有时省略。 */
  preview_url?: string
  created_at: number
  updated_at: number
}

export interface DownloadCreateRequest {
  links: string[]
  /**
   * 为 true 时完成后覆盖同名文件（不再追加 " (1)" 后缀），
   * 并丢弃已有 .part 从零下载。
   */
  overwrite?: boolean
  /**
   * 为 true 时只下载链接指向的那条消息，不展开相册；
   * 默认 false 与 CLI 一致：相册链接会创建整组任务。
   */
  single?: boolean
}

/** 因「没有媒体」或「超过单文件上限」被跳过的链接。 */
export interface DownloadSkip {
  link: string
  reason: string
}

/** 解析或查询失败的链接。 */
export interface DownloadFailure {
  link: string
  error: string
}

/** POST /downloads 的结果：新建、已存在、跳过与失败分开返回。 */
export interface DownloadCreateResponse {
  created: number[]
  existing: number[]
  skipped?: DownloadSkip[]
  failed?: DownloadFailure[]
}

export type DownloadAction = "pause" | "resume" | "retry"
