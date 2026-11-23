import { describe, expect, it } from "vitest"
import type { DownloadSpeedPoint } from "@/api/types"
import {
  formatSpeedAxis,
  formatWindowLabel,
  isSpeedHistoryIdle,
  niceSpeedMax,
  normalizeWindowSeconds,
  smoothSpeedPoints,
  speedChartCoordinates,
  speedChartMax,
  speedHistoryBucketSeconds,
  speedHistoryPollIntervalMs,
} from "./speed-chart"

function point(at: number, totalSpeed: number): DownloadSpeedPoint {
  return { at, total_speed: totalSpeed, running_tasks: 1 }
}

describe("niceSpeedMax", () => {
  it("按 1024 进制向上取整到刻度", () => {
    expect(niceSpeedMax(0)).toBe(1)
    expect(niceSpeedMax(-1)).toBe(1)
    expect(niceSpeedMax(500)).toBe(500)
    expect(niceSpeedMax(501)).toBe(1024)
    expect(niceSpeedMax(1500)).toBe(2048)
    expect(niceSpeedMax(1024 * 1024)).toBe(1024 * 1024)
    expect(niceSpeedMax(1_500_000)).toBe(2 * 1024 * 1024)
  })
})

describe("formatSpeedAxis", () => {
  it("去掉整数小数的 .0 尾巴", () => {
    expect(formatSpeedAxis(0)).toBe("0 B")
    expect(formatSpeedAxis(512 * 1024)).toBe("512 KB")
    expect(formatSpeedAxis(1024 * 1024)).toBe("1 MB")
    expect(formatSpeedAxis(1536 * 1024)).toBe("1.5 MB")
  })
})

describe("speedChartMax", () => {
  it("有速度时按峰值自适应，空载时使用稳定刻度", () => {
    expect(speedChartMax(0)).toBe(1024 * 1024)
    expect(speedChartMax(50 * 1024)).toBe(50 * 1024)
    expect(speedChartMax(100)).toBe(1024)
    expect(speedChartMax(1.5 * 1024 * 1024)).toBe(2 * 1024 * 1024)
  })
})

describe("normalizeWindowSeconds", () => {
  it("归一到至少 1 秒的整数", () => {
    expect(normalizeWindowSeconds(300)).toBe(300)
    expect(normalizeWindowSeconds(90.4)).toBe(90)
    expect(normalizeWindowSeconds(0)).toBe(1)
    expect(normalizeWindowSeconds(-10)).toBe(1)
    expect(normalizeWindowSeconds(Number.NaN)).toBe(1)
  })
})

describe("speedHistoryBucketSeconds", () => {
  it("保证服务端点数不超过 1000", () => {
    expect(speedHistoryBucketSeconds(300)).toBe(1)
    expect(speedHistoryBucketSeconds(999)).toBe(1)
    expect(speedHistoryBucketSeconds(1000)).toBe(2)
    expect(speedHistoryBucketSeconds(1500)).toBe(2)
    expect(speedHistoryBucketSeconds(1999)).toBe(2)
    expect(speedHistoryBucketSeconds(2000)).toBe(3)
    for (const window of [300, 999, 1000, 1500, 1999, 2000, 3600, 86400]) {
      const bucket = speedHistoryBucketSeconds(window)
      expect(Math.floor(window / bucket) + 1).toBeLessThanOrEqual(1000)
    }
  })
})

describe("formatWindowLabel", () => {
  it("按秒/分钟给出文案", () => {
    expect(formatWindowLabel(30)).toBe("30 秒")
    expect(formatWindowLabel(300)).toBe("5 分钟")
    expect(formatWindowLabel(90)).toBe("1.5 分钟")
  })
})

describe("speedHistoryPollIntervalMs", () => {
  it("只根据最新采样判断是否仍在运行", () => {
    const running: DownloadSpeedPoint = {
      at: 1,
      total_speed: 0,
      running_tasks: 1,
    }
    const idle: DownloadSpeedPoint = {
      at: 1,
      total_speed: 0,
      running_tasks: 0,
    }
    expect(speedHistoryPollIntervalMs(true, idle)).toBe(1000)
    expect(speedHistoryPollIntervalMs(false, running)).toBe(1000)
    expect(speedHistoryPollIntervalMs(false, idle)).toBe(10_000)
    expect(speedHistoryPollIntervalMs(false, undefined)).toBe(10_000)
  })
})

describe("isSpeedHistoryIdle", () => {
  it("空窗口或全 0 认为无活动", () => {
    expect(isSpeedHistoryIdle([])).toBe(true)
    expect(isSpeedHistoryIdle([point(1, 0), point(2, 0)])).toBe(true)
    expect(isSpeedHistoryIdle([point(1, 0), point(2, 100)])).toBe(false)
  })
})

describe("smoothSpeedPoints", () => {
  it("尾随平均，开头用已有样本", () => {
    const raw = [
      point(1, 0),
      point(2, 100),
      point(3, 200),
      point(4, 300),
      point(5, 0),
    ]
    const smoothed = smoothSpeedPoints(raw, 3, 1)
    expect(smoothed.map((item) => item.total_speed)).toEqual([0, 50, 100, 200, 167])
    expect(smoothed.map((item) => item.at)).toEqual([1, 2, 3, 4, 5])
    // 不修改入参。
    expect(raw[1].total_speed).toBe(100)
  })

  it("按 bucket 换算窗口点数", () => {
    const raw = [point(1, 100), point(2, 200), point(3, 300)]
    expect(
      smoothSpeedPoints(raw, 10, 5).map((item) => item.total_speed)
    ).toEqual([100, 150, 250])
  })

  it("空数组返回空数组", () => {
    expect(smoothSpeedPoints([], 10, 1)).toEqual([])
  })
})

describe("speedChartCoordinates", () => {
  const options = { from: 100, to: 200, width: 100, height: 50, maxSpeed: 1000 }

  it("按时间与速度映射，端点落在坐标轴上", () => {
    const points = [point(100, 0), point(150, 500), point(200, 1000)]
    expect(speedChartCoordinates(points, options)).toEqual([
      { x: 0, y: 50 },
      { x: 50, y: 25 },
      { x: 100, y: 0 },
    ])
  })

  it("越界时间与速度会被夹住", () => {
    const points = [point(50, 2000), point(250, -100)]
    expect(speedChartCoordinates(points, options)).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 50 },
    ])
  })

  it("参数非法时返回空数组", () => {
    expect(speedChartCoordinates([point(100, 1)], { ...options, to: 100 })).toEqual([])
    expect(speedChartCoordinates([point(100, 1)], { ...options, height: 0 })).toEqual([])
    expect(speedChartCoordinates([point(100, 1)], { ...options, maxSpeed: 0 })).toEqual([])
  })
})
