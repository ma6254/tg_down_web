import { CheckIcon, MonitorIcon, MoonIcon, SunIcon, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTheme, type Theme } from "@/hooks/use-theme"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface ThemeOption {
  value: Theme
  label: string
  icon: LucideIcon
}

const themes: ThemeOption[] = [
  { value: "light", label: "浅色", icon: SunIcon },
  { value: "dark", label: "深色", icon: MoonIcon },
  { value: "system", label: "跟随系统", icon: MonitorIcon },
]

/** 主题切换：浅色 / 深色 / 跟随系统。 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const current = themes.find((item) => item.value === theme) ?? themes[2]
  const Icon = current.icon

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`切换主题，当前：${current.label}`}
          />
        }
      >
        <Icon className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36">
        {themes.map(({ value, label, icon: ItemIcon }) => (
          <DropdownMenuItem key={value} onClick={() => setTheme(value)}>
            <ItemIcon />
            <span>{label}</span>
            {theme === value ? <CheckIcon className="ml-auto" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
