import { useEffect, useRef, useState } from "react"
import type { DownloadTask } from "@/api/types"
import { smoothSpeedSample, type SpeedSample } from "@/lib/download"

const SAMPLE_INTERVAL_MS = 1_000

/**
 * 任务行速度的 10 秒尾随平均。
 *
 * 每秒对运行中的任务追加一次采样并返回窗口均值；任务暂停/结束后清空。
 * 只用于展示与剩余时间计算，不改变接口返回的原始 speed。
 */
export function useSmoothedTaskSpeeds(
  tasks: DownloadTask[]
): Record<number, number> {
  const tasksRef = useRef(tasks)
  const samplesRef = useRef(new Map<number, SpeedSample[]>())
  const [speeds, setSpeeds] = useState<Record<number, number>>({})

  useEffect(() => {
    tasksRef.current = tasks
  }, [tasks])

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now()
      const current = new Map(tasksRef.current.map((task) => [task.id, task]))
      const next: Record<number, number> = {}

      // 已经结束/暂停/删除的任务不再保留采样。
      for (const id of Array.from(samplesRef.current.keys())) {
        const task = current.get(id)
        if (!task || task.status !== "running") {
          samplesRef.current.delete(id)
        }
      }

      for (const task of current.values()) {
        if (task.status !== "running") {
          continue
        }
        let samples = samplesRef.current.get(task.id)
        if (!samples) {
          samples = []
          samplesRef.current.set(task.id, samples)
        }
        next[task.id] = smoothSpeedSample(samples, now, task.speed)
      }

      setSpeeds((previous) => {
        const previousKeys = Object.keys(previous)
        const nextKeys = Object.keys(next)
        if (
          previousKeys.length === nextKeys.length &&
          nextKeys.every((key) => previous[Number(key)] === next[Number(key)])
        ) {
          return previous
        }
        return next
      })
    }, SAMPLE_INTERVAL_MS)

    return () => window.clearInterval(timer)
  }, [])

  return speeds
}
