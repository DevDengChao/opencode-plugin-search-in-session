import type { ParsedQuery } from "./types"

/**
 * Parses the search box.
 *
 * - Whitespace separates terms; a part must contain every positive term.
 * - Double quotes keep a phrase together: `"tool output"`.
 * - A leading `-` excludes a term: `search -reasoning`.
 * - A backslash escapes the next character, including a quote.
 */
export function parseQuery(value: string): ParsedQuery {
  const tokens: string[] = []
  let current = ""
  let quote = false
  let escaped = false

  for (const char of value) {
    if (escaped) {
      current += char
      escaped = false
      continue
    }

    if (char === "\\") {
      escaped = true
      continue
    }

    if (char === '"') {
      quote = !quote
      continue
    }

    if (!quote && /\s/.test(char)) {
      if (current) {
        tokens.push(current)
        current = ""
      }
      continue
    }

    current += char
  }

  if (escaped) current += "\\"
  if (current) tokens.push(current)

  const positive: string[] = []
  const negative: string[] = []

  for (const token of tokens) {
    if (!token) continue

    if (token.startsWith("-") && token.length > 1) {
      pushUnique(negative, token.slice(1))
    } else {
      pushUnique(positive, token)
    }
  }

  return { positive, negative }
}

function pushUnique(list: string[], value: string): void {
  const lower = value.toLowerCase()

  if (!list.some((item) => item.toLowerCase() === lower)) list.push(value)
}
