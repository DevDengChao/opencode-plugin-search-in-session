import { createEffect, onCleanup, type Accessor } from "solid-js"
import type { SearchMatch } from "../search"
import { findActiveTimelineRoot, findPartElement, isOwnMutation } from "./selectors"

const HIGHLIGHT_HIT = "sis-search-hit"
const HIGHLIGHT_ACTIVE = "sis-search-active"

export interface TimelineHighlighterInput {
  enabled: Accessor<boolean>
  matches: Accessor<readonly SearchMatch[]>
  active: Accessor<SearchMatch | undefined>
  sessionKey?: Accessor<string | undefined>
}

export interface TimelineHighlighter {
  refresh: () => void
  dispose: () => void
}

export function createTimelineHighlighter(input: TimelineHighlighterInput): TimelineHighlighter {
  let observer: MutationObserver | undefined
  let observedRoot: HTMLElement | undefined
  let scheduled = false
  let disposed = false

  function apply(): void {
    if (disposed) return

    const registry = highlightRegistry()

    if (!registry || !input.enabled()) {
      clearHighlights()
      return
    }

    const root = findActiveTimelineRoot()
    const list = input.matches()

    if (!root || list.length === 0) {
      clearHighlights()
      return
    }

    const active = input.active()
    const byPart = groupByPart(list)
    const hits: Range[] = []
    const activeRanges: Range[] = []

    for (const [partID, partMatches] of byPart) {
      const part = findPartElement(root, partID)
      if (!part) continue

      const allowed = new Set(partMatches.map((match) => occurrenceKey(match.term, match.occurrence)))
      const activeKey =
        active?.partID === partID ? occurrenceKey(active.term, active.occurrence) : undefined
      const terms = uniqueTerms(partMatches)
      const counts = new Map<string, number>()

      for (const node of textNodes(part, partMatches)) {
        const text = node.nodeValue ?? ""
        if (!text) continue

        const lower = text.toLowerCase()

        for (const term of terms) {
          const lowerTerm = term.toLowerCase()
          let from = 0
          let at = lower.indexOf(lowerTerm, from)

          while (at !== -1) {
            const occurrence = counts.get(term) ?? 0
            counts.set(term, occurrence + 1)

            if (allowed.has(occurrenceKey(term, occurrence))) {
              const range = document.createRange()
              range.setStart(node, at)
              range.setEnd(node, Math.min(text.length, at + term.length))

              if (activeKey === occurrenceKey(term, occurrence)) activeRanges.push(range)
              else hits.push(range)
            }

            from = at + Math.max(1, lowerTerm.length)
            at = lower.indexOf(lowerTerm, from)
          }
        }
      }
    }

    clearHighlights()

    const HighlightCtor = (globalThis as unknown as { Highlight?: typeof Highlight }).Highlight
    if (!HighlightCtor) return

    if (hits.length > 0) registry.set(HIGHLIGHT_HIT, new HighlightCtor(...hits))
    if (activeRanges.length > 0) {
      registry.set(HIGHLIGHT_ACTIVE, new HighlightCtor(...activeRanges))
    } else if (active) {
      // The text may be in a tool result the UI never renders (for example a
      // webfetch body). Outline the part so navigation still has a visible target.
      findPartElement(root, active.partID)?.setAttribute("data-sis-active-part", "true")
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

    if (!input.enabled()) {
      observer?.disconnect()
      observer = undefined
      observedRoot = undefined
      return
    }

    const root = findActiveTimelineRoot()
    if (!root) return
    if (root === observedRoot && observer) return

    observer?.disconnect()
    observedRoot = root
    observer = new MutationObserver((records) => {
      if (records.some((record) => !isOwnMutation(record))) schedule()
    })
    observer.observe(root, { childList: true, subtree: true, characterData: true })
  }

  createEffect(() => {
    if (disposed) return

    input.enabled()
    input.matches()
    input.active()
    input.sessionKey?.()

    apply()
    observe()
  })

  onCleanup(() => {
    disposed = true
    observer?.disconnect()
    observer = undefined
    clearHighlights()
  })

  return {
    refresh: apply,
    dispose: () => {
      disposed = true
      observer?.disconnect()
      observer = undefined
      clearHighlights()
    },
  }
}

/**
 * Finds the active occurrence's DOM range inside a part. Used both by the
 * highlighter and by scroll-to-match.
 */
export function findActiveRange(part: HTMLElement, match: SearchMatch): Range | undefined {
  let occurrence = 0

  for (const node of textNodes(part, [match])) {
    const text = node.nodeValue ?? ""
    if (!text) continue

    const lower = text.toLowerCase()
    const lowerTerm = match.term.toLowerCase()
    let from = 0
    let at = lower.indexOf(lowerTerm, from)

    while (at !== -1) {
      if (occurrence === match.occurrence) {
        const range = document.createRange()
        range.setStart(node, at)
        range.setEnd(node, at + match.term.length)
        return range
      }

      occurrence += 1
      from = at + Math.max(1, lowerTerm.length)
      at = lower.indexOf(lowerTerm, from)
    }
  }

  return undefined
}

function groupByPart(matches: readonly SearchMatch[]): Map<string, SearchMatch[]> {
  const result = new Map<string, SearchMatch[]>()

  for (const match of matches) {
    const list = result.get(match.partID)
    if (list) list.push(match)
    else result.set(match.partID, [match])
  }

  return result
}

function uniqueTerms(matches: readonly SearchMatch[]): string[] {
  const terms = new Map<string, string>()

  for (const match of matches) {
    const key = match.term.toLowerCase()
    if (!terms.has(key)) terms.set(key, match.term)
  }

  return [...terms.values()]
}

function occurrenceKey(term: string, occurrence: number): string {
  return `${term.toLowerCase()}\u0000${occurrence}`
}

function textNodes(part: HTMLElement, matches: readonly SearchMatch[]): Text[] {
  const roots = textRoots(part, matches)
  const seen = new Set<Text>()
  const result: Text[] = []

  for (const root of roots) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement
        if (!parent) return NodeFilter.FILTER_REJECT
        if (parent.closest("[data-sis-ui], script, style")) return NodeFilter.FILTER_REJECT
        if (
          parent.closest(
            '[data-slot="text-part-copy-wrapper"], [data-slot="text-part-meta"], [data-slot="user-message-copy-wrapper"], [data-slot="user-message-meta"], time',
          )
        )
          return NodeFilter.FILTER_REJECT
        if (!node.nodeValue?.trim()) return NodeFilter.FILTER_REJECT

        return NodeFilter.FILTER_ACCEPT
      },
    })

    let node = walker.nextNode() as Text | null

    while (node) {
      if (!seen.has(node)) {
        seen.add(node)
        result.push(node)
      }
      node = walker.nextNode() as Text | null
    }
  }

  return result
}

function textRoots(part: HTMLElement, matches: readonly SearchMatch[]): HTMLElement[] {
  const scopes = new Set(matches.map((match) => match.scope))
  const roots: HTMLElement[] = []

  if (scopes.has("user")) {
    const text = part.querySelector<HTMLElement>('[data-slot="user-message-text"]')
    if (text) roots.push(text)
  }

  if (scopes.has("assistant")) {
    const text = part.querySelector<HTMLElement>('[data-slot="text-part-body"]')
    if (text) roots.push(text)
  }

  if (scopes.has("reasoning")) {
    const text = part.querySelector<HTMLElement>('[data-component="markdown"]')
    if (text) roots.push(text)
  }

  if (scopes.has("tool-call")) {
    const trigger = part.querySelector<HTMLElement>('[data-component="tool-trigger"]')
    if (trigger) roots.push(trigger)
    else roots.push(part)
  }

  if (scopes.has("tool-result")) {
    const output = part.querySelector<HTMLElement>('[data-component="tool-output"]')
    if (output) roots.push(output)

    const card = part.querySelector<HTMLElement>('[data-component="card"], .error-card')
    if (card) roots.push(card)
  }

  if (scopes.has("shell")) roots.push(part)

  if (roots.length === 0) return scopes.has("tool-result") ? [] : [part]

  return roots
}

function highlightRegistry(): { delete(name: string): void; set(name: string, highlight: Highlight): void } | undefined {
  return (globalThis.CSS as unknown as { highlights?: { delete(name: string): void; set(name: string, highlight: Highlight): void } } | undefined)?.highlights
}

function clearHighlights(): void {
  for (const element of document.querySelectorAll<HTMLElement>("[data-sis-active-part]")) {
    element.removeAttribute("data-sis-active-part")
  }

  const registry = highlightRegistry()
  if (!registry) return

  registry.delete(HIGHLIGHT_HIT)
  registry.delete(HIGHLIGHT_ACTIVE)
}
