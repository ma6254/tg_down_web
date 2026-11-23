import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { describeError } from "@/api/client"
import { api } from "@/api/endpoints"
import { queryKeys } from "@/api/query-keys"
import type { SettingsPatch } from "@/api/types"

/** 服务端配置项（数组，含 known / read_only 标记）。 */
export function useSettings() {
  return useQuery({
    queryKey: queryKeys.settings,
    queryFn: ({ signal }) => api.settings.get(signal),
  })
}

/** 设置页顶部的服务信息；与账号页无共享，单独缓存。 */
export function useHealthStatus() {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: () => api.health(),
    staleTime: 30_000,
  })
}

/**
 * 编译期版本信息与运行环境。
 *
 * 老服务端可能还没有 /system：失败时静默降级（卡片按缺省值展示），
 * 不重试，避免对 404 反复请求。
 */
export function useSystemInfo() {
  return useQuery({
    queryKey: queryKeys.system,
    queryFn: ({ signal }) => api.system.get(signal),
    staleTime: 30_000,
    retry: false,
  })
}

/**
 * 保存配置的 mutation key。
 *
 * 设置页用 `useIsMutating` 匹配它来判断是否有写入在途，据此显示全局遮罩；
 * 所有 `useUpdateSettings` 实例共享同一个 key。
 */
export const UPDATE_SETTINGS_MUTATION_KEY = ["settings", "update"] as const

/** 保存配置：服务端返回完整数组，直接回填缓存，不再额外 GET。 */
export function useUpdateSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationKey: UPDATE_SETTINGS_MUTATION_KEY,
    mutationFn: (patch: SettingsPatch) => api.settings.update(patch),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.settings, data)
    },
  })
}

/**
 * 行内开关：写入一个布尔配置项。
 *
 * `successMessage` 根据新值生成 toast 文案；失败统一由 `describeError` 归一。
 * 所有行内开关共用这套 pending / 提示逻辑，开关本身只关心展示与禁用条件。
 */
export function useToggleSetting(
  key: string,
  successMessage: (enabled: boolean) => string
) {
  const update = useUpdateSettings()

  function toggle(enabled: boolean) {
    if (update.isPending) {
      return
    }
    update.mutate(
      { [key]: enabled ? "true" : "false" },
      {
        onSuccess: () => toast.success(successMessage(enabled)),
        onError: (error) => toast.error(describeError(error)),
      }
    )
  }

  return { toggle, pending: update.isPending }
}
