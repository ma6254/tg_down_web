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
  /** 缩略图磁盘缓存键；下载页历史用它取封面，跨重启仍然有效。 */
  thumb_key?: string
}

/** 频道帖子评论区的摘要；普通消息/评论链接省略。 */
export interface PreviewCommentSection {
  /** 帖子是否开启了评论区（即使暂时没有评论）。 */
  available: boolean
  /** 评论总数。 */
  count: number
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
  /** 频道帖子的评论区摘要；普通消息/评论链接省略。 */
  comment_section?: PreviewCommentSection
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

/** 评论引用的回复目标。 */
export interface PreviewCommentReply {
  message_id: number
  quote?: string
}

/** 评论区里的一条评论。 */
export interface PreviewComment {
  id: number
  /** Unix 秒。 */
  date: number
  /** 匿名评论可能省略。 */
  sender?: PreviewSender
  text?: string
  links?: PreviewLink[]
  entities?: PreviewEntity[]
  media?: PreviewMedia
  /** 媒体解析失败的原因；评论文字仍然可用。 */
  media_error?: string
  reply_to?: PreviewCommentReply
}

/** GET /links/comments：频道帖子的评论区。 */
export interface CommentsResponse {
  link: string
  message_id: number
  /** 讨论组里的线程起始消息；没有评论区时省略。 */
  thread_id?: number
  available: boolean
  /** available=false 时的原因。 */
  reason?: string
  /** 评论区所在的关联讨论组。 */
  chat?: PreviewChat
  /** 原帖所在的频道。 */
  post_chat?: PreviewChat
  total: number
  /** 按时间倒序（最新在前）。 */
  comments: PreviewComment[]
  /** 加载更早评论时传给 offset_id；0/省略表示没有更多。 */
  next_offset_id?: number
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

/** GET /downloads/stats/history 的一个聚合点。 */
export interface DownloadSpeedPoint {
  /** 桶起始时间，Unix 秒。 */
  at: number
  /** 桶内平均合计速度，B/s。 */
  total_speed: number
  /** 桶内最大运行任务数。 */
  running_tasks: number
}

/** GET /downloads/stats/history：一段历史速度曲线。 */
export interface DownloadSpeedHistory {
  from: number
  to: number
  bucket: number
  sample_interval: number
  /** 平均/峰值统计的起点：上次清空时间或窗口起点，Unix 秒。 */
  stats_since: number
  /** 区间内全部原始样本的平均值（含空闲 0 值），B/s。 */
  average_speed: number
  /** 区间内单个原始样本的峰值，B/s。 */
  peak_speed: number
  points: DownloadSpeedPoint[]
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
  /**
   * 为 true 时跳过前端的单文件上限预检，强制创建任务；
   * Telegram 服务端仍可能拒绝，失败会体现在任务 error。
   */
  allow_over_limit?: boolean
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

/** POST /downloads 的结果：新建、重启、已存在、跳过与失败分开返回。 */
export interface DownloadCreateResponse {
  created: number[]
  /** 覆盖模式下被重置并重新入队的已有任务。 */
  restarted?: number[]
  existing: number[]
  skipped?: DownloadSkip[]
  failed?: DownloadFailure[]
}

export type DownloadAction = "pause" | "resume" | "retry"

/** 解析摘要的计数，对应服务端 PreviewSummary 的裁剪版。 */
export interface DownloadCacheSummary {
  total: number
  ok: number
  failed: number
  no_media: number
  expanded: number
}

/** 摘要里出现过的会话。 */
export interface DownloadCacheChat {
  kind: PreviewChat["kind"]
  title: string
  username?: string
}

/** 摘要里的一条消息（正文前 200 字 + 主媒体信息）。 */
export interface DownloadCacheItem {
  message_id?: number
  chat_title?: string
  text?: string
  media_kind?: MediaKind
  file_name?: string
  size?: number
  /** 缩略图磁盘缓存键（历史卡片封面用）；服务端只接受 64 位十六进制。 */
  thumb_key?: string
}

/** 摘要里的一条解析失败记录。 */
export interface DownloadCacheFailure {
  link: string
  error: string
}

/**
 * 裁剪后的解析摘要，草稿与历史共用。
 *
 * 服务端按白名单裁剪（items ≤ 20、chats ≤ 5、failures ≤ 5、文本 200 字），
 * 不回传缩略图地址、entities 等会过期或敏感的字段。
 */
export interface DownloadCache {
  v: number
  summary: DownloadCacheSummary
  chats?: DownloadCacheChat[]
  items?: DownloadCacheItem[]
  failures?: DownloadCacheFailure[]
}

/** GET/PUT /downloads/draft：下载页输入草稿（两个开关都在系统配置里）。 */
export interface DownloadDraft {
  links: string
  cache?: DownloadCache
  /** 最后保存时间（Unix 秒）；从未保存时省略。 */
  updated_at?: number
}

/** PUT /downloads/draft 的请求体：cache 省略表示保留，null 表示清除。 */
export interface DownloadDraftInput {
  links: string
  cache?: DownloadCache | null
}

/** 历史列表里的一行；完整 links 与缓存条目在详情里。 */
export interface DownloadHistoryEntry {
  id: number
  first_line: string
  /** 历史卡片标题：消息摘要（正文/说明，或 [图片] 之类的媒体占位符）。 */
  title?: string
  line_count: number
  expand_text_links: boolean
  overwrite: boolean
  use_count: number
  summary?: DownloadCacheSummary
  chats?: DownloadCacheChat[]
  /** summary.total 大于缓存条目数（只缓存前 20 条）。 */
  cache_truncated: boolean
  created_at: number
  last_used_at: number
}

/** GET /downloads/history/{id}：包含完整回填文本与缓存。 */
export interface DownloadHistoryDetail extends DownloadHistoryEntry {
  links: string
  cache?: DownloadCache
}

export interface DownloadHistoryList {
  items: DownloadHistoryEntry[]
}

/** POST /downloads/history 的请求体。 */
export interface DownloadHistoryInput {
  links: string
  expand_text_links: boolean
  overwrite: boolean
  cache?: DownloadCache | null
}
