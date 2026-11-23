import { CheckIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTheme } from "@/hooks/use-theme"
import { useSetWebTheme } from "@/hooks/use-web-theme"
import { THEME_OPTIONS } from "@/lib/theme-options"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

/** 主题切换：浅色 / 深色 / 跟随系统。 */
export function ThemeToggle() {
  const { theme } = useTheme()
  const { setTheme } = useSetWebTheme()
  const current =
    THEME_OPTIONS.find((item) => item.value === theme) ??
    THEME_OPTIONS[THEME_OPTIONS.length - 1]
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
        {THEME_OPTIONS.map(({ value, label, icon: ItemIcon }) => (
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
