import type { ReactNode } from "react"
import { useDocumentTitle } from "@/hooks/use-document-title"

interface PageHeaderProps {
  title: string
  description?: string
  actions?: ReactNode
}

/** 页面标题区：标题、说明与右侧操作，所有业务页共用。 */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  useDocumentTitle(title)

  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  )
}
