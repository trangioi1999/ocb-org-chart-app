# Dual Org Chart (OCB + Chi nhánh/PGD) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a second, independent org chart (1 Chi nhánh → 3 Phòng giao dịch → staff, placeholder data) alongside the existing OCB chart, switchable via 2 tabs in the header, without either chart's search state leaking into the other.

**Architecture:** Make `OrgChartComponent` self-contained (it stops depending on the app-wide `OrgDataService` singleton for search, filtering its own `data()` input instead). Add a parallel `BranchDataService` that loads a second static JSON file the same way `OrgDataService` does. `App` gains a tab switcher signal and mounts exactly one `<app-org-chart>` at a time via `@if`, each fed by its own service and its own `legendItems`.

**Tech Stack:** Angular 22 (standalone, signals), `@angular/common/http`, Vitest (jsdom).

## Global Constraints

- Node v24.18.0 required (`.nvmrc`). Do **not** run `source ~/.nvm/nvm.sh && nvm use` in any command — it triggers a permission prompt every time. Instead prepend the bin dir to PATH: `export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"` before any `npm`/`npx`/`ng` command.
- Angular 22 standalone components only — no NgModules. Do not add routing (`@angular/router` stays an unused dependency, per prior explicit user decision) or reactive forms.
- Vietnamese UI copy throughout, matching existing tone (see current `app.html`/`org-chart.component.html` for examples).
- Tests run via `npx ng test --watch=false` (Vitest + jsdom, already configured). Every task touching logic must add/update a spec file.
- `npm run lint` must stay clean (ESLint flat config already set up) after every task.
- Commit after every task with a descriptive message; never batch multiple tasks into one commit.
- A known pre-existing jsdom quirk exists: an unhandled "Cannot read properties of undefined (reading 'baseVal')" error from d3-interpolate/d3-transition prints during `ng test` when the org chart renders inside jsdom (missing `canvas` package). This is environmental noise, not a regression — ignore it unless it causes an actual assertion failure.

---

### Task 1: Make `OrgChartComponent` self-contained (remove its `OrgDataService` dependency)

**Files:**
- Modify: `src/app/org-chart/org-chart.component.ts`
- Modify: `src/app/org-chart/org-chart.component.spec.ts`
- Modify: `src/app/services/org-data.service.ts`
- Modify: `src/app/services/org-data.service.spec.ts`

**Interfaces:**
- Produces: `OrgChartComponent.highlight(term: string): void` now filters `this.data()` directly (same predicate as before: case-insensitive substring match on `name` or `title`) instead of calling `OrgDataService.search()`. `OrgDataService.search()` no longer exists. Later tasks must not reintroduce a call to it.

- [ ] **Step 1: Update the component spec to stop depending on `HttpClient`/`OrgDataService`**

Replace `src/app/org-chart/org-chart.component.spec.ts` in full:

```ts
import { TestBed } from '@angular/core/testing';
import { OrgChartComponent } from './org-chart.component';
import { OrgNode } from '../models/org-node.model';

const NODES: OrgNode[] = [
  { id: 'root', parentId: null, name: 'Trịnh Văn Tuấn', title: 'Chủ tịch', tag: 'regular' },
  { id: 'child', parentId: 'root', name: 'Nguyễn Văn A', title: 'Tổng Giám đốc', tag: 'executive', isDummy: true },
];

describe('OrgChartComponent', () => {
  it('marks dummy nodes in the rendered card without a name prefix', () => {
    const fixture = TestBed.createComponent(OrgChartComponent);
    fixture.componentRef.setInput('data', NODES);
    fixture.detectChanges();

    const html = (fixture.componentInstance as unknown as { renderCard: (n: OrgNode) => string })[
      'renderCard'
    ](NODES[1]);

    expect(html).toContain('Nguyễn Văn A');
    expect(html).not.toContain('[Dummy]');
    expect(html).toContain('org-card__dummy');
  });

  it('does not mark real nodes as dummy', () => {
    const fixture = TestBed.createComponent(OrgChartComponent);
    fixture.componentRef.setInput('data', NODES);
    fixture.detectChanges();

    const html = (fixture.componentInstance as unknown as { renderCard: (n: OrgNode) => string })[
      'renderCard'
    ](NODES[0]);

    expect(html).not.toContain('org-card__dummy');
  });

  it('highlight() filters matches from its own data() input', () => {
    const fixture = TestBed.createComponent(OrgChartComponent);
    fixture.componentRef.setInput('data', NODES);
    fixture.detectChanges();

    fixture.componentInstance.highlight('tổng giám đốc');

    expect(fixture.componentInstance['matches']()).toEqual([NODES[1]]);
  });

  it('sets initError when chart initialization throws', () => {
    const fixture = TestBed.createComponent(OrgChartComponent);
    fixture.componentRef.setInput('data', NODES);

    const instance = fixture.componentInstance as unknown as { initChart: () => void; initError: () => boolean };
    // Force a throw by nulling the container's nativeElement access path.
    Object.defineProperty(fixture.componentInstance, 'containerRef', {
      value: () => {
        throw new Error('container missing');
      },
    });

    instance.initChart();
    expect(instance.initError()).toBe(true);
  });

  it('emits nodeClick when Enter is pressed on a focused card inside the real container', () => {
    const fixture = TestBed.createComponent(OrgChartComponent);
    fixture.componentRef.setInput('data', NODES);
    fixture.detectChanges();

    const emitted: OrgNode[] = [];
    fixture.componentInstance.nodeClick.subscribe((n: OrgNode) => emitted.push(n));

    const container = (
      fixture.componentInstance as unknown as {
        containerRef: () => { nativeElement: HTMLElement };
      }
    )['containerRef']().nativeElement;
    const card = document.createElement('div');
    card.className = 'org-card';
    card.setAttribute('data-node-id', 'child');
    container.appendChild(card);

    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
    card.dispatchEvent(event);

    expect(emitted).toEqual([NODES[1]]);
  });

  it('zoomIn/zoomOut delegate to the underlying chart instance without throwing', () => {
    const fixture = TestBed.createComponent(OrgChartComponent);
    fixture.componentRef.setInput('data', NODES);
    fixture.detectChanges();

    expect(() => fixture.componentInstance.zoomIn()).not.toThrow();
    expect(() => fixture.componentInstance.zoomOut()).not.toThrow();
  });

  it('toggleLayout() flips between top and left layout', () => {
    const fixture = TestBed.createComponent(OrgChartComponent);
    fixture.componentRef.setInput('data', NODES);
    fixture.detectChanges();

    expect(fixture.componentInstance.layoutDirection()).toBe('top');
    fixture.componentInstance.toggleLayout();
    expect(fixture.componentInstance.layoutDirection()).toBe('left');
    fixture.componentInstance.toggleLayout();
    expect(fixture.componentInstance.layoutDirection()).toBe('top');
  });

  it('cycles through multiple search matches with nextMatch/prevMatch', () => {
    const THREE_MATCH_NODES: OrgNode[] = [
      ...NODES,
      { id: 'other', parentId: 'root', name: 'Nguyễn Văn B', title: 'Phó Tổng Giám đốc', tag: 'executive' },
    ];
    const fixture = TestBed.createComponent(OrgChartComponent);
    fixture.componentRef.setInput('data', THREE_MATCH_NODES);
    fixture.detectChanges();

    fixture.componentInstance.highlight('giám đốc');
    expect(fixture.componentInstance.matchCount()).toBe(2);
    expect(fixture.componentInstance.matchPosition()).toBe(1);

    fixture.componentInstance.nextMatch();
    expect(fixture.componentInstance.matchPosition()).toBe(2);

    fixture.componentInstance.nextMatch();
    expect(fixture.componentInstance.matchPosition()).toBe(1);

    fixture.componentInstance.prevMatch();
    expect(fixture.componentInstance.matchPosition()).toBe(2);
  });

  it('exportImage() delegates to the underlying chart instance without throwing', () => {
    const fixture = TestBed.createComponent(OrgChartComponent);
    fixture.componentRef.setInput('data', NODES);
    fixture.detectChanges();

    expect(() => fixture.componentInstance.exportImage()).not.toThrow();
  });
});
```

(Changes versus the current file: no `TestBed.configureTestingModule` / `provideHttpClient` / `provideHttpClientTesting` / `OrgDataService` import at all; the `highlight()` test and the `cycles through multiple search matches` test no longer call `TestBed.inject(OrgDataService).setData(...)`.)

- [ ] **Step 2: Run the tests to see them fail**

Run:
```bash
export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"
npx ng test --watch=false 2>&1 | tail -40
```
Expected: FAIL — `OrgChartComponent`'s constructor still calls `inject(OrgDataService)`, which injects `HttpClient`; with no `provideHttpClient()` in this TestBed configuration anymore, component creation throws `NullInjectorError: No provider for HttpClient`.

- [ ] **Step 3: Remove the `OrgDataService` dependency from `OrgChartComponent`**

In `src/app/org-chart/org-chart.component.ts`:

Remove this import line:
```ts
import { OrgDataService } from '../services/org-data.service';
```

Remove this field (currently right after `private readonly orgDataService = inject(OrgDataService);` near the `containerRef` declaration):
```ts
  private readonly orgDataService = inject(OrgDataService);
```

Replace the `highlight()` method:

```ts
  /** Lọc node khớp tên/chức danh qua OrgDataService, highlight kết quả đang chọn. */
  highlight(term: string): void {
    const results = this.orgDataService.search(term);
    this.matches.set(results);
    this.matchIndex.set(0);
    this.highlightCurrentMatch();
  }
```

with:

```ts
  /** Lọc node khớp tên/chức danh trong data hiện tại, highlight kết quả đang chọn. */
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

- [ ] **Step 4: Run the tests to confirm they pass**

Run: `npx ng test --watch=false 2>&1 | tail -20`
Expected: all `OrgChartComponent` tests pass (9 tests).

- [ ] **Step 5: Delete `OrgDataService.search()` (now dead code)**

In `src/app/services/org-data.service.ts`, remove:

```ts

  /** Tìm node theo tên hoặc chức danh (không phân biệt hoa/thường). */
  search(term: string): OrgNode[] {
    const keyword = term.trim().toLowerCase();
    if (!keyword) {
      return [];
    }
    return this._data().filter(
      (node) =>
        node.name.toLowerCase().includes(keyword) || node.title.toLowerCase().includes(keyword)
    );
  }
```

(the closing `}` of the class stays — this just removes the method body, leaving `setData()` as the last member).

- [ ] **Step 6: Remove the `search()` test from `org-data.service.spec.ts`**

In `src/app/services/org-data.service.spec.ts`, remove this test case:

```ts

  it('search() matches by name or title, case-insensitive', () => {
    service.setData(SAMPLE);
    expect(service.search('cntt')).toEqual([SAMPLE[1]]);
    expect(service.search('nguyen')).toEqual([SAMPLE[0]]);
    expect(service.search('')).toEqual([]);
  });
```

- [ ] **Step 7: Run the full suite and lint**

Run:
```bash
npx ng test --watch=false 2>&1 | tail -20
npm run lint 2>&1 | tail -20
```
Expected: all tests pass, lint clean.

- [ ] **Step 8: Commit**

```bash
git add src/app/org-chart/org-chart.component.ts src/app/org-chart/org-chart.component.spec.ts src/app/services/org-data.service.ts src/app/services/org-data.service.spec.ts
git commit -m "refactor: make OrgChartComponent search self-contained, drop OrgDataService dependency"
```

---

### Task 2: Add a configurable `legendItems` input to `OrgChartComponent`

**Files:**
- Modify: `src/app/org-chart/org-chart.component.ts`
- Modify: `src/app/org-chart/org-chart.component.html`
- Modify: `src/app/org-chart/org-chart.component.spec.ts`

**Interfaces:**
- Consumes: `OrgNodeTag` type from `src/app/models/org-node.model.ts` (already exists: `'independent' | 'executive' | 'regular'`).
- Produces: `export interface LegendItem { tagClass: OrgNodeTag; label: string; }` and `OrgChartComponent.legendItems: InputSignal<LegendItem[]>` (default value = the current 3-entry OCB legend). Task 5 imports `LegendItem` from this file and binds a 2-entry array for the branch tab.

- [ ] **Step 1: Write the failing tests**

Add to `src/app/org-chart/org-chart.component.spec.ts` (insert as new `it(...)` blocks anywhere inside the existing `describe('OrgChartComponent', ...)`, e.g. right after the `does not mark real nodes as dummy` test):

```ts
  it('renders the default OCB legend when legendItems is not provided', () => {
    const fixture = TestBed.createComponent(OrgChartComponent);
    fixture.componentRef.setInput('data', NODES);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const items = Array.from(compiled.querySelectorAll('.legend-item')).map((el) =>
      el.textContent?.trim()
    );
    expect(items).toEqual(['HĐQT / Ban Kiểm soát', 'Thành viên độc lập', 'Ban điều hành']);
  });

  it('renders custom legend items from the legendItems input', () => {
    const fixture = TestBed.createComponent(OrgChartComponent);
    fixture.componentRef.setInput('data', NODES);
    fixture.componentRef.setInput('legendItems', [
      { tagClass: 'executive', label: 'Quản lý' },
      { tagClass: 'regular', label: 'Nhân viên' },
    ]);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const items = Array.from(compiled.querySelectorAll('.legend-item')).map((el) =>
      el.textContent?.trim()
    );
    expect(items).toEqual(['Quản lý', 'Nhân viên']);
  });
```

- [ ] **Step 2: Run the tests to see the second one fail**

Run: `export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH" && npx ng test --watch=false 2>&1 | tail -30`
Expected: the "renders the default OCB legend" test passes already (matches current hardcoded markup); the "renders custom legend items" test FAILS because `setInput('legendItems', ...)` has no effect yet (no such input exists) and the DOM still shows the 3 hardcoded OCB entries instead of the 2 custom ones.

- [ ] **Step 3: Add the `LegendItem` type, default constant, and input**

In `src/app/org-chart/org-chart.component.ts`, change the model import line:

```ts
import { OrgNode } from '../models/org-node.model';
```

to:

```ts
import { OrgNode, OrgNodeTag } from '../models/org-node.model';
```

Add, right after the imports and before the `@Component` decorator:

```ts
export interface LegendItem {
  tagClass: OrgNodeTag;
  label: string;
}

const DEFAULT_LEGEND_ITEMS: LegendItem[] = [
  { tagClass: 'regular', label: 'HĐQT / Ban Kiểm soát' },
  { tagClass: 'independent', label: 'Thành viên độc lập' },
  { tagClass: 'executive', label: 'Ban điều hành' },
];
```

Add the input field right after `readonly data = input.required<OrgNode[]>();`:

```ts
  /** Chú giải màu sắc hiển thị dưới toolbar; mặc định là legend của OCB. */
  readonly legendItems = input<LegendItem[]>(DEFAULT_LEGEND_ITEMS);
```

(`input` is already imported from `@angular/core` in this file — no new import needed for that.)

- [ ] **Step 4: Update the template to render the legend from the input**

In `src/app/org-chart/org-chart.component.html`, replace:

```html
    <div class="org-chart-legend" role="list" aria-label="Chú giải màu sắc">
      <span class="legend-item" role="listitem"><i class="legend-dot legend-dot--regular"></i>HĐQT / Ban Kiểm soát</span>
      <span class="legend-item" role="listitem"><i class="legend-dot legend-dot--independent"></i>Thành viên độc lập</span>
      <span class="legend-item" role="listitem"><i class="legend-dot legend-dot--executive"></i>Ban điều hành</span>
    </div>
```

with:

```html
    <div class="org-chart-legend" role="list" aria-label="Chú giải màu sắc">
      @for (item of legendItems(); track item.tagClass) {
        <span class="legend-item" role="listitem"><i class="legend-dot legend-dot--{{ item.tagClass }}"></i>{{ item.label }}</span>
      }
    </div>
```

- [ ] **Step 5: Run the tests to confirm both pass**

Run: `npx ng test --watch=false 2>&1 | tail -20`
Expected: all `OrgChartComponent` tests pass (11 tests now).

- [ ] **Step 6: Run lint**

Run: `npm run lint 2>&1 | tail -20`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/app/org-chart/org-chart.component.ts src/app/org-chart/org-chart.component.html src/app/org-chart/org-chart.component.spec.ts
git commit -m "feat: make org chart legend configurable via a legendItems input"
```

---

### Task 3: Add the placeholder Chi nhánh/PGD data file

**Files:**
- Create: `public/data/branch-org.json`

**Interfaces:**
- Produces: a `data/branch-org.json` static asset (served the same way `data/org-chart.json` already is, via the `public/` asset glob in `angular.json`), shaped as `OrgNode[]` — 10 nodes: 1 Giám đốc Chi nhánh → 3 Phòng giao dịch, each with 1 Trưởng PGD + 2 nhân viên. Task 4's `BranchDataService.load()` fetches this exact path.

- [ ] **Step 1: Create the file**

Create `public/data/branch-org.json`:

```json
[
  { "id": "cn-giamdoc", "parentId": null, "name": "Giám đốc Chi nhánh (Mẫu)", "title": "Giám đốc Chi nhánh", "department": "Chi nhánh Ví dụ", "tag": "executive" },
  { "id": "pgd1-truong", "parentId": "cn-giamdoc", "name": "Trưởng PGD Số 1", "title": "Trưởng Phòng giao dịch", "department": "PGD Số 1", "tag": "executive" },
  { "id": "pgd1-nv1", "parentId": "pgd1-truong", "name": "Nhân viên A - PGD Số 1", "title": "Giao dịch viên", "department": "PGD Số 1", "tag": "regular" },
  { "id": "pgd1-nv2", "parentId": "pgd1-truong", "name": "Nhân viên B - PGD Số 1", "title": "Giao dịch viên", "department": "PGD Số 1", "tag": "regular" },
  { "id": "pgd2-truong", "parentId": "cn-giamdoc", "name": "Trưởng PGD Số 2", "title": "Trưởng Phòng giao dịch", "department": "PGD Số 2", "tag": "executive" },
  { "id": "pgd2-nv1", "parentId": "pgd2-truong", "name": "Nhân viên A - PGD Số 2", "title": "Giao dịch viên", "department": "PGD Số 2", "tag": "regular" },
  { "id": "pgd2-nv2", "parentId": "pgd2-truong", "name": "Nhân viên B - PGD Số 2", "title": "Giao dịch viên", "department": "PGD Số 2", "tag": "regular" },
  { "id": "pgd3-truong", "parentId": "cn-giamdoc", "name": "Trưởng PGD Số 3", "title": "Trưởng Phòng giao dịch", "department": "PGD Số 3", "tag": "executive" },
  { "id": "pgd3-nv1", "parentId": "pgd3-truong", "name": "Nhân viên A - PGD Số 3", "title": "Giao dịch viên", "department": "PGD Số 3", "tag": "regular" },
  { "id": "pgd3-nv2", "parentId": "pgd3-truong", "name": "Nhân viên B - PGD Số 3", "title": "Giao dịch viên", "department": "PGD Số 3", "tag": "regular" }
]
```

- [ ] **Step 2: Validate the JSON and node/parent integrity**

Run:
```bash
python3 -c "
import json
d = json.load(open('public/data/branch-org.json'))
print('nodes:', len(d))
ids = {n['id'] for n in d}
print('unique ids:', len(ids))
print('orphan parentId refs:', [n['id'] for n in d if n['parentId'] and n['parentId'] not in ids])
"
```
Expected: `nodes: 10`, `unique ids: 10`, `orphan parentId refs: []`.

- [ ] **Step 3: Commit**

```bash
git add public/data/branch-org.json
git commit -m "data: add placeholder Chi nhánh/PGD org chart data"
```

---

### Task 4: Add `BranchDataService`

**Files:**
- Create: `src/app/services/branch-data.service.ts`
- Create: `src/app/services/branch-data.service.spec.ts`

**Interfaces:**
- Consumes: `public/data/branch-org.json` (Task 3), `OrgNode` model (unchanged).
- Produces: `BranchDataService.data: Signal<OrgNode[]>`, `.status: Signal<'idle'|'loading'|'loaded'|'error'>`, `.isLoading: Signal<boolean>`, `.hasError: Signal<boolean>`, `.load(): void`, `.setData(nodes: OrgNode[]): void` — same shape as `OrgDataService` minus `search()`. Task 5's `App` injects this alongside `OrgDataService`.

- [ ] **Step 1: Write the failing service spec**

Create `src/app/services/branch-data.service.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { BranchDataService } from './branch-data.service';
import { OrgNode } from '../models/org-node.model';

const SAMPLE: OrgNode[] = [
  { id: 'cn', parentId: null, name: 'Giám đốc CN', title: 'Giám đốc Chi nhánh', tag: 'executive' },
  { id: 'pgd1', parentId: 'cn', name: 'Trưởng PGD 1', title: 'Trưởng Phòng giao dịch', tag: 'executive' },
];

describe('BranchDataService', () => {
  let service: BranchDataService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(BranchDataService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('starts idle with no data', () => {
    expect(service.data()).toEqual([]);
    expect(service.status()).toBe('idle');
  });

  it('loads data from the JSON asset and sets status to loaded', () => {
    service.load();
    expect(service.isLoading()).toBe(true);

    const req = httpMock.expectOne('data/branch-org.json');
    req.flush(SAMPLE);

    expect(service.status()).toBe('loaded');
    expect(service.data()).toEqual(SAMPLE);
  });

  it('sets status to error when the request fails', () => {
    service.load();
    const req = httpMock.expectOne('data/branch-org.json');
    req.flush('fail', { status: 500, statusText: 'Server Error' });

    expect(service.hasError()).toBe(true);
    expect(service.data()).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to see it fail**

Run: `export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH" && npx ng test --watch=false 2>&1 | tail -30`
Expected: FAIL — `Cannot find module './branch-data.service'`.

- [ ] **Step 3: Implement the service**

Create `src/app/services/branch-data.service.ts`:

```ts
import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { catchError, of, tap } from 'rxjs';
import { OrgNode } from '../models/org-node.model';

export type BranchDataStatus = 'idle' | 'loading' | 'loaded' | 'error';

@Injectable({ providedIn: 'root' })
export class BranchDataService {
  private readonly http = inject(HttpClient);

  private readonly _data = signal<OrgNode[]>([]);
  private readonly _status = signal<BranchDataStatus>('idle');

  /** Toàn bộ danh sách node chi nhánh/PGD (dạng phẳng, id/parentId). */
  readonly data = this._data.asReadonly();
  readonly status = this._status.asReadonly();
  readonly isLoading = computed(() => this._status() === 'loading');
  readonly hasError = computed(() => this._status() === 'error');

  /** Tải dữ liệu từ file JSON tĩnh (public/data/branch-org.json). */
  load(): void {
    this._status.set('loading');
    this.http
      .get<OrgNode[]>('data/branch-org.json')
      .pipe(
        tap((nodes) => {
          this._data.set(nodes);
          this._status.set('loaded');
        }),
        catchError(() => {
          this._status.set('error');
          return of([] as OrgNode[]);
        })
      )
      .subscribe();
  }

  /** Thay dữ liệu trực tiếp (dùng trong test). */
  setData(nodes: OrgNode[]): void {
    this._data.set(nodes);
    this._status.set('loaded');
  }
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npx ng test --watch=false 2>&1 | tail -20`
Expected: all `BranchDataService` tests pass (3 tests).

- [ ] **Step 5: Run lint**

Run: `npm run lint 2>&1 | tail -20`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/app/services/branch-data.service.ts src/app/services/branch-data.service.spec.ts
git commit -m "feat: add BranchDataService for the Chi nhánh/PGD dataset"
```

---

### Task 5: Add the tab switcher to `App` and wire up both charts

**Files:**
- Modify: `src/app/app.ts`
- Modify: `src/app/app.html`
- Modify: `src/app/app.scss`
- Modify: `src/app/app.spec.ts`

**Interfaces:**
- Consumes: `LegendItem` type from `src/app/org-chart/org-chart.component.ts` (Task 2), `BranchDataService` (Task 4), `OrgDataService` (unchanged, minus `search()` from Task 1).
- Produces: `App.activeTab: WritableSignal<'ocb' | 'branch'>` — no other task depends on this; `App` is the top of the component tree.

- [ ] **Step 1: Update `App`'s tests for the new tab structure and dual HTTP requests**

Replace `src/app/app.spec.ts` in full:

```ts
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { App } from './app';

describe('App', () => {
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  function flushBoth(): void {
    httpMock.expectOne('data/org-chart.json').flush([]);
    httpMock.expectOne('data/branch-org.json').flush([]);
  }

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
    flushBoth();
  });

  it('should render the header with both tabs', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Cơ cấu tổ chức');
    const tabs = Array.from(compiled.querySelectorAll('.app-tab')).map((el) => el.textContent?.trim());
    expect(tabs).toEqual(['Sơ đồ OCB', 'Sơ đồ Chi nhánh/PGD']);
    flushBoth();
  });

  it('shows a loading indicator while data is in flight', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.app-status')?.textContent).toContain('Đang tải');
    flushBoth();
  });

  it('shows an error state and can retry for the OCB tab', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    httpMock.expectOne('data/org-chart.json').flush('fail', { status: 500, statusText: 'Server Error' });
    httpMock.expectOne('data/branch-org.json').flush([]);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.app-status--error')).toBeTruthy();

    (compiled.querySelector('.app-status--error button') as HTMLButtonElement).click();
    httpMock.expectOne('data/org-chart.json').flush([]);
  });

  it('opens the detail panel when a node is clicked and closes it on close', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    httpMock.expectOne('data/org-chart.json').flush([
      { id: 'a', parentId: null, name: 'Alice', title: 'Chủ tịch', tag: 'regular' },
    ]);
    httpMock.expectOne('data/branch-org.json').flush([]);
    fixture.detectChanges();

    fixture.componentInstance['onNodeClick']({
      id: 'a',
      parentId: null,
      name: 'Alice',
      title: 'Chủ tịch',
      tag: 'regular',
    });
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.detail-panel')).toBeTruthy();

    compiled.querySelector<HTMLButtonElement>('.detail-panel__close')!.click();
    fixture.detectChanges();
    expect(compiled.querySelector('.detail-panel')).toBeNull();
  });

  it('switching to the Chi nhánh/PGD tab renders the branch dataset and its legend', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    httpMock.expectOne('data/org-chart.json').flush([
      { id: 'a', parentId: null, name: 'Alice', title: 'Chủ tịch', tag: 'regular' },
    ]);
    httpMock.expectOne('data/branch-org.json').flush([
      { id: 'cn', parentId: null, name: 'Giám đốc CN', title: 'Giám đốc Chi nhánh', tag: 'executive' },
    ]);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const tabs = Array.from(compiled.querySelectorAll('.app-tab'));
    const branchTab = tabs.find((el) => el.textContent?.includes('Chi nhánh')) as HTMLButtonElement;
    branchTab.click();
    fixture.detectChanges();

    const legendLabels = Array.from(compiled.querySelectorAll('.legend-item')).map((el) =>
      el.textContent?.trim()
    );
    expect(legendLabels).toEqual(['Quản lý (GĐ chi nhánh/Trưởng PGD)', 'Nhân viên']);
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH" && npx ng test --watch=false 2>&1 | tail -40`
Expected: FAIL — `App` doesn't yet inject `BranchDataService`, doesn't fire a `data/branch-org.json` request, has no `.app-tab` elements, and the `<h1>` still says "Sơ đồ tổ chức — Ngân hàng OCB".

- [ ] **Step 3: Update `App`'s component class**

Replace `src/app/app.ts` in full:

```ts
import { Component, inject, OnInit, signal } from '@angular/core';
import { OrgChartComponent, LegendItem } from './org-chart/org-chart.component';
import { DetailPanelComponent } from './detail-panel/detail-panel.component';
import { OrgDataService } from './services/org-data.service';
import { BranchDataService } from './services/branch-data.service';
import { OrgNode } from './models/org-node.model';

const BRANCH_LEGEND_ITEMS: LegendItem[] = [
  { tagClass: 'executive', label: 'Quản lý (GĐ chi nhánh/Trưởng PGD)' },
  { tagClass: 'regular', label: 'Nhân viên' },
];

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [OrgChartComponent, DetailPanelComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  protected readonly orgDataService = inject(OrgDataService);
  protected readonly branchDataService = inject(BranchDataService);

  protected readonly selectedNode = signal<OrgNode | null>(null);
  protected readonly activeTab = signal<'ocb' | 'branch'>('ocb');
  protected readonly branchLegendItems = BRANCH_LEGEND_ITEMS;

  ngOnInit(): void {
    this.orgDataService.load();
    this.branchDataService.load();
  }

  protected onNodeClick(node: OrgNode): void {
    this.selectedNode.set(node);
  }
}
```

- [ ] **Step 4: Update `App`'s template**

Replace `src/app/app.html` in full:

```html
<div class="app-shell">
  <header class="app-header">
    <div class="app-header__top">
      <h1>Cơ cấu tổ chức</h1>
      <div class="app-tabs" role="tablist" aria-label="Chọn sơ đồ tổ chức">
        <button
          type="button"
          role="tab"
          class="app-tab"
          [class.app-tab--active]="activeTab() === 'ocb'"
          [attr.aria-selected]="activeTab() === 'ocb'"
          (click)="activeTab.set('ocb')"
        >
          Sơ đồ OCB
        </button>
        <button
          type="button"
          role="tab"
          class="app-tab"
          [class.app-tab--active]="activeTab() === 'branch'"
          [attr.aria-selected]="activeTab() === 'branch'"
          (click)="activeTab.set('branch')"
        >
          Sơ đồ Chi nhánh/PGD
        </button>
      </div>
    </div>
    <p class="app-subtitle">
      @if (activeTab() === 'ocb') {
        Dữ liệu Hội đồng quản trị, Ban Kiểm soát và Ban điều hành lấy từ ocb.com.vn
      } @else {
        Dữ liệu mẫu — chỉnh sửa tại public/data/branch-org.json
      }
    </p>
  </header>

  <main class="app-main">
    @if (activeTab() === 'ocb') {
      @if (orgDataService.isLoading()) {
        <div class="app-status" role="status">Đang tải dữ liệu sơ đồ tổ chức...</div>
      } @else if (orgDataService.hasError()) {
        <div class="app-status app-status--error" role="alert">
          Không tải được dữ liệu.
          <button type="button" (click)="orgDataService.load()">Thử lại</button>
        </div>
      } @else {
        <div class="app-main__content">
          <app-org-chart [data]="orgDataService.data()" (nodeClick)="onNodeClick($event)" />
          <app-detail-panel [node]="selectedNode()" (closed)="selectedNode.set(null)" />
        </div>
      }
    } @else {
      @if (branchDataService.isLoading()) {
        <div class="app-status" role="status">Đang tải dữ liệu chi nhánh/PGD...</div>
      } @else if (branchDataService.hasError()) {
        <div class="app-status app-status--error" role="alert">
          Không tải được dữ liệu.
          <button type="button" (click)="branchDataService.load()">Thử lại</button>
        </div>
      } @else {
        <div class="app-main__content">
          <app-org-chart
            [data]="branchDataService.data()"
            [legendItems]="branchLegendItems"
            (nodeClick)="onNodeClick($event)"
          />
          <app-detail-panel [node]="selectedNode()" (closed)="selectedNode.set(null)" />
        </div>
      }
    }
  </main>
</div>
```

- [ ] **Step 5: Add tab styling to `app.scss`**

In `src/app/app.scss`, replace:

```scss
.app-header {
  padding: 14px 20px;
  background: #0b3d68;
  color: #fff;

  h1 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
  }
}
```

with:

```scss
.app-header {
  padding: 14px 20px;
  background: #0b3d68;
  color: #fff;

  h1 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
  }
}

.app-header__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.app-tabs {
  display: flex;
  gap: 8px;
}

.app-tab {
  border: 1px solid rgba(255, 255, 255, 0.4);
  background: transparent;
  color: #cfe0f2;
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.12);
  }

  &--active {
    background: #fff;
    color: #0b3d68;
    border-color: #fff;
  }
}
```

- [ ] **Step 6: Run the tests to confirm they pass**

Run: `npx ng test --watch=false 2>&1 | tail -30`
Expected: all `App` tests pass (6 tests).

- [ ] **Step 7: Run lint**

Run: `npm run lint 2>&1 | tail -20`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add src/app/app.ts src/app/app.html src/app/app.scss src/app/app.spec.ts
git commit -m "feat: add tab switcher between OCB and Chi nhánh/PGD org charts"
```

---

### Task 6: Final verification — lint, full test suite, production build, manual smoke test

**Files:** none created; verification only.

- [ ] **Step 1: Run lint across the whole project**

Run: `export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH" && npm run lint 2>&1 | tail -20`
Expected: no errors.

- [ ] **Step 2: Run the full test suite**

Run: `npx ng test --watch=false 2>&1 | tail -30`
Expected: all specs pass (`App`, `OrgDataService`, `BranchDataService`, `OrgChartComponent`, `DetailPanelComponent`).

- [ ] **Step 3: Run a production build**

Run: `npx ng build 2>&1 | tail -20`
Expected: succeeds within the budgets defined in `angular.json`. If the `anyComponentStyle` budget is exceeded by `org-chart.component.scss` or `app.scss`, raise `maximumWarning`/`maximumError` for `anyComponentStyle` in `angular.json` only as much as needed to pass, and note the exact new values used.

- [ ] **Step 4: Manually smoke-test in a real browser**

Start the dev server (`npm start`) in the background, navigate to `http://localhost:4200`, and verify:
- Default view shows the "Sơ đồ OCB" tab active, with the OCB chart (HĐQT/Ban Kiểm soát/Ban điều hành) rendered.
- Clicking "Sơ đồ Chi nhánh/PGD" switches to the branch chart: 1 Giám đốc Chi nhánh at the root, 3 Phòng giao dịch below, each with 2 nhân viên. Legend shows exactly "Quản lý (GĐ chi nhánh/Trưởng PGD)" and "Nhân viên" (not the OCB 3-entry legend).
- Typing a search term on the OCB tab only matches OCB nodes; switching to the branch tab and searching only matches branch nodes (confirms no cross-talk between the two datasets).
- Clicking a node on either tab opens the detail panel with the correct name/title.
- Zoom in/out, layout toggle, and export buttons work on both tabs without throwing (check the browser console).
- Switching tabs back and forth doesn't error and each tab re-renders correctly.

Stop the dev server when done.

- [ ] **Step 5: Fix any regressions found, then commit**

```bash
git add -A
git commit -m "chore: final lint/test/build verification pass for dual org chart feature"
```

(Skip this commit if Step 4 required no code changes.)
