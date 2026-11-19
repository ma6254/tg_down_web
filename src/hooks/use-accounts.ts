import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/api/endpoints"
import { queryKeys } from "@/api/query-keys"
import type { ProbeRequest } from "@/api/types"

/**
 * 账号列表；切换账号 / 导入后由 mutation 失效重取。
 *
 * enabled=false 时不请求（例如账号选择弹窗关闭时），用于避免重复拉取。
 */
export function useAccounts(enabled = true) {
  return useQuery({
    queryKey: queryKeys.accounts,
    queryFn: ({ signal }) => api.accounts.list(signal),
    enabled,
  })
}

/** 账号详情；accountId 为 null 时不发请求。 */
export function useAccountDetail(accountId: number | null) {
  return useQuery({
    queryKey: queryKeys.account(accountId ?? 0),
    queryFn: ({ signal }) => api.accounts.get(accountId as number, signal),
    enabled: accountId !== null,
  })
}

/**
 * 账号在线资料（联网查询，等价于 CLI 的 account info --live）。
 *
 * 只有调用方确认「有 session、可以联网」时才传 enabled=true；
 * 查询结果短暂缓存，关掉弹窗再打开不会立刻重复联网。
 */
export function useAccountLive(accountId: number | null, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.accountLive(accountId ?? 0),
    queryFn: ({ signal }) => api.accounts.live(accountId as number, signal),
    enabled: accountId !== null && enabled,
    retry: false,
    staleTime: 30_000,
  })
}

/** 切换当前账号；成功后失效整个 accounts 前缀（列表 + 详情）。 */
export function useSelectAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.accounts.select(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.accounts })
    },
  })
}

interface ProbeVariables {
  body: ProbeRequest
  signal?: AbortSignal
}

/** 探测本机 Telegram Desktop；成功后失效账号列表。 */
export function useProbeAccounts() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ body, signal }: ProbeVariables) =>
      api.accounts.probe(body, signal),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.accounts })
    },
  })
}
