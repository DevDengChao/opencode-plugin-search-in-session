import { describe, expect, it } from "vitest"
import { rowMatches } from "../src/timeline/filter"

function row(html: string): HTMLElement {
  const element = document.createElement("div")
  element.setAttribute("data-index", "0")
  element.innerHTML = html
  return element
}

describe("rowMatches", () => {
  it("keeps a row whose part id matches", () => {
    const element = row('<div data-timeline-part-id="part-1">search</div>')

    expect(rowMatches(element, new Set(["part-1"]))).toBe(true)
    expect(rowMatches(element, new Set(["part-2"]))).toBe(false)
  })

  it("keeps a tool group when any grouped part matches", () => {
    const element = row('<div data-timeline-part-ids="part-1,part-2"></div>')

    expect(rowMatches(element, new Set(["part-2"]))).toBe(true)
  })

  it("matches the row element itself too", () => {
    const element = row("")
    element.setAttribute("data-timeline-part-id", "part-1")

    expect(rowMatches(element, new Set(["part-1"]))).toBe(true)
  })

  it("hides rows without part ids", () => {
    expect(rowMatches(row('<div data-timeline-row="TurnGap"></div>'), new Set(["part-1"]))).toBe(false)
  })
})
