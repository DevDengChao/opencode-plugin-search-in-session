import { describe, expect, it } from "vitest"
import { parseQuery } from "../src/search/tokenize"

describe("parseQuery", () => {
  it("splits words on whitespace", () => {
    expect(parseQuery("search plugin")).toEqual({ positive: ["search", "plugin"], negative: [] })
  })

  it("keeps quoted phrases together", () => {
    expect(parseQuery('"tool output" search')).toEqual({ positive: ["tool output", "search"], negative: [] })
  })

  it("extracts negative terms", () => {
    expect(parseQuery("search -reasoning -\"tool output\"")).toEqual({
      positive: ["search"],
      negative: ["reasoning", "tool output"],
    })
  })

  it("ignores empty input and duplicate terms", () => {
    expect(parseQuery("   ")).toEqual({ positive: [], negative: [] })
    expect(parseQuery("Search search SEARCH")).toEqual({ positive: ["Search"], negative: [] })
  })

  it("supports escaped quotes inside a phrase", () => {
    expect(parseQuery('"say \\"hi\\""')).toEqual({ positive: ['say "hi"'], negative: [] })
  })

  it("treats a lone dash as a normal term", () => {
    expect(parseQuery("-")).toEqual({ positive: ["-"], negative: [] })
  })
})
