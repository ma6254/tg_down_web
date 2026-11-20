import { request } from "@/api/client"
import type {
  AccountDetail,
  AccountLiveInfo,
  AccountLogoutResponse,
  AccountDeleteResponse,
  AccountsResponse,
  DownloadAction,
  DownloadCreateRequest,
  DownloadCreateResponse,
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
} from "@/api/types"

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
    control(id: number, action: DownloadAction): Promise<DownloadTask> {
      return request<DownloadTask>(`/downloads/${id}/${action}`, { method: "POST" })
    },
    remove(id: number, deleteFile: boolean): Promise<{ ok: boolean }> {
      const suffix = deleteFile ? "?delete_file=true" : ""
      return request<{ ok: boolean }>(`/downloads/${id}${suffix}`, {
        method: "DELETE",
      })
    },
  },
}
