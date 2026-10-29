import { Command, Plugin, Slot, Style } from "@opencode/plugin/gui"
import { createEffect, on, onCleanup } from "solid-js"
import { render } from "solid-js/web"
import { createSearchController } from "./controller"
import { createTimelineFilter } from "./timeline/filter"
import { createTimelineHighlighter } from "./timeline/highlight"
import { cancelReveal, createRevealToken, revealMatch } from "./timeline/reveal"
import { HeaderSearch } from "./ui/header"
import { SearchPanel } from "./ui/panel"
import styles from "./ui/styles.css?inline"

export default Plugin.define({
  setup(ctx) {
    console.info(`[search-in-session] GUI setup in OpenCode ${ctx.app.version}`)
    ctx.add(Style, styles)

    const controller = createSearchController(ctx)

    ctx.add(Slot, {
      at: "session.header",
      order: 20,
      render: (input) => <HeaderSearch controller={controller} active={() => input.active} />,
    })

    ctx.add(Command, () => ({
      id: "find",
      title: controller.labels().commandTitle,
      description: controller.labels().commandDescription,
      group: controller.labels().commandGroup,
      keywords: "search find session 搜索 查找",
      section: "session" as const,
      bind: "mod+shift+f",
      run: () => {
        if (!controller.sessionKey()) return false
        controller.openPanel()
      },
    }))

    const filter = createTimelineFilter({
      enabled: controller.filter,
      matchedPartIDs: controller.partIDs,
      sessionKey: controller.sessionKey,
    })

    const highlighter = createTimelineHighlighter({
      enabled: controller.open,
      matches: controller.matches,
      active: controller.activeMatch,
      sessionKey: controller.sessionKey,
    })

    let reveal = createRevealToken()
    let lastRevealKey = ""
    let wasOpen = false

    createEffect(
      on(
        () =>
          [controller.open(), controller.activeMatch(), controller.sessionKey(), controller.filter()] as const,
        ([open, match, sessionKey, filtered]) => {
          cancelReveal(reveal)
          reveal = createRevealToken()

          if (!open || !match || !sessionKey) {
            wasOpen = false
            lastRevealKey = ""
            return
          }

          const key = `${sessionKey}|${match.partID}|${match.term}|${match.occurrence}|${filtered}`
          if (wasOpen && key === lastRevealKey) return

          wasOpen = true
          lastRevealKey = key

          const userMessageIDs = controller
            .messages()
            .filter((message) => message.type === "user")
            .map((message) => message.id)
          const targetUserID = match.revealID || match.messageID

          revealMatch(match, reveal, {
            userMessageIDs,
            targetUserID,
            targetUserIndex: userMessageIDs.indexOf(targetUserID),
          })

          // Expanding a folded part clicks a timeline control, which can move
          // focus off the input. Restore it without selecting the query.
          window.setTimeout(() => {
            if (controller.open()) controller.refocus()
          }, 200)
        },
        { defer: true },
      ),
    )

    const root = document.createElement("div")
    root.setAttribute("data-sis-ui", "root")
    document.body.append(root)

    const disposePanel = render(() => <SearchPanel ctx={ctx} controller={controller} />, root)

    const globalKeyHandler = "__sisSearchKeyHandler"
    const previousHandler = (globalThis as Record<string, unknown>)[globalKeyHandler] as
      | ((event: KeyboardEvent) => void)
      | undefined

    // A dev reload can replace the GUI bundle before the old owner's cleanup
    // runs. Remove the previous handler so only one instance answers a key.
    if (previousHandler) window.removeEventListener("keydown", previousHandler, { capture: true })

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (!controller.open() || event.isComposing || isDialogOpen()) return

        event.preventDefault()
        event.stopPropagation()
        controller.closePanel()
        return
      }

      if (
        controller.open() &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.shiftKey &&
        (event.key === "ArrowDown" || event.key === "ArrowUp") &&
        !isEditableTarget(event.target) &&
        !isInsidePanel(event.target) &&
        !isDialogOpen()
      ) {
        event.preventDefault()
        event.stopImmediatePropagation()
        controller.move(event.key === "ArrowDown" ? 1 : -1)
        controller.refocus()
        return
      }

      if (event.isComposing || event.repeat) return
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return
      if (event.key.toLowerCase() !== "f") return
      if (!controller.sessionKey() || isDialogOpen()) return

      // Another listener may have handled the key first, for example the
      // built-in session search after a dev reload changed listener order.
      // Our handler still runs; replace that UI with this plugin's panel.
      closeBuiltInSearch()
      event.preventDefault()
      event.stopImmediatePropagation()
      controller.togglePanel()
    }

    ;(globalThis as Record<string, unknown>)[globalKeyHandler] = onKeyDown
    window.addEventListener("keydown", onKeyDown, { capture: true })

    onCleanup(() => {
      window.removeEventListener("keydown", onKeyDown, { capture: true })
      if ((globalThis as Record<string, unknown>)[globalKeyHandler] === onKeyDown) {
        delete (globalThis as Record<string, unknown>)[globalKeyHandler]
      }
      cancelReveal(reveal)
      filter.dispose()
      highlighter.dispose()
      disposePanel()
      root.remove()
    })
  },
})

function closeBuiltInSearch(): void {
  const bar = document.querySelector<HTMLElement>('[data-component="timeline-search-bar"]')
  if (!bar) return

  const buttons = bar.querySelectorAll<HTMLButtonElement>("button")
  buttons[buttons.length - 1]?.click()
}

function isInsidePanel(target: EventTarget | null): boolean {
  return target instanceof Element && !!target.closest('[data-sis-ui="panel"]')
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false

  return (
    target.isContentEditable ||
    !!target.closest("input, textarea, select, [contenteditable='true']")
  )
}

function isDialogOpen(): boolean {
  const dialogs = document.querySelectorAll<HTMLElement>(
    '[data-component="dialog-overlay"], [role="dialog"][aria-modal="true"]',
  )

  return Array.from(dialogs).some((dialog) => {
    const rect = dialog.getBoundingClientRect()
    return rect.width > 0 && rect.height > 0
  })
}
