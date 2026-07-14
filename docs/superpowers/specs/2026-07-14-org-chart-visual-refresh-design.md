# OCB Org Chart Visual Refresh + Governance Sub-units — Design Spec

**Goal:** Three focused frontend improvements to the OCB org chart (single-chart app, no backend): (1) restyle the app around OCB's real brand colors sampled from the source org chart image, (2) turn the "Các cơ quan trực thuộc HĐQT/TGĐ" placeholder-note nodes into real child tree nodes, (3) surface each node's direct children (names only) in the detail panel so users get context without cluttering the chart itself.

**Non-goal (explicitly deferred to a separate spec):** CRUD editing with a Node.js backend server, JSON import, and persistence. This requires its own architecture decisions (hosting — GitHub Pages only serves static files — storage, auth) and is out of scope here.

## 1. Brand color refresh

Colors sampled directly from the user's source image (`/Users/trangioi/.claude/image-cache/4a9720e0-424a-462b-8e8b-468bcd0ce2ae/1.png`): the header's double-chevron icon uses `#07753C` (green) and `#C57622` (orange/amber); the org chart boxes fill with `#007F42` (green).

- New palette: primary green `#00793D` (buttons, header, `--executive` tag), accent amber `#C57622` (hover/highlight states), replacing the current blue (`#0b5fa5` toolbar/regular) and navy (`#0b3d68` executive) palette.
- `org-chart.component.scss`: `.icon-btn` border/color/hover switches from blue to green primary with amber hover accent. `.org-card--executive` switches from navy to green. `.legend-dot--executive`/`--regular` updated to match.
- `app.html`/`app.scss` (or wherever the header lives): header background becomes a green gradient; keep the existing "»" chevron glyph before the `<h1>` text (matches the source image's icon), just recolored.
- No new hero/stats content — "hoành tráng hơn" comes from correct brand color + gradient/shadow polish, not fabricated numbers.

## 2. "Các cơ quan trực thuộc" become real child nodes

Remove the `note` field from `cqt-hdqt` and `cqt-tgd` in `org-chart.json`; add real child `OrgNode`s instead (same shape as the 16 khối leaves, `tag: 'regular'`, empty `title`):

- Under `cqt-hdqt`: Ủy ban Nhân sự, Ủy ban Quản lý rủi ro, Ủy ban XLRR, Ban Chiến lược, Ban Hợp tác chiến lược, Ban PTBV (6 nodes).
- Under `cqt-tgd`: Hội đồng xét duyệt sản phẩm, Hội đồng rủi ro, Hội đồng quản lý vốn, Hội đồng ALCO, Hội đồng tín dụng, Hội đồng cơ cấu nợ, Hội đồng mua bán nợ, Hội đồng nhân sự, Phòng Quản lý chuyển đổi (9 nodes).

No component code changes needed for this — `OrgChartComponent` already renders any node in `data()` given `parentId`; the numbered-badge regex only matches `khoi-*` ids so these new nodes get the default initials avatar, which is correct (they aren't part of the 16 khối).

## 3. Detail panel shows direct children (names only)

- `App` (`app.ts`): add `protected readonly selectedChildren = computed(() => { const n = this.selectedNode(); return n ? this.orgData().filter((x) => x.parentId === n.id) : []; });`
- `app.html`: pass `[children]="selectedChildren()"` to `<app-detail-panel>`.
- `DetailPanelComponent`: add `readonly children = input<OrgNode[]>([]);`; template adds a `@if (children().length)` block rendering a `<ul>` of child names (reuse `.detail-panel__members`-style list, new class `.detail-panel__children` for a distinct heading "Đơn vị trực thuộc:").
- This is purely additive to the existing panel — no chart-side changes, so the chart itself doesn't get more crowded (the user's explicit concern).

## Testing

- `org-chart.component.spec.ts`: no new cases needed (existing badge/title tests already cover rendering of arbitrary nodes; color changes aren't asserted in unit tests, verified visually).
- `detail-panel.component.spec.ts`: add a case asserting the children list renders names when `children` input is non-empty, and is absent when empty.
- `app.spec.ts`: add a case asserting `selectedChildren` computes the right filtered set when a node is selected.
- Manual verification: run dev server, click through a few nodes (HĐQT, one khối, one new committee node) to confirm detail panel and colors visually.

## Deployment

After implementation, tests, and build pass: commit, push to `main`, then rebuild with `--base-href /ocb-org-chart-app/` and redeploy to the `gh-pages` branch via `ngh`, same as the previous deploy.
