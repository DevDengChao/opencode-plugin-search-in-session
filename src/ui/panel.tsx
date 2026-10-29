import { For, Show, createEffect, on } from "solid-js"
import type { Context } from "@opencode/plugin/gui"
import type { SearchController } from "../controller"
import { SEARCH_SCOPES, type SearchScope } from "../search"

export interface SearchPanelProps {
  ctx: Context
  controller: SearchController
}

export function SearchPanel(props: SearchPanelProps) {
  const c = props.controller
  let input: HTMLInputElement | undefined

  createEffect(
    on(
      () => c.focusTick(),
      () => {
        if (!c.open()) return

        requestAnimationFrame(() => {
          input?.focus({ preventScroll: true })
          if (c.focusSelect()) input?.select()
        })
      },
    ),
  )

  const count = () => {
    if (c.total() === 0) return "0/0"

    return c.labels().activeOf(c.activeIndex() + 1, c.total())
  }

  const onKeyDown = (event: KeyboardEvent & { currentTarget: HTMLElement }) => {
    if (event.defaultPrevented) return
    if (event.altKey || event.ctrlKey || event.metaKey) return

    if (event.key === "Escape") {
      event.preventDefault()
      c.closePanel()
      return
    }

    if (event.key === "ArrowDown" || (event.key === "Enter" && !event.isComposing)) {
      event.preventDefault()
      c.move(event.shiftKey ? -1 : 1)
      return
    }

    if (event.key === "ArrowUp") {
      event.preventDefault()
      c.move(-1)
    }
  }

  return (
    <div
      data-sis-ui="panel"
      class="sis-panel"
      classList={{ "sis-open": c.open() }}
      role="search"
      aria-label={c.labels().searchPlaceholder}
      aria-hidden={!c.open()}
      inert={!c.open()}
      onKeyDown={onKeyDown}
    >
      <div class="sis-top">
        <div class="sis-input-wrap">
          <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="7" cy="7" r="4.25" stroke="currentColor" stroke-width="1.3" />
            <path d="M10.2 10.2 13 13" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
          </svg>
          <input
            ref={input}
            class="sis-input"
            type="search"
            value={c.query()}
            placeholder={c.labels().searchPlaceholder}
            aria-label={c.labels().searchPlaceholder}
            autocomplete="off"
            spellcheck={false}
            onInput={(event) => c.setQuery(event.currentTarget.value)}
            onKeyDown={onKeyDown}
          />
          <span class="sis-count" classList={{ "sis-zero": c.total() === 0 }} aria-live="polite">
            {count()}
          </span>
        </div>

        <div class="sis-nav">
          <button
            type="button"
            class="sis-icon-button"
            title={c.labels().previous}
            aria-label={c.labels().previous}
            disabled={c.total() === 0}
            onClick={() => c.move(-1)}
          >
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3.5 10 8 5.5l4.5 4.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            class="sis-icon-button"
            title={c.labels().next}
            aria-label={c.labels().next}
            disabled={c.total() === 0}
            onClick={() => c.move(1)}
          >
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="m3.5 6 4.5 4.5L12.5 6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
          <span class="sis-divider" />
          <button
            type="button"
            class="sis-icon-button"
            title={c.labels().close}
            aria-label={c.labels().close}
            onClick={() => c.closePanel()}
          >
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
            </svg>
          </button>
        </div>
      </div>

      <div class="sis-scopes">
        <div class="sis-scope-title">{c.labels().scopeTitle}</div>
        <For each={SEARCH_SCOPES}>
          {(scope) => (
            <label class="sis-scope" data-scope={scope}>
              <input
                type="checkbox"
                checked={c.scopes()[scope]}
                onChange={(event) => c.setScope(scope, event.currentTarget.checked)}
              />
              <span class="sis-scope-dot" />
              <span class="sis-scope-label">{c.labels().scopes[scope]}</span>
              <span class="sis-scope-count">{c.labels().scopeCount(c.counts()[scope])}</span>
            </label>
          )}
        </For>
      </div>

      <Show when={c.loadingHistory() || c.historyError()}>
        <div class="sis-status" classList={{ "sis-status-error": !!c.historyError() }}>
          {c.historyError() ?? c.labels().loadingHistory}
        </div>
      </Show>

      <Show when={c.query().trim() && c.total() === 0}>
        <div class="sis-empty">
          <strong>{c.labels().emptyTitle}</strong>
          <span>{c.labels().emptyHint}</span>
        </div>
      </Show>

      <div class="sis-footer">
        <label class="sis-switch-row" title={c.labels().filterHint}>
          <input
            type="checkbox"
            checked={c.filter()}
            disabled={!c.query().trim()}
            onChange={(event) => c.setFilter(event.currentTarget.checked)}
          />
          <span class="sis-switch-track" />
          <span>{c.labels().filterOnly}</span>
        </label>
        <span class="sis-meta">
          {c.labels().matches(c.total())} · {c.labels().parts(c.partCount())}
        </span>
      </div>

      <div class="sis-footnote">
        <span>
          <kbd>↑</kbd>
          <kbd>↓</kbd> {c.labels().previous}/{c.labels().next}
        </span>
        <span>
          <kbd>Enter</kbd> {c.labels().next}
        </span>
        <span>
          <kbd>Esc</kbd> {c.labels().close}
        </span>
        <span>{c.labels().spaceHint}</span>
      </div>
    </div>
  )
}
