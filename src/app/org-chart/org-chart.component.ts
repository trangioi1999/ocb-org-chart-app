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
import { OrgNode, OrgNodeTag } from '../models/org-node.model';

export interface LegendItem {
  tagClass: OrgNodeTag;
  label: string;
}

const DEFAULT_LEGEND_ITEMS: LegendItem[] = [
  { tagClass: 'regular', label: 'Cơ quan quản trị / điều hành' },
  { tagClass: 'executive', label: 'Khối / Trung tâm / Phòng' },
];

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

  /** Chú giải màu sắc hiển thị dưới toolbar; mặc định là legend của OCB. */
  readonly legendItems = input<LegendItem[]>(DEFAULT_LEGEND_ITEMS);

  /** Node đang được chọn: highlight card + đường nối về gốc. */
  readonly selectedNodeId = input<string | null>(null);

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

    // Highlight node được chọn + đường nối về gốc. Đọc cả data() để
    // gắn lại cờ highlight sau khi node bị thay object mới (sửa/xóa) —
    // effect này chạy SAU effect data ở trên (cùng thứ tự khai báo)
    // nên chart đã có dữ liệu mới trước khi highlight.
    effect(() => {
      const id = this.selectedNodeId();
      const nodes = this.data();
      if (!this.chart) {
        return;
      }
      this.zone.runOutsideAngular(() => {
        try {
          this.chart!.clearHighlighting();
          if (id && nodes.some((n) => n.id === id)) {
            this.chart!.setUpToTheRootHighlighted(id);
          }
          this.chart!.render();
        } catch (err) {
          console.error('Không thể highlight node được chọn:', err);
        }
      });
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

  /**
   * Mở nhánh + căn giữa 1 node (dùng khi vừa thêm cấp dưới để node mới
   * hiện ra trong khung nhìn). Chỉ gắn cờ, không render — lần render kế
   * tiếp (effect data đổi) sẽ áp dụng, nên chỉ gọi ngay trước khi data đổi.
   */
  revealNode(id: string): void {
    this.zone.runOutsideAngular(() => this.chart?.setCentered(id));
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
        // Ghi đè mặc định của d3-org-chart (viền hồng #E27396) bằng màu
        // cam thương hiệu; node nằm trên đường đi tới node được chọn /
        // kết quả tìm kiếm sẽ có viền cam quanh card.
        .nodeUpdate(function (d) {
          const rect = this.querySelector<SVGRectElement>('.node-rect');
          if (!rect) {
            return;
          }
          const highlighted = Boolean(d.data._highlighted || d.data._upToTheRootHighlighted);
          rect.setAttribute('rx', '10');
          rect.setAttribute('stroke', highlighted ? '#c57622' : 'none');
          rect.setAttribute('stroke-width', highlighted ? '4' : '1');
        })
        // Tô đậm đường nối trên nhánh từ node được chọn về gốc và đưa
        // nó lên trên các link khác để không bị che.
        .linkUpdate(function (d) {
          const highlighted = Boolean(d.data._upToTheRootHighlighted);
          this.setAttribute('stroke', highlighted ? '#c57622' : '#c3cdda');
          this.setAttribute('stroke-width', highlighted ? '3' : '1.5');
          if (highlighted) {
            this.parentNode?.appendChild(this);
          }
        })
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
    const badgeMatch = node.id.match(/^khoi-(\d+)$/);
    const avatarContent = badgeMatch ? String(parseInt(badgeMatch[1], 10)) : this.initials(node.name);
    const tagClass = `org-card--${node.tag ?? 'regular'}`;
    const selectedClass = node.id === this.selectedNodeId() ? ' org-card--selected' : '';
    const ariaLabel = node.title ? `${this.escape(node.name)}, ${this.escape(node.title)}` : this.escape(node.name);

    return `
      <div class="org-card ${tagClass}${selectedClass}" tabindex="0" role="button" data-node-id="${node.id}" aria-label="${ariaLabel}">
        <div class="org-card__avatar">${avatarContent}</div>
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

  private initials(name: string): string {
    return name
      .split(' ')
      .filter(Boolean)
      .slice(-2)
      .map((part) => part[0])
      .join('')
      .toUpperCase();
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
