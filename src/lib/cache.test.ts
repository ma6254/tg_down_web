import { describe, expect, it } from "vitest"
import { previewCacheStatus } from "./cache"

// 2026-01-02 03:04:05 UTC，与 formatDateTime 的展示口径对应。
const at = Date.UTC(2026, 0, 2, 3, 4, 5) / 1000
const now = at * 1000 + 3 * 3600 * 1000 // 三小时后

describe("previewCacheStatus", () => {
  it("新读到的结果不显示缓存提示", () => {
    expect(previewCacheStatus({}, now)).toEqual({
      kind: "none",
      label: "",
      title: "",
    })
  })

  it("缓存命中时给出相对时间，悬停给绝对时间", () => {
    const status = previewCacheStatus({ cached: true, cached_at: at }, now)
    expect(status.kind).toBe("cached")
    expect(status.label).toBe("缓存于 3 小时前")
    expect(status.title).toContain("2026-01-02")
  })

  it("没有 cached_at 时退化为不显示", () => {
    expect(previewCacheStatus({ cached: true }, now).kind).toBe("none")
  })

  it("过期未更新的快照带上快照时间", () => {
    const status = previewCacheStatus(
      { cached: true, stale: true, cached_at: at },
      now
    )
    expect(status.kind).toBe("stale")
    expect(status.label).toBe("未更新")
    expect(status.title).toContain("快照取自")
    expect(status.title).toContain("强制刷新")
  })

  it("已失效优先于未更新，并且不能下载", () => {
    const status = previewCacheStatus(
      { cached: true, stale: true, gone: true, cached_at: at },
      now
    )
    expect(status.kind).toBe("gone")
    expect(status.label).toBe("已失效")
    expect(status.title).toContain("不能下载")
    expect(status.title).toContain("快照取自")
  })

  it("已失效但没有快照时间时不出现半截文案", () => {
    const status = previewCacheStatus({ gone: true }, now)
    expect(status.title).toBe("消息已删除或当前账号不可见，不能下载")
  })
})
