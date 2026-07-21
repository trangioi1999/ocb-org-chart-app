# Map-Style Readability Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the OCB org chart legible at scale — auto-height cards with no clipped text, an automatic grid layout for large sibling groups, a full-screen "Google Maps"-style shell with floating controls, and fit/zoom behavior that stays correct after every user action.

**Architecture:** All changes are frontend-only inside the existing Angular 21 standalone-component app. New pure math (card height estimation, grid column count) lives in a new `chart-layout.utils.ts` so it's unit-testable without touching the D3 wrapper. The D3 wrapper (`OrgChartComponent`) gets its card renderer, its compact-layout monkey-patch, and its fit/zoom logic updated. The app shell (`App`) drops its header and lets the chart go full-bleed; the detail panel becomes a floating overlay instead of a docked flex column.

**Tech Stack:** Angular 21 (standalone components, signals), `d3-org-chart` 3.1.1 (patched via its internal `getChartState()`, same pattern already used in the codebase), Vitest (`ng test`) for units.

## Global Constraints

- Card width fixed at 288px; height is auto (no `text-overflow: ellipsis` / `white-space: nowrap` on card text anywhere).
- Leaf-sibling groups grid-pack once `leafCount > 4`; column count = `min(4, ceil(sqrt(leafCount)))`.
- `fit()` never zooms below scale `0.55` (`MIN_FIT_SCALE`); if the whole tree doesn't fit at that floor, the user pans instead.
- `setActiveNodeCentered(false)` on the chart — per-node expand/collapse toggles must never auto-pan/center the viewport.
- Toolbar-level actions (Expand all, Collapse all, node selection/focus mode, search jump-to-match, the "Fit" button, layout direction toggle) call the zoom-floor-aware fit; per-node expand/collapse toggles do not.
- No edits to `public/data/org-chart.json`, `public/data/branch-org.json`, or `src/app/services/branch-data.service.ts` — out of scope.
- No new npm dependencies.

---

### Task 1: Pure layout utility functions

**Files:**
- Create: `src/app/org-chart/chart-layout.utils.ts`
- Create: `src/app/org-chart/chart-layout.utils.spec.ts`

**Interfaces:**
- Produces: `estimateCardHeight(node: { name: string; title?: string; department?: string }): number`, `shouldGridPack(leafCount: number): boolean`, `computeGridColumns(leafCount: number, maxColumns?: number): number`, `GRID_GROUP_THRESHOLD: number` — all consumed by Task 2 (card sizing) and Task 3 (grid packing).

- [ ] **Step 1: Write the failing tests**

```typescript
// src/app/org-chart/chart-layout.utils.spec.ts
import { computeGridColumns, estimateCardHeight, GRID_GROUP_THRESHOLD, shouldGridPack } from './chart-layout.utils';

describe('estimateCardHeight', () => {
  it('returns the compact single-line height when name/title are short and department is absent', () => {
    expect(estimateCardHeight({ name: 'AN', title: 'CEO' })).toBe(65);
  });

  it('adds height for the department line when present', () => {
    expect(estimateCardHeight({ name: 'AN', title: 'CEO', department: 'Khoi Van hanh' })).toBe(84);
  });

  it('grows when the name wraps onto multiple lines', () => {
    const longName = 'A'.repeat(45);
    expect(estimateCardHeight({ name: longName, title: 'CEO' })).toBe(105);
  });

  it('omits the title line entirely when title is empty', () => {
    expect(estimateCardHeight({ name: 'AN', title: '' })).toBe(44);
  });
});

describe('shouldGridPack', () => {
  it('is false at the threshold', () => {
    expect(shouldGridPack(GRID_GROUP_THRESHOLD)).toBe(false);
  });

  it('is true just above the threshold', () => {
    expect(shouldGridPack(GRID_GROUP_THRESHOLD + 1)).toBe(true);
  });
});

describe('computeGridColumns', () => {
  it('returns 1 column for a single leaf', () => {
    expect(computeGridColumns(1)).toBe(1);
  });

  it('returns a squarish column count for 4 leaves', () => {
    expect(computeGridColumns(4)).toBe(2);
  });

  it('caps at the default maxColumns for large leaf counts', () => {
    expect(computeGridColumns(22)).toBe(4);
  });

  it('respects a custom maxColumns', () => {
    expect(computeGridColumns(9, 3)).toBe(3);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx ng test --watch=false`
Expected: FAIL — `chart-layout.utils` module not found.

- [ ] **Step 3: Write the implementation**

```typescript
// src/app/org-chart/chart-layout.utils.ts
/**
 * Hằng số ước lượng số dòng text khi wrap, phải khớp với padding/font
 * của .org-card trong org-chart.component.scss (card rộng cố định 288px).
 */
const NAME_CHARS_PER_LINE = 22;
const TITLE_CHARS_PER_LINE = 26;
const DEPT_CHARS_PER_LINE = 28;

const NAME_LINE_HEIGHT = 20;
const TITLE_LINE_HEIGHT = 17;
const DEPT_LINE_HEIGHT = 15;
const VERTICAL_PADDING = 24;
const ROW_GAP = 4;

function countLines(text: string, charsPerLine: number): number {
  return Math.max(1, Math.ceil(text.length / charsPerLine));
}

/**
 * Ước lượng chiều cao card (px) theo nội dung thực tế, để d3-org-chart
 * cấp đủ chỗ dọc cho card thay vì dùng 1 chiều cao cố định.
 */
export function estimateCardHeight(node: { name: string; title?: string; department?: string }): number {
  let height = VERTICAL_PADDING + countLines(node.name, NAME_CHARS_PER_LINE) * NAME_LINE_HEIGHT;
  if (node.title) {
    height += ROW_GAP + countLines(node.title, TITLE_CHARS_PER_LINE) * TITLE_LINE_HEIGHT;
  }
  if (node.department) {
    height += ROW_GAP + countLines(node.department, DEPT_CHARS_PER_LINE) * DEPT_LINE_HEIGHT;
  }
  return height;
}

/** Số node con lá tối thiểu để bắt đầu xếp thành lưới nhiều cột thay vì 1 hàng ngang. */
export const GRID_GROUP_THRESHOLD = 4;

/** true nếu nhóm node con lá này nên xếp lưới thay vì dàn hàng ngang mặc định. */
export function shouldGridPack(leafCount: number): boolean {
  return leafCount > GRID_GROUP_THRESHOLD;
}

/** Số cột lưới gần-vuông cho 1 nhóm node con lá, giới hạn bởi maxColumns. */
export function computeGridColumns(leafCount: number, maxColumns = 4): number {
  if (leafCount <= 0) {
    return 1;
  }
  return Math.min(maxColumns, Math.ceil(Math.sqrt(leafCount)));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx ng test --watch=false`
Expected: PASS — all new tests green, existing 16 tests still passing (19 total... note actual count depends on prior suite; confirm no regressions).

- [ ] **Step 5: Commit**

```bash
git add src/app/org-chart/chart-layout.utils.ts src/app/org-chart/chart-layout.utils.spec.ts
git commit -m "feat: add pure card-height and grid-column layout utilities"
```

---

### Task 2: Card rendering — drop avatar, uppercase, wrap, auto-height

**Files:**
- Modify: `src/app/org-chart/org-chart.component.ts:266-270` (nodeWidth/nodeHeight config), `:449-482` (renderCard/initials)
- Modify: `src/app/org-chart/org-chart.component.scss:211-337` (`.org-card` and variant rules)

**Interfaces:**
- Consumes: `estimateCardHeight` from Task 1 (`./chart-layout.utils`).

- [ ] **Step 1: Update the D3 config chain and imports**

In `src/app/org-chart/org-chart.component.ts`, add the import near the top with the other local imports:

```typescript
import { estimateCardHeight } from './chart-layout.utils';
```

Replace lines 266-270:

```typescript
        .nodeWidth(() => 260)
        .nodeHeight(() => 118)
```

with:

```typescript
        .nodeWidth(() => 288)
        .nodeHeight((d) => estimateCardHeight(d.data))
```

- [ ] **Step 2: Rewrite `renderCard` and delete `initials`**

Replace the `renderCard` method (current lines 449-472):

```typescript
  private renderCard(node: OrgNode): string {
    const tagClass = `org-card--${node.tag ?? 'regular'}`;
    const selectedClass = node.id === this.selectedNodeId() ? ' org-card--selected' : '';
    const ariaLabel = node.title ? `${this.escape(node.name)}, ${this.escape(node.title)}` : this.escape(node.name);

    return `
      <div class="org-card ${tagClass}${selectedClass}" tabindex="0" role="button" data-node-id="${node.id}" aria-label="${ariaLabel}">
        <div class="org-card__body">
          <div class="org-card__name">${this.escape(node.name)}${
      node.isDummy ? ' <span class="org-card__dummy">(dummy)</span>' : ''
    }</div>
          ${node.title ? `<div class="org-card__title">${this.escape(node.title)}</div>` : ''}
          ${
            node.department
              ? `<div class="org-card__dept">${this.escape(node.department)}</div>`
              : ''
          }
        </div>
      </div>
    `;
  }
```

Delete the now-unused `initials()` method entirely (current lines 474-482).

- [ ] **Step 3: Update card SCSS**

In `src/app/org-chart/org-chart.component.scss`, replace the `.org-card` rule (current lines 211-223):

```scss
.org-card {
  display: flex;
  align-items: stretch;
  height: 100%;
  box-sizing: border-box;
  padding: 12px;
  border-radius: 10px;
  background: #ffffff;
  border: 1px solid #d3d9e2;
  box-shadow: 0 2px 6px rgba(15, 23, 42, 0.06);
  font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
}
```

Delete the `.org-card__avatar` rule entirely (current lines 225-237).

Replace `.org-card__body` through `.org-card__dept` (current lines 239-271) with:

```scss
.org-card__body {
  min-width: 0;
  width: 100%;
}

.org-card__name {
  font-weight: 700;
  font-size: 16px;
  color: #1a2332;
  text-transform: uppercase;
  white-space: normal;
  overflow-wrap: break-word;
  line-height: 20px;
}

.org-card__dummy {
  font-weight: 400;
  text-transform: none;
  font-size: 10px;
  color: #94a3b8;
}

.org-card__title {
  font-size: 13px;
  color: #4a5568;
  margin-top: 4px;
  white-space: normal;
  overflow-wrap: break-word;
  line-height: 17px;
}

.org-card__dept {
  font-size: 12px;
  color: #94a3b8;
  margin-top: 4px;
  white-space: normal;
  overflow-wrap: break-word;
  line-height: 15px;
}
```

In `.org-card--independent` (current lines 288-294), remove the nested `.org-card__avatar { background: #c57622; }` line, keeping just `border-left: 4px solid #c57622;`.

In the `org-card-variant` mixin (current lines 297-305), remove the `.org-card__avatar { background: $accent; }` line, keeping just the `background`/`border-color`/`border-left` declarations.

In `.org-card--executive` (current lines 349-366), remove the nested `.org-card__avatar { background: #ffffff; color: #00793d; }` block.

- [ ] **Step 4: Verify build and existing tests still pass**

Run: `npx ng build`
Expected: build succeeds (warnings about component style budget are pre-existing/acceptable at this step).

Run: `npx ng test --watch=false`
Expected: PASS, no regressions.

- [ ] **Step 5: Commit**

```bash
git add src/app/org-chart/org-chart.component.ts src/app/org-chart/org-chart.component.scss
git commit -m "feat: auto-height cards with no truncation, drop avatar, uppercase name"
```

---

### Task 3: Automatic grid packing for large sibling groups

**Files:**
- Modify: `src/app/org-chart/org-chart.component.ts:323-447` (`applySingleColumnCompact` → `applyGridCompact`), its call site at `:306`

**Interfaces:**
- Consumes: `shouldGridPack`, `computeGridColumns` from Task 1 (`./chart-layout.utils`).

- [ ] **Step 1: Add the import**

In `src/app/org-chart/org-chart.component.ts`, extend the Task 2 import line to:

```typescript
import { computeGridColumns, estimateCardHeight, shouldGridPack } from './chart-layout.utils';
```

- [ ] **Step 2: Replace the compact-layout monkey-patch**

Replace the entire `applySingleColumnCompact` method (current lines 323-447) with:

```typescript
  /**
   * d3-org-chart chỉ hỗ trợ compact 2 cột cứng (hard-code i % 2 trong
   * calculateCompactFlexDimensions/Positions). Ghi đè 2 hàm layout đó
   * trên instance để: nhóm node con LÁ nào có số lượng > GRID_GROUP_THRESHOLD
   * thì tự động xếp thành lưới nhiều cột gần-vuông (computeGridColumns);
   * nhóm nhỏ hơn giữ nguyên dàn hàng ngang mặc định (không compact).
   */
  private applyGridCompact(chart: OrgChart<OrgNode>): void {
    interface FlexNode {
      x: number;
      y: number;
      width: number;
      height: number;
      row: number;
      firstCompact: boolean | null;
      compactEven: boolean | null;
      flexCompactDim: [number, number] | null;
      firstCompactNode: FlexNode | null;
      children?: FlexNode[];
    }
    interface FlexRoot {
      eachBefore(cb: (n: FlexNode) => void): void;
    }
    interface CompactState {
      layout: 'top' | 'left' | 'right' | 'bottom';
      layoutBindings: Record<
        string,
        {
          compactDimension: {
            sizeColumn(n: FlexNode): number;
            sizeRow(n: FlexNode): number;
          };
          compactLinkMidX(n: FlexNode, s: CompactState): number;
        }
      >;
      compactMarginBetween(n?: FlexNode): number;
      compactMarginPair(n?: FlexNode): number;
    }
    // Các hàm/field nội bộ không có trong .d.ts công khai của thư viện.
    const patched = chart as unknown as {
      getChartState(): CompactState;
      calculateCompactFlexDimensions(root: FlexRoot): void;
      calculateCompactFlexPositions(root: FlexRoot): void;
    };

    patched.calculateCompactFlexDimensions = (root) => {
      const attrs = patched.getChartState();
      const dim = attrs.layoutBindings[attrs.layout].compactDimension;
      root.eachBefore((node) => {
        node.firstCompact = null;
        node.compactEven = null;
        node.flexCompactDim = null;
        node.firstCompactNode = null;
      });
      root.eachBefore((node) => {
        if (!node.children || node.children.length <= 1) {
          return;
        }
        const leaves = node.children.filter((d) => !d.children);
        if (!shouldGridPack(leaves.length)) {
          return;
        }
        const columns = computeGridColumns(leaves.length);
        const rowsPerColumn = Math.ceil(leaves.length / columns);
        leaves.forEach((child, i) => {
          child.firstCompact = i === 0;
          child.compactEven = false;
          child.row = i % rowsPerColumn;
        });
        const columnWidth =
          Math.max(...leaves.map((d) => dim.sizeColumn(d))) + attrs.compactMarginPair(leaves[0]);
        const columnHeights: number[] = [];
        for (let c = 0; c < columns; c++) {
          const columnLeaves = leaves.slice(c * rowsPerColumn, (c + 1) * rowsPerColumn);
          columnHeights.push(
            columnLeaves.reduce((sum, d) => sum + dim.sizeRow(d) + attrs.compactMarginBetween(d), 0)
          );
        }
        leaves.forEach((child) => {
          child.firstCompactNode = leaves[0];
          child.flexCompactDim = child.firstCompact
            ? [columns * columnWidth, Math.max(...columnHeights) - attrs.compactMarginBetween(leaves[0])]
            : [0, 0];
        });
        node.flexCompactDim = null;
      });
    };

    patched.calculateCompactFlexPositions = (root) => {
      const attrs = patched.getChartState();
      const dim = attrs.layoutBindings[attrs.layout].compactDimension;
      root.eachBefore((node) => {
        if (!node.children) {
          return;
        }
        const leaves = node.children.filter((d) => d.flexCompactDim);
        const first = leaves[0];
        if (!first) {
          return;
        }
        const columns = computeGridColumns(leaves.length);
        const rowsPerColumn = Math.ceil(leaves.length / columns);
        const columnWidth =
          Math.max(...leaves.map((d) => dim.sizeColumn(d))) + attrs.compactMarginPair(first);
        const groupWidth = columns * columnWidth;
        const centerX = first.x;
        const offsetX = Math.abs(node.x - centerX) < 10 ? node.x - centerX : 0;
        const leftEdge = centerX - groupWidth / 2 + columnWidth / 2 + offsetX;
        const columnY = new Array(columns).fill(first.y);
        leaves.forEach((child, i) => {
          const c = Math.floor(i / rowsPerColumn);
          child.x = leftEdge + c * columnWidth;
          child.y = columnY[c];
          columnY[c] += dim.sizeRow(child) + attrs.compactMarginBetween(child);
        });
      });
    };

    // Rail dọc của cụm compact nằm bên TRÁI cột đầu tiên (mặc định nằm giữa 2 cột).
    patched.getChartState().layoutBindings['top'].compactLinkMidX = (node, state) => {
      const first = node.firstCompactNode!;
      return first.x - first.width / 2 - state.compactMarginPair(node) / 4;
    };
  }
```

Update the call site (current line 306) from `this.applySingleColumnCompact(this.chart);` to `this.applyGridCompact(this.chart);`.

- [ ] **Step 3: Verify build and tests**

Run: `npx ng build`
Expected: build succeeds, no TypeScript errors from the rewritten patch.

Run: `npx ng test --watch=false`
Expected: PASS, no regressions.

- [ ] **Step 4: Manual verification**

Run: `npx ng serve`, open the app, expand the root node (which has a large fan-out under `khoi-01`/`tgd` style groups) and confirm those groups render as a multi-column grid instead of one long row or one tall column.

- [ ] **Step 5: Commit**

```bash
git add src/app/org-chart/org-chart.component.ts
git commit -m "feat: auto grid-pack large sibling groups instead of fixed 2-col/1-col compact"
```

---

### Task 4: Remove the manual per-node row/column toggle

**Files:**
- Modify: `src/app/detail-panel/detail-panel.component.ts` (remove `childrenLayoutChanged` output)
- Modify: `src/app/detail-panel/detail-panel.component.html` (remove the layout toggle block)
- Modify: `src/app/detail-panel/detail-panel.component.scss` (remove `.detail-panel__layout` / `.layout-btn*` rules)
- Modify: `src/app/app.ts` (remove `onChildrenLayoutChanged` and its binding)
- Modify: `src/app/app.html` (remove the `(childrenLayoutChanged)` binding)
- Modify: `src/app/services/org-data.service.ts:51-54` (drop `childrenLayout` from `updateNode`'s updatable-fields type)

**Interfaces:**
- Produces: `OrgDataService.updateNode(id, changes: Partial<Pick<OrgNode, 'name' | 'title' | 'department'>>)` (narrowed from including `childrenLayout`) — Task 6/7 don't touch this service further.

- [ ] **Step 1: `DetailPanelComponent` — remove the output**

In `src/app/detail-panel/detail-panel.component.ts`, delete this line and its preceding comment:

```typescript
  /** Yêu cầu đổi hướng xếp cấp dưới (ngang/dọc) của node đang chọn. */
  readonly childrenLayoutChanged = output<{ id: string; layout: 'row' | 'column' }>();
```

- [ ] **Step 2: `detail-panel.component.html` — remove the toggle block**

Delete this block (current lines 37-57):

```html
      @if (children().length > 1) {
        <div class="detail-panel__layout" role="group" aria-label="Hướng xếp cấp dưới">
          <span class="detail-panel__layout-label">Xếp cấp dưới:</span>
          <button
            type="button"
            class="layout-btn"
            [class.layout-btn--active]="(n.childrenLayout ?? 'row') === 'row'"
            (click)="childrenLayoutChanged.emit({ id: n.id, layout: 'row' })"
          >
            ▭ Ngang
          </button>
          <button
            type="button"
            class="layout-btn"
            [class.layout-btn--active]="n.childrenLayout === 'column'"
            (click)="childrenLayoutChanged.emit({ id: n.id, layout: 'column' })"
          >
            ▯ Dọc
          </button>
        </div>
      }
```

- [ ] **Step 3: `detail-panel.component.scss` — remove now-unused rules**

Delete the `.detail-panel__layout`, `.detail-panel__layout-label`, `.layout-btn`, and `.layout-btn--active` rules (current lines 83-123).

- [ ] **Step 4: `app.ts` — remove the handler**

Delete this method:

```typescript
  protected onChildrenLayoutChanged(payload: { id: string; layout: 'row' | 'column' }): void {
    const updated = this.orgDataService.updateNode(payload.id, {
      childrenLayout: payload.layout,
    });
    if (updated) {
      this.selectedNode.set(updated);
    }
  }
```

- [ ] **Step 5: `app.html` — remove the binding**

In the `<app-detail-panel>` tag, delete the line:

```html
          (childrenLayoutChanged)="onChildrenLayoutChanged($event)"
```

- [ ] **Step 6: `org-data.service.ts` — narrow the updatable fields**

Change (current lines 51-54):

```typescript
  updateNode(
    id: string,
    changes: Partial<Pick<OrgNode, 'name' | 'title' | 'department' | 'childrenLayout'>>
  ): OrgNode | undefined {
```

to:

```typescript
  updateNode(
    id: string,
    changes: Partial<Pick<OrgNode, 'name' | 'title' | 'department'>>
  ): OrgNode | undefined {
```

- [ ] **Step 7: Run tests and build**

Run: `npx ng test --watch=false`
Expected: PASS — no test referenced `childrenLayoutChanged` or `childrenLayout` in `updateNode`, so no spec edits are needed here.

Run: `npx ng build`
Expected: build succeeds with no TypeScript errors (confirms no other file still references the removed output/method).

- [ ] **Step 8: Commit**

```bash
git add src/app/detail-panel/detail-panel.component.ts src/app/detail-panel/detail-panel.component.html src/app/detail-panel/detail-panel.component.scss src/app/app.ts src/app/app.html src/app/services/org-data.service.ts
git commit -m "refactor: remove manual row/column toggle now that grid packing is automatic"
```

---

### Task 5: Fit-with-zoom-floor and correct re-fit triggers

**Files:**
- Modify: `src/app/org-chart/d3-org-chart.d.ts` (extend `fit()` signature, add `setActiveNodeCentered`)
- Modify: `src/app/org-chart/org-chart.component.ts` (add zoom-floor helper, wire it into `initChart`, `effect`, `expandAll`, `collapseAll`, `fit`, `toggleLayout`, `highlightCurrentMatch`)

**Interfaces:**
- Produces: `OrgChartComponent.fitWithZoomFloor(): void` (private) — used internally by the public methods listed above; no external consumers.

- [ ] **Step 1: Extend the ambient type declarations**

In `src/app/org-chart/d3-org-chart.d.ts`, replace:

```typescript
    render(): this;
    fit(): this;
```

with:

```typescript
    render(): this;
    fit(options?: { animate?: boolean; scale?: boolean; onCompleted?: () => void }): this;
    setActiveNodeCentered(value: boolean): this;
```

- [ ] **Step 2: Add the zoom-floor state interface and helper methods**

In `src/app/org-chart/org-chart.component.ts`, add this interface at module scope, above the `@Component` decorator (alongside `LegendItem`/`DEFAULT_LEGEND_ITEMS`):

```typescript
/**
 * d3-org-chart không expose transform/zoom hiện tại qua API công khai
 * (chỉ có trong getChartState() nội bộ) — dùng để đọc scale sau khi
 * fit() và chỉnh lại nếu bị zoom-out quá mức đọc được.
 */
interface ZoomFitState {
  lastTransform: { k: number };
  svg: { transition(): { duration(ms: number): unknown } };
  zoomBehavior: { scaleBy: (target: unknown, k: number) => void };
  duration: number;
}
```

Inside the `OrgChartComponent` class, add a private field near the other private fields (after `private resizeObserver`):

```typescript
  /** fit() không bao giờ zoom-out quá mức này, để chữ trên card luôn đọc được. */
  private readonly MIN_FIT_SCALE = 0.55;
```

Add these two private methods (near `highlightCurrentMatch`, for example):

```typescript
  private getZoomState(): ZoomFitState {
    return (this.chart as unknown as { getChartState(): ZoomFitState }).getChartState();
  }

  /** fit() có giới hạn zoom-out tối thiểu — dùng cho mọi thao tác toàn cục. */
  private fitWithZoomFloor(): void {
    this.chart?.fit({
      onCompleted: () => {
        const state = this.getZoomState();
        if (state.lastTransform.k < this.MIN_FIT_SCALE) {
          const factor = this.MIN_FIT_SCALE / state.lastTransform.k;
          state.zoomBehavior.scaleBy(state.svg.transition().duration(state.duration), factor);
        }
      },
    });
  }
```

- [ ] **Step 3: Disable auto-centering on per-node toggle**

In `initChart()`, add `.setActiveNodeCentered(false)` to the chained builder calls — insert it right after `.initialExpandLevel(2)`:

```typescript
        .initialExpandLevel(2)
        .setActiveNodeCentered(false)
```

- [ ] **Step 4: Route toolbar-level actions through the zoom floor**

In the constructor's `effect()`, replace:

```typescript
          this.chart!.render().fit();
```

with:

```typescript
          this.chart!.render();
          this.fitWithZoomFloor();
```

Replace `expandAll()`:

```typescript
  expandAll(): void {
    this.zone.runOutsideAngular(() => this.chart?.expandAll());
  }
```

with:

```typescript
  expandAll(): void {
    this.zone.runOutsideAngular(() => {
      this.chart?.expandAll();
      this.fitWithZoomFloor();
    });
  }
```

Replace `collapseAll()`:

```typescript
  collapseAll(): void {
    this.zone.runOutsideAngular(() => this.chart?.collapseAll());
  }
```

with:

```typescript
  collapseAll(): void {
    this.zone.runOutsideAngular(() => {
      this.chart?.collapseAll();
      this.fitWithZoomFloor();
    });
  }
```

Replace `fit()`:

```typescript
  fit(): void {
    this.zone.runOutsideAngular(() => this.chart?.fit());
  }
```

with:

```typescript
  fit(): void {
    this.zone.runOutsideAngular(() => this.fitWithZoomFloor());
  }
```

In `toggleLayout()`, replace:

```typescript
      this.chart?.layout(next).compact(next === 'top').render();
```

with:

```typescript
      this.chart?.layout(next).compact(next === 'top').render();
      this.fitWithZoomFloor();
```

`highlightCurrentMatch()` itself is shared by both typing (`onSearchInput` → `highlight()`, which resets to the first match on every keystroke) and explicit navigation (`nextMatch()`/`prevMatch()`) — it must NOT call `fitWithZoomFloor()` directly, or the view would re-fit on every keystroke while typing. Instead, add the fit call only to the explicit navigation methods. Replace `nextMatch()`:

```typescript
  nextMatch(): void {
    const total = this.matches().length;
    if (!total) {
      return;
    }
    this.matchIndex.set((this.matchIndex() + 1) % total);
    this.highlightCurrentMatch();
  }
```

with:

```typescript
  nextMatch(): void {
    const total = this.matches().length;
    if (!total) {
      return;
    }
    this.matchIndex.set((this.matchIndex() + 1) % total);
    this.highlightCurrentMatch();
    this.fitWithZoomFloor();
  }
```

Replace `prevMatch()`:

```typescript
  prevMatch(): void {
    const total = this.matches().length;
    if (!total) {
      return;
    }
    this.matchIndex.set((this.matchIndex() - 1 + total) % total);
    this.highlightCurrentMatch();
  }
```

with:

```typescript
  prevMatch(): void {
    const total = this.matches().length;
    if (!total) {
      return;
    }
    this.matchIndex.set((this.matchIndex() - 1 + total) % total);
    this.highlightCurrentMatch();
    this.fitWithZoomFloor();
  }
```

- [ ] **Step 5: Verify build and tests**

Run: `npx ng build`
Expected: build succeeds.

Run: `npx ng test --watch=false`
Expected: PASS, no regressions.

- [ ] **Step 6: Manual verification**

Run: `npx ng serve`, open the app:
1. Click "Expand all" on a large branch and confirm the view zooms to fit but text stays readable (doesn't shrink below the floor) even if that means part of the tree is off-screen (pannable).
2. Click a single node's own expand/collapse chevron and confirm the viewport does NOT jump/re-center — only the surrounding layout adjusts.
3. Click "Fit" and confirm it also respects the floor.

- [ ] **Step 7: Commit**

```bash
git add src/app/org-chart/d3-org-chart.d.ts src/app/org-chart/org-chart.component.ts
git commit -m "feat: fit respects a minimum zoom scale; per-node toggle no longer auto-pans"
```

---

### Task 6: Full-screen app shell — remove header, float the detail panel

**Files:**
- Modify: `src/app/app.html` (remove `<header>`)
- Modify: `src/app/app.scss` (remove header rules, make chart fill viewport)
- Modify: `src/app/detail-panel/detail-panel.component.scss` (dock → floating overlay)
- Modify: `src/app/app.spec.ts:24-30` (the header test no longer applies)

- [ ] **Step 1: Remove the header markup**

In `src/app/app.html`, delete the `<header class="app-header">...</header>` block (current lines 2-7), leaving:

```html
<div class="app-shell">
  <main class="app-main">
    @if (isLoading()) {
      <div class="app-status" role="status">Đang tải dữ liệu sơ đồ tổ chức...</div>
    } @else if (hasError()) {
      <div class="app-status app-status--error" role="alert">
        Không tải được dữ liệu.
        <button type="button" (click)="reload()">Thử lại</button>
      </div>
    } @else {
      <div class="app-main__content">
        <app-org-chart
          [data]="orgData()"
          [selectedNodeId]="selectedNode()?.id ?? null"
          (nodeClick)="onNodeClick($event)"
        />
        <app-detail-panel
          [node]="selectedNode()"
          [children]="selectedChildren()"
          (closed)="selectedNode.set(null)"
          (createChild)="onCreateChild($event)"
          (updated)="onUpdateNode($event)"
          (deleted)="onDeleteNode($event)"
        />
      </div>
    }
  </main>
</div>
```

(Note: this also drops the `(childrenLayoutChanged)` binding already removed in Task 4 — the tag above shows the final expected state.)

- [ ] **Step 2: Simplify `app.scss`**

Replace the entire file contents with:

```scss
:host {
  display: block;
  height: 100vh;
}

.app-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.app-main {
  flex: 1 1 auto;
  min-height: 0;
}

.app-status {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  height: 100%;
  color: #4a5568;
  font-size: 14px;

  &--error {
    color: #b91c1c;
  }

  button {
    border: 1px solid #00793d;
    background: #fff;
    color: #00793d;
    padding: 6px 14px;
    border-radius: 6px;
    cursor: pointer;

    &:hover {
      background: #00793d;
      color: #fff;
    }
  }
}

.app-main__content {
  position: relative;
  height: 100%;
}

.app-main__content app-org-chart {
  position: absolute;
  inset: 0;
}
```

- [ ] **Step 3: Float the detail panel**

In `src/app/detail-panel/detail-panel.component.scss`, replace the `.detail-panel` rule (current lines 1-9):

```scss
.detail-panel {
  position: relative;
  width: 280px;
  flex: 0 0 280px;
  padding: 20px;
  background: #fff;
  border-left: 1px solid #e2e6ed;
  box-sizing: border-box;
}
```

with:

```scss
.detail-panel {
  position: absolute;
  top: 16px;
  right: 16px;
  bottom: 16px;
  width: 320px;
  padding: 20px;
  background: #fff;
  border-radius: 12px;
  border: 1px solid #e2e6ed;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.16);
  box-sizing: border-box;
  overflow-y: auto;
  z-index: 4;
}
```

Update the `@media (max-width: 640px)` block at the end (current lines 235-243) from:

```scss
@media (max-width: 640px) {
  .detail-panel {
    position: fixed;
    inset: auto 0 0 0;
    width: auto;
    border-left: none;
    border-top: 1px solid #e2e6ed;
  }
}
```

to:

```scss
@media (max-width: 640px) {
  .detail-panel {
    position: fixed;
    inset: auto 0 0 0;
    top: auto;
    bottom: 0;
    width: auto;
    border-radius: 12px 12px 0 0;
    max-height: 70vh;
  }
}
```

- [ ] **Step 4: Update `app.spec.ts`**

Replace the header test (current lines 24-30):

```typescript
  it('should render the OCB header', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('OCB');
    httpMock.expectOne('data/org-chart.json').flush([]);
  });
```

with:

```typescript
  it('renders full-screen with no header', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('header')).toBeNull();
    httpMock.expectOne('data/org-chart.json').flush([]);
  });
```

- [ ] **Step 5: Run tests and build**

Run: `npx ng test --watch=false`
Expected: PASS.

Run: `npx ng build`
Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/app/app.html src/app/app.scss src/app/detail-panel/detail-panel.component.scss src/app/app.spec.ts
git commit -m "feat: full-screen app shell, no header, floating detail panel overlay"
```

---

### Task 7: Floating legend/search controls (map-style toolbar)

**Files:**
- Modify: `src/app/org-chart/org-chart.component.ts` (add `legendOpen`/`searchOpen` signals and toggle methods)
- Modify: `src/app/org-chart/org-chart.component.html` (restructure toolbar into floating icon buttons + panels)
- Modify: `src/app/org-chart/org-chart.component.scss` (position the new floating elements)
- Modify: `angular.json` (bump the `anyComponentStyle` budget — this component's SCSS grows past the current 4kB warning / 8kB error threshold)

- [ ] **Step 1: Add open/close state to the component**

In `src/app/org-chart/org-chart.component.ts`, add these signals near the other `protected readonly` signals (after `initError`):

```typescript
  protected readonly legendOpen = signal(false);
  protected readonly searchOpen = signal(false);
```

Add these methods near `onSearchInput`:

```typescript
  toggleLegend(): void {
    this.legendOpen.update((open) => !open);
  }

  toggleSearch(): void {
    this.searchOpen.update((open) => !open);
    if (!this.searchOpen()) {
      this.closeSearch();
    }
  }

  closeSearch(): void {
    this.searchOpen.set(false);
    this.highlight('');
  }
```

- [ ] **Step 2: Restructure the template**

Replace `src/app/org-chart/org-chart.component.html` in full with:

```html
<div class="org-chart-shell">
  @if (initError()) {
    <div class="org-chart-error" role="alert">
      Không thể hiển thị sơ đồ tổ chức. Vui lòng tải lại trang.
    </div>
  } @else {
    <div class="org-chart-container">
      <div #chartContainer class="org-chart-canvas"></div>

      <div class="org-chart-topright" role="group" aria-label="Chú giải và tìm kiếm">
        <button
          type="button"
          class="icon-btn"
          [class.icon-btn--active]="legendOpen()"
          (click)="toggleLegend()"
          [attr.aria-expanded]="legendOpen()"
          aria-label="Chú giải màu sắc"
          title="Chú giải"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M4 6h16M4 12h16M4 18h10" />
          </svg>
        </button>
        <button
          type="button"
          class="icon-btn"
          [class.icon-btn--active]="searchOpen()"
          (click)="toggleSearch()"
          [attr.aria-expanded]="searchOpen()"
          aria-label="Tìm theo tên hoặc chức danh"
          title="Tìm kiếm"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
        </button>
      </div>

      @if (legendOpen()) {
        <div class="org-chart-legend" role="list" aria-label="Chú giải màu sắc">
          @for (item of legendItems(); track item.tagClass) {
            <span class="legend-item" role="listitem"><i class="legend-dot legend-dot--{{ item.tagClass }}"></i>{{ item.label }}</span>
          }
          <span class="legend-item legend-item--line" role="listitem"><i class="legend-line" aria-hidden="true"></i>Quan hệ trực thuộc</span>
          <span class="legend-item legend-item--line" role="listitem"><i class="legend-line legend-line--dashed" aria-hidden="true"></i>Quan hệ chức năng</span>
        </div>
      }

      @if (searchOpen()) {
        <div class="org-chart-search-overlay" role="search">
          <label class="sr-only" for="org-chart-search">Tìm theo tên hoặc chức danh</label>
          <input
            id="org-chart-search"
            type="text"
            class="org-chart-search"
            placeholder="Tìm theo tên hoặc chức danh..."
            aria-label="Tìm theo tên hoặc chức danh"
            autofocus
            (input)="onSearchInput($event)"
            (keydown.escape)="closeSearch()"
          />
          @if (matchCount() > 0) {
            <span class="org-chart-match-counter" aria-live="polite">{{ matchPosition() }}/{{ matchCount() }}</span>
            <button type="button" class="icon-btn icon-btn--ghost" (click)="prevMatch()" aria-label="Kết quả trước" title="Kết quả trước">‹</button>
            <button type="button" class="icon-btn icon-btn--ghost" (click)="nextMatch()" aria-label="Kết quả tiếp theo" title="Kết quả tiếp theo">›</button>
          }
          <button type="button" class="icon-btn icon-btn--ghost" (click)="closeSearch()" aria-label="Đóng tìm kiếm" title="Đóng">✕</button>
        </div>
      }

      <div class="org-chart-actions" role="group" aria-label="Thao tác sơ đồ">
        <button type="button" class="icon-btn" (click)="expandAll()" aria-label="Mở rộng tất cả các nhánh" title="Mở rộng tất cả">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M8 3l4 4 4-4" />
            <path d="M8 21l4-4 4 4" />
          </svg>
        </button>
        <button type="button" class="icon-btn" (click)="collapseAll()" aria-label="Thu gọn tất cả các nhánh" title="Thu gọn tất cả">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M8 7l4 4 4-4" />
            <path d="M8 17l4-4 4 4" />
          </svg>
        </button>
        <button type="button" class="icon-btn" (click)="fit()" aria-label="Đưa sơ đồ vừa khung nhìn" title="Fit màn hình">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M8 3H5a2 2 0 0 0-2 2v3" />
            <path d="M16 3h3a2 2 0 0 1 2 2v3" />
            <path d="M8 21H5a2 2 0 0 1-2-2v-3" />
            <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
          </svg>
        </button>
        <button type="button" class="icon-btn" (click)="zoomIn()" aria-label="Phóng to" title="Phóng to">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="10" cy="10" r="6" />
            <path d="M10 7v6M7 10h6" />
            <path d="M20 20l-4.35-4.35" />
          </svg>
        </button>
        <button type="button" class="icon-btn" (click)="zoomOut()" aria-label="Thu nhỏ" title="Thu nhỏ">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="10" cy="10" r="6" />
            <path d="M7 10h6" />
            <path d="M20 20l-4.35-4.35" />
          </svg>
        </button>
        <button
          type="button"
          class="icon-btn"
          [class.icon-btn--rotated]="layoutDirection() === 'left'"
          (click)="toggleLayout()"
          [attr.aria-label]="'Đổi hướng sơ đồ, hiện đang: ' + (layoutDirection() === 'top' ? 'dọc' : 'ngang')"
          [attr.title]="'Đổi hướng sơ đồ (hiện đang ' + (layoutDirection() === 'top' ? 'dọc' : 'ngang') + ')'"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M4 4v5h5" />
            <path d="M20 20v-5h-5" />
            <path d="M4.5 15a8 8 0 0 0 14.9 2.5" />
            <path d="M19.5 9a8 8 0 0 0-14.9-2.5" />
          </svg>
        </button>
        <button type="button" class="icon-btn" (click)="exportImage()" aria-label="Xuất ảnh sơ đồ" title="Xuất ảnh">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 3v12" />
            <path d="M7 10l5 5 5-5" />
            <path d="M5 21h14" />
          </svg>
        </button>
      </div>
    </div>
  }
</div>
```

- [ ] **Step 3: Restyle for floating layout**

In `src/app/org-chart/org-chart.component.scss`, delete the `.org-chart-toolbar` rule and the `@media (max-width: 640px)` block that references `.org-chart-toolbar`/`.org-chart-legend` (current lines 9-17 and 73-87 — re-add a simplified mobile block in the same step, see below).

Replace the `.org-chart-legend` rule (current lines 102-111):

```scss
.org-chart-legend {
  position: absolute;
  top: 56px;
  right: 16px;
  z-index: 3;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 260px;
  padding: 12px 14px;
  background: #fff;
  border-radius: 10px;
  border: 1px solid #e2e6ed;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.16);
  font-size: 12px;
  color: #4a5568;
}
```

Add these new rules near it:

```scss
.org-chart-topright {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 5;
  display: flex;
  gap: 8px;
}

.icon-btn--active {
  background: #00793d;
  border-color: #00793d;
  color: #fff;
}

.org-chart-search-overlay {
  position: absolute;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #fff;
  border-radius: 10px;
  border: 1px solid #e2e6ed;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.16);
}

@media (max-width: 640px) {
  .org-chart-search-overlay {
    left: 16px;
    right: 16px;
    transform: none;
    width: auto;
  }

  .org-chart-legend {
    max-width: none;
    left: 16px;
    right: 16px;
    width: auto;
  }
}
```

`.org-chart-container` already has `position: relative; overflow: hidden;` (current lines 190-196) — no change needed there; the new floating elements are positioned relative to it.

- [ ] **Step 4: Bump the component style budget**

In `angular.json`, under `architect.build.configurations.production.budgets`, change the `anyComponentStyle` entry from:

```json
    {
      "type": "anyComponentStyle",
      "maximumWarning": "4kB",
      "maximumError": "8kB"
    }
```

to:

```json
    {
      "type": "anyComponentStyle",
      "maximumWarning": "8kB",
      "maximumError": "14kB"
    }
```

- [ ] **Step 5: Run tests and build**

Run: `npx ng test --watch=false`
Expected: PASS.

Run: `npx ng build`
Expected: build succeeds with no budget errors.

- [ ] **Step 6: Manual verification**

Run: `npx ng serve`, open the app:
1. Confirm legend and search icons float top-right with no background bar.
2. Click the legend icon — panel appears near that corner; click again — it closes.
3. Click the search icon — a centered search bar appears near the top; type a name, confirm match counter/prev/next work; press Esc — it closes and clears highlighting.
4. Confirm the bottom-right action strip (expand/collapse/fit/zoom/layout/export) is unchanged in position and still works.

- [ ] **Step 7: Commit**

```bash
git add src/app/org-chart/org-chart.component.ts src/app/org-chart/org-chart.component.html src/app/org-chart/org-chart.component.scss angular.json
git commit -m "feat: map-style floating legend and search controls"
```

---

### Task 8: Final integration check

**Files:** none (verification only)

- [ ] **Step 1: Full test suite**

Run: `npx ng test --watch=false`
Expected: PASS, all tests green.

- [ ] **Step 2: Full production build**

Run: `npx ng build`
Expected: build succeeds, no errors, no unexpected warnings beyond the pre-existing main bundle size note (if any).

- [ ] **Step 3: End-to-end manual smoke test**

Run: `npx ng serve`, open the app, and walk through:
1. Default load — no header, chart fills the screen, cards show full name/title/department in uppercase with no clipped text.
2. A large group (many siblings under one parent) renders as a grid, not a single sprawling row/column.
3. Expand all → view fits but stays legible (zoom floor holds); pan to see any overflow.
4. Click a node → floating detail panel appears top-right over the chart, chart doesn't resize/shrink.
5. Click a single node's expand chevron → view does not jump.
6. Legend and search icons work as designed (Task 7 checks).
7. Bottom-right action strip still works (zoom in/out, fit, layout toggle, export image).

- [ ] **Step 4: Report status**

No commit for this task — it's verification only. If any check fails, return to the relevant task above and fix before considering the plan complete.
