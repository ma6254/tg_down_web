/** TanStack Query 的 key 工厂：避免各页面手写字符串导致失效不彻底。 */
export const queryKeys = {
  health: ["health"] as const,
  system: ["system"] as const,
  accounts: ["accounts"] as const,
  account: (id: number) => ["accounts", id] as const,
  accountLive: (id: number) => ["accounts", id, "live"] as const,
  settings: ["settings"] as const,
  cache: ["cache"] as const,
  comments: (link: string) => ["comments", link] as const,
  downloads: ["downloads"] as const,
  downloadSpeedHistory: (windowSeconds: number, bucketSeconds: number) =>
    ["downloads", "speed-history", windowSeconds, bucketSeconds] as const,
  downloadDraft: ["download-draft"] as const,
  downloadHistory: ["download-history"] as const,
  downloadHistoryItem: (id: number) => ["download-history", id] as const,
}
