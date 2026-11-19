/** TanStack Query 的 key 工厂：避免各页面手写字符串导致失效不彻底。 */
export const queryKeys = {
  health: ["health"] as const,
  accounts: ["accounts"] as const,
  account: (id: number) => ["accounts", id] as const,
  settings: ["settings"] as const,
}
