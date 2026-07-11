# OCB Org Chart App Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the code-quality gaps found in review (strict typing, lint, dead code, no error handling, no a11y, no responsiveness, hardcoded data) and add the agreed feature set (JSON-backed data loading, detail panel, zoom/layout/export controls, multi-match search) to the OCB org chart Angular app.

**Architecture:** Keep the existing standalone-component + signals architecture. Data moves from a hardcoded `.ts` array to a static JSON asset loaded via `HttpClient` inside `OrgDataService`, which becomes the single source of truth for both the full node list and search matching (removing the duplicate filter logic currently living in `OrgChartComponent`). A new `DetailPanelComponent` renders node details on click. `OrgChartComponent` gains toolbar controls (zoom, layout direction, export, multi-match search) and defensive error handling around `d3-org-chart` initialization.

**Tech Stack:** Angular 22 (standalone, signals), `@angular/common/http`, d3-org-chart 3.1.1, Vitest (jsdom), ESLint (flat config) + `angular-eslint`, Prettier.

## Global Constraints

- Node version: v24.18.0 (see `.nvmrc`) — run `nvm use` before any `npm`/`ng` command.
- Angular 22 standalone components only — no NgModules, no `@Input()`/`@Output()` decorators (use `input()`/`output()`), no constructor DI where `inject()` fits existing style (mixed usage already exists in the repo — match whichever a given file already uses).
- Do **not** remove or newly wire up `@angular/forms` / `@angular/router` — user has decided to leave them as unused dependencies (used in a downstream repo). Do not touch `package.json`'s existing dependency list except to *add* new devDependencies for ESLint.
- All UI copy stays in Vietnamese, matching existing tone.
- Tests run via `ng test` (Vitest + jsdom, already configured in `angular.json`). Every task that touches logic must add/update a spec file.
- Format touched files with the project's Prettier config (`.prettierrc`) — run `npx prettier --write <files>` before committing if you hand-format anything.
- Commit after every task with a descriptive message; never batch multiple tasks into one commit.
- `git` remote is intentionally not configured yet — do not push; the user will handle that separately.

---

### Task 1: Enable TypeScript strict mode and fix the resulting errors

**Files:**
- Modify: `tsconfig.json`
- Modify: `src/app/org-chart/org-chart.component.ts:110` (remove the `any`)

**Interfaces:**
- Produces: `OrgChartComponent.initChart()`'s `onNodeClick` callback now typed against the ambient `D3OrgChartHierarchyNode<OrgNode> | OrgNode` union declared in `d3-org-chart.d.ts` instead of `any`.

- [ ] **Step 1: Turn on strict mode**

Edit `tsconfig.json` compilerOptions to add `"strict": true` alongside the existing flags:

```json
{
  "compileOnSave": false,
  "compilerOptions": {
    "strict": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "experimentalDecorators": true,
    "importHelpers": true,
    "target": "ES2022",
    "module": "preserve"
  },
  "angularCompilerOptions": {
    "enableI18nLegacyMessageIdFormat": false,
    "strictInjectionParameters": true,
    "strictInputAccessModifiers": true,
    "strictTemplates": true
  },
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.spec.json" }
  ]
}
```

- [ ] **Step 2: Build and list resulting errors**

Run: `nvm use && npx ng build 2>&1 | tee /tmp/strict-build.log`
Expected: one or more TS errors, at minimum in `org-chart.component.ts` around the `(d: any)` callback parameter.

- [ ] **Step 3: Fix the `any` in `onNodeClick`**

In `src/app/org-chart/org-chart.component.ts`, replace:

```ts
      .onNodeClick((d: any) => {
        const node: OrgNode = d?.data ?? d;
        this.zone.run(() => this.nodeClick.emit(node));
      })
```

with:

```ts
      .onNodeClick((d) => {
        const node: OrgNode = 'data' in d ? d.data : d;
        this.zone.run(() => this.nodeClick.emit(node));
      })
```

- [ ] **Step 4: Fix any other strict-mode errors reported in Step 2**

Address each remaining error at its reported file/line individually (likely candidates: implicit `any` on event handler params, nullable access on `viewChild`/`ElementRef`). Re-run the build after each fix.

- [ ] **Step 5: Re-run build to confirm clean**

Run: `npx ng build 2>&1 | tail -30`
Expected: build succeeds with no TS errors.

- [ ] **Step 6: Commit**

```bash
git add tsconfig.json src/app/org-chart/org-chart.component.ts
git commit -m "chore: enable TypeScript strict mode and remove any usage"
```

---

### Task 2: Add ESLint (flat config) for TS + Angular templates

**Files:**
- Create: `eslint.config.js`
- Modify: `package.json` (devDependencies + `lint` script)

**Interfaces:**
- Produces: `npm run lint` command usable by later tasks and CI.

- [ ] **Step 1: Install ESLint + angular-eslint**

Run:
```bash
nvm use
npm install -D eslint@^9 @eslint/js@^9 typescript-eslint@^8 angular-eslint@^19
```
Expected: packages added to `devDependencies` in `package.json`, `package-lock.json` updated.

- [ ] **Step 2: Create the flat config**

Create `eslint.config.js`:

```js
// @ts-check
const eslint = require('@eslint/js');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');

module.exports = tseslint.config(
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
      ...angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: 'app', style: 'kebab-case' },
      ],
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: 'app', style: 'camelCase' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    files: ['**/*.html'],
    extends: [...angular.configs.templateRecommended, ...angular.configs.templateAccessibility],
  }
);
```

- [ ] **Step 3: Add the lint script**

In `package.json` `"scripts"`, add:

```json
    "lint": "eslint ."
```

(insert alphabetically after `"build"`, keeping the existing `ng`/`start`/`build`/`watch`/`test` entries untouched).

- [ ] **Step 4: Run lint and fix reported issues**

Run: `npm run lint`
Expected: some findings (e.g. missing accessibility rules on the toolbar buttons/search input, possibly the raw HTML string in `renderCard`). Fix straightforward ones now (e.g. add `type="button"` where missing — already present). Leave template-accessibility findings on `renderCard`'s raw HTML string as-is for now; they'll be resolved by Task 7 (accessibility task) — note them here for that task's author: run `npm run lint` again after Task 7 to confirm they're gone.

- [ ] **Step 5: Commit**

```bash
git add eslint.config.js package.json package-lock.json
git commit -m "chore: add ESLint flat config with angular-eslint"
```

---

### Task 3: Replace the `[Dummy]` name-prefix hack with a typed `isDummy` field

**Files:**
- Modify: `src/app/models/org-node.model.ts`
- Modify: `src/app/data/ocb-org-data.ts`
- Modify: `src/app/org-chart/org-chart.component.ts:117-145` (`renderCard`)
- Test: `src/app/org-chart/org-chart.component.spec.ts` (new — card rendering behavior)

**Interfaces:**
- Produces: `OrgNode.isDummy?: boolean` — later tasks (JSON migration in Task 4, detail panel in Task 12) read this field instead of parsing `name`.

- [ ] **Step 1: Add the field to the model**

In `src/app/models/org-node.model.ts`, add `isDummy?: boolean;` to the interface:

```ts
export type OrgNodeTag = 'independent' | 'executive' | 'regular';

/**
 * Flat node shape consumed by d3-org-chart.
 * The library builds the tree itself from `id` / `parentId` — no need
 * to nest children manually.
 */
export interface OrgNode {
  id: string;
  parentId: string | null;
  name: string;
  title: string;
  department?: string;
  imageUrl?: string;
  tag?: OrgNodeTag;
  isDummy?: boolean;
}
```

- [ ] **Step 2: Strip the `[Dummy] ` prefix from names and add `isDummy: true` in the data file**

In `src/app/data/ocb-org-data.ts`, for every node whose `name` currently starts with `'[Dummy] '`, remove that prefix from `name` and add `isDummy: true`. Example transformation for the `ceo` entry:

Before:
```ts
{ id: 'ceo', parentId: 'hdqt-chairman', name: '[Dummy] Nguyễn Văn A', title: 'Tổng Giám đốc', department: 'Ban điều hành', tag: 'executive' },
```

After:
```ts
{ id: 'ceo', parentId: 'hdqt-chairman', name: 'Nguyễn Văn A', title: 'Tổng Giám đốc', department: 'Ban điều hành', tag: 'executive', isDummy: true },
```

Apply the same transform to all 25 dummy nodes (`ceo`, `deputy-khcn`, `deputy-khdn`, `deputy-vanhanh`, `deputy-rui-ro`, `director-cntt`, `director-taichinh`, `director-nhansu`, `khcn-p1`, `khcn-p2`, `khcn-p3`, `khdn-p1`, `khdn-p2`, `khdn-p3`, `vh-p1`, `vh-p2`, `rr-p1`, `rr-p2`, `cntt-p1`, `cntt-p2`, `tc-p1`, `tc-p2`, `ns-p1`, `ns-p2`). The 9 real HĐQT nodes are untouched (no `isDummy` field — `undefined` means "real").

- [ ] **Step 3: Update `renderCard` to use the field instead of string parsing**

In `src/app/org-chart/org-chart.component.ts`, replace:

```ts
  private renderCard(node: OrgNode): string {
    const displayName = node.name.replace('[Dummy] ', '');
    const initials = displayName
      .split(' ')
      .filter(Boolean)
      .slice(-2)
      .map((part) => part[0])
      .join('')
      .toUpperCase();
    const tagClass = `org-card--${node.tag ?? 'regular'}`;
    const isDummy = node.name.startsWith('[Dummy]');

    return `
      <div class="org-card ${tagClass}">
        <div class="org-card__avatar">${initials}</div>
        <div class="org-card__body">
          <div class="org-card__name">${this.escape(displayName)}${
      isDummy ? ' <span class="org-card__dummy">(dummy)</span>' : ''
    }</div>
          <div class="org-card__title">${this.escape(node.title)}</div>
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

with:

```ts
  private renderCard(node: OrgNode): string {
    const initials = node.name
      .split(' ')
      .filter(Boolean)
      .slice(-2)
      .map((part) => part[0])
      .join('')
      .toUpperCase();
    const tagClass = `org-card--${node.tag ?? 'regular'}`;

    return `
      <div class="org-card ${tagClass}" tabindex="0" role="button" data-node-id="${node.id}" aria-label="${this.escape(node.name)}, ${this.escape(node.title)}">
        <div class="org-card__avatar">${initials}</div>
        <div class="org-card__body">
          <div class="org-card__name">${this.escape(node.name)}${
      node.isDummy ? ' <span class="org-card__dummy">(dummy)</span>' : ''
    }</div>
          <div class="org-card__title">${this.escape(node.title)}</div>
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

(the `tabindex`/`role`/`data-node-id`/`aria-label` additions are consumed by Task 7's keyboard-navigation work — adding them now avoids touching this template string twice.)

- [ ] **Step 4: Write a test for the card rendering / dummy badge**

Create `src/app/org-chart/org-chart.component.spec.ts`:

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
});
```

- [ ] **Step 5: Run the test**

Run: `nvm use && npx ng test --watch=false`
Expected: both new tests pass. (`renderCard` is private — TypeScript allows the bracket-access cast used above; if the test runner's strict mode rejects it, add `// eslint-disable-next-line @typescript-eslint/no-explicit-any` is not needed since we cast via `unknown` first.)

- [ ] **Step 6: Commit**

```bash
git add src/app/models/org-node.model.ts src/app/data/ocb-org-data.ts src/app/org-chart/org-chart.component.ts src/app/org-chart/org-chart.component.spec.ts
git commit -m "refactor: replace [Dummy] name-prefix hack with typed isDummy field"
```

---

### Task 4: Move org data to a JSON asset loaded via HttpClient, with loading/error state

**Files:**
- Create: `public/data/org-chart.json`
- Delete: `src/app/data/ocb-org-data.ts`
- Modify: `src/app/services/org-data.service.ts`
- Modify: `src/app/app.config.ts` (add `provideHttpClient`)
- Modify: `src/app/app.ts` (trigger `load()`, expose status)
- Modify: `src/app/app.html` (loading/error UI)
- Test: `src/app/services/org-data.service.spec.ts` (new)

**Interfaces:**
- Consumes: `OrgNode` from `../models/org-node.model` (Task 3's `isDummy` field).
- Produces: `OrgDataService.status: Signal<'idle' | 'loading' | 'loaded' | 'error'>`, `OrgDataService.isLoading: Signal<boolean>`, `OrgDataService.hasError: Signal<boolean>`, `OrgDataService.load(): void`, `OrgDataService.data: Signal<OrgNode[]>` (unchanged shape), `OrgDataService.search(term: string): OrgNode[]` (unchanged, still used by Task 11).

- [ ] **Step 1: Create the JSON asset**

Create `public/data/org-chart.json` with the full node list (same 34 nodes as `ocb-org-data.ts` after Task 3's `isDummy` migration), as a plain JSON array:

```json
[
  { "id": "hdqt-chairman", "parentId": null, "name": "Trịnh Văn Tuấn", "title": "Chủ tịch Hội đồng quản trị", "department": "Hội đồng quản trị", "tag": "regular" },
  { "id": "hdqt-01", "parentId": "hdqt-chairman", "name": "Ngô Hà Bắc", "title": "Thành viên HĐQT", "department": "Hội đồng quản trị", "tag": "regular" },
  { "id": "hdqt-02", "parentId": "hdqt-chairman", "name": "Trịnh Thị Mai Anh", "title": "Thành viên HĐQT", "department": "Hội đồng quản trị", "tag": "regular" },
  { "id": "hdqt-03", "parentId": "hdqt-chairman", "name": "Yoshizawa Toshiki", "title": "Thành viên HĐQT", "department": "Hội đồng quản trị", "tag": "regular" },
  { "id": "hdqt-04", "parentId": "hdqt-chairman", "name": "Segawa Mitsuhiro", "title": "Thành viên HĐQT", "department": "Hội đồng quản trị", "tag": "regular" },
  { "id": "hdqt-05", "parentId": "hdqt-chairman", "name": "Phan Trung", "title": "Thành viên HĐQT", "department": "Hội đồng quản trị", "tag": "regular" },
  { "id": "hdqt-06", "parentId": "hdqt-chairman", "name": "Dương Kỳ Hiệp", "title": "Thành viên độc lập HĐQT", "department": "Hội đồng quản trị", "tag": "independent" },
  { "id": "hdqt-07", "parentId": "hdqt-chairman", "name": "Lê Xuân Nghĩa", "title": "Thành viên độc lập HĐQT", "department": "Hội đồng quản trị", "tag": "independent" },
  { "id": "ceo", "parentId": "hdqt-chairman", "name": "Nguyễn Văn A", "title": "Tổng Giám đốc", "department": "Ban điều hành", "tag": "executive", "isDummy": true },
  { "id": "deputy-khcn", "parentId": "ceo", "name": "Trần Thị B", "title": "Phó Tổng Giám đốc phụ trách Khối KHCN", "department": "Ban điều hành", "tag": "executive", "isDummy": true },
  { "id": "deputy-khdn", "parentId": "ceo", "name": "Lê Văn C", "title": "Phó Tổng Giám đốc phụ trách Khối KHDN", "department": "Ban điều hành", "tag": "executive", "isDummy": true },
  { "id": "deputy-vanhanh", "parentId": "ceo", "name": "Phạm Thị D", "title": "Phó Tổng Giám đốc phụ trách Khối Vận hành", "department": "Ban điều hành", "tag": "executive", "isDummy": true },
  { "id": "deputy-rui-ro", "parentId": "ceo", "name": "Hoàng Văn E", "title": "Phó Tổng Giám đốc kiêm Giám đốc Khối Quản trị rủi ro", "department": "Ban điều hành", "tag": "executive", "isDummy": true },
  { "id": "director-cntt", "parentId": "ceo", "name": "Vũ Thị F", "title": "Giám đốc Khối CNTT & Chuyển đổi số", "department": "Ban điều hành", "tag": "executive", "isDummy": true },
  { "id": "director-taichinh", "parentId": "ceo", "name": "Đặng Văn G", "title": "Giám đốc Khối Tài chính", "department": "Ban điều hành", "tag": "executive", "isDummy": true },
  { "id": "director-nhansu", "parentId": "ceo", "name": "Bùi Thị H", "title": "Giám đốc Khối Nhân sự", "department": "Ban điều hành", "tag": "executive", "isDummy": true },
  { "id": "khcn-p1", "parentId": "deputy-khcn", "name": "Ngô Thị I", "title": "Trưởng phòng Sản phẩm bán lẻ", "department": "Khối KHCN", "tag": "regular", "isDummy": true },
  { "id": "khcn-p2", "parentId": "deputy-khcn", "name": "Đỗ Văn K", "title": "Trưởng phòng Kênh phân phối", "department": "Khối KHCN", "tag": "regular", "isDummy": true },
  { "id": "khcn-p3", "parentId": "deputy-khcn", "name": "Lý Thị L", "title": "Trưởng phòng Ngân hàng ưu tiên", "department": "Khối KHCN", "tag": "regular", "isDummy": true },
  { "id": "khdn-p1", "parentId": "deputy-khdn", "name": "Trương Văn M", "title": "Trưởng phòng KH Doanh nghiệp lớn", "department": "Khối KHDN", "tag": "regular", "isDummy": true },
  { "id": "khdn-p2", "parentId": "deputy-khdn", "name": "Phan Thị N", "title": "Trưởng phòng SME", "department": "Khối KHDN", "tag": "regular", "isDummy": true },
  { "id": "khdn-p3", "parentId": "deputy-khdn", "name": "Vương Văn O", "title": "Trưởng phòng Tài trợ thương mại", "department": "Khối KHDN", "tag": "regular", "isDummy": true },
  { "id": "vh-p1", "parentId": "deputy-vanhanh", "name": "Chu Thị P", "title": "Trưởng phòng Vận hành giao dịch", "department": "Khối Vận hành", "tag": "regular", "isDummy": true },
  { "id": "vh-p2", "parentId": "deputy-vanhanh", "name": "Kiều Văn Q", "title": "Trưởng phòng Quản lý mạng lưới CN/PGD", "department": "Khối Vận hành", "tag": "regular", "isDummy": true },
  { "id": "rr-p1", "parentId": "deputy-rui-ro", "name": "Tạ Thị R", "title": "Trưởng phòng Quản lý rủi ro tín dụng", "department": "Khối Quản trị rủi ro", "tag": "regular", "isDummy": true },
  { "id": "rr-p2", "parentId": "deputy-rui-ro", "name": "Đinh Văn S", "title": "Trưởng phòng Tuân thủ & Pháp chế", "department": "Khối Quản trị rủi ro", "tag": "regular", "isDummy": true },
  { "id": "cntt-p1", "parentId": "director-cntt", "name": "Hồ Thị T", "title": "Trưởng phòng Phát triển ứng dụng", "department": "Khối CNTT & Chuyển đổi số", "tag": "regular", "isDummy": true },
  { "id": "cntt-p2", "parentId": "director-cntt", "name": "Mai Văn U", "title": "Trưởng phòng Hạ tầng & Bảo mật", "department": "Khối CNTT & Chuyển đổi số", "tag": "regular", "isDummy": true },
  { "id": "tc-p1", "parentId": "director-taichinh", "name": "Lâm Thị V", "title": "Trưởng phòng Kế toán tài chính", "department": "Khối Tài chính", "tag": "regular", "isDummy": true },
  { "id": "tc-p2", "parentId": "director-taichinh", "name": "Cao Văn X", "title": "Trưởng phòng Kế hoạch & Ngân sách", "department": "Khối Tài chính", "tag": "regular", "isDummy": true },
  { "id": "ns-p1", "parentId": "director-nhansu", "name": "Tô Thị Y", "title": "Trưởng phòng Tuyển dụng & Đào tạo", "department": "Khối Nhân sự", "tag": "regular", "isDummy": true },
  { "id": "ns-p2", "parentId": "director-nhansu", "name": "Đào Văn Z", "title": "Trưởng phòng Chính sách nhân sự", "department": "Khối Nhân sự", "tag": "regular", "isDummy": true }
]
```

- [ ] **Step 2: Delete the old TS data file**

```bash
git rm src/app/data/ocb-org-data.ts
```

- [ ] **Step 3: Add `provideHttpClient()`**

In `src/app/app.config.ts`:

```ts
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';

export const appConfig: ApplicationConfig = {
  providers: [provideBrowserGlobalErrorListeners(), provideHttpClient()],
};
```

- [ ] **Step 4: Write the failing service test**

Create `src/app/services/org-data.service.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { OrgDataService } from './org-data.service';
import { OrgNode } from '../models/org-node.model';

const SAMPLE: OrgNode[] = [
  { id: 'a', parentId: null, name: 'Alice Nguyen', title: 'Chủ tịch', tag: 'regular' },
  { id: 'b', parentId: 'a', name: 'Bob Tran', title: 'Giám đốc CNTT', tag: 'executive' },
];

describe('OrgDataService', () => {
  let service: OrgDataService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(OrgDataService);
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

    const req = httpMock.expectOne('data/org-chart.json');
    req.flush(SAMPLE);

    expect(service.status()).toBe('loaded');
    expect(service.data()).toEqual(SAMPLE);
  });

  it('sets status to error when the request fails', () => {
    service.load();
    const req = httpMock.expectOne('data/org-chart.json');
    req.flush('fail', { status: 500, statusText: 'Server Error' });

    expect(service.hasError()).toBe(true);
    expect(service.data()).toEqual([]);
  });

  it('search() matches by name or title, case-insensitive', () => {
    service.setData(SAMPLE);
    expect(service.search('cntt')).toEqual([SAMPLE[1]]);
    expect(service.search('nguyen')).toEqual([SAMPLE[0]]);
    expect(service.search('')).toEqual([]);
  });
});
```

- [ ] **Step 5: Run the test to see it fail**

Run: `nvm use && npx ng test --watch=false`
Expected: FAIL — `OrgDataService` doesn't yet expose `status`/`isLoading`/`hasError`/`load`.

- [ ] **Step 6: Implement the service**

Replace `src/app/services/org-data.service.ts` with:

```ts
import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { catchError, of, tap } from 'rxjs';
import { OrgNode } from '../models/org-node.model';

export type OrgDataStatus = 'idle' | 'loading' | 'loaded' | 'error';

@Injectable({ providedIn: 'root' })
export class OrgDataService {
  private readonly http = inject(HttpClient);

  private readonly _data = signal<OrgNode[]>([]);
  private readonly _status = signal<OrgDataStatus>('idle');

  /** Toàn bộ danh sách node (dạng phẳng, id/parentId). */
  readonly data = this._data.asReadonly();
  readonly status = this._status.asReadonly();
  readonly isLoading = computed(() => this._status() === 'loading');
  readonly hasError = computed(() => this._status() === 'error');

  /** Tải dữ liệu từ file JSON tĩnh (public/data/org-chart.json). */
  load(): void {
    this._status.set('loading');
    this.http
      .get<OrgNode[]>('data/org-chart.json')
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

  /** Thay dữ liệu trực tiếp (dùng trong test hoặc khi cần bơm data thủ công). */
  setData(nodes: OrgNode[]): void {
    this._data.set(nodes);
    this._status.set('loaded');
  }

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
}
```

- [ ] **Step 7: Run the test to confirm it passes**

Run: `npx ng test --watch=false`
Expected: all `OrgDataService` tests pass.

- [ ] **Step 8: Wire loading into `App` and show loading/error UI**

Replace `src/app/app.ts`:

```ts
import { Component, inject, OnInit } from '@angular/core';
import { OrgChartComponent } from './org-chart/org-chart.component';
import { OrgDataService } from './services/org-data.service';
import { OrgNode } from './models/org-node.model';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [OrgChartComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  private readonly orgDataService = inject(OrgDataService);

  protected readonly orgData = this.orgDataService.data;
  protected readonly isLoading = this.orgDataService.isLoading;
  protected readonly hasError = this.orgDataService.hasError;

  ngOnInit(): void {
    this.orgDataService.load();
  }

  protected reload(): void {
    this.orgDataService.load();
  }

  protected onNodeClick(node: OrgNode): void {
    // Xử lý ở Task 12 (detail panel).
    console.log('Node clicked:', node);
  }
}
```

- [ ] **Step 9: Update the template for loading/error states**

Replace `src/app/app.html`:

```html
<div class="app-shell">
  <header class="app-header">
    <h1>Sơ đồ tổ chức — Ngân hàng OCB</h1>
    <p class="app-subtitle">
      Hội đồng quản trị: dữ liệu thật từ ocb.com.vn · Ban điều hành &amp; các khối/phòng ban: dữ liệu minh hoạ (dummy)
    </p>
  </header>

  <main class="app-main">
    @if (isLoading()) {
      <div class="app-status" role="status">Đang tải dữ liệu sơ đồ tổ chức...</div>
    } @else if (hasError()) {
      <div class="app-status app-status--error" role="alert">
        Không tải được dữ liệu.
        <button type="button" (click)="reload()">Thử lại</button>
      </div>
    } @else {
      <app-org-chart [data]="orgData()" (nodeClick)="onNodeClick($event)" />
    }
  </main>
</div>
```

- [ ] **Step 10: Add minimal styling for the status states**

In `src/app/app.scss`, append:

```scss
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
    border: 1px solid #0b5fa5;
    background: #fff;
    color: #0b5fa5;
    padding: 6px 14px;
    border-radius: 6px;
    cursor: pointer;
  }
}
```

- [ ] **Step 11: Update `App`'s spec for the new loading flow**

Replace `src/app/app.spec.ts`:

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

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render the OCB header', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('OCB');
    httpMock.expectOne('data/org-chart.json').flush([]);
  });

  it('shows a loading indicator while data is in flight', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.app-status')?.textContent).toContain('Đang tải');
    httpMock.expectOne('data/org-chart.json').flush([]);
  });

  it('shows an error state and can retry', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    httpMock.expectOne('data/org-chart.json').flush('fail', { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.app-status--error')).toBeTruthy();

    (compiled.querySelector('.app-status--error button') as HTMLButtonElement).click();
    httpMock.expectOne('data/org-chart.json').flush([]);
  });
});
```

- [ ] **Step 12: Run all tests**

Run: `npx ng test --watch=false`
Expected: all tests pass, including the 4 `App` tests and 4 `OrgDataService` tests.

- [ ] **Step 13: Manually verify the JSON is served**

Run: `nvm use && npm start` in the background, then `curl -s http://localhost:4200/data/org-chart.json | head -c 200`
Expected: JSON content starting with `[{"id":"hdqt-chairman"`. Stop the dev server after confirming.

- [ ] **Step 14: Commit**

```bash
git add -A
git commit -m "feat: load org data from a JSON asset via HttpClient with loading/error state"
```

---

### Task 5: Consolidate search — remove the duplicate filter logic in `OrgChartComponent`

**Files:**
- Modify: `src/app/org-chart/org-chart.component.ts`
- Modify: `src/app/org-chart/org-chart.component.spec.ts`

**Interfaces:**
- Consumes: `OrgDataService.search(term: string): OrgNode[]` (Task 4).
- Produces: `OrgChartComponent.matches: Signal<OrgNode[]>`, `OrgChartComponent.matchIndex: Signal<number>` — consumed by Task 11 (search results counter/cycling), which replaces this task's single-match `highlight()` with multi-match navigation. This task only removes the duplicate `.find()` logic and delegates matching to the service; Task 11 builds the counter/cycle UI on top of the `matches`/`matchIndex` signals introduced here.

- [ ] **Step 1: Inject `OrgDataService` and replace the inline `.find()` with `.search()`**

In `src/app/org-chart/org-chart.component.ts`, add the import and injection, then replace `highlight()`:

```ts
import { OrgDataService } from '../services/org-data.service';
```

Add inside the class (near `containerRef`):

```ts
  private readonly orgDataService = inject(OrgDataService);

  protected readonly matches = signal<OrgNode[]>([]);
  protected readonly matchIndex = signal(0);
```

Add `signal` and `inject` to the existing `@angular/core` import list at the top of the file.

Replace the whole `highlight()` method with:

```ts
  /** Lọc node khớp tên/chức danh qua OrgDataService, highlight kết quả đang chọn. */
  highlight(term: string): void {
    const results = this.orgDataService.search(term);
    this.matches.set(results);
    this.matchIndex.set(0);
    this.highlightCurrentMatch();
  }

  private highlightCurrentMatch(): void {
    if (!this.chart) {
      return;
    }
    this.zone.runOutsideAngular(() => {
      this.chart!.clearHighlighting();
      const match = this.matches()[this.matchIndex()];
      if (match) {
        this.chart!.setUpToTheRootHighlighted(match.id);
      }
      this.chart!.render();
    });
  }
```

- [ ] **Step 2: Update the existing card-rendering test to inject `OrgDataService`**

`OrgChartComponent` now depends on `OrgDataService`, which depends on `HttpClient`. Update `src/app/org-chart/org-chart.component.spec.ts` to provide it in `TestBed`:

```ts
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { OrgChartComponent } from './org-chart.component';
import { OrgNode } from '../models/org-node.model';

const NODES: OrgNode[] = [
  { id: 'root', parentId: null, name: 'Trịnh Văn Tuấn', title: 'Chủ tịch', tag: 'regular' },
  { id: 'child', parentId: 'root', name: 'Nguyễn Văn A', title: 'Tổng Giám đốc', tag: 'executive', isDummy: true },
];

describe('OrgChartComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

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

  it('highlight() delegates matching to OrgDataService.search()', () => {
    const fixture = TestBed.createComponent(OrgChartComponent);
    fixture.componentRef.setInput('data', NODES);
    fixture.detectChanges();

    fixture.componentInstance.highlight('tổng giám đốc');

    expect(fixture.componentInstance['matches']()).toEqual([NODES[1]]);
  });
});
```

- [ ] **Step 3: Run tests**

Run: `nvm use && npx ng test --watch=false`
Expected: all `OrgChartComponent` tests pass.

- [ ] **Step 4: Run lint**

Run: `npm run lint`
Expected: no new errors introduced by this task.

- [ ] **Step 5: Commit**

```bash
git add src/app/org-chart/org-chart.component.ts src/app/org-chart/org-chart.component.spec.ts
git commit -m "refactor: delegate search matching to OrgDataService, drop duplicate filter logic"
```

---

### Task 6: Defensive error handling around chart init/render

**Files:**
- Modify: `src/app/org-chart/org-chart.component.ts`
- Modify: `src/app/org-chart/org-chart.component.html`
- Modify: `src/app/org-chart/org-chart.component.scss`
- Modify: `src/app/org-chart/org-chart.component.spec.ts`

**Interfaces:**
- Produces: `OrgChartComponent.initError: Signal<boolean>` — read by the component's own template only (not consumed elsewhere).

- [ ] **Step 1: Write a failing test for the error state**

Add to `src/app/org-chart/org-chart.component.spec.ts`:

```ts
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
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `nvm use && npx ng test --watch=false`
Expected: FAIL — `initError` doesn't exist yet, or `initChart` doesn't catch the throw.

- [ ] **Step 3: Add the `initError` signal and wrap `initChart` in try/catch**

In `src/app/org-chart/org-chart.component.ts`, add near `matchIndex`:

```ts
  protected readonly initError = signal(false);
```

Wrap the body of `initChart()`:

```ts
  private initChart(): void {
    try {
      this.chart = new OrgChart<OrgNode>()
        .container(this.containerRef().nativeElement)
        .data(this.data())
        .nodeId((d) => d.id)
        .parentNodeId((d) => d.parentId ?? undefined)
        .compact(false)
        .initialExpandLevel(2)
        .nodeWidth(() => 260)
        .nodeHeight(() => 118)
        .childrenMargin(() => 50)
        .siblingsMargin(() => 30)
        .nodeContent((d) => this.renderCard(d.data))
        .onNodeClick((d) => {
          const node: OrgNode = 'data' in d ? d.data : d;
          this.zone.run(() => this.nodeClick.emit(node));
        })
        .render();
    } catch (err) {
      console.error('Không thể khởi tạo sơ đồ tổ chức:', err);
      this.zone.run(() => this.initError.set(true));
    }
  }
```

Also guard the `effect()` re-render call the same way — wrap its body:

```ts
    effect(() => {
      const nodes = this.data();
      if (this.chart) {
        this.zone.runOutsideAngular(() => {
          try {
            this.chart!.data(nodes).render();
          } catch (err) {
            console.error('Không thể cập nhật sơ đồ tổ chức:', err);
            this.zone.run(() => this.initError.set(true));
          }
        });
      }
    });
```

- [ ] **Step 4: Show a fallback message in the template**

In `src/app/org-chart/org-chart.component.html`, wrap the chart container:

```html
  @if (initError()) {
    <div class="org-chart-error" role="alert">
      Không thể hiển thị sơ đồ tổ chức. Vui lòng tải lại trang.
    </div>
  } @else {
    <div #chartContainer class="org-chart-container"></div>
  }
```

- [ ] **Step 5: Style the error state**

In `src/app/org-chart/org-chart.component.scss`, append:

```scss
.org-chart-error {
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #b91c1c;
  font-size: 14px;
  background: #fef2f2;
}
```

- [ ] **Step 6: Run the test again to confirm it passes**

Run: `npx ng test --watch=false`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app/org-chart/org-chart.component.ts src/app/org-chart/org-chart.component.html src/app/org-chart/org-chart.component.scss src/app/org-chart/org-chart.component.spec.ts
git commit -m "fix: handle chart init/render failures with a visible error state"
```

---

### Task 7: Accessibility — ARIA labels, roles, and keyboard navigation on cards

**Files:**
- Modify: `src/app/org-chart/org-chart.component.html`
- Modify: `src/app/org-chart/org-chart.component.ts`
- Modify: `src/app/org-chart/org-chart.component.scss`
- Modify: `src/app/org-chart/org-chart.component.spec.ts`

**Interfaces:**
- Consumes: `data-node-id` attribute already added to `renderCard`'s markup in Task 3, and `nodeClick` output already defined.
- Produces: nothing new consumed by later tasks; this task is UI/a11y polish only.

- [ ] **Step 1: Add ARIA labels to the toolbar**

In `src/app/org-chart/org-chart.component.html`, update the toolbar markup:

```html
<div class="org-chart-shell">
  <div class="org-chart-toolbar" role="toolbar" aria-label="Điều khiển sơ đồ tổ chức">
    <label class="sr-only" for="org-chart-search">Tìm theo tên hoặc chức danh</label>
    <input
      id="org-chart-search"
      type="text"
      class="org-chart-search"
      placeholder="Tìm theo tên hoặc chức danh..."
      aria-label="Tìm theo tên hoặc chức danh"
      (input)="onSearchInput($event)"
    />
    <button type="button" (click)="expandAll()" aria-label="Mở rộng tất cả các nhánh">Mở rộng tất cả</button>
    <button type="button" (click)="collapseAll()" aria-label="Thu gọn tất cả các nhánh">Thu gọn tất cả</button>
    <button type="button" (click)="fit()" aria-label="Đưa sơ đồ vừa khung nhìn">Fit màn hình</button>
  </div>

  <div class="org-chart-legend" role="list" aria-label="Chú giải màu sắc">
    <span class="legend-item" role="listitem"><i class="legend-dot legend-dot--regular"></i>HĐQT / Phòng ban</span>
    <span class="legend-item" role="listitem"><i class="legend-dot legend-dot--independent"></i>Thành viên độc lập</span>
    <span class="legend-item" role="listitem"><i class="legend-dot legend-dot--executive"></i>Ban điều hành</span>
  </div>

  @if (initError()) {
    <div class="org-chart-error" role="alert">
      Không thể hiển thị sơ đồ tổ chức. Vui lòng tải lại trang.
    </div>
  } @else {
    <div #chartContainer class="org-chart-container"></div>
  }
</div>
```

- [ ] **Step 2: Add a visually-hidden utility class**

In `src/app/org-chart/org-chart.component.scss`, append:

```scss
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

- [ ] **Step 3: Write a failing test for keyboard activation of a card**

Add to `src/app/org-chart/org-chart.component.spec.ts`:

```ts
  it('emits nodeClick when Enter is pressed on a focused card', () => {
    const fixture = TestBed.createComponent(OrgChartComponent);
    fixture.componentRef.setInput('data', NODES);
    fixture.detectChanges();

    const emitted: OrgNode[] = [];
    fixture.componentInstance.nodeClick.subscribe((n: OrgNode) => emitted.push(n));

    const card = document.createElement('div');
    card.className = 'org-card';
    card.setAttribute('data-node-id', 'child');
    document.body.appendChild(card);

    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
    card.dispatchEvent(event);

    (fixture.componentInstance as unknown as { handleCardKeydown: (e: KeyboardEvent) => void })[
      'handleCardKeydown'
    ](event);

    expect(emitted).toEqual([NODES[1]]);
    document.body.removeChild(card);
  });
```

- [ ] **Step 4: Run it to confirm it fails**

Run: `nvm use && npx ng test --watch=false`
Expected: FAIL — `handleCardKeydown` doesn't exist.

- [ ] **Step 5: Implement keyboard activation**

In `src/app/org-chart/org-chart.component.ts`, add a bound method and wire it up in `initChart()`:

```ts
  private readonly handleCardKeydown = (event: KeyboardEvent): void => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    const target = event.target as HTMLElement;
    const card = target.closest<HTMLElement>('.org-card[data-node-id]');
    if (!card) {
      return;
    }
    event.preventDefault();
    const id = card.dataset['nodeId'];
    const node = this.data().find((n) => n.id === id);
    if (node) {
      this.zone.run(() => this.nodeClick.emit(node));
    }
  };
```

In `initChart()`, after `.render();` inside the try block, attach the listener once:

```ts
        .render();
      this.containerRef().nativeElement.addEventListener('keydown', this.handleCardKeydown);
```

In `ngOnDestroy()`, remove it:

```ts
  ngOnDestroy(): void {
    this.containerRef()?.nativeElement.removeEventListener('keydown', this.handleCardKeydown);
    this.chart = null;
  }
```

- [ ] **Step 6: Run the test again**

Run: `npx ng test --watch=false`
Expected: PASS.

- [ ] **Step 7: Run lint to confirm the earlier template-accessibility findings from Task 2 are resolved**

Run: `npm run lint`
Expected: no accessibility findings remain on the toolbar/search input.

- [ ] **Step 8: Commit**

```bash
git add src/app/org-chart/org-chart.component.html src/app/org-chart/org-chart.component.ts src/app/org-chart/org-chart.component.scss src/app/org-chart/org-chart.component.spec.ts
git commit -m "feat: add ARIA labels and keyboard navigation for org chart cards"
```

---

### Task 8: Responsive layout — media queries + resize-triggered refit

**Files:**
- Modify: `src/app/org-chart/org-chart.component.scss`
- Modify: `src/app/org-chart/org-chart.component.ts`
- Modify: `src/app/app.scss`

**Interfaces:**
- Produces: nothing consumed by later tasks; standalone UI/behavior improvement.

- [ ] **Step 1: Add media queries for the toolbar/legend**

In `src/app/org-chart/org-chart.component.scss`, modify `.org-chart-toolbar` and `.org-chart-search` and add a breakpoint block:

```scss
.org-chart-toolbar {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
  padding: 10px 16px;
  border-bottom: 1px solid #e2e6ed;
  background: #fff;

  button {
    border: 1px solid #0b5fa5;
    background: #fff;
    color: #0b5fa5;
    padding: 6px 14px;
    border-radius: 6px;
    font-size: 13px;
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease;

    &:hover {
      background: #0b5fa5;
      color: #fff;
    }
  }
}

@media (max-width: 640px) {
  .org-chart-toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .org-chart-search {
    flex: 1 1 auto;
  }

  .org-chart-legend {
    flex-wrap: wrap;
    gap: 10px;
  }
}
```

(the existing `.org-chart-search` and `.org-chart-legend` rules stay as-is — this step only adds `flex-wrap: wrap;` to `.org-chart-toolbar` and appends the new `@media` block.)

- [ ] **Step 2: Refit the chart on container resize**

In `src/app/org-chart/org-chart.component.ts`, add a `ResizeObserver` field and wire it up. Add the field:

```ts
  private resizeObserver: ResizeObserver | null = null;
```

At the end of the try block in `initChart()`, after attaching the keydown listener:

```ts
      this.resizeObserver = new ResizeObserver(() => {
        this.zone.runOutsideAngular(() => this.chart?.fit());
      });
      this.resizeObserver.observe(this.containerRef().nativeElement);
```

In `ngOnDestroy()`, disconnect it:

```ts
  ngOnDestroy(): void {
    this.containerRef()?.nativeElement.removeEventListener('keydown', this.handleCardKeydown);
    this.resizeObserver?.disconnect();
    this.chart = null;
  }
```

- [ ] **Step 3: Add a responsive breakpoint to the app header**

In `src/app/app.scss`, append:

```scss
@media (max-width: 640px) {
  .app-header {
    padding: 10px 14px;

    h1 {
      font-size: 16px;
    }
  }

  .app-subtitle {
    font-size: 11px;
  }
}
```

- [ ] **Step 4: Run existing tests to confirm nothing broke**

Run: `nvm use && npx ng test --watch=false`
Expected: all tests still pass (jsdom's `ResizeObserver` may be undefined — if the test run errors on `new ResizeObserver(...)`, guard the call: `if (typeof ResizeObserver !== 'undefined') { this.resizeObserver = new ResizeObserver(...); this.resizeObserver.observe(...); }`).

- [ ] **Step 5: Commit**

```bash
git add src/app/org-chart/org-chart.component.scss src/app/org-chart/org-chart.component.ts src/app/app.scss
git commit -m "feat: make toolbar/header responsive and refit chart on container resize"
```

---

### Task 9: Zoom in/out controls

**Files:**
- Modify: `src/app/org-chart/org-chart.component.ts`
- Modify: `src/app/org-chart/org-chart.component.html`
- Modify: `src/app/org-chart/org-chart.component.spec.ts`

**Interfaces:**
- Produces: `OrgChartComponent.zoomIn(): void`, `OrgChartComponent.zoomOut(): void` — UI-only, no downstream consumers.

- [ ] **Step 1: Write failing tests**

Add to `src/app/org-chart/org-chart.component.spec.ts`:

```ts
  it('zoomIn/zoomOut delegate to the underlying chart instance without throwing', () => {
    const fixture = TestBed.createComponent(OrgChartComponent);
    fixture.componentRef.setInput('data', NODES);
    fixture.detectChanges();

    expect(() => fixture.componentInstance.zoomIn()).not.toThrow();
    expect(() => fixture.componentInstance.zoomOut()).not.toThrow();
  });
```

- [ ] **Step 2: Run to confirm it fails**

Run: `nvm use && npx ng test --watch=false`
Expected: FAIL — `zoomIn`/`zoomOut` don't exist.

- [ ] **Step 3: Implement**

In `src/app/org-chart/org-chart.component.ts`, add next to `fit()`:

```ts
  zoomIn(): void {
    this.zone.runOutsideAngular(() => this.chart?.zoomIn());
  }

  zoomOut(): void {
    this.zone.runOutsideAngular(() => this.chart?.zoomOut());
  }
```

- [ ] **Step 4: Add toolbar buttons**

In `src/app/org-chart/org-chart.component.html`, after the "Fit màn hình" button:

```html
    <button type="button" (click)="zoomIn()" aria-label="Phóng to">Phóng to</button>
    <button type="button" (click)="zoomOut()" aria-label="Thu nhỏ">Thu nhỏ</button>
```

- [ ] **Step 5: Run tests**

Run: `npx ng test --watch=false`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/org-chart/org-chart.component.ts src/app/org-chart/org-chart.component.html src/app/org-chart/org-chart.component.spec.ts
git commit -m "feat: add zoom in/out controls to org chart toolbar"
```

---

### Task 10: Layout direction toggle (vertical/horizontal)

**Files:**
- Modify: `src/app/org-chart/org-chart.component.ts`
- Modify: `src/app/org-chart/org-chart.component.html`
- Modify: `src/app/org-chart/org-chart.component.spec.ts`

**Interfaces:**
- Produces: `OrgChartComponent.toggleLayout(): void`, `OrgChartComponent.layoutDirection: Signal<'top' | 'left'>` — UI-only.

- [ ] **Step 1: Write failing test**

Add to `src/app/org-chart/org-chart.component.spec.ts`:

```ts
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
```

- [ ] **Step 2: Run to confirm it fails**

Run: `nvm use && npx ng test --watch=false`
Expected: FAIL — `toggleLayout`/`layoutDirection` don't exist.

- [ ] **Step 3: Implement**

In `src/app/org-chart/org-chart.component.ts`, add near `initError`:

```ts
  readonly layoutDirection = signal<'top' | 'left'>('top');
```

Add the method:

```ts
  toggleLayout(): void {
    const next = this.layoutDirection() === 'top' ? 'left' : 'top';
    this.layoutDirection.set(next);
    this.zone.runOutsideAngular(() => {
      this.chart?.layout(next).render();
    });
  }
```

Set the initial layout explicitly in `initChart()`'s builder chain (add right after `.compact(false)`):

```ts
        .compact(false)
        .layout(this.layoutDirection())
```

- [ ] **Step 4: Add the toggle button**

In `src/app/org-chart/org-chart.component.html`, after the zoom buttons:

```html
    <button type="button" (click)="toggleLayout()" aria-label="Đổi hướng sơ đồ (dọc/ngang)">
      Đổi hướng: {{ layoutDirection() === 'top' ? 'Dọc' : 'Ngang' }}
    </button>
```

- [ ] **Step 5: Run tests**

Run: `npx ng test --watch=false`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/org-chart/org-chart.component.ts src/app/org-chart/org-chart.component.html src/app/org-chart/org-chart.component.spec.ts
git commit -m "feat: add vertical/horizontal layout toggle to org chart"
```

---

### Task 11: Export image + multi-match search counter/cycling

**Files:**
- Modify: `src/app/org-chart/org-chart.component.ts`
- Modify: `src/app/org-chart/org-chart.component.html`
- Modify: `src/app/org-chart/org-chart.component.scss`
- Modify: `src/app/org-chart/org-chart.component.spec.ts`

**Interfaces:**
- Consumes: `matches`/`matchIndex` signals introduced in Task 5.
- Produces: `OrgChartComponent.exportImage(): void`, `OrgChartComponent.nextMatch(): void`, `OrgChartComponent.prevMatch(): void`, `OrgChartComponent.matchCount: Signal<number>`, `OrgChartComponent.matchPosition: Signal<number>` — UI-only.

- [ ] **Step 1: Write failing tests**

Add to `src/app/org-chart/org-chart.component.spec.ts`:

```ts
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
```

- [ ] **Step 2: Run to confirm failure**

Run: `nvm use && npx ng test --watch=false`
Expected: FAIL — `matchCount`, `matchPosition`, `nextMatch`, `prevMatch`, `exportImage` don't exist yet.

- [ ] **Step 3: Implement the computed signals and navigation methods**

In `src/app/org-chart/org-chart.component.ts`, add `computed` to the `@angular/core` import, then add near `matches`/`matchIndex`:

```ts
  protected readonly matchCount = computed(() => this.matches().length);
  protected readonly matchPosition = computed(() =>
    this.matches().length ? this.matchIndex() + 1 : 0
  );
```

Add the navigation methods next to `highlight()`:

```ts
  nextMatch(): void {
    const total = this.matches().length;
    if (!total) {
      return;
    }
    this.matchIndex.set((this.matchIndex() + 1) % total);
    this.highlightCurrentMatch();
  }

  prevMatch(): void {
    const total = this.matches().length;
    if (!total) {
      return;
    }
    this.matchIndex.set((this.matchIndex() - 1 + total) % total);
    this.highlightCurrentMatch();
  }

  exportImage(): void {
    this.zone.runOutsideAngular(() => this.chart?.exportImg({ save: true }));
  }
```

- [ ] **Step 4: Add the UI**

In `src/app/org-chart/org-chart.component.html`, after the search input, add the counter and nav buttons, and add the export button after the layout toggle button:

```html
    @if (matchCount() > 0) {
      <span class="org-chart-match-counter" aria-live="polite">{{ matchPosition() }}/{{ matchCount() }}</span>
      <button type="button" (click)="prevMatch()" aria-label="Kết quả trước">‹</button>
      <button type="button" (click)="nextMatch()" aria-label="Kết quả tiếp theo">›</button>
    }
```

and:

```html
    <button type="button" (click)="exportImage()" aria-label="Xuất ảnh sơ đồ">Xuất ảnh</button>
```

- [ ] **Step 5: Style the match counter**

In `src/app/org-chart/org-chart.component.scss`, append:

```scss
.org-chart-match-counter {
  font-size: 12px;
  color: #4a5568;
  white-space: nowrap;
}
```

- [ ] **Step 6: Run tests**

Run: `npx ng test --watch=false`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app/org-chart/org-chart.component.ts src/app/org-chart/org-chart.component.html src/app/org-chart/org-chart.component.scss src/app/org-chart/org-chart.component.spec.ts
git commit -m "feat: add image export and multi-match search cycling"
```

---

### Task 12: Detail panel on node click

**Files:**
- Create: `src/app/detail-panel/detail-panel.component.ts`
- Create: `src/app/detail-panel/detail-panel.component.html`
- Create: `src/app/detail-panel/detail-panel.component.scss`
- Create: `src/app/detail-panel/detail-panel.component.spec.ts`
- Modify: `src/app/app.ts`
- Modify: `src/app/app.html`
- Modify: `src/app/app.scss`

**Interfaces:**
- Consumes: `OrgNode` model (Task 3's `isDummy` field), `App.onNodeClick(node: OrgNode)` (existing output binding from `OrgChartComponent`).
- Produces: `DetailPanelComponent` with `node = input<OrgNode | null>(null)` and `closed = output<void>()`, standalone, imported by `App`.

- [ ] **Step 1: Write the failing component test**

Create `src/app/detail-panel/detail-panel.component.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { DetailPanelComponent } from './detail-panel.component';
import { OrgNode } from '../models/org-node.model';

const NODE: OrgNode = {
  id: 'ceo',
  parentId: 'hdqt-chairman',
  name: 'Nguyễn Văn A',
  title: 'Tổng Giám đốc',
  department: 'Ban điều hành',
  tag: 'executive',
  isDummy: true,
};

describe('DetailPanelComponent', () => {
  it('renders nothing when node is null', () => {
    const fixture = TestBed.createComponent(DetailPanelComponent);
    fixture.componentRef.setInput('node', null);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.detail-panel')).toBeNull();
  });

  it('renders node name, title, department, and a dummy badge', () => {
    const fixture = TestBed.createComponent(DetailPanelComponent);
    fixture.componentRef.setInput('node', NODE);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Nguyễn Văn A');
    expect(compiled.textContent).toContain('Tổng Giám đốc');
    expect(compiled.textContent).toContain('Ban điều hành');
    expect(compiled.querySelector('.detail-panel__dummy')).toBeTruthy();
  });

  it('emits closed when the close button is clicked', () => {
    const fixture = TestBed.createComponent(DetailPanelComponent);
    fixture.componentRef.setInput('node', NODE);
    fixture.detectChanges();

    let closed = false;
    fixture.componentInstance.closed.subscribe(() => (closed = true));

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('.detail-panel__close')!
      .click();

    expect(closed).toBe(true);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `nvm use && npx ng test --watch=false`
Expected: FAIL — `DetailPanelComponent` doesn't exist.

- [ ] **Step 3: Create the component**

Create `src/app/detail-panel/detail-panel.component.ts`:

```ts
import { Component, input, output } from '@angular/core';
import { OrgNode } from '../models/org-node.model';

@Component({
  selector: 'app-detail-panel',
  standalone: true,
  templateUrl: './detail-panel.component.html',
  styleUrl: './detail-panel.component.scss',
})
export class DetailPanelComponent {
  readonly node = input<OrgNode | null>(null);
  readonly closed = output<void>();

  protected close(): void {
    this.closed.emit();
  }
}
```

Create `src/app/detail-panel/detail-panel.component.html`:

```html
@if (node(); as n) {
  <aside class="detail-panel" role="complementary" aria-label="Chi tiết nhân sự">
    <button type="button" class="detail-panel__close" aria-label="Đóng" (click)="close()">✕</button>
    <h2 class="detail-panel__name">
      {{ n.name }}
      @if (n.isDummy) {
        <span class="detail-panel__dummy">(dummy)</span>
      }
    </h2>
    <p class="detail-panel__title">{{ n.title }}</p>
    @if (n.department) {
      <p class="detail-panel__department">{{ n.department }}</p>
    }
  </aside>
}
```

Create `src/app/detail-panel/detail-panel.component.scss`:

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

.detail-panel__close {
  position: absolute;
  top: 10px;
  right: 10px;
  border: none;
  background: transparent;
  font-size: 16px;
  cursor: pointer;
  color: #4a5568;
}

.detail-panel__name {
  margin: 0 24px 4px 0;
  font-size: 16px;
  font-weight: 600;
  color: #1a2332;
}

.detail-panel__dummy {
  font-weight: 400;
  font-size: 11px;
  color: #94a3b8;
}

.detail-panel__title {
  margin: 0 0 4px;
  font-size: 13px;
  color: #4a5568;
}

.detail-panel__department {
  margin: 0;
  font-size: 12px;
  color: #94a3b8;
}

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

- [ ] **Step 4: Run to confirm the component tests pass**

Run: `npx ng test --watch=false`
Expected: PASS for the 3 new `DetailPanelComponent` tests.

- [ ] **Step 5: Wire it into `App`**

In `src/app/app.ts`, import `DetailPanelComponent` and `signal`, add a `selectedNode` signal, and update `onNodeClick`:

```ts
import { Component, inject, OnInit, signal } from '@angular/core';
import { OrgChartComponent } from './org-chart/org-chart.component';
import { DetailPanelComponent } from './detail-panel/detail-panel.component';
import { OrgDataService } from './services/org-data.service';
import { OrgNode } from './models/org-node.model';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [OrgChartComponent, DetailPanelComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  private readonly orgDataService = inject(OrgDataService);

  protected readonly orgData = this.orgDataService.data;
  protected readonly isLoading = this.orgDataService.isLoading;
  protected readonly hasError = this.orgDataService.hasError;
  protected readonly selectedNode = signal<OrgNode | null>(null);

  ngOnInit(): void {
    this.orgDataService.load();
  }

  protected reload(): void {
    this.orgDataService.load();
  }

  protected onNodeClick(node: OrgNode): void {
    this.selectedNode.set(node);
  }
}
```

- [ ] **Step 6: Update the template**

In `src/app/app.html`, wrap the chart and add the panel inside `app-main`:

```html
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
        <app-org-chart [data]="orgData()" (nodeClick)="onNodeClick($event)" />
        <app-detail-panel [node]="selectedNode()" (closed)="selectedNode.set(null)" />
      </div>
    }
  </main>
```

- [ ] **Step 7: Update `app.scss` for the side-by-side layout**

In `src/app/app.scss`, append:

```scss
.app-main__content {
  display: flex;
  height: 100%;
}

.app-main__content app-org-chart {
  flex: 1 1 auto;
  min-width: 0;
}
```

- [ ] **Step 8: Update `App`'s spec for the new click behavior**

Add to `src/app/app.spec.ts`:

```ts
  it('opens the detail panel when a node is clicked and closes it on close', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    httpMock.expectOne('data/org-chart.json').flush([
      { id: 'a', parentId: null, name: 'Alice', title: 'Chủ tịch', tag: 'regular' },
    ]);
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
```

- [ ] **Step 9: Run all tests**

Run: `nvm use && npx ng test --watch=false`
Expected: all tests pass.

- [ ] **Step 10: Commit**

```bash
git add src/app/detail-panel src/app/app.ts src/app/app.html src/app/app.scss src/app/app.spec.ts
git commit -m "feat: add node detail panel on click"
```

---

### Task 13: Final pass — lint, full test suite, production build

**Files:** none created; verification only.

- [ ] **Step 1: Run lint across the whole project**

Run: `nvm use && npm run lint`
Expected: no errors. Fix any stragglers introduced by earlier tasks before proceeding.

- [ ] **Step 2: Run the full test suite**

Run: `npx ng test --watch=false`
Expected: all specs pass (`App`, `OrgDataService`, `OrgChartComponent`, `DetailPanelComponent`).

- [ ] **Step 3: Run a production build**

Run: `npx ng build`
Expected: succeeds within the budgets defined in `angular.json` (initial bundle ≤ 1MB error threshold, component styles ≤ 8kB error threshold). If the `anyComponentStyle` budget is exceeded by `org-chart.component.scss` (it has grown across Tasks 6-11), raise `maximumWarning`/`maximumError` for `anyComponentStyle` in `angular.json` only as much as needed to pass, and note the new values in the commit message.

- [ ] **Step 4: Manually smoke-test in the browser**

Run: `npm start` in the background, then use Playwright (`mcp__plugin_playwright_playwright__browser_navigate` to `http://localhost:4200`) or ask the user to check manually:
- Chart loads and renders the OCB data.
- Search finds a match, counter shows `1/N`, next/prev cycle works.
- Clicking a card opens the detail panel with correct name/title/department and dummy badge where applicable.
- Zoom in/out, layout toggle, and export buttons don't throw (export triggers a download).
- Resizing the browser window reflows the toolbar at narrow widths.

Expected: all behaviors work as described; note and fix any regressions found.

- [ ] **Step 5: Commit any final fixes**

```bash
git add -A
git commit -m "chore: final lint/test/build verification pass"
```

(Skip this commit if Steps 1-4 required no code changes.)
