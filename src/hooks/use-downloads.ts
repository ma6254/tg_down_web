import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/api/endpoints"
import { queryKeys } from "@/api/query-keys"
import type { DownloadAction, DownloadCreateRequest } from "@/api/types"
import { hasActiveDownloads } from "@/lib/download"

/**
 * 下载任务列表；有进行中的任务时每 2s 轮询一次进度。
 *
 * poll=false 用于 SSE 已连上的场景，避免两边同时刷新；
 * SSE 断开后由任务面板重新打开轮询。
 */
export function useDownloads({ poll = true }: { poll?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.downloads,
    queryFn: ({ signal }) => api.downloads.list({ limit: 200 }, signal),
    refetchInterval: (query) => {
      if (!poll) {
        return false
      }
      const tasks = query.state.data
      return tasks && hasActiveDownloads(tasks) ? 2_000 : false
    },
  })
}

/** 创建下载任务；成功后刷新任务列表（后台会把新任务标成 pending）。 */
export function useCreateDownloads() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: DownloadCreateRequest) => api.downloads.create(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.downloads })
    },
  })
}

interface ControlVariables {
  id: number
  action: DownloadAction
}

/** 暂停 / 恢复 / 重试任务。 */
export function useControlDownload() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, action }: ControlVariables) =>
      api.downloads.control(id, action),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.downloads })
    },
  })
}

interface DeleteVariables {
  id: number
  deleteFile: boolean
}

/** 删除任务记录，可选同时删除已下载文件。 */
export function useDeleteDownload() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, deleteFile }: DeleteVariables) =>
      api.downloads.remove(id, deleteFile),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.downloads })
    },
  })
}
