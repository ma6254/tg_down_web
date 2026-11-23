import { CheckIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { useTheme } from "@/hooks/use-theme"
import { useSetWebTheme } from "@/hooks/use-web-theme"
import { useWebTitleSpeed } from "@/hooks/use-web-title-speed"
import { THEME_OPTIONS } from "@/lib/theme-options"
import { cn } from "@/lib/utils"

/**
 * 网页设置：当前只放浏览器偏好，主题同时写入服务端 settings.web_theme。
 *
 * 本地 localStorage 仍保留，用于首屏在配置接口返回前先渲染主题。
 */
export function WebSettingsCard({ className }: { className?: string }) {
  const { theme, resolvedTheme } = useTheme()
  const { setTheme, isPending } = useSetWebTheme({ notify: true })
  const titleSpeed = useWebTitleSpeed()
  const saving = isPending || titleSpeed.isPending

  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border bg-card",
        className
      )}
      aria-labelledby="web-settings-title"
      aria-busy={saving}
    >
      <div className="border-b px-4 py-3">
        <h2 id="web-settings-title" className="text-base font-medium">
          网页设置
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          选择网页外观，并决定浏览器标签页标题是否显示下载速度。
        </p>
      </div>

      <div className="space-y-3 p-4">
        <div>
          <p className="text-sm font-medium">主题</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            选择浅色、深色或跟随系统；当前生效：
            {resolvedTheme === "dark" ? "深色" : "浅色"}。
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {THEME_OPTIONS.map(({ value, label, icon: Icon }) => {
              const selected = theme === value
              return (
                <Button
                  key={value}
                  type="button"
                  variant={selected ? "default" : "outline"}
                  className="justify-start"
                  disabled={isPending}
                  aria-pressed={selected}
                  onClick={() => setTheme(value)}
                >
                  <Icon className="size-4" />
                  {label}
                  {selected ? <CheckIcon className="ml-auto size-4" /> : null}
                </Button>
              )
            })}
          </div>
        </div>

        <div className="flex items-start justify-between gap-4 border-t pt-3">
          <div className="min-w-0">
            <p className="text-sm font-medium">网页标题速度显示</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              开启后浏览器标签标题会显示当前总下载速度；没有运行中的任务时显示「无活动」。
            </p>
          </div>
          <Switch
            checked={titleSpeed.enabled}
            onCheckedChange={titleSpeed.setEnabled}
            disabled={titleSpeed.isPending}
            aria-label="在网页标题显示下载速度"
            className="mt-0.5 shrink-0"
          />
        </div>
      </div>
    </section>
  )
}
