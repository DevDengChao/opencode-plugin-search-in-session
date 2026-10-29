import { describe, expect, it } from "vitest"
import type { SearchMatch } from "../src/search"
import { findActiveRange } from "../src/timeline/highlight"

function match(overrides: Partial<SearchMatch>): SearchMatch {
  return {
    partID: "message-1:text:0",
    messageID: "message-1",
    revealID: "message-1",
    scope: "assistant",
    term: "search",
    termIndex: 0,
    occurrence: 0,
    start: 0,
    end: 6,
    text: "search",
    order: 0,
    ...overrides,
  }
}

describe("findActiveRange", () => {
  it("finds the nth occurrence inside an assistant text part", () => {
    const part = document.createElement("div")
    part.setAttribute("data-timeline-part-id", "message-1:text:0")
    part.innerHTML = '<div data-slot="text-part-body">search once, search twice</div>'

    const range = findActiveRange(part, match({ occurrence: 1 }))

    expect(range?.toString()).toBe("search")
    expect(range?.startOffset).toBe(13)
  })

  it("ignores copy metadata", () => {
    const part = document.createElement("div")
    part.setAttribute("data-timeline-part-id", "message-1:text:0")
    part.innerHTML =
      '<div data-slot="text-part-body">search</div><div data-slot="text-part-meta">search</div>'

    const range = findActiveRange(part, match({ occurrence: 0 }))

    expect(range?.startContainer.parentElement?.getAttribute("data-slot")).toBe("text-part-body")
  })

  it("searches user message text only", () => {
    const part = document.createElement("div")
    part.setAttribute("data-timeline-part-id", "message-1:text:0")
    part.innerHTML =
      '<div data-slot="user-message-text">search</div><div data-slot="user-message-meta">search</div>'

    const range = findActiveRange(part, match({ scope: "user" }))

    expect(range?.startContainer.parentElement?.getAttribute("data-slot")).toBe("user-message-text")
  })

  it("returns undefined when the occurrence does not exist", () => {
    const part = document.createElement("div")
    part.setAttribute("data-timeline-part-id", "message-1:text:0")
    part.innerHTML = '<div data-slot="text-part-body">search</div>'

    expect(findActiveRange(part, match({ occurrence: 3 }))).toBeUndefined()
  })
})
