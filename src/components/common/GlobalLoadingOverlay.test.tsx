import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { GlobalLoadingOverlay } from "./GlobalLoadingOverlay"

describe("GlobalLoadingOverlay", () => {
  it("关闭时不渲染遮罩", () => {
    expect(renderToStaticMarkup(<GlobalLoadingOverlay open={false} />)).toBe("")
  })

  it("打开时渲染状态区与自定义文案", () => {
    const html = renderToStaticMarkup(
      <GlobalLoadingOverlay
        open
        label="正在保存配置…"
        description="配置写入完成前请勿重复操作。"
      />
    )
    expect(html).toContain('role="status"')
    expect(html).toContain('aria-busy="true"')
    expect(html).toContain("正在保存配置…")
    expect(html).toContain("配置写入完成前请勿重复操作。")
  })

  it("缺省文案为「正在保存…」", () => {
    expect(renderToStaticMarkup(<GlobalLoadingOverlay open />)).toContain(
      "正在保存…"
    )
  })
})
