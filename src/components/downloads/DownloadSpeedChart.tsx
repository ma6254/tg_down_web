import { useEffect, useMemo, useRef, useState } from "react"
import {
  CircleAlertIcon,
  GaugeIcon,
  LoaderCircleIcon,
  RefreshCwIcon,
} from "lucide-react"
import { describeError } from "@/api/client"
import type { DownloadSpeedPoint } from "@/api/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  SPEED_HISTORY_WINDOW_SECONDS,
  latestSpeedPoint,
  useDownloadSpeedHistory,
} from "@/hooks/use-download-speed-history"
import { useTheme } from "@/hooks/use-theme"
import { formatSpeed, formatSpeedParts } from "@/lib/format"
import {
  SPEED_CHART_SMOOTH_SECONDS,
  formatSpeedAxis,
  formatWindowLabel,
  isSpeedHistoryIdle,
  normalizeWindowSeconds,
  smoothSpeedPoints,
  speedChartCoordinates,
  speedChartMax,
} from "@/lib/speed-chart"
import { cn } from "@/lib/utils"

/** 曲线的一种着色：活动时为品牌蓝，空闲时退成灰色。 */
interface ChartTone {
  line: string
  /** 折线起点的淡色，做出从左到右的渐变。 */
  lineFade: string
  fillTop: string
  fillBottom: string
  halo: string
}

interface ChartPalette {
  grid: string
  axis: string
  active: ChartTone
  idle: ChartTone
}

const LIGHT_PALETTE: ChartPalette = {
  grid: "rgba(100, 116, 139, 0.18)",
  axis: "#64748b",
  active: {
    line: "#2563eb",
    lineFade: "rgba(37, 99, 235, 0.32)",
    fillTop: "rgba(37, 99, 235, 0.24)",
    fillBottom: "rgba(37, 99, 235, 0.01)",
    halo: "rgba(37, 99, 235, 0.16)",
  },
  idle: {
    line: "#94a3b8",
    lineFade: "rgba(148, 163, 184, 0.28)",
    fillTop: "rgba(148, 163, 184, 0.12)",
    fillBottom: "rgba(148, 163, 184, 0.01)",
    halo: "rgba(148, 163, 184, 0.14)",
  },
}

const DARK_PALETTE: ChartPalette = {
  grid: "rgba(148, 163, 184, 0.18)",
  axis: "#94a3b8",
  active: {
    line: "#60a5fa",
    lineFade: "rgba(96, 165, 250, 0.3)",
    fillTop: "rgba(96, 165, 250, 0.28)",
    fillBottom: "rgba(96, 165, 250, 0.01)",
    halo: "rgba(96, 165, 250, 0.18)",
  },
  idle: {
    line: "#64748b",
    lineFade: "rgba(100, 116, 139, 0.3)",
    fillTop: "rgba(148, 163, 184, 0.1)",
    fillBottom: "rgba(148, 163, 184, 0.01)",
    halo: "rgba(148, 163, 184, 0.12)",
  },
}

interface DownloadSpeedChartProps {
  className?: string
  /** 图表时间窗，默认最近 5 分钟。 */
  windowSeconds?: number
}

/**
 * 实时下载速度卡片：大号当前速度 + 运行任务/平均/峰值指标 + canvas 曲线。
 *
 * 数据由 useDownloadSpeedHistory 轮询（活动时 1s、空闲 10s），
 * 这里只负责响应式尺寸、主题配色与绘制。
 */
export function DownloadSpeedChart({
  className,
  windowSeconds = SPEED_HISTORY_WINDOW_SECONDS,
}: DownloadSpeedChartProps) {
  const chartWindow = normalizeWindowSeconds(windowSeconds)
  const { resolvedTheme } = useTheme()
  const history = useDownloadSpeedHistory({ windowSeconds: chartWindow })
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  // 曲线只做 10s 尾随平均；卡片上的当前/平均/峰值仍是接口原始统计。
  const points = useMemo(
    () =>
      smoothSpeedPoints(
        history.data?.points ?? [],
        SPEED_CHART_SMOOTH_SECONDS,
        history.data?.bucket ?? 1
      ),
    [history.data]
  )
  const hasData = history.data !== undefined
  const idle = hasData && isSpeedHistoryIdle(points)

  const latest = latestSpeedPoint(history.data)
  const currentSpeed = latest?.total_speed ?? 0
  const runningTasks = latest?.running_tasks ?? 0
  const averageSpeed = history.data?.average_speed ?? 0
  // 峰值统计由后端按「上次清空」起点累计；曲线是 10s 均速，峰值标签仍用原始值。
  const peakSpeed = history.data?.peak_speed ?? 0

  const current = formatSpeedParts(hasData ? currentSpeed : undefined)
  const windowLabel = formatWindowLabel(chartWindow)
  const live = hasData && !idle
  const statusLabel = hasData
    ? idle
      ? "空闲"
      : "实时"
    : history.isError
      ? "离线"
      : "连接中"

  // canvas 的 CSS 尺寸由布局决定，绘制尺寸按 devicePixelRatio 放大。
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (!rect) return
      setSize({ width: rect.width, height: rect.height })
    })
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || size.width <= 0 || size.height <= 0) return
    const pointPeak = points.reduce(
      (max, point) => Math.max(max, point.total_speed),
      0
    )
    drawSpeedChart(canvas, {
      width: size.width,
      height: size.height,
      windowSeconds: chartWindow,
      points,
      peakSpeed: pointPeak,
      inactive: idle,
      dark: resolvedTheme === "dark",
    })
  }, [points, idle, resolvedTheme, size, chartWindow])

  const ariaLabel = hasData
    ? idle
      ? `最近 ${windowLabel}下载速度曲线（${SPEED_CHART_SMOOTH_SECONDS} 秒滑动平均），无活动`
      : `最近 ${windowLabel}下载速度曲线（${SPEED_CHART_SMOOTH_SECONDS} 秒滑动平均），当前 ${formatSpeed(currentSpeed)}，平均 ${formatSpeed(averageSpeed)}，峰值 ${formatSpeed(peakSpeed)}`
    : "实时下载速度曲线"

  return (
    <Card className={cn("relative isolate", className)}>
      {/* 顶部环境光，给卡片一点层次；不参与交互。 */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-44 bg-[radial-gradient(120%_100%_at_90%_0%,rgba(37,99,235,0.10),transparent_62%)] dark:bg-[radial-gradient(120%_100%_at_90%_0%,rgba(96,165,250,0.13),transparent_62%)]"
      />
      <CardHeader className="border-b border-border/60">
        <CardTitle className="flex flex-wrap items-center gap-2">
          实时下载速度
          <Badge
            variant="outline"
            className={cn(
              "gap-1.5 font-normal",
              live &&
                "border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:border-emerald-400/25 dark:text-emerald-400"
            )}
            title="有下载活动时每 1 秒刷新，空闲时每 10 秒刷新"
          >
            <span className="relative flex size-1.5 shrink-0">
              {live ? (
                <span className="absolute inset-0 animate-ping rounded-full bg-emerald-500 opacity-60 motion-reduce:animate-none" />
              ) : null}
              <span
                className={cn(
                  "relative size-1.5 rounded-full",
                  live ? "bg-emerald-500" : "bg-muted-foreground/60"
                )}
                aria-hidden="true"
              />
            </span>
            {statusLabel}
          </Badge>
        </CardTitle>
        <CardDescription>
          最近 {windowLabel} · 曲线为 {SPEED_CHART_SMOOTH_SECONDS} 秒滑动均速
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">当前速度</p>
            <p className="mt-1 flex items-baseline gap-1.5">
              <span
                className={cn(
                  "font-heading text-4xl leading-none font-semibold tracking-tight tabular-nums sm:text-5xl",
                  (idle || !hasData) && "text-muted-foreground"
                )}
              >
                {current.value}
              </span>
              {current.unit ? (
                <span className="text-sm font-medium text-muted-foreground">
                  {current.unit}
                </span>
              ) : null}
            </p>
          </div>

          <div className="grid w-full grid-cols-3 divide-x divide-border/60 overflow-hidden rounded-xl border border-border/60 bg-muted/25 sm:w-auto sm:min-w-72">
            <SpeedStat
              label="运行任务"
              value={hasData ? `${runningTasks} 个` : "—"}
              hint="当前正在执行的下载任务数"
            />
            <SpeedStat
              label="平均速度"
              value={hasData ? formatSpeed(averageSpeed) : "—"}
              hint="区间内全部原始 1 秒采样的平均值（含空闲 0 值）"
            />
            <SpeedStat
              label="峰值速度"
              value={hasData ? formatSpeed(peakSpeed) : "—"}
              hint="区间内单个原始采样点的最大速度"
            />
          </div>
        </div>

        <div className="relative overflow-hidden rounded-xl bg-muted/20 ring-1 ring-border/50">
          <canvas
            ref={canvasRef}
            className="block h-36 w-full sm:h-44"
            role="img"
            aria-label={ariaLabel}
          />
          {history.isError ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-card/50 px-4 text-center">
              <CircleAlertIcon
                className="size-5 text-destructive"
                aria-hidden="true"
              />
              <p
                className="text-xs text-muted-foreground"
                title={describeError(history.error)}
              >
                速度曲线加载失败
              </p>
              <Button
                variant="outline"
                size="xs"
                onClick={() => void history.refetch()}
              >
                <RefreshCwIcon />
                重试
              </Button>
            </div>
          ) : !hasData ? (
            <div
              role="status"
              className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground"
            >
              <LoaderCircleIcon
                className="size-5 animate-spin"
                aria-hidden="true"
              />
              <p className="text-xs">加载速度曲线…</p>
            </div>
          ) : idle ? (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-center">
              <GaugeIcon
                className="size-5 text-muted-foreground/70"
                aria-hidden="true"
              />
              <p className="text-xs font-medium text-muted-foreground">
                当前没有下载活动
              </p>
              <p className="text-[11px] text-muted-foreground/70">
                开始下载后，这里会显示实时曲线
              </p>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

interface SpeedStatProps {
  label: string
  value: string
  hint?: string
}

/** 指标小格：标签 + 等宽数字，hover 有解释。 */
function SpeedStat({ label, value, hint }: SpeedStatProps) {
  return (
    <div className="min-w-0 px-3 py-2.5" title={hint}>
      <p className="truncate text-[11px] leading-none text-muted-foreground">
        {label}
      </p>
      <p className="mt-1.5 truncate text-sm leading-none font-medium tabular-nums">
        {value}
      </p>
    </div>
  )
}

interface DrawOptions {
  width: number
  height: number
  windowSeconds: number
  points: DownloadSpeedPoint[]
  peakSpeed: number
  inactive: boolean
  dark: boolean
}

/** 在 canvas 上画网格、刻度、面积与折线；尺寸单位是 CSS 像素。 */
function drawSpeedChart(canvas: HTMLCanvasElement, options: DrawOptions): void {
  const { width, height, windowSeconds, points, peakSpeed, inactive, dark } =
    options
  const dpr = window.devicePixelRatio || 1
  const pixelWidth = Math.max(1, Math.round(width * dpr))
  const pixelHeight = Math.max(1, Math.round(height * dpr))
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth
    canvas.height = pixelHeight
  }
  const ctx = canvas.getContext("2d")
  if (!ctx) return

  const palette = dark ? DARK_PALETTE : LIGHT_PALETTE
  const tone = inactive ? palette.idle : palette.active

  // 底部多留一点给「5 分钟前 / 现在」。
  const padding = { top: 14, right: 12, bottom: 26, left: 58 }
  const plotWidth = Math.max(1, width - padding.left - padding.right)
  const plotHeight = Math.max(1, height - padding.top - padding.bottom)
  const baseY = padding.top + plotHeight
  const now = Math.floor(Date.now() / 1000)
  const windowSpan = normalizeWindowSeconds(windowSeconds)
  const from = now - windowSpan
  const maxSpeed = speedChartMax(peakSpeed)

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, width, height)
  ctx.font = '11px "Geist Variable", ui-sans-serif, system-ui, sans-serif'

  // 横向网格：中间与顶部用虚线，0 基线用实线，给面积一个着落点。
  ctx.strokeStyle = palette.grid
  ctx.lineWidth = 1
  ctx.setLineDash([3, 5])
  for (const ratio of [0.5, 1]) {
    const y = padding.top + plotHeight * (1 - ratio)
    ctx.beginPath()
    ctx.moveTo(padding.left, y + 0.5)
    ctx.lineTo(padding.left + plotWidth, y + 0.5)
    ctx.stroke()
  }
  ctx.setLineDash([])
  ctx.beginPath()
  ctx.moveTo(padding.left, baseY + 0.5)
  ctx.lineTo(padding.left + plotWidth, baseY + 0.5)
  ctx.stroke()

  // 纵轴刻度。
  for (const ratio of [0, 0.5, 1]) {
    const y = padding.top + plotHeight * (1 - ratio)
    ctx.fillStyle = palette.axis
    ctx.textAlign = "right"
    ctx.textBaseline = "middle"
    ctx.fillText(formatSpeedAxis(maxSpeed * ratio), padding.left - 8, y)
  }

  // 横轴起止标签。
  ctx.fillStyle = palette.axis
  ctx.textBaseline = "top"
  ctx.textAlign = "left"
  ctx.fillText(`${formatWindowLabel(windowSpan)}前`, padding.left, baseY + 9)
  ctx.textAlign = "right"
  ctx.fillText("现在", padding.left + plotWidth, baseY + 9)

  const coords = speedChartCoordinates(points, {
    from,
    to: now,
    width: plotWidth,
    height: plotHeight,
    maxSpeed,
  })
  if (coords.length === 0) return

  // 面积渐变。
  const gradient = ctx.createLinearGradient(0, padding.top, 0, baseY)
  gradient.addColorStop(0, tone.fillTop)
  gradient.addColorStop(1, tone.fillBottom)
  ctx.beginPath()
  ctx.moveTo(padding.left + coords[0].x, baseY)
  for (const point of coords) {
    ctx.lineTo(padding.left + point.x, padding.top + point.y)
  }
  const lastCoord = coords[coords.length - 1]
  ctx.lineTo(padding.left + lastCoord.x, baseY)
  ctx.closePath()
  ctx.fillStyle = gradient
  ctx.fill()

  // 折线：左淡右浓，并加一层很轻的辉光。
  const stroke = ctx.createLinearGradient(
    padding.left,
    0,
    padding.left + plotWidth,
    0
  )
  stroke.addColorStop(0, tone.lineFade)
  stroke.addColorStop(0.35, tone.line)
  stroke.addColorStop(1, tone.line)
  ctx.beginPath()
  coords.forEach((point, index) => {
    const x = padding.left + point.x
    const y = padding.top + point.y
    if (index === 0) {
      ctx.moveTo(x, y)
    } else {
      ctx.lineTo(x, y)
    }
  })
  ctx.strokeStyle = stroke
  ctx.lineWidth = 2
  ctx.lineJoin = "round"
  ctx.lineCap = "round"
  ctx.shadowColor = tone.halo
  ctx.shadowBlur = 10
  ctx.stroke()
  ctx.shadowBlur = 0
  ctx.shadowColor = "transparent"

  // 最新点：外圈光晕 + 实心圆点。
  const lastX = padding.left + lastCoord.x
  const lastY = padding.top + lastCoord.y
  ctx.beginPath()
  ctx.arc(lastX, lastY, 6, 0, Math.PI * 2)
  ctx.fillStyle = tone.halo
  ctx.fill()
  ctx.beginPath()
  ctx.arc(lastX, lastY, 2.75, 0, Math.PI * 2)
  ctx.fillStyle = tone.line
  ctx.fill()
}
