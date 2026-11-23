import { useEffect } from "react"
import {
  BASE_TITLE,
  formatDocumentTitle,
  type DocumentTitleStatus,
} from "@/lib/document-title"
import { formatSpeed } from "@/lib/format"

let baseTitle: string | null = null
let status: DocumentTitleStatus = { enabled: false, speed: null }

/** 标题速度状态：关闭时不加前缀；开启时显示速度或「无活动」。 */
function renderDocumentTitle() {
  if (!baseTitle) {
    if (!status.enabled) {
      return
    }
    const prefix =
      status.speed !== null && status.speed > 0
        ? formatSpeed(status.speed)
        : "无活动"
    document.title = `${prefix} · ${BASE_TITLE}`
    return
  }

  document.title = formatDocumentTitle(baseTitle, status)
}

/**
 * 更新标题里的速度状态。
 *
 * 由 AppShell 里的全局 hook 调用；页面标题仍由 useDocumentTitle 维护。
 */
export function setDocumentTitleStatus(next: DocumentTitleStatus) {
  status = next
  renderDocumentTitle()
}

/** 把当前页面标题同步到 document.title，便于浏览器标签与读屏识别。 */
export function useDocumentTitle(title?: string) {
  useEffect(() => {
    // 子页面（BootSplash / OfflineScreen）可能先设置更具体的标题；
    // 父级传 undefined 时不要覆盖它们。
    if (!title) {
      return
    }
    baseTitle = title
    renderDocumentTitle()
  }, [title])
}
