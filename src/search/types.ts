export const SEARCH_SCOPES = ["user", "assistant", "reasoning", "tool-call", "tool-result", "shell"] as const

export type SearchScope = (typeof SEARCH_SCOPES)[number]

export type ScopeSelection = Record<SearchScope, boolean>

export interface SearchPart {
  /** The id the timeline renders as `data-timeline-part-id`. */
  id: string
  messageID: string
  /** The user or shell message the timeline anchors this part to. */
  revealID: string
  scope: SearchScope
  text: string
  order: number
  label?: string
}

export interface ParsedQuery {
  positive: string[]
  negative: string[]
}

export interface SearchMatch {
  partID: string
  messageID: string
  revealID: string
  scope: SearchScope
  term: string
  termIndex: number
  /** The occurrence of this term within its part, in reading order. */
  occurrence: number
  start: number
  end: number
  text: string
  order: number
}

export type ScopeCounts = Record<SearchScope, number>

export interface SearchResult {
  /** The navigable matches, capped for pathological queries. */
  matches: SearchMatch[]
  /** The full hit count, even when `matches` is capped. */
  total: number
  counts: ScopeCounts
  partCount: number
  /** Every matching part id, even when `matches` is capped. */
  partIDs: ReadonlySet<string>
}

export function emptyScopeSelection(value = true): ScopeSelection {
  return {
    user: value,
    assistant: value,
    reasoning: value,
    "tool-call": value,
    "tool-result": value,
    shell: value,
  }
}

export function emptyScopeCounts(): ScopeCounts {
  return {
    user: 0,
    assistant: 0,
    reasoning: 0,
    "tool-call": 0,
    "tool-result": 0,
    shell: 0,
  }
}
