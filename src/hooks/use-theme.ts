import { createContext, useContext } from "react"

export type Theme = "light" | "dark" | "system"
export type ResolvedTheme = "light" | "dark"

export interface ThemeState {
  theme: Theme
  resolvedTheme: ResolvedTheme
  setTheme: (theme: Theme) => void
}

export const ThemeContext = createContext<ThemeState | null>(null)

export function useTheme(): ThemeState {
  const value = useContext(ThemeContext)
  if (!value) {
    throw new Error("useTheme 必须在 <ThemeProvider> 内使用")
  }
  return value
}
