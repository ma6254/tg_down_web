import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/api/endpoints"
import { queryKeys } from "@/api/query-keys"
import type { ProbeRequest } from "@/api/types"

/** 账号列表；切换账号 / 导入后由 mutation 失效重取。 */
export function useAccounts() {
  return useQuery({
    queryKey: queryKeys.accounts,
    queryFn: ({ signal }) => api.accounts.list(signal),
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
