import { useCallback, useEffect, useRef, useState } from "react"
import { api } from "@/api/endpoints"
import type { DownloadCache } from "@/api/types"

/** links 变化的自动保存延迟；摘要变化立即保存。 */
export const DRAFT_AUTOSAVE_DELAY = 800

export type DraftSaveStatus = "idle" | "saving" | "saved" | "error"

interface Snapshot {
  links: string
  cache: DownloadCache | null
}

const EMPTY_SNAPSHOT: Snapshot = {
  links: "",
  cache: null,
}

function signature(snapshot: Snapshot): string {
  return JSON.stringify(snapshot)
}

/**
 * 下载页输入草稿：挂载时恢复、变化时自动保存、卸载页面时尽力补一次。
 *
 * - 两个开关（覆盖同名文件、展开正文链接）已迁移到系统配置，不在这里保存。
 * - 恢复完成前不触发自动保存；GET 返回前用户已经开始输入时放弃这次恢复。
 * - `links` debounce 800ms；摘要变化立即保存。
 * - 保存失败只置状态，不阻塞解析与下载；调用方可用 `retrySave` 重试。
 * - 多标签页 last-write-wins，不做冲突合并。
 */
export function useDownloadDraft() {
  const [links, setLinksState] = useState("")
  const [cache, setCacheState] = useState<DownloadCache | null>(null)
  const [status, setStatus] = useState<DraftSaveStatus>("idle")
  const [ready, setReady] = useState(false)
  // restored 表示这次挂载确实恢复了草稿（用户没抢先输入）；页面据此自动预览一次。
  const [restored, setRestored] = useState(false)

  const hydratedRef = useRef(false)
  const touchedRef = useRef(false)
  const savedRef = useRef<string | null>(null)
  const snapshotRef = useRef<Snapshot>(EMPTY_SNAPSHOT)
  const timerRef = useRef<number | null>(null)
  const seqRef = useRef(0)

  useEffect(() => {
    snapshotRef.current = { links, cache }
  }, [links, cache])

  const persist = useCallback(async (snapshot: Snapshot) => {
    const seq = ++seqRef.current
    setStatus("saving")
    try {
      await api.downloads.saveDraft({
        links: snapshot.links,
        cache: snapshot.cache,
      })
      if (seq !== seqRef.current) {
        // 已有更新的保存请求在飞，忽略这次结果。
        return
      }
      savedRef.current = signature(snapshot)
      setStatus("saved")
    } catch {
      if (seq !== seqRef.current) {
        return
      }
      setStatus("error")
    }
  }, [])

  const scheduleSave = useCallback(
    (snapshot: Snapshot, delay: number) => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current)
      }
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null
        if (signature(snapshot) === savedRef.current) {
          return
        }
        void persist(snapshot)
      }, delay)
    },
    [persist]
  )

  // 挂载时恢复一次；用户已经动过输入就放弃，保留当前内容。
  useEffect(() => {
    let cancelled = false
    api.downloads
      .draft()
      .then((draft) => {
        if (cancelled) {
          return
        }
        const restoredDraft: Snapshot = {
          links: draft.links,
          cache: draft.cache ?? null,
        }
        if (!touchedRef.current) {
          setLinksState(restoredDraft.links)
          setCacheState(restoredDraft.cache)
          savedRef.current = signature(restoredDraft)
          setRestored(true)
          if (draft.updated_at) {
            setStatus("saved")
          }
        }
        hydratedRef.current = true
        setReady(true)
        if (touchedRef.current) {
          scheduleSave(snapshotRef.current, 0)
        }
      })
      .catch(() => {
        if (cancelled) {
          return
        }
        hydratedRef.current = true
        setReady(true)
        if (touchedRef.current) {
          scheduleSave(snapshotRef.current, 0)
        }
      })
    return () => {
      cancelled = true
    }
  }, [scheduleSave])

  // links 变化 debounce 800ms；摘要变化立即保存。
  const prevRef = useRef<Snapshot>(EMPTY_SNAPSHOT)
  useEffect(() => {
    if (!hydratedRef.current) {
      return
    }
    const snapshot: Snapshot = { links, cache }
    const previous = prevRef.current
    prevRef.current = snapshot
    if (signature(snapshot) === savedRef.current) {
      return
    }
    const immediate = previous.cache !== cache
    scheduleSave(snapshot, immediate ? 0 : DRAFT_AUTOSAVE_DELAY)
  }, [links, cache, scheduleSave])

  // 关闭/刷新页面时用 keepalive 补一次；失败静默（浏览器限制请求体大小）。
  useEffect(() => {
    const flush = () => {
      if (!hydratedRef.current) {
        return
      }
      const snapshot = snapshotRef.current
      if (signature(snapshot) === savedRef.current) {
        return
      }
      void api.downloads
        .saveDraft(
          {
            links: snapshot.links,
            cache: snapshot.cache,
          },
          { keepalive: true }
        )
        .then(() => {
          if (signature(snapshot) === signature(snapshotRef.current)) {
            savedRef.current = signature(snapshot)
          }
        })
        .catch(() => {})
    }
    window.addEventListener("pagehide", flush)
    return () => {
      window.removeEventListener("pagehide", flush)
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [])

  const touch = useCallback(() => {
    touchedRef.current = true
  }, [])

  const setLinks = useCallback(
    (value: string) => {
      touch()
      setLinksState(value)
    },
    [touch]
  )

  const setCache = useCallback(
    (value: DownloadCache | null) => {
      touch()
      setCacheState(value)
    },
    [touch]
  )

  /** 从历史回填：只恢复 links；两个开关都是全局配置，不随历史变化。 */
  const applyHistory = useCallback(
    (linksValue: string) => {
      touch()
      setLinksState(linksValue)
    },
    [touch]
  )

  /** 清空输入与摘要并立即保存空串。 */
  const clearDraft = useCallback(() => {
    touch()
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setLinksState("")
    setCacheState(null)
    savedRef.current = null
    void persist({ links: "", cache: null })
  }, [persist, touch])

  const retrySave = useCallback(() => {
    void persist(snapshotRef.current)
  }, [persist])

  return {
    links,
    cache,
    ready,
    restored,
    status,
    setLinks,
    setCache,
    applyHistory,
    clearDraft,
    retrySave,
  }
}
