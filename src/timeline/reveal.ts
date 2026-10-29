import type { SearchMatch } from "../search"
import { findActiveRange } from "./highlight"
import { findActiveTimelineRoot, findGroupElement, findPartElement, timelineViewport } from "./selectors"

export interface RevealToken {
  cancelled: boolean
}

export interface RevealContext {
  /** User message ids in transcript order. */
  userMessageIDs: readonly string[]
  /** The user message that owns the active match, when there is one. */
  targetUserID: string
  /** Its index in `userMessageIDs`, or -1 when the match is not under a user message. */
  targetUserIndex: number
}

export function createRevealToken(): RevealToken {
  return { cancelled: false }
}

export function cancelReveal(token: RevealToken): void {
  token.cancelled = true
}

/**
 * Scrolls to a hit. The timeline is virtualized and some parts are collapsed,
 * so this tries, in order:
 *
 * 1. an already mounted part,
 * 2. a mounted tool group that contains the part,
 * 3. scrolling to the owning user message after the app loads older history,
 * 4. stepping through the timeline until the part mounts.
 *
 * It deliberately avoids changing the route hash: OpenCode's desktop router
 * rejects an unrecognised hash-only route, and the virtualizer already exposes
 * enough DOM to navigate by scrolling.
 */
export function revealMatch(match: SearchMatch, token: RevealToken, context?: RevealContext): void {
  let attempts = 0
  let direction: "up" | "down" = targetIsAbove(context) ? "up" : "down"

  const initialRoot = findActiveTimelineRoot()
  if (initialRoot) pauseAutoScroll(initialRoot)

  const seek = () => {
    if (token.cancelled) return

    const root = findActiveTimelineRoot()
    if (!root) {
      if (attempts++ < 12) later(seek, 120)
      return
    }

    const part = findPartElement(root, match.partID)
    if (part) {
      focusPart(root, part, match, token)
      return
    }

    const group = findGroupElement(root, match.partID)
    if (group) {
      expandGroup(group)
      later(seek, 180)
      return
    }

    const anchor = context ? document.getElementById(`message-${context.targetUserID}`) : null
    if (anchor) {
      scrollElementIntoView(timelineViewport(root), anchor)
      later(() => {
        if (token.cancelled) return
        const currentRoot = findActiveTimelineRoot()
        const currentPart = currentRoot ? findPartElement(currentRoot, match.partID) : undefined
        if (currentRoot && currentPart) {
          focusPart(currentRoot, currentPart, match, token)
          return
        }

        const currentGroup = currentRoot ? findGroupElement(currentRoot, match.partID) : undefined
        if (currentRoot && currentGroup) {
          expandGroup(currentGroup)
          later(seek, 180)
          return
        }

        stepThroughTimeline(match, token)
      }, 80)
      return
    }

    if (attempts++ < 40) {
      if (attempts === 1 || attempts % 6 === 0) {
        scrollToEdge(timelineViewport(root), direction)

        if (attempts > 12) direction = direction === "up" ? "down" : "up"
      }

      later(seek, 280)
      return
    }

    stepThroughTimeline(match, token)
  }

  seek()
}

function targetIsAbove(context: RevealContext | undefined): boolean {
  if (!context || context.targetUserIndex < 0) return true

  const current = currentVisibleUserIndex(context.userMessageIDs)
  if (current < 0) return true

  return context.targetUserIndex < current
}

function currentVisibleUserIndex(userMessageIDs: readonly string[]): number {
  const root = findActiveTimelineRoot()
  if (!root) return -1

  const rows = Array.from(root.querySelectorAll<HTMLElement>('[data-timeline-row="UserMessage"][data-message-id]'))
  const viewport = timelineViewport(root)
  const box = viewport.getBoundingClientRect()

  for (const row of rows) {
    const rect = row.getBoundingClientRect()
    if (rect.bottom < box.top || rect.top > box.bottom) continue

    const id = row.getAttribute("data-message-id")
    if (!id) continue

    const index = userMessageIDs.indexOf(id)
    if (index >= 0) return index
  }

  return -1
}

function focusPart(root: HTMLElement, part: HTMLElement, match: SearchMatch, token: RevealToken): void {
  expandPart(part)

  later(() => {
    if (token.cancelled) return
    scrollPart(root, part, match)

    later(() => {
      if (token.cancelled) return
      scrollPart(root, part, match)
    }, 60)
  }, 60)
}

function pauseAutoScroll(root: HTMLElement): void {
  const viewport = timelineViewport(root)

  try {
    viewport.dispatchEvent(new WheelEvent("wheel", { deltaY: -120, bubbles: true, cancelable: true }))
  } catch {
    // A synthetic wheel is only an optimisation; scrolling still works without it.
  }
}

function scrollToEdge(viewport: HTMLElement, direction: "up" | "down"): void {
  pauseAutoScroll(viewport)
  const top = direction === "up" ? 0 : Math.max(0, viewport.scrollHeight - viewport.clientHeight)
  viewport.scrollTo({ top, behavior: "auto" })
}

function scrollElementIntoView(viewport: HTMLElement, element: HTMLElement): void {
  const target = element.getBoundingClientRect()
  const box = viewport.getBoundingClientRect()
  const sticky = viewport.querySelector<HTMLElement>("[data-session-title]")
  const inset = sticky?.offsetHeight ?? 0
  const top = target.top - box.top + viewport.scrollTop - inset - Math.max(0, (box.height - target.height) / 2)

  viewport.scrollTo({ top: Math.max(0, top), behavior: "auto" })
}

function stepThroughTimeline(match: SearchMatch, token: RevealToken): void {
  let steps = 0

  const step = () => {
    if (token.cancelled) return

    const root = findActiveTimelineRoot()
    if (!root) return

    const part = findPartElement(root, match.partID)
    if (part) {
      focusPart(root, part, match, token)
      return
    }

    const group = findGroupElement(root, match.partID)
    if (group) {
      expandGroup(group)
      later(step, 180)
      return
    }

    if (steps++ >= 20) return

    const viewport = timelineViewport(root)
    pauseAutoScroll(root)
    viewport.scrollBy({ top: Math.max(80, viewport.clientHeight * 0.75), behavior: "auto" })
    later(step, 140)
  }

  step()
}

export function scrollPart(root: HTMLElement, part: HTMLElement, match: SearchMatch): void {
  const viewport = timelineViewport(root)
  if (!viewport.isConnected) return

  const range = findActiveRange(part, match)
  const target = range?.getBoundingClientRect() ?? part.getBoundingClientRect()
  const box = viewport.getBoundingClientRect()
  const sticky = viewport.querySelector<HTMLElement>("[data-session-title]")
  const inset = sticky?.offsetHeight ?? 0
  const top = target.top - box.top + viewport.scrollTop - inset - Math.max(0, (box.height - target.height) / 2)

  viewport.scrollTo({ top: Math.max(0, top), behavior: "auto" })
}

export function expandPart(part: HTMLElement): void {
  part
    .querySelector<HTMLElement>('[data-slot="user-message-fold-toggle"][aria-expanded="false"]')
    ?.click()

  clickCollapsible(part)
}

export function expandGroup(group: HTMLElement): void {
  clickCollapsible(group)
}

function clickCollapsible(container: HTMLElement): void {
  const trigger = container.querySelector<HTMLElement>('[data-slot="collapsible-trigger"]')
  if (!trigger) return

  if (trigger.getAttribute("aria-expanded") === "false") {
    trigger.click()
    return
  }

  const content = container.querySelector<HTMLElement>('[data-slot="collapsible-content"]')
  if (content && content.getBoundingClientRect().height === 0) trigger.click()
}

function later(fn: () => void, delay: number): void {
  setTimeout(fn, delay)
}
