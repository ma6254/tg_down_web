import { describe, expect, it } from "vitest"
import type { DownloadCreateResponse, DownloadTask } from "@/api/types"
import {
  downloadEta,
  downloadPercent,
  downloadStatusLabel,
  hasActiveDownloads,
  summarizeCreateResult,
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

  it("非 running 或没有速度时返回 null", () => {
    expect(downloadEta(task({ status: "paused", speed: 100 }))).toBeNull()
    expect(downloadEta(task({ speed: 0 }))).toBeNull()
  })
})

describe("summarizeCreateResult", () => {
  it("把各计数拼成一句提示", () => {
    const resp: DownloadCreateResponse = {
      created: [1, 2],
      existing: [3],
      skipped: [{ link: "x", reason: "无媒体" }],
      failed: [{ link: "y", error: "解析失败" }],
    }
    expect(summarizeCreateResult(resp)).toBe("新建 2，已存在 1，跳过 1，失败 1")
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
