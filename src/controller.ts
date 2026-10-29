import { createEffect, createMemo, createSignal, on, type Accessor } from "solid-js"
import type { Context } from "@opencode/plugin/gui"
import type { SessionMessageInfo } from "@opencode/client/promise"
import { labelsFor, type Labels } from "./labels"
import { buildSearchParts, findMatches, parseQuery } from "./search"
import { findActiveRange } from "./timeline/highlight"
import { findActiveTimelineRoot, findPartElement } from "./timeline/selectors"
import {
  emptyScopeSelection,
  type ScopeCounts,
  type ScopeSelection,
  type SearchMatch,
  type SearchPart,
  type SearchScope,
} from "./search"

export interface SearchController {
  readonly labels: () => Labels
  readonly sessionKey: Accessor<string | undefined>
  readonly sessionID: Accessor<string | undefined>
  readonly messages: Accessor<readonly SessionMessageInfo[]>
  readonly parts: Accessor<SearchPart[]>
  readonly matches: Accessor<SearchMatch[]>
  readonly total: Accessor<number>
  readonly counts: Accessor<ScopeCounts>
  readonly partCount: Accessor<number>
  readonly partIDs: Accessor<ReadonlySet<string>>
  readonly activeIndex: Accessor<number>
  readonly activeMatch: Accessor<SearchMatch | undefined>
  readonly open: Accessor<boolean>
  readonly query: Accessor<string>
  readonly scopes: Accessor<ScopeSelection>
  readonly filter: Accessor<boolean>
  readonly loadingHistory: Accessor<boolean>
  readonly historyError: Accessor<string | undefined>
  readonly focusTick: Accessor<number>
  readonly focusSelect: Accessor<boolean>
  openPanel: () => void
  refocus: () => void
  closePanel: () => void
  togglePanel: () => void
  setQuery: (value: string) => void
  setScope: (scope: SearchScope, value: boolean) => void
  toggleScope: (scope: SearchScope) => void
  setAllScopes: (value: boolean) => void
  setFilter: (value: boolean) => void
  clearFilter: () => void
  move: (delta: number) => void
  setActive: (index: number) => void
}

export function createSearchController(ctx: Context): SearchController {
  const labels = () => labelsFor(ctx.locale.locale())
  const [open, setOpen] = createSignal(false)
  const [query, setQuerySignal] = createSignal("")
  const [scopes, setScopes] = createSignal<ScopeSelection>(emptyScopeSelection())
  const [filter, setFilterSignal] = createSignal(false)
  const [active, setActiveSignal] = createSignal(0)
  const [focusTick, setFocusTick] = createSignal(0)
  const [focusSelect, setFocusSelect] = createSignal(true)
  const [loadingHistory, setLoadingHistory] = createSignal(false)
  const [historyError, setHistoryError] = createSignal<string | undefined>()

  let loadToken = 0

  const session = () => ctx.sessions.current()
  const sessionKey = () => session()?.key
  const sessionID = () => session()?.id

  const messages = createMemo<readonly SessionMessageInfo[]>(() => {
    const current = session()
    if (!current) return []

    return current.server.data.session.message.list(current.id)
  })

  const parts = createMemo(() => buildSearchParts(messages()))
  const parsed = createMemo(() => parseQuery(query()))
  const result = createMemo(() => findMatches(parts(), parsed(), scopes()))
  const matches = createMemo(() => result().matches)
  const total = createMemo(() => result().total)
  const counts = createMemo(() => result().counts)
  const partCount = createMemo(() => result().partCount)
  const partIDs = createMemo(() => result().partIDs)

  const activeIndex = createMemo(() => {
    const list = matches()
    if (list.length === 0) return 0

    return Math.min(Math.max(active(), 0), list.length - 1)
  })

  const activeMatch = createMemo(() => matches()[activeIndex()])

  async function ensureHistory(): Promise<void> {
    const current = session()
    if (!current || loadingHistory()) return

    const data = current.server.data
    const id = current.id

    if (!data.session.message.more(id)) {
      setHistoryError(undefined)
      return
    }

    const token = ++loadToken
    setLoadingHistory(true)
    setHistoryError(undefined)

    try {
      await data.session.message.loadMore(id, { all: true, signal: ctx.signal })
    } catch (error) {
      if (token !== loadToken || ctx.signal.aborted) return

      setHistoryError(labels().historyError)
      console.warn("[search-in-session] failed to load full history", error)
    } finally {
      if (token === loadToken) setLoadingHistory(false)
    }
  }

  function openPanel(): void {
    if (!session()) return

    setOpen(true)
    setFocusSelect(true)
    setFocusTick((value) => value + 1)
    void ensureHistory()
  }

  function refocus(): void {
    if (!open()) return

    setFocusSelect(false)
    setFocusTick((value) => value + 1)
  }

  function closePanel(): void {
    setOpen(false)
  }

  function togglePanel(): void {
    if (open()) closePanel()
    else openPanel()
  }

  function setQuery(value: string): void {
    setQuerySignal(value)

    if (!value.trim()) setFilterSignal(false)
  }

  function setScope(scope: SearchScope, value: boolean): void {
    setScopes((current) => ({ ...current, [scope]: value }))
  }

  function toggleScope(scope: SearchScope): void {
    setScope(scope, !scopes()[scope])
  }

  function setAllScopes(value: boolean): void {
    setScopes(emptyScopeSelection(value))
  }

  function setFilter(value: boolean): void {
    if (!value) {
      setFilterSignal(false)
      return
    }

    if (!query().trim()) return
    setFilterSignal(true)
  }

  function clearFilter(): void {
    setFilterSignal(false)
  }

  function move(delta: number): void {
    const list = matches()
    if (list.length === 0) return

    setActiveSignal(nextNavigableIndex(list, activeIndex(), delta))
  }

  function nextNavigableIndex(list: readonly SearchMatch[], from: number, delta: number): number {
    const normalize = (index: number) => ((index % list.length) + list.length) % list.length
    let index = normalize(from + delta)
    const current = list[from]

    if (!current) return index

    const root = findActiveTimelineRoot()
    const part = root ? findPartElement(root, current.partID) : undefined

    if (!part) return index

    const collapsed = part.querySelector<HTMLElement>('[data-slot="collapsible-trigger"][aria-expanded="false"]')
    if (collapsed || findActiveRange(part, current)) return index

    // A tool result the UI never renders (for example a webfetch body) can
    // contain thousands of occurrences that all point at the same part.
    // Treat the part as one navigation stop instead of appearing stuck.
    for (let steps = 0; steps < list.length; steps++) {
      if (list[index]?.partID !== current.partID) return index
      index = normalize(index + delta)
    }

    return index
  }

  function setActive(index: number): void {
    const list = matches()
    if (list.length === 0) {
      setActiveSignal(0)
      return
    }

    setActiveSignal(((index % list.length) + list.length) % list.length)
  }

  createEffect(
    on(
      sessionKey,
      () => {
        loadToken += 1
        setOpen(false)
        setQuerySignal("")
        setScopes(emptyScopeSelection())
        setFilterSignal(false)
        setActiveSignal(0)
        setLoadingHistory(false)
        setHistoryError(undefined)
      },
      { defer: true },
    ),
  )

  createEffect(
    on(
      query,
      () => {
        setActiveSignal(0)
      },
      { defer: true },
    ),
  )

  createEffect(
    on(
      () => total(),
      (count) => {
        if (count === 0 && !query().trim()) setFilterSignal(false)
      },
      { defer: true },
    ),
  )

  return {
    labels,
    sessionKey,
    sessionID,
    messages,
    parts,
    matches,
    total,
    counts,
    partCount,
    partIDs,
    activeIndex,
    activeMatch,
    open,
    query,
    scopes,
    filter,
    loadingHistory,
    historyError,
    focusTick,
    focusSelect,
    openPanel,
    refocus,
    closePanel,
    togglePanel,
    setQuery,
    setScope,
    toggleScope,
    setAllScopes,
    setFilter,
    clearFilter,
    move,
    setActive,
  }
}
