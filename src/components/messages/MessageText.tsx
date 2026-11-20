import { Fragment, useMemo, useState, type ReactNode } from "react"
import type { PreviewEntity } from "@/api/types"
import { entityKey, formatEntityDate, splitRichText, type RichSegment } from "@/lib/rich-text"
import { cn } from "@/lib/utils"

interface MessageTextProps {
  text: string
  /** 富文本标注；缺失或为空时按纯文本渲染。 */
  entities?: PreviewEntity[]
  className?: string
}

/** Telegram 的链接/提及用蓝色区分，跟随明暗主题。 */
const ACCENT_CLASS = "text-blue-600 dark:text-blue-400"
const LINK_CLASS = "text-blue-600 underline-offset-2 break-all hover:underline dark:text-blue-400"

/**
 * 渲染消息正文：纯文本 + Telegram 实体标注。
 *
 * 实体偏移以 UTF-16 码元计，正好等于 JS 字符串下标，所以这里只负责
 * 按边界切段、给每段套上对应的标签，不需要像 Go 侧那样换算。
 */
export function MessageText({ text, entities, className }: MessageTextProps) {
  const segments = useMemo(() => splitRichText(text, entities), [text, entities])
  const [revealed, setRevealed] = useState<ReadonlySet<string>>(() => new Set())

  function toggleSpoiler(key: string) {
    setRevealed((current) => {
      const next = new Set(current)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  return (
    <p
      className={cn(
        "whitespace-pre-wrap break-words text-sm leading-relaxed",
        className
      )}
    >
      {segments.map((segment, index) => (
        <Fragment key={`${index}-${segment.entities.length}`}>
          {renderSegment(segment, revealed, toggleSpoiler)}
        </Fragment>
      ))}
    </p>
  )
}

/** 从内向外套标签：实体已按「外层先」排好，倒序遍历即可。 */
function renderSegment(
  segment: RichSegment,
  revealed: ReadonlySet<string>,
  onToggleSpoiler: (key: string) => void
): ReactNode {
  let content: ReactNode = segment.text
  for (let i = segment.entities.length - 1; i >= 0; i--) {
    content = wrapEntity(segment.entities[i], content, segment.text, revealed, onToggleSpoiler)
  }
  return content
}

function wrapEntity(
  entity: PreviewEntity,
  child: ReactNode,
  text: string,
  revealed: ReadonlySet<string>,
  onToggleSpoiler: (key: string) => void
): ReactNode {
  switch (entity.type) {
    case "bold":
      return <strong className="font-semibold">{child}</strong>
    case "italic":
      return <em>{child}</em>
    case "underline":
      return <span className="underline underline-offset-2">{child}</span>
    case "strikethrough":
      return <span className="line-through">{child}</span>
    case "spoiler": {
      const key = entityKey(entity)
      const shown = revealed.has(key)
      return (
        <span
          role="button"
          tabIndex={0}
          aria-label={shown ? "隐藏剧透" : "显示剧透"}
          title={shown ? "点击重新隐藏" : "剧透，点击展开"}
          className={cn(
            "cursor-pointer rounded-sm outline-none select-none transition-[filter] focus-visible:ring-2 focus-visible:ring-ring/50",
            shown ? "bg-muted/60" : "bg-foreground/15 blur-[3px]"
          )}
          onClick={() => onToggleSpoiler(key)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault()
              onToggleSpoiler(key)
            }
          }}
        >
          {child}
        </span>
      )
    }
    case "code":
      return (
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">{child}</code>
      )
    case "pre":
      return (
        <span
          className="my-1 block overflow-x-auto rounded-md border bg-muted/50 p-2 font-mono text-xs"
          title={entity.language ? `代码块（${entity.language}）` : "代码块"}
        >
          {child}
        </span>
      )
    case "blockquote":
      return (
        <span
          className={cn(
            "my-1 block border-l-2 border-primary/25 pl-3 text-muted-foreground",
            entity.collapsed && "border-primary/50"
          )}
          title={entity.collapsed ? "可折叠引用" : undefined}
        >
          {child}
        </span>
      )
    case "text_link":
      return entity.url ? (
        <a href={entity.url} target="_blank" rel="noreferrer" className={LINK_CLASS}>
          {child}
        </a>
      ) : (
        <>{child}</>
      )
    case "url":
      return (
        <a href={withScheme(text)} target="_blank" rel="noreferrer" className={LINK_CLASS}>
          {child}
        </a>
      )
    case "email":
      return (
        <a href={`mailto:${text}`} className={LINK_CLASS}>
          {child}
        </a>
      )
    case "phone_number":
      return (
        <a href={`tel:${text.replace(/[^\d+]/g, "")}`} className={LINK_CLASS}>
          {child}
        </a>
      )
    case "date_time": {
      const formatted = formatEntityDate(entity)
      if (!formatted || !entity.date) {
        return <>{child}</>
      }
      return (
        <time
          dateTime={new Date(entity.date * 1000).toISOString()}
          title={text}
          className="underline decoration-dotted underline-offset-2"
        >
          {formatted}
        </time>
      )
    }
    case "mention":
    case "hashtag":
    case "cashtag":
    case "bot_command":
      return <span className={ACCENT_CLASS}>{child}</span>
    case "text_mention":
      return (
        <span className={ACCENT_CLASS} title={entity.user_id ? `用户 ID ${entity.user_id}` : undefined}>
          {child}
        </span>
      )
    case "custom_emoji":
      return <span title="自定义表情">{child}</span>
    case "media_timestamp":
      return (
        <span
          className={cn(
            ACCENT_CLASS,
            "font-mono underline decoration-dotted underline-offset-2"
          )}
        >
          {child}
        </span>
      )
    case "bank_card":
      return <span className="font-mono break-all">{child}</span>
    case "ton_address":
      return <span className="font-mono break-all">{child}</span>
    case "diff_insert":
      return (
        <span className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">{child}</span>
      )
    case "diff_delete":
      return <span className="bg-destructive/10 text-destructive line-through">{child}</span>
    case "diff_replace":
      return <span className="bg-amber-500/15">{child}</span>
    default:
      return <>{child}</>
  }
}

/** 裸 URL 实体可能没有协议头，补上 https:// 再作为链接。 */
function withScheme(url: string): string {
  return /^[a-z][a-z\d+.-]*:/i.test(url) ? url : `https://${url}`
}
