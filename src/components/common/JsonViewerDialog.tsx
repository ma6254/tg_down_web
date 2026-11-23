import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import {
  CheckIcon,
  ChevronRightIcon,
  CopyIcon,
  FileJsonIcon,
} from "lucide-react"
import { toast } from "sonner"
import { ModalDialog, type ModalSize } from "@/components/common/ModalDialog"
import { Button } from "@/components/ui/button"
import { copyText } from "@/lib/clipboard"
import { formatJson, type JsonToken, type JsonTokenKind } from "@/lib/json"
import {
  buildJsonTree,
  buildJsonViewLines,
  collectFoldPaths,
  plainJsonViewLines,
  selectedLineRange,
} from "@/lib/json-tree"
import { cn } from "@/lib/utils"

/** 语法配色：浅色模式用深色阶，暗色模式换亮色阶，保证两种主题都可读。 */
const TOKEN_CLASS: Record<JsonTokenKind, string> = {
  key: "text-sky-700 dark:text-sky-300",
  string: "text-emerald-700 dark:text-emerald-300",
  number: "text-amber-700 dark:text-amber-300",
  boolean: "text-violet-700 dark:text-violet-300",
  null: "text-rose-700 dark:text-rose-300",
  punctuation: "text-muted-foreground",
  summary: "text-muted-foreground/80",
  // 括号正常按 level 取 BRACKET_CLASS；这里只是类型兜底。
  bracket: "text-muted-foreground",
  // 缩进不渲染成文字，而是按层级画成彩色引导块，这里只留空类名兜底。
  indent: "",
}

/**
 * 缩进层级配色：每层一种颜色，6 层一循环。
 *
 * 用同一组 500 级中间色，亮/暗主题下都能看清；缩进块用渐变绘制
 * 「1px 引导线 + 很淡的底色」，叠起来就是彩虹缩进。
 */
const INDENT_COLORS = [
  "14 165 233", // sky
  "139 92 246", // violet
  "16 185 129", // emerald
  "245 158 11", // amber
  "244 63 94", // rose
  "99 102 241", // indigo
]

/**
 * 括号颜色与缩进层级一一对应，顺序同 INDENT_COLORS。
 *
 * 文字用 700/300 色阶保证对比度，色相与缩进引导线一致。
 */
const BRACKET_CLASS = [
  "text-sky-700 dark:text-sky-300",
  "text-violet-700 dark:text-violet-300",
  "text-emerald-700 dark:text-emerald-300",
  "text-amber-700 dark:text-amber-300",
  "text-rose-700 dark:text-rose-300",
  "text-indigo-700 dark:text-indigo-300",
]

/** 括号按嵌套层级取色，其余 token 用常规语法配色。 */
function tokenClass(token: JsonToken): string {
  if (token.kind === "bracket") {
    const level = Math.max(token.level ?? 1, 1)
    return BRACKET_CLASS[(level - 1) % BRACKET_CLASS.length]
  }
  return TOKEN_CLASS[token.kind]
}

/** 可选的每层缩进空格数。 */
const INDENT_WIDTHS = [2, 4, 8] as const
const DEFAULT_INDENT_WIDTH = 2

/**
 * 按缩进宽度生成缩进引导背景。
 *
 * 每一层占 `width` 个字符宽：左边 1px 实色引导线，其余是同色淡底；
 * 6 种颜色循环，所以背景图尺寸是 `width * 6` 个字符宽。
 */
function indentGuide(width: number): { image: string; size: string } {
  const stops = INDENT_COLORS.map((color, index) => {
    const start = index * width
    const end = start + width
    return `rgb(${color} / 0.85) ${start}ch calc(${start}ch + 1px), rgb(${color} / 0.14) calc(${start}ch + 1px) ${end}ch`
  }).join(", ")
  return {
    image: `linear-gradient(to right, ${stops})`,
    size: `${width * INDENT_COLORS.length}ch 100%`,
  }
}

/** 行首连续的缩进 token 决定层级；其余 token 正常渲染。 */
function splitIndent(tokens: JsonToken[]): {
  indent: number
  body: JsonToken[]
} {
  let index = 0
  while (tokens[index]?.kind === "indent") {
    index += 1
  }
  return { indent: index, body: tokens.slice(index) }
}

/** 「已复制」状态保持时长：足够看到反馈，又不会一直停在那里。 */
const COPIED_RESET_MS = 1600

/** 单独的修饰键按下不应取消 Ctrl+A 的全选状态（Ctrl+C 前会先按 Ctrl）。 */
const MODIFIER_KEYS = new Set([
  "control",
  "shift",
  "alt",
  "meta",
  "altgraph",
  "os",
  "capslock",
  "numlock",
  "scrolllock",
])

/** 空折叠集合：跨调用复用，避免每次渲染新建 Set。 */
const EMPTY_FOLDS: ReadonlySet<string> = new Set()

interface FoldState {
  /** 折叠状态对应的数据标识（固定用 2 空格格式化，与缩进宽度无关）。 */
  sourceKey: string
  collapsed: ReadonlySet<string>
}

export interface JsonViewerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 要展示的数据：对象/数组按缩进展示（默认 2 空格，可切换）；字符串按原样展示。 */
  value: unknown
  /** 标题，默认「JSON 数据」。 */
  title?: ReactNode
  description?: ReactNode
  /** 宽度档位，默认 xl（48rem）。 */
  size?: ModalSize
  className?: string
}

/**
 * 只读 JSON 查看器对话框（公共组件）。
 *
 * 负责格式化、行号、语法着色、彩虹缩进与缩进宽度切换、折叠、复制与关闭；
 * 数据由调用方传入。折叠时保留原文行号（隐藏的行跳号），复制始终复制
 * 完整 JSON（按当前缩进宽度）。
 */
export function JsonViewerDialog({
  open,
  onOpenChange,
  value,
  title = "JSON 数据",
  description,
  size = "xl",
  className,
}: JsonViewerDialogProps) {
  const [indentWidth, setIndentWidth] = useState<number>(DEFAULT_INDENT_WIDTH)
  // 固定用 2 空格文本作为「数据是否变化」的标识，切换缩进宽度不会重置折叠状态。
  const baseText = useMemo(
    () => formatJson(value, DEFAULT_INDENT_WIDTH),
    [value]
  )
  const text = useMemo(
    () =>
      indentWidth === DEFAULT_INDENT_WIDTH
        ? baseText
        : formatJson(value, indentWidth),
    [value, indentWidth, baseText]
  )
  const tree = useMemo(() => buildJsonTree(text), [text])
  const foldPaths = useMemo(() => (tree ? collectFoldPaths(tree) : []), [tree])
  const [foldState, setFoldState] = useState<FoldState>(() => ({
    sourceKey: baseText,
    collapsed: EMPTY_FOLDS,
  }))
  // 数据换了就回到全部展开，不保留旧路径的折叠状态。
  const collapsed =
    foldState.sourceKey === baseText ? foldState.collapsed : EMPTY_FOLDS
  const lines = useMemo(
    () =>
      tree
        ? buildJsonViewLines(tree, collapsed, indentWidth)
        : plainJsonViewLines(text),
    [tree, text, collapsed, indentWidth]
  )
  const guide = useMemo(() => indentGuide(indentWidth), [indentWidth])
  const totalLines = useMemo(() => text.split("\n").length, [text])
  const foldable = foldPaths.length > 0
  const allFolded = foldable && collapsed.size >= foldPaths.length
  const [copied, setCopied] = useState(false)
  const preRef = useRef<HTMLPreElement>(null)
  // Ctrl/Cmd+A 选中整块后置为 true；选区被调整或点击后取消，复制时据此写纯 JSON。
  const selectAllRef = useRef(false)

  // 复制成功后短暂显示「已复制」；组件卸载或再次复制时清掉上一个计时器。
  useEffect(() => {
    if (!copied) {
      return
    }
    const timer = window.setTimeout(() => setCopied(false), COPIED_RESET_MS)
    return () => window.clearTimeout(timer)
  }, [copied])

  // 捕获 Ctrl/Cmd+A：选中 JSON 正文；随后的复制直接写纯文本，
  // 避免行号、折叠箭头与 [index] 标注进入剪贴板。
  useEffect(() => {
    if (!open) {
      return
    }
    selectAllRef.current = false

    function handleSelectAll(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) {
        return
      }
      if (event.key.toLowerCase() !== "a") {
        return
      }
      // 输入框里的 Ctrl+A 留给输入框自己处理。
      const target = event.target as HTMLElement | null
      if (target?.closest("input, textarea") || target?.isContentEditable) {
        return
      }
      const pre = preRef.current
      if (!pre) {
        return
      }
      event.preventDefault()
      pre.focus({ preventScroll: true })
      const selection = window.getSelection()
      if (!selection) {
        return
      }
      const range = document.createRange()
      range.selectNodeContents(pre)
      selection.removeAllRanges()
      selection.addRange(range)
      selectAllRef.current = true
    }

    // 之后按了别的键（移动光标等）就放弃「全选复制」；Tab 只移焦点，不影响选区。
    function handleKeyDown(event: KeyboardEvent) {
      const key = event.key.toLowerCase()
      // 单独的 Ctrl/Shift/Alt/Meta 等修饰键不改变选区，不能因此取消状态；
      // 否则「松开 Ctrl 再按 Ctrl+C」会在按 Ctrl 的瞬间把全选标记清掉。
      if (MODIFIER_KEYS.has(key) || key === "tab") {
        return
      }
      if (
        (event.ctrlKey || event.metaKey) &&
        (key === "a" || key === "c" || key === "insert")
      ) {
        return
      }
      selectAllRef.current = false
    }

    // 左键点击视为调整/取消选区；右键（可能打开菜单复制）保留全选状态。
    function handlePointerDown(event: PointerEvent) {
      if (event.button === 0) {
        selectAllRef.current = false
      }
    }

    function handleCopyEvent(event: ClipboardEvent) {
      const pre = preRef.current
      const selection = window.getSelection()
      if (!pre || !selection || selection.rangeCount === 0) {
        selectAllRef.current = false
        return
      }
      if (selection.isCollapsed) {
        selectAllRef.current = false
        return
      }
      if (!pre.contains(selection.getRangeAt(0).commonAncestorContainer)) {
        selectAllRef.current = false
        return
      }

      // Ctrl+A：选中整块时直接给完整 JSON。
      if (selectAllRef.current) {
        if (!event.clipboardData) {
          return
        }
        event.preventDefault()
        event.clipboardData.setData("text/plain", text)
        return
      }

      // 普通选区：若跨过折叠块，按源码行展开折叠内容，避免复制出 `{ … }`。
      const rows = Array.from(
        pre.querySelectorAll<HTMLElement>("[data-json-line]")
      )
      const range = selectedLineRange(
        rows
          .filter((row) => selection.containsNode(row, true))
          .map((row) => ({
            start: Number(row.dataset.jsonLine),
            end: Number(row.dataset.jsonEnd ?? row.dataset.jsonLine),
          }))
      )
      if (!range || !range.crossesFold) {
        return
      }

      const sourceLines = text.split("\n")
      if (range.end > sourceLines.length) {
        return
      }
      if (!event.clipboardData) {
        return
      }
      event.preventDefault()
      event.clipboardData.setData(
        "text/plain",
        sourceLines.slice(range.start - 1, range.end).join("\n")
      )
    }

    document.addEventListener("keydown", handleSelectAll)
    document.addEventListener("keydown", handleKeyDown)
    document.addEventListener("pointerdown", handlePointerDown, true)
    document.addEventListener("copy", handleCopyEvent)
    return () => {
      selectAllRef.current = false
      document.removeEventListener("keydown", handleSelectAll)
      document.removeEventListener("keydown", handleKeyDown)
      document.removeEventListener("pointerdown", handlePointerDown, true)
      document.removeEventListener("copy", handleCopyEvent)
    }
  }, [open, text])

  async function handleCopy() {
    try {
      await copyText(text)
      setCopied(true)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "复制失败")
    }
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      setCopied(false)
      // 关闭即复位，下一次打开从全部展开开始。
      setFoldState({ sourceKey: baseText, collapsed: EMPTY_FOLDS })
    }
    onOpenChange(next)
  }

  function toggleFold(path: string) {
    // 用函数式更新，连续快速点击时不会拿到旧 collapsed。
    setFoldState((previous) => {
      const base =
        previous.sourceKey === baseText ? previous.collapsed : EMPTY_FOLDS
      const next = new Set(base)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return { sourceKey: baseText, collapsed: next }
    })
  }

  function expandAll() {
    setFoldState({ sourceKey: baseText, collapsed: EMPTY_FOLDS })
  }

  function collapseAll() {
    setFoldState({ sourceKey: baseText, collapsed: new Set(foldPaths) })
  }

  return (
    <ModalDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={
        <span className="flex items-center gap-2">
          <FileJsonIcon className="size-4 text-muted-foreground" />
          {title}
        </span>
      }
      description={description}
      size={size}
      // 查看器需要固定的大画布：高度占视口多数，正文区自行滚动。
      className={cn("h-[85svh]", className)}
      bodyClassName="min-h-0 overflow-hidden p-0"
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopy}
            title="复制完整 JSON（不受折叠影响）"
            aria-label={copied ? "已复制 JSON" : "复制 JSON"}
          >
            {copied ? <CheckIcon /> : <CopyIcon />}
            {copied ? "已复制" : "复制"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleOpenChange(false)}
          >
            关闭
          </Button>
        </>
      }
    >
      <div className="flex h-full min-h-0 flex-col">
        {foldable ? (
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b px-4 py-1.5">
            <span className="text-xs text-muted-foreground">
              共 {totalLines} 行
              {collapsed.size > 0
                ? ` · 已折叠 ${collapsed.size} 处 · 显示 ${lines.length} 行`
                : ""}
            </span>
            <div className="flex flex-wrap items-center gap-1">
              <span className="px-1 text-xs text-muted-foreground">缩进</span>
              {INDENT_WIDTHS.map((width) => (
                <Button
                  key={width}
                  type="button"
                  variant={width === indentWidth ? "secondary" : "ghost"}
                  size="xs"
                  aria-pressed={width === indentWidth}
                  aria-label={`缩进 ${width} 个空格`}
                  title={`每层 ${width} 个空格`}
                  onClick={() => setIndentWidth(width)}
                >
                  {width}
                </Button>
              ))}
              <span className="pr-1 text-xs text-muted-foreground">空格</span>
              <span
                aria-hidden="true"
                className="mx-1 h-4 w-px shrink-0 bg-border"
              />
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={expandAll}
                disabled={collapsed.size === 0}
              >
                展开全部
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={collapseAll}
                disabled={allFolded}
              >
                折叠全部
              </Button>
            </div>
          </div>
        ) : null}

        <pre
          ref={preRef}
          tabIndex={0}
          aria-label="JSON 内容"
          className="min-h-0 flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset"
        >
          <code className="block">
            {lines.map((line) => {
              const fold = line.fold
              const { indent, body } = splitIndent(line.tokens)
              // 折叠行在源码里覆盖的结束行：复制跨折叠块的选区时据此展开。
              const endLine =
                fold?.collapsed && fold.lineCount > 1
                  ? line.line + fold.lineCount - 1
                  : line.line
              return (
                <span
                  key={line.line}
                  data-json-line={line.line}
                  data-json-end={endLine}
                  className="flex"
                >
                  <span className="relative w-5 shrink-0 select-none">
                    {fold ? (
                      <button
                        type="button"
                        onClick={() => toggleFold(fold.path)}
                        aria-expanded={!fold.collapsed}
                        aria-label={`${fold.collapsed ? "展开" : "折叠"}第 ${line.line} 行`}
                        title={fold.collapsed ? "展开此节点" : "折叠此节点"}
                        className="absolute top-0 left-0 flex size-5 items-center justify-center rounded text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
                      >
                        <ChevronRightIcon
                          className={cn(
                            "size-3.5 transition-transform",
                            !fold.collapsed && "rotate-90"
                          )}
                        />
                      </button>
                    ) : null}
                  </span>
                  <span
                    aria-hidden="true"
                    className="w-10 shrink-0 select-none border-r border-border/40 pr-2 text-right text-muted-foreground/60 tabular-nums"
                  >
                    {line.line}
                  </span>
                  <span className="relative flex min-w-0 flex-1 pl-1">
                    {indent > 0 ? (
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-y-0 left-1"
                        style={{
                          width: `${indent * indentWidth}ch`,
                          backgroundImage: guide.image,
                          backgroundSize: guide.size,
                          backgroundRepeat: "repeat",
                        }}
                      />
                    ) : null}
                    <span className="relative min-w-0 flex-1 break-words whitespace-pre-wrap">
                      {/* 缩进用真实空格，划选复制时不丢；色带由上面的绝对定位层绘制。 */}
                      {" ".repeat(indent * indentWidth)}
                      {line.label ? (
                        // 下标是视觉辅助，不参与文本选中，避免手动复制时混进 JSON。
                        <span className="select-none text-muted-foreground/80">
                          {line.label}
                        </span>
                      ) : null}
                      {body.map((token, tokenIndex) => (
                        <span key={tokenIndex} className={tokenClass(token)}>
                          {token.text}
                        </span>
                      ))}
                    </span>
                  </span>
                </span>
              )
            })}
          </code>
        </pre>
      </div>
    </ModalDialog>
  )
}
