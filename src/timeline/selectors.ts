export const TIMELINE_SCROLL_SELECTOR = '[data-slot="session-timeline-scroll"]'
export const TIMELINE_VIEWPORT_SELECTOR = ":scope > .scroll-view__viewport"
export const TIMELINE_CONTENT_SELECTOR = "[data-timeline-virtual-content]"
export const TIMELINE_ROW_SELECTOR = "[data-timeline-virtual-content] [data-index]"
export const TIMELINE_KEY_SELECTOR = "[data-timeline-key]"
export const OWN_UI_ATTRIBUTE = "data-sis-ui"

export function findActiveTimelineRoot(): HTMLElement | undefined {
  const candidates = Array.from(document.querySelectorAll<HTMLElement>(TIMELINE_SCROLL_SELECTOR))

  return candidates.find((element) => {
    if (!element.isConnected || element.closest("[inert]")) return false

    const rect = element.getBoundingClientRect()
    return rect.width > 0 && rect.height > 0
  })
}

export function timelineViewport(root: HTMLElement): HTMLElement {
  return root.querySelector<HTMLElement>(TIMELINE_VIEWPORT_SELECTOR) ?? root
}

export function findPartElement(root: ParentNode, partID: string): HTMLElement | undefined {
  return root.querySelector<HTMLElement>(`[data-timeline-part-id="${CSS.escape(partID)}"]`) ?? undefined
}

export function findGroupElement(root: ParentNode, partID: string): HTMLElement | undefined {
  const groups = root.querySelectorAll<HTMLElement>("[data-timeline-part-ids]")

  for (const group of groups) {
    const ids = (group.getAttribute("data-timeline-part-ids") ?? "").split(",")
    if (ids.some((id) => id.trim() === partID)) return group
  }

  return undefined
}

export function rowPartIDs(row: HTMLElement): Set<string> {
  const ids = new Set<string>()
  collect(row)

  return ids

  function collect(element: HTMLElement): void {
    const partID = element.getAttribute("data-timeline-part-id")
    if (partID) ids.add(partID)

    const partIDs = element.getAttribute("data-timeline-part-ids")
    if (partIDs) {
      for (const id of partIDs.split(",")) {
        const value = id.trim()
        if (value) ids.add(value)
      }
    }

    for (const child of element.querySelectorAll<HTMLElement>("[data-timeline-part-id], [data-timeline-part-ids]")) {
      const childPartID = child.getAttribute("data-timeline-part-id")
      if (childPartID) ids.add(childPartID)

      const childPartIDs = child.getAttribute("data-timeline-part-ids")
      if (childPartIDs) {
        for (const id of childPartIDs.split(",")) {
          const value = id.trim()
          if (value) ids.add(value)
        }
      }
    }
  }
}

export function isOwnUI(node: Node | null): boolean {
  if (!node) return false
  if (node instanceof Element) return node.closest(`[${OWN_UI_ATTRIBUTE}]`) !== null
  if (node instanceof Text) return node.parentElement?.closest(`[${OWN_UI_ATTRIBUTE}]`) !== null
  return false
}

export function isOwnMutation(record: MutationRecord): boolean {
  if (isOwnUI(record.target)) return true
  if (record.type !== "childList") return false

  const nodes = [...record.addedNodes, ...record.removedNodes]
  return nodes.length > 0 && nodes.every(isOwnUI)
}
