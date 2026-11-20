import { useEffect, useState } from "react"
import { useQueryClient, type QueryClient } from "@tanstack/react-query"
import { openDownloadEvents, type DownloadEvent } from "@/api/events"
import { queryKeys } from "@/api/query-keys"
import type { DownloadTask } from "@/api/types"

export type DownloadEventsStatus = "connecting" | "connected" | "disconnected"

const MAX_BACKOFF_SECONDS = 30

// 服务端每 15s 发一次 ping；超过这个时间没有任何事件就认为连接已死。
// 有的反向代理不会在 upstream 断开时关闭下游连接，需要客户端自己兜底。
const IDLE_TIMEOUT_MS = 35_000
const WATCHDOG_INTERVAL_MS = 5_000

/**
 * 订阅 /api/v1/events，把任务事件直接写进 TanStack Query 缓存。
 *
 * 断线后指数退避重连（2/4/8…最多 30s）；重连成功时重新拉一次列表对齐。
 * 空闲超过 35s 没收到任何事件（含 ping）也会主动断开重连。
 */
export function useDownloadEvents(): DownloadEventsStatus {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<DownloadEventsStatus>("connecting")

  useEffect(() => {
    let disposed = false
    let attempt = 0
    let retryTimer: number | undefined
    let watchdog: number | undefined
    let controller: AbortController | undefined
    let lastEventAt = Date.now()

    function stopWatchdog() {
      if (watchdog !== undefined) {
        window.clearInterval(watchdog)
        watchdog = undefined
      }
    }

    function scheduleReconnect() {
      if (disposed) {
        return
      }
      setStatus("disconnected")
      attempt = Math.min(attempt + 1, 5)
      const delay = Math.min(2 ** attempt, MAX_BACKOFF_SECONDS) * 1000
      retryTimer = window.setTimeout(() => void connect(), delay)
    }

    async function connect() {
      if (disposed) {
        return
      }
      controller = new AbortController()
      lastEventAt = Date.now()
      setStatus("connecting")

      watchdog = window.setInterval(() => {
        if (Date.now() - lastEventAt > IDLE_TIMEOUT_MS) {
          // 触发 fetch 中止，走下面的重连分支。
          controller?.abort()
        }
      }, WATCHDOG_INTERVAL_MS)

      try {
        await openDownloadEvents(controller.signal, {
          onOpen: () => {
            attempt = 0
            lastEventAt = Date.now()
            setStatus("connected")
            // 断线期间可能漏事件，重连后全量对齐一次。
            void queryClient.invalidateQueries({ queryKey: queryKeys.downloads })
          },
          onEvent: (event) => {
            lastEventAt = Date.now()
            applyDownloadEvent(queryClient, event)
          },
        })
      } catch {
        // 网络错误 / 401 / 主动取消都走重连；401 时 client 已广播登出。
      } finally {
        stopWatchdog()
      }

      scheduleReconnect()
    }

    void connect()

    return () => {
      disposed = true
      controller?.abort()
      stopWatchdog()
      if (retryTimer !== undefined) {
        window.clearTimeout(retryTimer)
      }
    }
  }, [queryClient])

  return status
}

/** 把一条 SSE 事件合并进任务列表缓存。 */
export function applyDownloadEvent(
  queryClient: QueryClient,
  event: DownloadEvent
): void {
  switch (event.event) {
    case "task.update": {
      const task = event.data as DownloadTask
      if (!task || typeof task.id !== "number") {
        return
      }
      queryClient.setQueryData<DownloadTask[]>(queryKeys.downloads, (current) => {
        const list = current ?? []
        const index = list.findIndex((item) => item.id === task.id)
        if (index < 0) {
          return [task, ...list]
        }
        const next = list.slice()
        next[index] = task
        return next
      })
      return
    }
    case "task.progress": {
      const patch = event.data as {
        id?: number
        offset?: number
        speed?: number
        size?: number
      }
      if (!patch || typeof patch.id !== "number") {
        return
      }
      queryClient.setQueryData<DownloadTask[]>(queryKeys.downloads, (current) =>
        (current ?? []).map((task) =>
          task.id === patch.id
            ? {
                ...task,
                status: "running",
                offset: patch.offset ?? task.offset,
                speed: patch.speed ?? task.speed,
                file_size: patch.size ?? task.file_size,
              }
            : task
        )
      )
      return
    }
    case "task.deleted": {
      const deleted = event.data as { id?: number }
      if (!deleted || typeof deleted.id !== "number") {
        return
      }
      queryClient.setQueryData<DownloadTask[]>(queryKeys.downloads, (current) =>
        (current ?? []).filter((task) => task.id !== deleted.id)
      )
      return
    }
    default:
      // ping 等事件忽略。
      return
  }
}
