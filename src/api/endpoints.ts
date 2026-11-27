import { request } from "@/api/client"
import type {
  AccountDetail,
  AccountLiveInfo,
  AccountLogoutResponse,
  AccountDeleteResponse,
  AccountsResponse,
  CacheStats,
  CommentsResponse,
  DownloadAction,
  DownloadCreateRequest,
  DownloadCreateResponse,
  DownloadDraft,
  DownloadDraftInput,
  DownloadHistoryDetail,
  DownloadHistoryInput,
  DownloadHistoryList,
  DownloadSpeedHistory,
  DownloadStatus,
  DownloadTask,
  Health,
  PreviewLinksRequest,
  PreviewResponse,
  ProbeRequest,
  ProbeResponse,
  SelectAccountResponse,
  SettingsPatch,
  SettingsResponse,
  SystemInfo,
} from "@/api/types"

/** 历史封面地址：直接放进 <img src>，没有封面时返回 404。 */
export function downloadHistoryCoverUrl(id: number): string {
  return `/api/v1/downloads/history/${id}/cover`
}

/**
 * 已下载文件地址：可直接用于新标签页、<video>/<audio> 或图片查看器。
 *
 * 支持 Range，视频/音频拖动进度条不会拉取整个文件；只在任务已下载完成时有内容。
 */
export function downloadFileUrl(id: number): string {
  return `/api/v1/downloads/${id}/file`
}

export interface HealthOptions {
  signal?: AbortSignal
  /** 传 null 表示不带 Authorization；不传则使用本地保存的 token。 */
  token?: string | null
}

/**
 * 按资源分组的接口函数。
 *
 * 健康检查单独把超时收紧到 5s：它只用于启动探测和登录校验，
 * 后端没起来时应当快速失败并展示离线页。
 */
export const api = {
  health(options: HealthOptions = {}): Promise<Health> {
    return request<Health>("/health", {
      token: options.token,
      signal: options.signal,
      timeoutMs: 5_000,
      handleUnauthorized: false,
    })
  },

  /** 编译期版本信息与运行环境：设置在「服务信息」卡片里展示。 */
  system: {
    get(signal?: AbortSignal): Promise<SystemInfo> {
      return request<SystemInfo>("/system", { signal })
    },
  },

  accounts: {
    list(signal?: AbortSignal): Promise<AccountsResponse> {
      return request<AccountsResponse>("/accounts", { signal })
    },
    get(id: number, signal?: AbortSignal): Promise<AccountDetail> {
      return request<AccountDetail>(`/accounts/${id}`, { signal })
    },
    /** 联网查询在线资料；服务端上限 30s，客户端留 5s 余量。 */
    live(id: number, signal?: AbortSignal): Promise<AccountLiveInfo> {
      return request<AccountLiveInfo>(`/accounts/${id}/live`, {
        signal,
        timeoutMs: 35_000,
      })
    },
    select(id: number): Promise<SelectAccountResponse> {
      return request<SelectAccountResponse>(`/accounts/${id}/select`, {
        method: "POST",
      })
    },
    /** 退出登录并删除本地账号；服务端吊销 session 最多 30s，客户端留 5s 余量。 */
    logout(id: number): Promise<AccountLogoutResponse> {
      return request<AccountLogoutResponse>(`/accounts/${id}/logout`, {
        method: "POST",
        timeoutMs: 35_000,
      })
    },
    /** 只删除本地账号记录与 session 文件，不注销 Telegram 会话。 */
    remove(id: number): Promise<AccountDeleteResponse> {
      return request<AccountDeleteResponse>(`/accounts/${id}`, {
        method: "DELETE",
      })
    },
    /** 同步执行，服务端上限 300s；客户端留 10s 余量。 */
    probe(body: ProbeRequest, signal?: AbortSignal): Promise<ProbeResponse> {
      return request<ProbeResponse>("/accounts/probe", {
        method: "POST",
        body,
        signal,
        timeoutMs: 310_000,
      })
    },
  },

  settings: {
    get(signal?: AbortSignal): Promise<SettingsResponse> {
      return request<SettingsResponse>("/settings", { signal })
    },
    update(patch: SettingsPatch): Promise<SettingsResponse> {
      return request<SettingsResponse>("/settings", { method: "PUT", body: patch })
    },
  },

  cache: {
    /** 读取本地缓存规模（消息快照 / 会话定位 / 评论线程的行数）。 */
    stats(signal?: AbortSignal): Promise<CacheStats> {
      return request<CacheStats>("/cache", { signal })
    },
    /** 清空本地缓存，返回被删除的行数。 */
    clear(): Promise<CacheStats> {
      return request<CacheStats>("/cache", { method: "DELETE" })
    },
  },

  links: {
    /**
     * 解析消息链接（只读，不创建任务）。
     *
     * 服务端按链接数放宽超时（上限 5 分钟），客户端留 10s 余量。
     */
    preview(
      body: PreviewLinksRequest,
      signal?: AbortSignal
    ): Promise<PreviewResponse> {
      return request<PreviewResponse>("/links/preview", {
        method: "POST",
        body,
        signal,
        timeoutMs: 310_000,
      })
    },
    /**
     * 读取频道帖子评论区（只读）。
     *
     * 服务端超时 45s，客户端留 5s 余量；点开评论时才调用。
     */
    comments(
      params: { link: string; limit?: number; offset_id?: number },
      signal?: AbortSignal
    ): Promise<CommentsResponse> {
      const query = new URLSearchParams()
      query.set("link", params.link)
      if (params.limit !== undefined) {
        query.set("limit", String(params.limit))
      }
      if (params.offset_id) {
        query.set("offset_id", String(params.offset_id))
      }
      return request<CommentsResponse>(`/links/comments?${query.toString()}`, {
        signal,
        timeoutMs: 50_000,
      })
    },
  },

  downloads: {
    /** 创建任务：服务端要联网解析消息，超时与预览一致。 */
    create(body: DownloadCreateRequest): Promise<DownloadCreateResponse> {
      return request<DownloadCreateResponse>("/downloads", {
        method: "POST",
        body,
        timeoutMs: 310_000,
      })
    },
    list(
      params: { status?: DownloadStatus; limit?: number } = {},
      signal?: AbortSignal
    ): Promise<DownloadTask[]> {
      const query = new URLSearchParams()
      if (params.status) {
        query.set("status", params.status)
      }
      if (params.limit) {
        query.set("limit", String(params.limit))
      }
      const suffix = query.size > 0 ? `?${query.toString()}` : ""
      return request<DownloadTask[]>(`/downloads${suffix}`, { signal })
    },
    get(id: number, signal?: AbortSignal): Promise<DownloadTask> {
      return request<DownloadTask>(`/downloads/${id}`, { signal })
    },
    /** 历史速度曲线：from/to 为 Unix 秒，bucket 省略时服务端自动选粒度。 */
    speedHistory(
      params: { from: number; to: number; bucket?: number },
      signal?: AbortSignal
    ): Promise<DownloadSpeedHistory> {
      const query = new URLSearchParams()
      query.set("from", String(params.from))
      query.set("to", String(params.to))
      if (params.bucket) {
        query.set("bucket", String(params.bucket))
      }
      return request<DownloadSpeedHistory>(
        `/downloads/stats/history?${query.toString()}`,
        { signal }
      )
    },
    control(id: number, action: DownloadAction): Promise<DownloadTask> {
      return request<DownloadTask>(`/downloads/${id}/${action}`, { method: "POST" })
    },
    remove(id: number, deleteFile: boolean): Promise<{ ok: boolean }> {
      const suffix = deleteFile ? "?delete_file=true" : ""
      return request<{ ok: boolean }>(`/downloads/${id}${suffix}`, {
        method: "DELETE",
      })
    },

    /** 下载页输入草稿：没有草稿时后端返回默认值，不会 404。 */
    draft(signal?: AbortSignal): Promise<DownloadDraft> {
      return request<DownloadDraft>("/downloads/draft", { signal })
    },
    /** 全量保存草稿；cache 为 null 表示清除摘要，省略表示保留。 */
    saveDraft(
      body: DownloadDraftInput,
      options: { keepalive?: boolean } = {}
    ): Promise<DownloadDraft> {
      return request<DownloadDraft>("/downloads/draft", {
        method: "PUT",
        body,
        keepalive: options.keepalive,
      })
    },
    /** 最近解析过的输入批次（服务端只保留最近 20 条）。 */
    history(limit = 20, signal?: AbortSignal): Promise<DownloadHistoryList> {
      return request<DownloadHistoryList>(`/downloads/history?limit=${limit}`, {
        signal,
      })
    },
    /** 历史详情：包含完整 links 与摘要缓存，用于回填。 */
    historyDetail(id: number, signal?: AbortSignal): Promise<DownloadHistoryDetail> {
      return request<DownloadHistoryDetail>(`/downloads/history/${id}`, { signal })
    },
    /** 记录一次成功解析；内容重复时后端返回 200 并累加使用次数。 */
    recordHistory(body: DownloadHistoryInput): Promise<DownloadHistoryDetail> {
      return request<DownloadHistoryDetail>("/downloads/history", {
        method: "POST",
        body,
      })
    },
    removeHistory(id: number): Promise<{ ok: boolean }> {
      return request<{ ok: boolean }>(`/downloads/history/${id}`, {
        method: "DELETE",
      })
    },
    clearHistory(): Promise<{ ok: boolean; removed: number }> {
      return request<{ ok: boolean; removed: number }>("/downloads/history", {
        method: "DELETE",
      })
    },
  },
}
