# OpenCode Search in Session

Search the current OpenCode Desktop session with scoped filters, hit counts, keyboard navigation, highlighting, and a "show only matches" mode.

OpenCode Desktop 2.2.x ships a built-in Ctrl+F search, but it only scans user and assistant text. This plugin is the enhanced version:

- Search user messages, assistant replies, reasoning, tool calls, tool results, and shell commands
- Space-separated multi-keyword search, quoted phrases, and exclusions
- Per-scope hit counts and checkboxes
- CSS Custom Highlight API highlighting
- Up/down and Enter navigation between hits
- Hide unrelated rows to shorten the virtual timeline
- Keep the filter after closing the panel, with a header chip to reopen or clear it
- Load the full session history when the search opens

## Preview

<p align="center">
  <img src="https://raw.githubusercontent.com/DevDengChao/opencode-plugin-search-in-session/main/docs/preview.jpg" alt="Searching github in an OpenCode session with 193 hits" width="900">
</p>

<p align="center">
  <sub>Searching <code>github</code>: 193 hits across 33 parts, broken down by user, assistant, reasoning, tool call and tool result scopes.</sub>
</p>

An interactive preview is also available at [docs/preview.html](./docs/preview.html).

## Install

Requires OpenCode Desktop **2.2.x**.

From source:

```bash
git clone git@github.com:DevDengChao/opencode-plugin-search-in-session.git
cd opencode-plugin-search-in-session
npm install
npm run build
```

Then add the local plugin to `~/.config/opencode/opencode.jsonc`:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    "file:///E:/my/open-source/opencode-plugin-search-in-session"
  ]
}
```

When published, the package name is:

```jsonc
"plugins": [
  "@devdengchao/opencode-plugin-search-in-session"
]
```

## Usage

1. Open a session.
2. Press `Ctrl+F` (`Cmd+F` on macOS) to open the panel; the input is focused automatically. Press it again to close the panel.
3. Type a query. The panel shows the current hit and the total, plus per-scope counts.
4. Use `↑` / `↓`, Enter, Shift+Enter, or the panel buttons to move between hits.
5. Uncheck scopes to narrow the search.
6. Turn on **Only show matches** to keep only rows that contain a hit.
7. Press Esc to close. If filtering stays on, the header shows a `Filtering … ×` chip; click it to reopen, or × to clear.

### Query syntax

| Query | Meaning |
| --- | --- |
| `search plugin` | The same part must contain both terms |
| `"tool output"` | Exact phrase |
| `search -reasoning` | Exclude parts containing `reasoning` |
| `"foo \"bar\""` | Escaped quote inside a phrase |

Matching is case-insensitive. Multiple positive terms are ANDed; excluded terms are not counted.

### Scopes

- User
- Assistant
- Reasoning
- Tool calls (name and input)
- Tool results (text output, file names, errors)
- Shell (command and output)

## Built-in Ctrl+F

The plugin listens for `Ctrl+F` in the window capture phase, opens its own panel first, and closes an already-open built-in search bar. This replaces the built-in behavior without patching OpenCode.

A normal command, **Search in session**, is also registered with `mod+shift+f`; it can be changed in **Settings > Shortcuts** and run from the command palette. Ctrl+F remains a fixed alias so the command does not create a duplicate shortcut conflict in Settings.

## How it works

- The index comes from `session.server.data.session.message.list(session.id)`, not from the current DOM, so virtualized rows still count.
- A hit is mapped to a timeline part id; collapsed tool groups are expanded before scrolling to the part.
- User, assistant, and reasoning text are highlighted with Range + CSS Custom Highlight API.
- Tool results the UI never renders (for example a webfetch body) still count and navigate to the tool call; the part is outlined as a visual target.
- Filter mode marks non-matching virtual rows with `data-sis-hidden`; TanStack Virtual's ResizeObserver measures them to zero and compacts the scroll range.
- Auto-follow is paused with a synthetic upward wheel event, so search navigation is not pulled back to the bottom.

## Development

```bash
npm install
npm run typecheck
npm test
npm run build
npm run dev
```

Desktop watches `dist/gui.cjs` and reloads the GUI part.

## Known limits

- Depends on the current OpenCode Desktop timeline DOM; a Desktop upgrade may need selector updates.
- Tool results that the UI does not render cannot be text-highlighted; the tool call is outlined instead and navigates as a single stop, so a webfetch body does not trap you in thousands of invisible hits.
- At most 25,000 navigable hits are retained per query; counts remain complete.
- Filter range compaction depends on virtual row measurement and settles progressively.
- The full history is loaded when searching; very large sessions can take a few seconds.
- TUI is not supported.

## License

[MIT](./LICENSE) © 2026 DevDengChao
