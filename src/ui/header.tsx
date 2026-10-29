import { Show, type Accessor } from "solid-js"
import type { SearchController } from "../controller"

export interface HeaderSearchProps {
  controller: SearchController
  active: Accessor<boolean>
}

export function HeaderSearch(props: HeaderSearchProps) {
  const c = props.controller

  return (
    <Show when={props.active()}>
      <div data-sis-ui="header" class="sis-header-actions">
        <Show when={c.filter()}>
          <div class="sis-chip">
            <button type="button" class="sis-chip-main" onClick={() => c.openPanel()}>
              <span class="sis-chip-label">{c.labels().filtering}</span>
              <span class="sis-chip-query">{c.query()}</span>
              <span class="sis-chip-count">· {c.partCount()}</span>
            </button>
            <button
              type="button"
              class="sis-chip-clear"
              title={c.labels().clearFilter}
              aria-label={c.labels().clearFilter}
              onClick={() => c.clearFilter()}
            >
              <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
              </svg>
            </button>
          </div>
        </Show>

        <button
          type="button"
          class="sis-header-search"
          title={c.labels().openSearch}
          aria-label={c.labels().openSearch}
          onClick={() => c.togglePanel()}
        >
          <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="7" cy="7" r="4.25" stroke="currentColor" stroke-width="1.3" />
            <path d="M10.2 10.2 13 13" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
          </svg>
        </button>
      </div>
    </Show>
  )
}
