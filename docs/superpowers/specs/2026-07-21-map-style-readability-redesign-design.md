# OCB Org Chart — Map-Style Full-Screen Layout + Readability Redesign

**Goal:** Make the org chart legible and usable at scale — no clipped text, bigger/clearer cards, an automatic space-efficient grid for large sibling groups (some nodes have 15–22 children), a full-screen "Google Maps"–style app shell (floating controls instead of a header/toolbar bar), and layout/fit that keeps itself correct after every user action (click a node, expand/collapse, expand-all).

**Non-goal:** No changes to `org-chart.json` / `branch-org.json` content (data is correct as-is). No changes to the untracked `branch-data.service.ts` — it isn't wired into the UI and stays out of scope. No backend/API work.

## 1. Card content & typography

- Drop the circular avatar/initials (`.org-card__avatar` and the `initials()` / `khoi-*` badge-number logic) from the card renderer. Name, title, department remain.
- Card width stays fixed (~280–300px, up from 260px). Height becomes **auto**: no more `white-space: nowrap` / `text-overflow: ellipsis` on `.org-card__name` / `.org-card__title` — text wraps.
- `.org-card__name` renders uppercase, bold, ~15–16px (up from 13px); `.org-card__title`/`.org-card__dept` bump to ~13px/12px.
- `nodeHeight()` (currently a constant `118`) becomes a function of content: estimate wrapped line count for name/title/department against the fixed card width and font metrics, return `basePadding + lines * lineHeight`. This is a small pure function (`estimateCardHeight(node): number`), unit-testable independent of the D3 wrapper.

## 2. Full-screen "Google Maps"–style app shell

- Remove `app.html`'s `<header>` (title, subtitle, gradient bar) entirely. `<app-org-chart>` fills the whole viewport; no more flex column squeeze from a docked detail panel.
- Loading/error states (`isLoading()` / `hasError()`) render as a centered overlay message floating on top of the (empty) canvas, not a full-page block replacing it.
- Toolbar restructure in `OrgChartComponent`:
  - **Top-right:** two floating icon buttons — legend toggle, search toggle — no background bar behind them, just icons floating over the canvas.
    - Legend toggle opens/closes a floating panel near that corner with the existing color-group + line-style legend items. Starts collapsed on load.
    - Search toggle opens/closes a search bar that appears **horizontally centered**, floating near the top of the screen, containing the existing text input + match counter + prev/next buttons. Esc key or the close icon collapses it back to icon-only.
  - **Bottom-right:** unchanged — existing vertical icon strip (expand all, collapse all, fit, zoom in, zoom out, toggle direction, export image) stays exactly where it is.
- Detail panel (`DetailPanelComponent`, shown on node click) becomes a floating overlay card (fixed position, right side, shadow, rounded corners, own scroll region) instead of a docked flex column that shrinks the chart. Same content and actions as today (view/add/edit/delete forms) — only the CSS positioning changes, no template logic changes.

## 3. Automatic grid packing for large sibling groups

- Remove the current per-node monkey-patched "single column" compact logic (`applySingleColumnCompact`'s hard-coded 1-column path) and the manual `childrenLayout: 'row' | 'column'` toggle it depends on.
- Replace with a generalized N-column grid, applied automatically to any node's leaf children once the count exceeds a threshold (~4):
  - `columns = min(maxColumns, ceil(sqrt(leafCount)))`, with `maxColumns` capped around 4–5 so groups don't sprawl too wide (e.g. the 22-child `tgd` node and 15-child `khoi-01` node both get a squarish grid instead of one long row or one tall column).
  - Leaves fill column-major, top-to-bottom, reusing the existing rail-line visual (link line runs along the left edge of the group).
  - Groups at or below the threshold keep the current horizontal row layout — no grid overhead for small groups.
  - The column-count math (`leafCount → columns`) is a small pure function, unit-testable independent of the D3 patch wiring.
- UI cleanup that follows from removing the per-node toggle:
  - `DetailPanelComponent`: remove the `▭ Ngang / ▯ Dọc` buttons and the `detail-panel__layout` block.
  - `app.ts`: remove `onChildrenLayoutChanged` and the `(childrenLayoutChanged)` binding.
  - `OrgDataService.updateNode`: drop `childrenLayout` from the updatable-fields type.
  - `OrgNode.childrenLayout` field itself, and its 16 existing values in `org-chart.json`, are left in place untouched (point 5) — simply no longer read by the component.

## 4. Fit-with-zoom-floor + re-fit triggers

- `fit()` today always zooms out enough to contain the entire visible tree — this is what makes expand-all illegible (larger cards + more grid rows means more zoom-out, canceling out any font-size gain since the whole card scales with the SVG transform).
- Wrap `fit()` calls with a zoom-floor: after fitting, read the resulting scale (via the chart's internal zoom transform / `getChartState()`, same pattern already used for the compact patch) and if it's below a tuned minimum, re-apply the transform at that minimum scale instead. If the full tree doesn't fit at the floor, the user pans/scrolls to see the rest rather than the whole tree shrinking further.
- Re-fit trigger rules:
  - Toolbar-level actions (Expand all, Collapse all, node selection/focus mode via the existing `effect()`, search jump-to-match) call `.fit()` after re-rendering — same as today.
  - Per-node expand/collapse (the small chevron under a card) does **not** auto-fit — it only re-renders the layout around that node, preserving the user's current pan/zoom. This requires wiring up d3-org-chart's `onExpandOrCollapse` callback (currently unused) to call `render()` without `fit()`.

## Testing

- New pure functions (`estimateCardHeight`, grid column-count calculation) get unit tests independent of the D3 wrapper — the wrapper itself (`OrgChartComponent`) has no spec today (thin D3 integration shell) and that stays true, but the logic feeding it is now testable.
- `app.spec.ts`: remove/update the `onChildrenLayoutChanged` test case.
- `org-data.service.spec.ts`: remove/update the `childrenLayout` update-path test case.
- Manual verification: run the dev server, confirm — cards show full text with no clipping at default zoom; a large group (e.g. `tgd`, 22 children) renders as a grid, not a single sprawling row/column; expand-all stays legible (zoom floor holds) with pan available; clicking a single node's expand chevron doesn't jump the viewport; toolbar/legend/search float correctly at their corners with no docked header or side panel.
