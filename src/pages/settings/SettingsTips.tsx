/** 侧栏说明：修改时机与配置项来源。 */
export function SettingsTips() {
  return (
    <section className="rounded-xl border bg-card p-4">
      <h2 className="text-sm font-medium">说明</h2>
      <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
        <li>修改立即生效；运行中的任务沿用旧连接。</li>
        <li>只读与未识别的配置项仅展示，无法在 Web 中修改。</li>
      </ul>
    </section>
  )
}
