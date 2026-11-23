import { useEffect, useRef } from "react"
import { useQuery } from "@tanstack/react-query"
import { api } from "@/api/endpoints"
import { queryKeys } from "@/api/query-keys"
import type { DownloadSpeedHistory, DownloadSpeedPoint } from "@/api/types"
import { useDownloads } from "@/hooks/use-downloads"
import { hasActiveDownloads } from "@/lib/download"
import {
  normalizeWindowSeconds,
  speedHistoryBucketSeconds,
  speedHistoryPollIntervalMs,
} from "@/lib/speed-chart"

/** 默认窗口：最近 5 分钟。 */
export const SPEED_HISTORY_WINDOW_SECONDS = 300

const ACTIVE_INTERVAL_MS = 1_000
const IDLE_INTERVAL_MS = 10_000

interface SpeedHistoryOptions {
  windowSeconds?: number
  /** 聚合粒度；省略时按窗口自动取，保证点数不超过服务端上限。 */
  bucketSeconds?: number
}

/**
 * 历史速度曲线查询。
 *
 * 有活动任务时每 1s 拉一次；空闲时降到 10s。活动状态同时参考任务列表
 * 和最近一次历史结果的 running_tasks，避免只依赖侧栏的列表轮询。
 * from/to 在每次请求时按当前时间计算，queryKey 只包含窗口与粒度，
 * 不会每个轮询周期都产生新的缓存项。
 */
export function useDownloadSpeedHistory({
  windowSeconds = SPEED_HISTORY_WINDOW_SECONDS,
  bucketSeconds,
}: SpeedHistoryOptions = {}) {
  const window = normalizeWindowSeconds(windowSeconds)
  const bucket = Math.max(
    1,
    Math.round(bucketSeconds ?? speedHistoryBucketSeconds(window))
  )

  // 只读共享缓存，不额外轮询任务列表；Sidebar 在有活动任务时已经每 2s 刷新。
  const downloads = useDownloads({ poll: false })
  const downloadsActive = hasActiveDownloads(downloads.data ?? [])

  const query = useQuery<DownloadSpeedHistory>({
    queryKey: queryKeys.downloadSpeedHistory(window, bucket),
    queryFn: ({ signal }) => {
      const to = Math.floor(Date.now() / 1000)
      return api.downloads.speedHistory({ from: to - window, to, bucket }, signal)
    },
    staleTime: 0,
    refetchInterval: (current) => {
      const points = current.state.data?.points
      return speedHistoryPollIntervalMs(
        downloadsActive,
        points?.[points.length - 1],
        ACTIVE_INTERVAL_MS,
        IDLE_INTERVAL_MS
      )
    },
    // 空闲时仍保留上一次曲线，避免轮询间隙图表闪空。
    placeholderData: (previous) => previous,
  })

  // 任务开始/结束时立刻对齐一次：否则空闲的 10s 轮询会让「当前速度」
  // 在下载结束后继续显示旧值，或让新任务迟迟不进入 1s 刷新。
  const { refetch } = query
  const previousActive = useRef(downloadsActive)
  useEffect(() => {
    if (previousActive.current === downloadsActive) {
      return
    }
    previousActive.current = downloadsActive
    void refetch()
  }, [downloadsActive, refetch])

  return query
}

/** 从历史结果里取最新一个点，供标题旁的「当前速度」使用。 */
export function latestSpeedPoint(
  history: DownloadSpeedHistory | undefined
): DownloadSpeedPoint | undefined {
  const points = history?.points
  return points && points.length > 0 ? points[points.length - 1] : undefined
}
