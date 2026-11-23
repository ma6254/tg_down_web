import { MonitorIcon, MoonIcon, SunIcon, type LucideIcon } from "lucide-react"
import type { Theme } from "@/hooks/use-theme"

export interface ThemeOption {
  value: Theme
  label: string
  icon: LucideIcon
}

/** 网页主题选项；侧栏切换与设置页共用。 */
export const THEME_OPTIONS: ThemeOption[] = [
  { value: "light", label: "浅色", icon: SunIcon },
  { value: "dark", label: "深色", icon: MoonIcon },
  { value: "system", label: "跟随系统", icon: MonitorIcon },
]
