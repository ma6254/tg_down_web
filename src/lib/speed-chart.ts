import type { DownloadSpeedPoint } from "@/api/types"
import { SPEED_SMOOTH_WINDOW_MS } from "@/lib/download"
import { formatBytes } from "@/lib/format"

/** 速度曲线上的一个画布坐标点。 */
export interface SpeedChartPoint {
  x: number
  y: number
}

/** 纵轴刻度：去掉 formatBytes 的 `.0` 尾巴（`1.0 MB` → `1 MB`）。 */
export function formatSpeedAxis(bytes: number): string {
  return formatBytes(bytes).replace(/\.0 /, " ")
}

const NICE_STEPS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1024]

/** 空载时保持稳定刻度的默认纵轴（1 MB/s）。 */
const IDLE_CHART_MAX = 1024 * 1024
/** 有活动时的最小纵轴（1 KB/s），避免刻度落到位数级别。 */
const MIN_ACTIVE_CHART_MAX = 1024

/**
 * 把峰值向上取整到 1/2/5/10… × 1024^n，给 Y 轴留出余量。
 *
 * 用 1024 进制是为了让 `formatBytes` 的刻度标签好看（500 KB / 1.0 MB / 2.0 MB）。
 * 非法值或 0 返回 1，避免除零；调用方通常会再给一个最小刻度。
 */
export function niceSpeedMax(peak: number): number {
  if (!Number.isFinite(peak) || peak <= 0) {
    return 1
  }
  const exponent = Math.floor(Math.log(peak) / Math.log(1024))
  const base = 1024 ** Math.max(0, exponent)
  const normalized = peak / base
  const step = NICE_STEPS.find((candidate) => normalized <= candidate) ?? 1024
  return step * base
}

/**
 * 自适应纵轴上限：有速度时按窗口峰值向上取整，空载时用稳定的 1 MB 刻度。
 *
 * 这样低速下载不会被固定在 1 MB 的刻度里压成一条贴底的线；
 * 峰值变化时纵轴会随 1/2/5 刻度跳档。
 */
export function speedChartMax(peak: number): number {
  if (!Number.isFinite(peak) || peak <= 0) {
    return niceSpeedMax(IDLE_CHART_MAX)
  }
  return niceSpeedMax(Math.max(peak, MIN_ACTIVE_CHART_MAX))
}

/** 把窗口秒数归一到至少 1 秒的整数，避免 0 或负数拼出非法接口参数。 */
export function normalizeWindowSeconds(windowSeconds: number): number {
  if (!Number.isFinite(windowSeconds)) {
    return 1
  }
  return Math.max(1, Math.round(windowSeconds))
}

/**
 * 历史速度的聚合粒度：保证服务端返回的点数不超过 maxPoints。
 *
 * 服务端按 `floor(span / bucket) + 1` 计算点数，所以 bucket 要大于
 * `span / maxPoints`，否则恰好 1000/2000 秒这类窗口会多出一个点而被 400。
 */
export function speedHistoryBucketSeconds(
  windowSeconds: number,
  maxPoints = 1000
): number {
  const window = normalizeWindowSeconds(windowSeconds)
  const limit = Math.max(1, Math.floor(maxPoints))
  return Math.max(1, Math.floor(window / limit) + 1)
}

/** 窗口文案：`30 秒` / `5 分钟` / `1.5 分钟`。 */
export function formatWindowLabel(windowSeconds: number): string {
  const seconds = normalizeWindowSeconds(windowSeconds)
  if (seconds < 60) {
    return `${seconds} 秒`
  }
  if (seconds % 60 === 0) {
    return `${seconds / 60} 分钟`
  }
  return `${(seconds / 60).toFixed(1)} 分钟`
}

/** 曲线滑动平均窗口（秒），与任务行共用同一个 10 秒常量。 */
export const SPEED_CHART_SMOOTH_SECONDS = SPEED_SMOOTH_WINDOW_MS / 1000

/** 曲线是否全为 0（包含空窗口）；用于无活动时的灰色展示。 */
export function isSpeedHistoryIdle(points: DownloadSpeedPoint[]): boolean {
  return points.every((point) => point.total_speed <= 0)
}

/**
 * 对历史速度点做尾随滑动平均：每个点 = 最近 windowSeconds 的平均速度。
 *
 * 窗口按 bucket 换算成点数；开头不足一个窗口时用已有样本平均。
 * 只影响绘制与「无活动」判断，不改变接口返回的原始统计。
 */
export function smoothSpeedPoints(
  points: DownloadSpeedPoint[],
  windowSeconds = SPEED_CHART_SMOOTH_SECONDS,
  bucketSeconds = 1
): DownloadSpeedPoint[] {
  if (points.length === 0) {
    return []
  }
  const window = normalizeWindowSeconds(windowSeconds)
  const bucket =
    Number.isFinite(bucketSeconds) && bucketSeconds > 0 ? bucketSeconds : 1
  const windowPoints = Math.max(1, Math.round(window / bucket))

  const smoothed: DownloadSpeedPoint[] = []
  let sum = 0
  for (let index = 0; index < points.length; index++) {
    sum += points[index].total_speed
    if (index >= windowPoints) {
      sum -= points[index - windowPoints].total_speed
    }
    const count = Math.min(index + 1, windowPoints)
    smoothed.push({
      ...points[index],
      total_speed: Math.round(sum / count),
    })
  }
  return smoothed
}

/**
 * 历史速度的轮询间隔：任务列表有活动，或最新一个采样仍有运行任务时用快轮询。
 *
 * 只看最新点，不能看整个窗口：窗口里历史上有 running 任务，不代表现在还在下载。
 */
export function speedHistoryPollIntervalMs(
  downloadsActive: boolean,
  latestPoint: DownloadSpeedPoint | undefined,
  activeMs = 1000,
  idleMs = 10_000
): number {
  return downloadsActive || (latestPoint?.running_tasks ?? 0) > 0
    ? activeMs
    : idleMs
}

/**
 * 把速度点映射到画布坐标。
 *
 * X 按固定时间窗（from..to）映射，Y 按 maxSpeed 映射；越界值会被夹住，
 * 避免曲线画到坐标轴外。参数非法时返回空数组。
 */
export function speedChartCoordinates(
  points: DownloadSpeedPoint[],
  options: {
    from: number
    to: number
    width: number
    height: number
    maxSpeed: number
  }
): SpeedChartPoint[] {
  const { from, to, width, height, maxSpeed } = options
  if (to <= from || width <= 0 || height <= 0 || maxSpeed <= 0) {
    return []
  }

  return points.map((point) => {
    const ratio = Math.min(1, Math.max(0, (point.at - from) / (to - from)))
    const speed = Math.min(maxSpeed, Math.max(0, point.total_speed))
    return {
      x: ratio * width,
      y: height - (speed / maxSpeed) * height,
    }
  })
}
