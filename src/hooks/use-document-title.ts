import { useEffect } from "react"

const BASE_TITLE = "tg_down"

/** 把当前页面标题同步到 document.title，便于浏览器标签与读屏识别。 */
export function useDocumentTitle(title?: string) {
  useEffect(() => {
    // 子页面（BootSplash / OfflineScreen）可能先设置更具体的标题；
    // 父级传 undefined 时不要覆盖它们。
    if (!title) {
      return
    }
    document.title = `${title} · ${BASE_TITLE}`
  }, [title])
}
