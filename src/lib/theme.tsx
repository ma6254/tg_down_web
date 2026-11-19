import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import {
  ThemeContext,
  type ResolvedTheme,
  type Theme,
  type ThemeState,
} from "@/hooks/use-theme"

const STORAGE_KEY = "theme"

function normalizeTheme(value: string | null): Theme {
  return value === "light" || value === "dark" || value === "system"
    ? value
    : "system"
}

function readStoredTheme(): Theme {
  try {
    return normalizeTheme(localStorage.getItem(STORAGE_KEY))
  } catch {
    return "system"
  }
}

function systemTheme(): ResolvedTheme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light"
}

/**
 * 主题 Provider：light / dark / system。
 *
 * 与 next-themes 的差异：不再向 React 树里注入 <script>（React 19 会为此报警），
 * 首屏由 index.html 的内联脚本提前设置 .dark，这里只负责运行时切换与同步。
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme)
  const [system, setSystem] = useState<ResolvedTheme>(systemTheme)
  const resolvedTheme: ResolvedTheme = theme === "system" ? system : theme

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const onChange = () => setSystem(media.matches ? "dark" : "light")
    media.addEventListener("change", onChange)
    return () => media.removeEventListener("change", onChange)
  }, [])

  // 多标签页同步：另一个标签页改了主题，这里跟着切换。
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) {
        setThemeState(normalizeTheme(event.newValue))
      }
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])

  useEffect(() => {
    const root = document.documentElement
    const dark = resolvedTheme === "dark"
    root.classList.toggle("dark", dark)
    root.style.colorScheme = dark ? "dark" : "light"
  }, [resolvedTheme])

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* localStorage 不可用时只在当前会话生效 */
    }
  }, [])

  const value = useMemo<ThemeState>(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
