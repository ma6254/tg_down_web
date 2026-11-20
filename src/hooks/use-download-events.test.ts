import { QueryClient } from "@tanstack/react-query"
import { describe, expect, it } from "vitest"
import type { DownloadTask } from "@/api/types"
import { queryKeys } from "@/api/query-keys"
import { applyDownloadEvent } from "./use-download-events"

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

function setup(initial: DownloadTask[]) {
  const client = new QueryClient()
  client.setQueryData(queryKeys.downloads, initial)
  return client
}

describe("applyDownloadEvent", () => {
  it("task.update 对已有任务做替换", () => {
    const client = setup([task()])
    applyDownloadEvent(client, {
      event: "task.update",
      data: task({ status: "done", offset: 1000 }),
    })
    const list = client.getQueryData<DownloadTask[]>(queryKeys.downloads)
    expect(list).toHaveLength(1)
    expect(list?.[0].status).toBe("done")
  })

  it("task.update 对未知任务插到最前面", () => {
    const client = setup([task({ id: 1 })])
    applyDownloadEvent(client, {
      event: "task.update",
      data: task({ id: 2, status: "pending" }),
    })
    const list = client.getQueryData<DownloadTask[]>(queryKeys.downloads)
    expect(list?.map((item) => item.id)).toEqual([2, 1])
  })

  it("task.progress 只更新 offset/speed", () => {
    const client = setup([task({ offset: 0, speed: 0 })])
    applyDownloadEvent(client, {
      event: "task.progress",
      data: { id: 1, offset: 512, speed: 64, size: 1000 },
    })
    const list = client.getQueryData<DownloadTask[]>(queryKeys.downloads)
    expect(list?.[0]).toMatchObject({ status: "running", offset: 512, speed: 64 })
  })

  it("task.deleted 移除任务", () => {
    const client = setup([task({ id: 1 }), task({ id: 2 })])
    applyDownloadEvent(client, { event: "task.deleted", data: { id: 1 } })
    const list = client.getQueryData<DownloadTask[]>(queryKeys.downloads)
    expect(list?.map((item) => item.id)).toEqual([2])
  })

  it("未知事件与非法数据不改变缓存", () => {
    const client = setup([task()])
    applyDownloadEvent(client, { event: "ping", data: {} })
    applyDownloadEvent(client, { event: "task.update", data: { nope: true } })
    const list = client.getQueryData<DownloadTask[]>(queryKeys.downloads)
    expect(list).toHaveLength(1)
  })
})
