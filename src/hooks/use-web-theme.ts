import { useCallback, useEffect, useRef } from "react"
import { toast } from "sonner"
import { describeError } from "@/api/client"
import { useSettings, useUpdateSettings } from "@/hooks/use-settings"
import { useTheme, type Theme } from "@/hooks/use-theme"
import { WEB_THEME_KEY } from "@/lib/settings"
import { THEME_OPTIONS } from "@/lib/theme-options"

/** 把服务端值归一成主题；非法值返回 null。 */
export function parseWebTheme(value: string | undefined): Theme | null {
  const normalized = value?.trim().toLowerCase()
  return normalized === "light" || normalized === "dark" || normalized === "system"
    ? normalized
    : null
}

/**
 * 应用启动时把服务端 settings.web_theme 同步到本地主题。
 *
 * ThemeProvider 先按 localStorage 渲染（避免首屏闪白），这里在配置加载后
 * 以服务端为准再校正一次；服务端不可用时保留本地值。
 */
export function useSyncWebTheme(): void {
  const settings = useSettings()
  const { theme, setTheme } = useTheme()
  const applied = useRef<Theme | null>(null)

  const row = settings.data?.settings.find((item) => item.key === WEB_THEME_KEY)
  const serverTheme = parseWebTheme(row?.value)

  useEffect(() => {
    if (!serverTheme || applied.current === serverTheme) {
      return
    }
    applied.current = serverTheme
    if (theme !== serverTheme) {
      setTheme(serverTheme)
    }
  }, [serverTheme, theme, setTheme])
}

export interface SetWebThemeResult {
  setTheme: (theme: Theme) => void
  isPending: boolean
}

export interface SetWebThemeOptions {
  /** 保存成功后是否用右下角 toast 确认；设置页卡片开启，侧栏切换保持安静。 */
  notify?: boolean
}

/**
 * 切换主题并写回 settings.web_theme。
 *
 * 先立即生效并写 localStorage，再异步保存到服务端；保存失败只提示，
 * 不撤销本地切换（离线时仍可正常使用网页）。
 */
export function useSetWebTheme({
  notify = false,
}: SetWebThemeOptions = {}): SetWebThemeResult {
  const { setTheme } = useTheme()
  const update = useUpdateSettings()

  const setWebTheme = useCallback(
    (next: Theme) => {
      setTheme(next)
      update.mutate(
        { [WEB_THEME_KEY]: next },
        {
          onSuccess: () => {
            if (!notify) {
              return
            }
            const label =
              THEME_OPTIONS.find((item) => item.value === next)?.label ?? next
            toast.success(`主题已切换：${label}`)
          },
          onError: (error) =>
            toast.error(`主题已在本机切换，但保存失败：${describeError(error)}`),
        }
      )
    },
    [setTheme, update, notify]
  )

  return { setTheme: setWebTheme, isPending: update.isPending }
}
