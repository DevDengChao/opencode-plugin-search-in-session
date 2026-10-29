import type {
  ParsedQuery,
  ScopeCounts,
  ScopeSelection,
  SearchMatch,
  SearchPart,
  SearchResult,
} from "./types"
import { emptyScopeCounts } from "./types"

const MAX_MATCHES = 25_000

/**
 * Finds every occurrence of every positive term in parts that contain all
 * positive terms and none of the negative ones. Matches are in reading order.
 */
export function findMatches(
  parts: readonly SearchPart[],
  query: ParsedQuery,
  scopes: ScopeSelection,
): SearchResult {
  const counts = emptyScopeCounts()
  const matches: SearchMatch[] = []
  const matchingParts = new Set<string>()
  let total = 0

  if (query.positive.length === 0) {
    return { matches, total, counts, partCount: 0, partIDs: matchingParts }
  }

  for (const part of parts) {
    if (!scopes[part.scope] || !part.text) continue

    const occurrences = query.positive.map((term) => findOccurrences(part.text, term))
    if (occurrences.some((list) => list.length === 0)) continue

    if (query.negative.some((term) => findOccurrences(part.text, term).length > 0)) continue

    matchingParts.add(part.id)

    for (let termIndex = 0; termIndex < query.positive.length; termIndex++) {
      const term = query.positive[termIndex]!
      const list = occurrences[termIndex]!

      counts[part.scope] += list.length
      total += list.length

      for (let occurrence = 0; occurrence < list.length; occurrence++) {
        if (matches.length >= MAX_MATCHES) continue

        const range = list[occurrence]!
        matches.push({
          partID: part.id,
          messageID: part.messageID,
          revealID: part.revealID,
          scope: part.scope,
          term,
          termIndex,
          occurrence,
          start: range.start,
          end: range.end,
          text: part.text,
          order: part.order,
        })
      }
    }
  }

  matches.sort((a, b) => a.order - b.order || a.start - b.start || a.termIndex - b.termIndex)

  return { matches, total, counts, partCount: matchingParts.size, partIDs: matchingParts }
}

export interface Occurrence {
  start: number
  end: number
}

export function findOccurrences(text: string, term: string): Occurrence[] {
  if (!text || !term) return []

  const lowerText = text.toLowerCase()
  const lowerTerm = term.toLowerCase()

  // Lowercasing preserves offsets for almost every string. When a locale
  // changes the length, fall back to a case-insensitive regex on the original.
  if (lowerText.length === text.length && lowerTerm.length === term.length) {
    const result: Occurrence[] = []
    let from = 0
    let at = lowerText.indexOf(lowerTerm, from)

    while (at !== -1) {
      result.push({ start: at, end: at + term.length })
      from = at + Math.max(1, term.length)
      at = lowerText.indexOf(lowerTerm, from)
    }

    return result
  }

  const result: Occurrence[] = []
  const pattern = new RegExp(escapeRegExp(term), "gi")
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text)) !== null) {
    result.push({ start: match.index, end: match.index + match[0].length })
    if (match[0].length === 0) pattern.lastIndex++
  }

  return result
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

export function countScopeHits(counts: ScopeCounts): number {
  return Object.values(counts).reduce((sum, count) => sum + count, 0)
}
