import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import type { PreviewEntity } from "@/api/types"
import { MessageText } from "./MessageText"

function render(text: string, entities?: PreviewEntity[]): string {
  return renderToStaticMarkup(<MessageText text={text} entities={entities} />)
}

describe("MessageText", () => {
  it("没有实体时按纯文本渲染并转义 HTML", () => {
    const html = render("<b>不是标签</b>")
    expect(html).toContain("&lt;b&gt;不是标签&lt;/b&gt;")
    expect(html).not.toContain("<b>")
  })

  it("粗体与文本链接分别渲染成 strong / a", () => {
    const entities: PreviewEntity[] = [
      { type: "bold", offset: 0, length: 4 },
      { type: "text_link", offset: 1, length: 2, url: "https://t.me/x/1" },
    ]
    const html = render("看这里!", entities)

    expect(html).toContain("<strong")
    expect(html).toContain('href="https://t.me/x/1"')
    expect(html).toContain('target="_blank"')
  })

  it("剧透默认模糊并带展开按钮语义", () => {
    const html = render("剧透内容", [{ type: "spoiler", offset: 0, length: 4 }])
    expect(html).toContain('role="button"')
    expect(html).toContain('aria-label="显示剧透"')
    expect(html).toContain("blur-[3px]")
  })

  it("引用与代码块渲染成块级元素", () => {
    const entities: PreviewEntity[] = [
      { type: "blockquote", offset: 0, length: 2 },
      { type: "pre", offset: 3, length: 3, language: "go" },
    ]
    const html = render("引用\nfmt", entities)
    expect(html).toContain("border-l-2")
    expect(html).toContain("代码块（go）")
    expect(html).toContain("font-mono")
  })

  it("日期实体渲染成本地化时间", () => {
    const html = render("2026-11-20", [
      {
        type: "date_time",
        offset: 0,
        length: 10,
        date: 1794931200,
        date_format: "date_long",
      },
    ])
    expect(html).toContain("<time")
    expect(html).toContain('dateTime="')
    expect(html).toContain('title="2026-11-20"')
  })

  it("未知类型只保留文字", () => {
    const html = render("abc", [{ type: "future_entity", offset: 0, length: 3 }])
    expect(html).toContain("abc")
  })
})
