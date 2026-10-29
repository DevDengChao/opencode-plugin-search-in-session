import type { SearchScope } from "./search"

export interface Labels {
  commandTitle: string
  commandDescription: string
  commandGroup: string
  searchPlaceholder: string
  scopeTitle: string
  scopes: Record<SearchScope, string>
  filterOnly: string
  filterHint: string
  filtering: string
  clearFilter: string
  previous: string
  next: string
  close: string
  openSearch: string
  emptyTitle: string
  emptyHint: string
  loadingHistory: string
  historyError: string
  matches: (total: number) => string
  parts: (count: number) => string
  activeOf: (active: number, total: number) => string
  scopeCount: (count: number) => string
  spaceHint: string
}

const zh: Labels = {
  commandTitle: "在会话中搜索",
  commandDescription: "按用户、回复、思考、工具调用和结果搜索当前会话",
  commandGroup: "会话",
  searchPlaceholder: "在会话中搜索…",
  scopeTitle: "搜索范围",
  scopes: {
    user: "用户输入",
    assistant: "助手回复",
    reasoning: "思考过程",
    "tool-call": "工具调用",
    "tool-result": "工具结果",
    shell: "终端命令",
  },
  filterOnly: "仅显示匹配内容",
  filterHint: "隐藏不相关的行，缩小滚动范围",
  filtering: "筛选中",
  clearFilter: "清除筛选",
  previous: "上一个",
  next: "下一个",
  close: "关闭",
  openSearch: "在会话中搜索 (Ctrl+F)",
  emptyTitle: "没有匹配的内容",
  emptyHint: "试试更短的关键词，或调整搜索范围。",
  loadingHistory: "正在加载完整历史…",
  historyError: "历史加载失败，仅搜索已加载的消息",
  matches: (total) => `${total} 处命中`,
  parts: (count) => `${count} 个片段`,
  activeOf: (active, total) => `${active}/${total}`,
  scopeCount: (count) => String(count),
  spaceHint: "空格分隔关键词",
}

const en: Labels = {
  commandTitle: "Search in session",
  commandDescription: "Search user, replies, reasoning, tool calls and tool results",
  commandGroup: "Session",
  searchPlaceholder: "Search in session…",
  scopeTitle: "Search in",
  scopes: {
    user: "User",
    assistant: "Assistant",
    reasoning: "Reasoning",
    "tool-call": "Tool calls",
    "tool-result": "Tool results",
    shell: "Shell",
  },
  filterOnly: "Only show matches",
  filterHint: "Hide unrelated rows and shorten the scroll range",
  filtering: "Filtering",
  clearFilter: "Clear filter",
  previous: "Previous",
  next: "Next",
  close: "Close",
  openSearch: "Search in session (Ctrl+F)",
  emptyTitle: "No matches",
  emptyHint: "Try a shorter keyword, or change the search scope.",
  loadingHistory: "Loading full history…",
  historyError: "Could not load full history; searching loaded messages",
  matches: (total) => `${total} ${total === 1 ? "match" : "matches"}`,
  parts: (count) => `${count} ${count === 1 ? "part" : "parts"}`,
  activeOf: (active, total) => `${active}/${total}`,
  scopeCount: (count) => String(count),
  spaceHint: "Space separates keywords",
}

export function labelsFor(locale: string): Labels {
  return locale.toLowerCase().startsWith("zh") ? zh : en
}
