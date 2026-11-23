import { describe, expect, it } from "vitest"
import type { DownloadCreateResponse, DownloadTask } from "@/api/types"
import {
  countActiveDownloads,
  downloadEta,
  downloadPercent,
  downloadPreviewSources,
  downloadStatusLabel,
  hasActiveDownloads,
  smoothSpeedSample,
  summarizeCreateResult,
  type SpeedSample,
} from "./download"

function task(patch: Partial<DownloadTask> = {}): DownloadTask {
  return {
    id: 1,
    link: "https://t.me/a/1",
    account_id: 1,
    chat_id: 1,
    message_id: 1,
    file_name: "clip.mp4",
    file_size: 1000,
    status: "running",
    offset: 0,
    speed: 0,
    created_at: 0,
    updated_at: 0,
    ...patch,
  }
}

describe("downloadStatusLabel", () => {
  it("返回中文标签，未知状态原样返回", () => {
    expect(downloadStatusLabel("running")).toBe("下载中")
    expect(downloadStatusLabel("done")).toBe("已完成")
    expect(downloadStatusLabel("weird" as never)).toBe("weird")
  })
})

describe("downloadPercent", () => {
  it("按 offset/size 计算并夹在 0-100", () => {
    expect(downloadPercent(task({ offset: 250 }))).toBe(25)
    expect(downloadPercent(task({ offset: 2000 }))).toBe(100)
    expect(downloadPercent(task({ offset: -5 }))).toBe(0)
  })

  it("大小未知时返回 0", () => {
    expect(downloadPercent(task({ file_size: 0 }))).toBe(0)
  })
})

describe("downloadEta", () => {
  it("running 且速度有效时计算剩余秒数", () => {
    expect(downloadEta(task({ offset: 500, speed: 100 }))).toBe(5)
    expect(downloadEta(task({ offset: 1000, speed: 100 }))).toBe(0)
  })

  it("可以用滑动平均后的速度计算", () => {
    expect(downloadEta(task({ offset: 500, speed: 0 }), 100)).toBe(5)
    expect(downloadEta(task({ status: "paused", offset: 500 }), 100)).toBeNull()
  })

  it("非 running 或没有速度时返回 null", () => {
    expect(downloadEta(task({ status: "paused", speed: 100 }))).toBeNull()
    expect(downloadEta(task({ speed: 0 }))).toBeNull()
  })
})

describe("downloadPreviewSources", () => {
  it("大图优先，去重并补上按任务 ID 的兜底接口", () => {
    expect(
      downloadPreviewSources(
        task({
          preview_url: "/api/v1/media/thumbnail/preview",
          thumbnail_url: "/api/v1/media/thumbnail/thumb",
        })
      )
    ).toEqual([
      "/api/v1/media/thumbnail/preview",
      "/api/v1/media/thumbnail/thumb",
      "/api/v1/downloads/1/thumbnail",
    ])
  })

  it("缺少 token 地址时直接退回按 ID 的接口", () => {
    expect(downloadPreviewSources(task())).toEqual([
      "/api/v1/downloads/1/thumbnail",
    ])
  })

  it("大图与封面是同一地址时只保留一次", () => {
    expect(
      downloadPreviewSources(
        task({
          preview_url: "/api/v1/media/thumbnail/same",
          thumbnail_url: "/api/v1/media/thumbnail/same",
        })
      )
    ).toEqual([
      "/api/v1/media/thumbnail/same",
      "/api/v1/downloads/1/thumbnail",
    ])
  })
})

describe("smoothSpeedSample", () => {
  it("按最近 10 秒窗口平均并裁剪旧样本", () => {
    const samples: SpeedSample[] = []
    expect(smoothSpeedSample(samples, 1_000, 100)).toBe(100)
    expect(smoothSpeedSample(samples, 2_000, 200)).toBe(150)
    // 11.001s 时，1s 的采样已超出 10s 窗口。
    expect(smoothSpeedSample(samples, 11_001, 300)).toBe(250)
    expect(samples).toHaveLength(2)
  })

  it("负数按 0 计", () => {
    const samples: SpeedSample[] = []
    expect(smoothSpeedSample(samples, 1_000, -5)).toBe(0)
  })
})

describe("summarizeCreateResult", () => {
  it("把各计数拼成一句提示", () => {
    const resp: DownloadCreateResponse = {
      created: [1, 2],
      restarted: [4],
      existing: [3],
      skipped: [{ link: "x", reason: "无媒体" }],
      failed: [{ link: "y", error: "解析失败" }],
    }
    expect(summarizeCreateResult(resp)).toBe(
      "新建 2，重新下载 1，已存在 1，跳过 1，失败 1"
    )
  })

  it("全部为空时给出兜底文案", () => {
    expect(summarizeCreateResult({ created: [], existing: [] })).toBe(
      "没有可下载的媒体"
    )
  })
})

describe("hasActiveDownloads", () => {
  it("只有 running / pending 算进行中", () => {
    expect(hasActiveDownloads([task({ status: "pending" })])).toBe(true)
    expect(hasActiveDownloads([task({ status: "done" }), task({ status: "failed" })])).toBe(
      false
    )
    expect(hasActiveDownloads([])).toBe(false)
  })
})

describe("countActiveDownloads", () => {
  it("统计 running + pending，不含暂停与已结束", () => {
    const tasks = [
      task({ status: "running" }),
      task({ status: "running" }),
      task({ status: "pending" }),
      task({ status: "pending" }),
      task({ status: "paused" }),
      task({ status: "done" }),
      task({ status: "failed" }),
    ]
    expect(countActiveDownloads(tasks)).toBe(4)
    expect(countActiveDownloads([])).toBe(0)
  })
})
