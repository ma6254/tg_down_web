import { Skeleton } from "@/components/ui/skeleton"

/** 配置列表加载骨架：两张卡片，贴近真实分组结构。 */
export function SettingsSkeleton() {
  return (
    <div
      className="space-y-4"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">正在加载配置…</span>
      {[0, 1].map((index) => (
        <div
          key={index}
          className="overflow-hidden rounded-xl border bg-card"
        >
          <div className="border-b px-4 py-3">
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="space-y-3 p-4">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-8 w-24" />
          </div>
        </div>
      ))}
    </div>
  )
}
