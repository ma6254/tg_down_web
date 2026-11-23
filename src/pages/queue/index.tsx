import { DownloadSpeedChart } from "@/components/downloads/DownloadSpeedChart"
import { PageHeader } from "@/components/layout/PageHeader"
import { DownloadTasks } from "./DownloadTasks"

/**
 * 下载队列页：实时速度曲线 + 任务列表与暂停/恢复/重试/删除。
 *
 * 曲线在页面顶部，数据由 DownloadSpeedChart 内部轮询历史速度接口；
 * 任务面板用 SSE 推送进度，离开页面即断开，侧栏查询继续提供轮询兜底。
 */
export function QueuePage() {
  return (
    <>
      <PageHeader
        title="下载队列"
        description="查看下载进度，暂停、恢复、重试或删除任务。"
      />
      <DownloadSpeedChart className="mb-6" />
      <DownloadTasks />
    </>
  )
}
