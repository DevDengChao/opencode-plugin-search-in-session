import type {
  SessionMessageAssistant,
  SessionMessageAssistantTool,
  SessionMessageInfo,
  SessionMessageShell,
} from "@opencode/client/promise"
import type { SearchPart } from "./types"

const MAX_TEXT = 400_000
const MAX_JSON_STRING = 20_000

/**
 * Turns the session's raw messages into searchable part records. Part ids match
 * the ids the timeline renders as `data-timeline-part-id`, so a hit can be
 * highlighted and revealed without replacing the transcript.
 */
export function buildSearchParts(messages: readonly SessionMessageInfo[]): SearchPart[] {
  const parts: SearchPart[] = []
  let revealID = ""
  let order = 0

  const add = (input: Omit<SearchPart, "revealID" | "order"> & { revealID?: string }) => {
    const text = input.text.trim()
    if (!text) return

    parts.push({
      ...input,
      text: truncate(text, MAX_TEXT),
      revealID: input.revealID ?? revealID,
      order: order++,
    })
  }

  for (const message of messages) {
    if (message.type === "user") {
      revealID = message.id
      add({
        id: `${message.id}:text:0`,
        messageID: message.id,
        scope: "user",
        text: message.text,
      })
      continue
    }

    if (message.type === "shell") {
      revealID = message.id
      add({
        id: message.id,
        messageID: message.id,
        scope: "shell",
        text: shellText(message),
        label: message.command,
      })
      continue
    }

    if (message.type !== "assistant") continue

    let textOrdinal = 0
    let reasoningOrdinal = 0

    for (const content of message.content) {
      if (content.type === "text") {
        add({
          id: `${message.id}:text:${textOrdinal++}`,
          messageID: message.id,
          scope: "assistant",
          text: content.text,
        })
        continue
      }

      if (content.type === "reasoning") {
        add({
          id: `${message.id}:reasoning:${reasoningOrdinal++}`,
          messageID: message.id,
          scope: "reasoning",
          text: content.text,
        })
        continue
      }

      if (content.type !== "tool") continue

      add({
        id: content.id,
        messageID: message.id,
        scope: "tool-call",
        text: toolCallText(content),
        label: content.name,
      })

      add({
        id: content.id,
        messageID: message.id,
        scope: "tool-result",
        text: toolResultText(content),
        label: content.name,
      })
    }
  }

  return parts
}

function shellText(message: SessionMessageShell): string {
  const output = message.output?.output ?? ""

  return [message.command, output].filter(Boolean).join("\n")
}

function toolCallText(tool: SessionMessageAssistantTool): string {
  const input = tool.state.input

  return [tool.name, typeof input === "string" ? input : safeJson(input)].filter(Boolean).join("\n")
}

function toolResultText(tool: SessionMessageAssistantTool): string {
  const state = tool.state
  const result: string[] = []

  if (state.status === "completed" || state.status === "error") {
    for (const content of state.content ?? []) {
      if (content.type === "text") {
        result.push(content.text)
        continue
      }

      if (content.type === "file") {
        if (content.name) result.push(content.name)
        if (content.uri && !content.uri.startsWith("data:")) result.push(content.uri)
      }
    }
  }

  if (state.status === "error") {
    result.push(state.error.message)

    if (state.error.response?.body) result.push(state.error.response.body)
  }

  return truncate(result.filter(Boolean).join("\n"), MAX_TEXT)
}

function safeJson(value: unknown): string {
  if (value === undefined || value === null) return ""

  const seen = new WeakSet<object>()

  try {
    return JSON.stringify(value, (_key, item) => {
      if (typeof item === "string") {
        if (item.startsWith("data:")) return "[data]"
        return item.length > MAX_JSON_STRING ? `${item.slice(0, MAX_JSON_STRING)}…` : item
      }

      if (item && typeof item === "object") {
        if (seen.has(item)) return "[circular]"
        seen.add(item)
      }

      return item
    })
  } catch {
    return String(value)
  }
}

function truncate(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value
}

export function assistantContentID(
  message: SessionMessageAssistant,
  content: SessionMessageAssistant["content"][number],
  ordinals: { text: number; reasoning: number },
): string {
  return content.type === "tool"
    ? content.id
    : `${message.id}:${content.type}:${ordinals[content.type]++}`
}
