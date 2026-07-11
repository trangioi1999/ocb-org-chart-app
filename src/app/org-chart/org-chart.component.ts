import {
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  ViewEncapsulation,
  afterNextRender,
  effect,
  input,
  output,
  viewChild,
} from '@angular/core';
import { OrgChart } from 'd3-org-chart';
import { OrgNode } from '../models/org-node.model';

@Component({
  selector: 'app-org-chart',
  standalone: true,
  templateUrl: './org-chart.component.html',
  styleUrl: './org-chart.component.scss',
  // d3-org-chart chèn HTML trực tiếp vào DOM (nodeContent), ngoài tầm
  // kiểm soát của Angular template -> phải tắt view encapsulation để
  // CSS trong file .scss áp dụng được lên các node do D3 tạo ra.
  encapsulation: ViewEncapsulation.None,
})
export class OrgChartComponent implements OnDestroy {
  /** Dữ liệu phẳng {id, parentId, ...}. */
  readonly data = input.required<OrgNode[]>();

  /** Bắn ra khi người dùng click 1 node trên chart. */
  readonly nodeClick = output<OrgNode>();

  private readonly containerRef =
    viewChild.required<ElementRef<HTMLDivElement>>('chartContainer');

  private chart: OrgChart<OrgNode> | null = null;

  constructor(private readonly zone: NgZone) {
    // d3-org-chart thao tác DOM trực tiếp (không qua Angular renderer),
    // nên phải khởi tạo sau khi view đã render xong.
    afterNextRender(() => {
      this.zone.runOutsideAngular(() => this.initChart());
    });

    // Re-render khi input data đổi, không destroy/recreate instance.
    effect(() => {
      const nodes = this.data();
      if (this.chart) {
        this.zone.runOutsideAngular(() => {
          this.chart!.data(nodes).render();
        });
      }
    });
  }

  expandAll(): void {
    this.zone.runOutsideAngular(() => this.chart?.expandAll());
  }

  collapseAll(): void {
    this.zone.runOutsideAngular(() => this.chart?.collapseAll());
  }

  fit(): void {
    this.zone.runOutsideAngular(() => this.chart?.fit());
  }

  /** Highlight node đầu tiên khớp tên/chức danh; xoá highlight nếu rỗng. */
  highlight(term: string): void {
    if (!this.chart) {
      return;
    }
    this.zone.runOutsideAngular(() => {
      this.chart!.clearHighlighting();
      const keyword = term.trim().toLowerCase();
      if (!keyword) {
        this.chart!.render();
        return;
      }
      const match = this.data().find(
        (node) =>
          node.name.toLowerCase().includes(keyword) ||
          node.title.toLowerCase().includes(keyword)
      );
      if (match) {
        this.chart!.setUpToTheRootHighlighted(match.id);
        this.chart!.render();
      }
    });
  }

  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.highlight(value);
  }

  private initChart(): void {
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
  }

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

  private escape(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  ngOnDestroy(): void {
    this.chart = null;
  }
}
