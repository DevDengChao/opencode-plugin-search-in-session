import { describe, expect, it } from "vitest"
import type { SessionMessageInfo } from "@opencode/client/promise"
import { buildSearchParts } from "../src/search/parts"

describe("buildSearchParts", () => {
  it("maps user, assistant, reasoning, tool and shell content to timeline part ids", () => {
    const messages = [
      {
        id: "user-1",
        type: "user",
        text: "find this",
        time: { created: 1 },
      },
      {
        id: "assistant-1",
        type: "assistant",
        agent: "build",
        model: { providerID: "test", id: "test" },
        time: { created: 2 },
        content: [
          { type: "reasoning", text: "thinking about search" },
          { type: "text", text: "the search result" },
          {
            type: "tool",
            id: "tool-1",
            name: "grep",
            state: {
              status: "completed",
              input: { pattern: "search" },
              content: [{ type: "text", text: "found in file.ts" }],
            },
            time: { created: 3 },
          },
        ],
      },
      {
        id: "shell-1",
        type: "shell",
        shellID: "shell-1",
        command: "rg search",
        status: "exited",
        exit: 0,
        output: { output: "file.ts:1:search", cursor: 1, size: 1, truncated: false },
        time: { created: 4 },
      },
    ] as unknown as SessionMessageInfo[]

    const parts = buildSearchParts(messages)

    expect(parts.map((part) => [part.id, part.scope])).toEqual([
      ["user-1:text:0", "user"],
      ["assistant-1:reasoning:0", "reasoning"],
      ["assistant-1:text:0", "assistant"],
      ["tool-1", "tool-call"],
      ["tool-1", "tool-result"],
      ["shell-1", "shell"],
    ])

    expect(parts[0]!.revealID).toBe("user-1")
    expect(parts[1]!.revealID).toBe("user-1")
    expect(parts[3]!.text).toContain("grep")
    expect(parts[4]!.text).toContain("found in file.ts")
    expect(parts[5]!.revealID).toBe("shell-1")
  })

  it("skips empty content", () => {
    const messages = [
      { id: "user-1", type: "user", text: "   ", time: { created: 1 } },
      {
        id: "assistant-1",
        type: "assistant",
        agent: "build",
        model: { providerID: "test", id: "test" },
        time: { created: 2 },
        content: [{ type: "text", text: "" }],
      },
    ] as unknown as SessionMessageInfo[]

    expect(buildSearchParts(messages)).toEqual([])
  })
})
