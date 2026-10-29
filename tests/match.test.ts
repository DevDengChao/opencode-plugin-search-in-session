import { describe, expect, it } from "vitest"
import { findMatches, findOccurrences } from "../src/search/match"
import { parseQuery } from "../src/search/tokenize"
import { emptyScopeSelection, type SearchPart } from "../src/search/types"

function part(input: Partial<SearchPart> & Pick<SearchPart, "id" | "text" | "scope">): SearchPart {
  return {
    messageID: "message-1",
    revealID: "message-1",
    order: 0,
    ...input,
  }
}

const scopes = emptyScopeSelection()

describe("findOccurrences", () => {
  it("finds overlapping terms independently", () => {
    expect(findOccurrences("aaaa", "aa")).toEqual([
      { start: 0, end: 2 },
      { start: 2, end: 4 },
    ])
  })

  it("matches without case", () => {
    expect(findOccurrences("Search SEARCH search", "search")).toHaveLength(3)
  })
})

describe("findMatches", () => {
  it("requires every positive term in the same part", () => {
    const parts = [
      part({ id: "a", scope: "assistant", text: "search plugin" }),
      part({ id: "b", scope: "assistant", text: "search only" }),
      part({ id: "c", scope: "assistant", text: "plugin only" }),
    ]

    const result = findMatches(parts, parseQuery("search plugin"), scopes)

    expect(result.partCount).toBe(1)
    expect(result.total).toBe(2)
    expect(result.matches.map((match) => match.partID)).toEqual(["a", "a"])
  })

  it("excludes parts containing a negative term", () => {
    const parts = [
      part({ id: "a", scope: "assistant", text: "search plugin reasoning" }),
      part({ id: "b", scope: "assistant", text: "search plugin answer" }),
    ]

    const result = findMatches(parts, parseQuery("search -reasoning"), scopes)

    expect(result.matches.map((match) => match.partID)).toEqual(["b"])
  })

  it("counts each term occurrence and maps the active term", () => {
    const parts = [part({ id: "a", scope: "user", text: "foo bar foo" })]

    const result = findMatches(parts, parseQuery("foo bar"), scopes)

    expect(result.total).toBe(3)
    expect(result.counts.user).toBe(3)
    expect(result.matches.map((match) => match.term)).toEqual(["foo", "bar", "foo"])
    expect(result.matches.map((match) => match.occurrence)).toEqual([0, 0, 1])
  })

  it("honors scope selection", () => {
    const parts = [
      part({ id: "user", scope: "user", text: "search" }),
      part({ id: "tool", scope: "tool-result", text: "search" }),
    ]

    const result = findMatches(parts, parseQuery("search"), { ...scopes, user: false })

    expect(result.matches.map((match) => match.partID)).toEqual(["tool"])
    expect(result.counts.user).toBe(0)
    expect(result.counts["tool-result"]).toBe(1)
  })

  it("returns nothing for an empty or negative-only query", () => {
    const parts = [part({ id: "a", scope: "assistant", text: "search" })]

    expect(findMatches(parts, parseQuery(""), scopes).total).toBe(0)
    expect(findMatches(parts, parseQuery("-search"), scopes).total).toBe(0)
  })

  it("sorts matches by part order, then position", () => {
    const parts = [
      part({ id: "b", scope: "assistant", text: "search", order: 2 }),
      part({ id: "a", scope: "user", text: "search search", order: 1 }),
    ]

    const result = findMatches(parts, parseQuery("search"), scopes)

    expect(result.matches.map((match) => match.partID)).toEqual(["a", "a", "b"])
  })
})
