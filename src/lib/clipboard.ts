/**
 * 复制文本到剪贴板。
 *
 * 优先用异步 Clipboard API；非安全上下文（局域网 http）或旧浏览器
 * 没有该 API 时退回隐藏 textarea + execCommand。
 */
export async function copyText(text: string): Promise<void> {
  if (!text) {
    throw new Error("没有可复制的内容")
  }

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return
    } catch {
      // 权限被拒或 API 不可用时走兜底。
    }
  }

  if (typeof document === "undefined") {
    throw new Error("当前环境不支持复制")
  }

  const area = document.createElement("textarea")
  area.value = text
  area.setAttribute("readonly", "")
  area.style.position = "fixed"
  area.style.top = "-9999px"
  area.style.opacity = "0"
  document.body.appendChild(area)
  area.select()
  const ok = document.execCommand("copy")
  document.body.removeChild(area)
  if (!ok) {
    throw new Error("复制失败")
  }
}
