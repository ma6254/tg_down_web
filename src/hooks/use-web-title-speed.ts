import { useEffect } from "react"
import { setDocumentTitleStatus } from "@/hooks/use-document-title"
import { useDownloads } from "@/hooks/use-downloads"
import { useSettings, useToggleSetting } from "@/hooks/use-settings"
import { settingBool, WEB_TITLE_SPEED_KEY } from "@/lib/settings"

/** 网页设置卡片：读写 settings.web_title_speed。 */
export function useWebTitleSpeed() {
  const settings = useSettings()
  const { toggle, pending } = useToggleSetting(
    WEB_TITLE_SPEED_KEY,
    (enabled) => `网页标题速度显示：${enabled ? "已启用" : "已关闭"}`
  )
  const enabled = settingBool(
    settings.data?.settings,
    WEB_TITLE_SPEED_KEY,
    false
  )

  return { enabled, setEnabled: toggle, isPending: pending }
}

/**
 * 把当前所有运行中任务的速度总和写进浏览器标题。
 *
 * 任务列表与侧栏共用同一个查询；SSE 在线时随进度更新，断线时轮询兜底。
 */
export function useDocumentTitleSpeed() {
  const settings = useSettings()
  const downloads = useDownloads()
  const enabled = settingBool(
    settings.data?.settings,
    WEB_TITLE_SPEED_KEY,
    false
  )
  const totalSpeed = (downloads.data ?? []).reduce(
    (sum, task) => (task.status === "running" ? sum + task.speed : sum),
    0
  )

  useEffect(() => {
    setDocumentTitleStatus({ enabled, speed: totalSpeed })
  }, [enabled, totalSpeed])

  // 离开应用壳（例如退出登录）时清掉速度前缀，避免登录页标题残留。
  useEffect(
    () => () => setDocumentTitleStatus({ enabled: false, speed: null }),
    []
  )
}
