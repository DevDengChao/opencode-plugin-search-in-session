import { createEffect, onCleanup, type Accessor } from "solid-js"
import {
  TIMELINE_KEY_SELECTOR,
  TIMELINE_ROW_SELECTOR,
  TIMELINE_SCROLL_SELECTOR,
  findActiveTimelineRoot,
  isOwnMutation,
  rowPartIDs,
} from "./selectors"

export interface TimelineFilterInput {
  enabled: Accessor<boolean>
  matchedPartIDs: Accessor<ReadonlySet<string>>
  sessionKey?: Accessor<string | undefined>
}

export interface TimelineFilter {
  refresh: () => void
  dispose: () => void
}

export function createTimelineFilter(input: TimelineFilterInput): TimelineFilter {
  let observer: MutationObserver | undefined
  let observedRoot: HTMLElement | undefined
  let appliedRoot: HTMLElement | undefined
  let matched: ReadonlySet<string> = new Set()
  let enabled = false
  let scheduled = false
  let disposed = false
  let retry: ReturnType<typeof setTimeout> | undefined

  function apply(): void {
    if (disposed) return

    const root = enabled ? findActiveTimelineRoot() : undefined

    if (appliedRoot && appliedRoot !== root) clearRoot(appliedRoot)
    appliedRoot = root

    if (!root) {
      if (!enabled) clearAll()
      return
    }

    if (!enabled) {
      clearRoot(root)
      return
    }

    root.setAttribute("data-sis-filtering", "true")

    for (const row of root.querySelectorAll<HTMLElement>(TIMELINE_ROW_SELECTOR)) {
      const show = rowMatches(row, matched)
      row.toggleAttribute("data-sis-hidden", !show)

      const key = row.closest<HTMLElement>(TIMELINE_KEY_SELECTOR)
      key?.toggleAttribute("data-sis-hidden", !show)
    }
  }

  function schedule(): void {
    if (disposed || scheduled) return

    scheduled = true
    queueMicrotask(() => {
      scheduled = false
      apply()
    })
  }

  function observe(): void {
    if (disposed) return

    if (!enabled) {
      observer?.disconnect()
      observer = undefined
      observedRoot = undefined
      return
    }

    const root = findActiveTimelineRoot()
    if (!root) {
      if (enabled && !retry) {
        retry = setTimeout(() => {
          retry = undefined
          observe()
        }, 100)
      }
      return
    }
    if (root === observedRoot && observer) return

    observer?.disconnect()
    observedRoot = root
    observer = new MutationObserver((records) => {
      if (records.some((record) => !isOwnMutation(record))) schedule()
    })
    observer.observe(root, { childList: true, subtree: true })
  }

  createEffect(() => {
    if (disposed) return

    enabled = input.enabled()
    matched = input.matchedPartIDs()
    input.sessionKey?.()

    apply()
    observe()
  })

  onCleanup(() => {
    disposed = true
    if (retry) clearTimeout(retry)
    retry = undefined
    observer?.disconnect()
    observer = undefined
    clearAll()
  })

  return {
    refresh: apply,
    dispose: () => {
      disposed = true
      if (retry) clearTimeout(retry)
      retry = undefined
      observer?.disconnect()
      observer = undefined
      clearAll()
    },
  }
}

export function rowMatches(row: HTMLElement, matched: ReadonlySet<string>): boolean {
  if (matched.size === 0) return false

  for (const id of rowPartIDs(row)) {
    if (matched.has(id)) return true
  }

  return false
}

function clearRoot(root: HTMLElement): void {
  root.removeAttribute("data-sis-filtering")

  for (const element of root.querySelectorAll<HTMLElement>("[data-sis-hidden]")) {
    element.removeAttribute("data-sis-hidden")
  }
}

function clearAll(): void {
  for (const root of document.querySelectorAll<HTMLElement>(TIMELINE_SCROLL_SELECTOR)) {
    clearRoot(root)
  }

  for (const element of document.querySelectorAll<HTMLElement>("[data-sis-hidden]")) {
    element.removeAttribute("data-sis-hidden")
  }
}
