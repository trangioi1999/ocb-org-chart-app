# Dual Org Chart (OCB + Chi nhánh/PGD) — Design Spec

**Goal:** The app currently renders one org chart (OCB's HĐQT/Ban Kiểm soát/Ban điều hành). Add a second, independent org chart for the user's own branch/transaction-office network (1 Chi nhánh → several Phòng giao dịch → staff), switchable via two tabs in the header. Both charts must run correctly at the same time without one's search/state leaking into the other.

**Non-goals:** No routing (the `@angular/router` dependency stays unused, per existing project decision). No multi-branch hierarchy (exactly 1 chi nhánh with N PGDs, per user confirmation). No real branch data yet — this spec ships placeholder data the user will edit directly, the same pattern used for the original OCB executive data before it was replaced with the real dataset.

## Context: why `OrgChartComponent` needs to change

`OrgChartComponent` (`src/app/org-chart/org-chart.component.ts`) currently injects the app-wide singleton `OrgDataService` (`providedIn: 'root'`) and calls `orgDataService.search(term)` inside `highlight()` (line 106) to compute search matches — even though the component also receives its own `data` input and already searches that same input directly inside `handleCardKeydown` (line 164, `this.data().find(...)`).

This was flagged as a Minor finding in the final whole-branch review for the previous feature set ("Search reads a different data source than the component's own input") — harmless as long as there was exactly one `<app-org-chart>` bound to the one global service. It stops being harmless the moment a second `<app-org-chart>` instance exists: both instances share the same singleton `OrgDataService`, so `highlight()` in the branch-chart instance would search whichever dataset was most recently loaded into that shared service — not necessarily its own. This spec fixes that as part of adding the second chart, rather than working around it.

## Architecture

**Approach:** Make `OrgChartComponent` fully self-contained — it stops depending on `OrgDataService` entirely, and computes search matches from its own `data()` input using the same predicate that used to live in the service. Introduce a second, independent data-loading service (`BranchDataService`) that mirrors `OrgDataService`'s shape (own `data`/`status`/`isLoading`/`hasError`/`load()`) but loads a different JSON file. `OrgDataService.search()` is deleted (it becomes unused once `OrgChartComponent` stops calling it — verified no other caller exists).

This was chosen over two alternatives:
- **Generic service parameterized via Angular `InjectionToken`** (one class, two DI-configured instances) — more DRY, but adds DI indirection that's disproportionate for exactly 2 datasets. Revisit if a 3rd chart is ever added.
- **Route-based switching** (`/ocb`, `/chi-nhanh`) — rejected; user chose tab-based switching in the same page, no URL change.

**Data flow:** `App.ngOnInit()` calls `.load()` on both `OrgDataService` and `BranchDataService` in parallel at startup (not lazily on first tab visit) — both datasets are small, and eager-loading avoids a loading flash when the user switches tabs. `App` holds an `activeTab = signal<'ocb' | 'branch'>('ocb')`. Only the active tab's `<app-org-chart>` is in the DOM (`@if`/`@else`, not `hidden`) — switching tabs destroys the inactive chart's `OrgChart` instance (via `OrgChartComponent.ngOnDestroy`) and creates a fresh one when switched back. This means expand/collapse state is not preserved across tab switches — an accepted, explicit trade-off for simplicity (avoids running two live d3 instances, including two active `ResizeObserver`s, simultaneously).

## Components & files

**New files:**
- `public/data/branch-org.json` — placeholder data, 11 nodes: 1 Giám đốc chi nhánh → 3 Phòng giao dịch (each: 1 Trưởng PGD + 2 nhân viên). Shape: `OrgNode[]`, same interface already used by `org-chart.json`. Names are deliberately placeholder-obvious (e.g. `"Trưởng PGD Số 1"`, `"Nhân viên A - PGD Số 1"`) so the user can find-and-replace with real names later, mirroring how `[Dummy] ` prefixes worked before `isDummy` existed — except here we lean on obviously-fake names rather than a parseable marker, since there's no dummy-vs-real distinction needed within this single dataset (it's ALL placeholder for now).
- `src/app/services/branch-data.service.ts` — copy of `OrgDataService`'s shape minus `search()`: `data`, `status`, `isLoading`, `hasError`, `load()` (hits `'data/branch-org.json'`), `setData()` (for tests). `providedIn: 'root'` (safe now — no cross-talk risk, since nothing but `App` reads from it, and `OrgChartComponent` no longer injects any data service).
- `src/app/services/branch-data.service.spec.ts` — mirrors `org-data.service.spec.ts`'s test shape (idle state, successful load, error state); no `search()` tests since the method doesn't exist on this service.

**Modified files:**
- `src/app/org-chart/org-chart.component.ts`:
  - Remove `private readonly orgDataService = inject(OrgDataService);` and the `OrgDataService` import.
  - `highlight(term: string)` filters `this.data()` directly instead of calling `orgDataService.search(term)` — same predicate (case-insensitive substring match on `name` or `title`), just relocated:
    ```ts
    highlight(term: string): void {
      const keyword = term.trim().toLowerCase();
      const results = keyword
        ? this.data().filter(
            (node) =>
              node.name.toLowerCase().includes(keyword) || node.title.toLowerCase().includes(keyword)
          )
        : [];
      this.matches.set(results);
      this.matchIndex.set(0);
      this.highlightCurrentMatch();
    }
    ```
  - Add `readonly legendItems = input<LegendItem[]>(DEFAULT_LEGEND_ITEMS);` where `LegendItem = { tagClass: 'regular' | 'independent' | 'executive'; label: string }`. `DEFAULT_LEGEND_ITEMS` is the current hardcoded 3-entry OCB legend (HĐQT/Ban Kiểm soát, Thành viên độc lập, Ban điều hành), kept as the default so the OCB tab's binding can stay minimal. Type and default constant live in `org-chart.component.ts` (exported) so `App` can reference the `LegendItem` type when building the branch tab's legend array.
- `src/app/org-chart/org-chart.component.html`: replace the 3 hardcoded `<span class="legend-item">` entries with a single `@for (item of legendItems(); track item.tagClass) { <span class="legend-item" role="listitem"><i class="legend-dot legend-dot--{{ item.tagClass }}"></i>{{ item.label }}</span> }`.
- `src/app/org-chart/org-chart.component.spec.ts`: drop `provideHttpClient()`/`provideHttpClientTesting()` from every test's `TestBed.configureTestingModule` (no longer needed — the component has no HTTP-dependent injectable anymore), and drop the `TestBed.inject(OrgDataService).setData(...)` seeding calls that existed solely to work around the old service dependency (tests now just `setInput('data', NODES)` and call `highlight()` directly).
- `src/app/services/org-data.service.ts`: delete the `search()` method (dead code once `OrgChartComponent` stops calling it — confirmed no other caller via the codebase).
- `src/app/services/org-data.service.spec.ts`: delete the `search()` test case.
- `src/app/app.ts`:
  - Inject `BranchDataService` alongside `OrgDataService`.
  - Add `activeTab = signal<'ocb' | 'branch'>('ocb')`.
  - `ngOnInit()` calls `.load()` on both services.
  - No new convenience getters — the template references `orgDataService.data()` / `orgDataService.isLoading()` / `orgDataService.hasError()` directly for the OCB block, and `branchDataService.data()` / `branchDataService.isLoading()` / `branchDataService.hasError()` for the branch block (both services are `protected readonly` fields on `App`, same visibility pattern already used for `selectedNode`).
  - Define `BRANCH_LEGEND_ITEMS: LegendItem[]` (2 entries: `executive` → "Quản lý (GĐ chi nhánh/Trưởng PGD)", `regular` → "Nhân viên") as a local constant, imported `LegendItem` type from `org-chart.component.ts`.
- `src/app/app.html`: add the tab buttons in the header (see UI section below); duplicate the existing `@if (isLoading()) / @else if (hasError()) / @else { ... }` loading/error/content block per-tab (each tab's own service drives its own loading/error state) — the `@else` content block for the active tab renders `<app-org-chart [data]="...", [legendItems]="...">`.
- `src/app/app.spec.ts`: add tab-switching test coverage (see Testing section).

## UI

Header layout (mirrors the reference OCB page's own tab styling shown by the user):
```
Cơ cấu tổ chức                    [ Sơ đồ OCB ] [ Sơ đồ Chi nhánh/PGD ]
<subtitle text — changes per active tab>
```
- Page `<h1>` changes from "Sơ đồ tổ chức — Ngân hàng OCB" to "Cơ cấu tổ chức" (tab-agnostic heading, since it now covers 2 datasets).
- Subtitle: OCB tab keeps "Dữ liệu Hội đồng quản trị, Ban Kiểm soát và Ban điều hành lấy từ ocb.com.vn"; branch tab shows "Dữ liệu mẫu — chỉnh sửa tại `branch-org.json`".
- Tab buttons: plain `<button>` elements (no router), `[class.active]` bound to `activeTab() === 'ocb' | 'branch'`, `(click)="activeTab.set('ocb' | 'branch')"`. Styled consistently with existing toolbar button conventions (`.org-chart-toolbar button` styling in `org-chart.component.scss` — reuse the same blue/white color scheme, not a new palette).
- `role="tablist"` / `role="tab"` / `aria-selected` on the buttons for accessibility, consistent with the app's existing ARIA discipline (Task 7 in the prior plan).
- Detail panel: one shared `<app-detail-panel [node]="selectedNode()" ...>`, rendered once regardless of active tab, bound to a single `selectedNode` signal in `App`. Switching tabs while the panel is open does not explicitly close it (acceptable — the node shown is whatever was last clicked; if this reads as confusing in practice, closing the panel on tab switch is a 1-line follow-up, not blocking).

## Data model

No changes to `OrgNode` / `OrgNodeTag` (`src/app/models/org-node.model.ts`) — the branch dataset reuses the exact same shape. Tag usage for the branch dataset: `'executive'` for Giám đốc chi nhánh and each Trưởng PGD, `'regular'` for nhân viên. The `'independent'` tag is simply unused in this dataset (no code change needed to "disable" it — a tag that never appears in the data never renders).

## Testing

- `branch-data.service.spec.ts`: idle → loading → loaded via `HttpTestingController` hitting `'data/branch-org.json'`, plus an error-state test. Mirrors `org-data.service.spec.ts` structure minus the `search()` cases.
- `org-chart.component.spec.ts`: all existing tests updated to drop `HttpClient` test providers (component no longer needs them); `highlight()`/`matches()` tests continue to pass using only `setInput('data', ...)`, no service seeding. Add one test asserting `legendItems` input renders custom entries when provided (e.g. render with a 2-item branch-style legend array, assert the DOM shows exactly those 2 `.legend-item`s and not the OCB defaults).
- `org-data.service.spec.ts`: remove the `search()` test case; keep load/error/idle coverage as-is.
- `app.spec.ts`: add a test that clicking the "Sơ đồ Chi nhánh/PGD" tab swaps the rendered `<app-org-chart>`'s bound data from the OCB dataset to the branch dataset (flush both `HttpTestingController` requests, switch tabs, assert the chart re-initializes with branch data — e.g. by checking the legend now shows "Nhân viên" instead of "Thành viên độc lập").

## Edge cases

- **Both datasets fail to load:** each tab's loading/error UI is independent (mirrors today's single-tab behavior) — if OCB fails but branch succeeds, the user can still switch to the branch tab and see data; the OCB tab shows its own retry button.
- **Switching tabs mid-search:** each `OrgChartComponent` instance owns its own `matches`/`matchIndex` signals; since the inactive instance is destroyed on tab switch (per the `@if` design decision above), there's no stale search state to worry about — switching back to a tab always starts that chart fresh (search cleared, `initialExpandLevel(2)`).
- **Legend with only 1 tag present in data:** not a concern for the initial branch dataset (both `executive` and `regular` appear), but `legendItems` is caller-configured rather than data-scanned, so this is a non-issue by construction — the caller (`App`) decides what the legend shows, independent of what tags actually appear in the loaded data.
