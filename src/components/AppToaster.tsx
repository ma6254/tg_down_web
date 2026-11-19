import { Toaster } from "@/components/ui/sonner"
import { useTheme } from "@/hooks/use-theme"

/**
 * 全局消息提示。
 *
 * 显式传入当前解析后的主题，避免 shadcn 的 Toaster 依赖 next-themes 的 Provider；
 * 我们的 ThemeProvider 不注入 script，也就不会触发 React 19 的 script 标签警告。
 */
export function AppToaster() {
  const { resolvedTheme } = useTheme()
  return (
    <Toaster position="bottom-right" closeButton theme={resolvedTheme} />
  )
}
