import { request } from "@/api/client"
import type {
  AccountDetail,
  AccountLiveInfo,
  AccountsResponse,
  Health,
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
}
