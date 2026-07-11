import {
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  ViewEncapsulation,
  afterNextRender,
  computed,
  effect,
  input,
  output,
  signal,
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

  protected readonly matches = signal<OrgNode[]>([]);
  protected readonly matchIndex = signal(0);
  readonly matchCount = computed(() => this.matches().length);
  readonly matchPosition = computed(() => (this.matches().length ? this.matchIndex() + 1 : 0));
  protected readonly initError = signal(false);
  readonly layoutDirection = signal<'top' | 'left'>('top');

  private chart: OrgChart<OrgNode> | null = null;
  private listenerAttached = false;
  private resizeObserver: ResizeObserver | null = null;

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
          try {
            this.chart!.data(nodes).render();
          } catch (err) {
            console.error('Không thể cập nhật sơ đồ tổ chức:', err);
            this.zone.run(() => this.initError.set(true));
          }
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

  zoomIn(): void {
    this.zone.runOutsideAngular(() => this.chart?.zoomIn());
  }

  zoomOut(): void {
    this.zone.runOutsideAngular(() => this.chart?.zoomOut());
  }

  toggleLayout(): void {
    const next = this.layoutDirection() === 'top' ? 'left' : 'top';
    this.layoutDirection.set(next);
    this.zone.runOutsideAngular(() => {
      this.chart?.layout(next).render();
    });
  }

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

  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.highlight(value);
  }

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

  private initChart(): void {
    try {
      this.chart = new OrgChart<OrgNode>()
        .container(this.containerRef().nativeElement)
        .data(this.data())
        .nodeId((d) => d.id)
        .parentNodeId((d) => d.parentId ?? undefined)
        .compact(false)
        .layout(this.layoutDirection())
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
      this.containerRef().nativeElement.addEventListener('keydown', this.handleCardKeydown);
      this.listenerAttached = true;

      if (typeof ResizeObserver !== 'undefined') {
        this.resizeObserver = new ResizeObserver(() => {
          this.zone.runOutsideAngular(() => this.chart?.fit());
        });
        this.resizeObserver.observe(this.containerRef().nativeElement);
      }
    } catch (err) {
      console.error('Không thể khởi tạo sơ đồ tổ chức:', err);
      this.zone.run(() => this.initError.set(true));
    }
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
    if (this.listenerAttached) {
      this.containerRef().nativeElement.removeEventListener('keydown', this.handleCardKeydown);
    }
    this.resizeObserver?.disconnect();
    this.chart = null;
  }
}
