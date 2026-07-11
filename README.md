# OCB Org Chart

Sơ đồ tổ chức OCB — Angular 22 (standalone, signals) + [d3-org-chart](https://github.com/bumbeishvili/org-chart) v3.

## Cài đặt

Thư mục này **chưa có `node_modules`** (đã loại bỏ khi copy để nhẹ). Chạy trước khi dùng:

```bash
npm install
```

## Dữ liệu

- File dữ liệu: `src/app/data/ocb-org-data.ts`.
- Khối **Hội đồng quản trị**: dữ liệu thật, lấy từ https://ocb.com.vn/vi/ve-ocb/co-cau-quan-ly (nhiệm kỳ 2025–2030, 8 thành viên).
- Khối **Ban điều hành** và các **Khối/Phòng ban**: dữ liệu dàn dựng (dummy, đánh dấu `[Dummy]`) vì trang OCB tải phần này bằng JavaScript nên không lấy được qua fetch tĩnh. Sửa thẳng file này để thay bằng dữ liệu thật.

## Cấu trúc chính

- `src/app/org-chart/` — component wrapper d3-org-chart (`OrgChartComponent`), style card (`org-chart.component.scss`), ambient types cho d3-org-chart (`d3-org-chart.d.ts`).
- `src/app/services/org-data.service.ts` — service expose dữ liệu qua signal, có hàm `search()`.
- `src/app/models/org-node.model.ts` — interface `OrgNode`.

Component org chart hỗ trợ: mở/thu gọn toàn bộ, fit màn hình, tìm kiếm & highlight theo tên/chức danh, card màu riêng theo HĐQT / thành viên độc lập / Ban điều hành.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
