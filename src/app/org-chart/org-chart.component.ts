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
  { tagClass: 'top', label: 'Cấp cao nhất (ĐHĐCĐ, HĐQT, TGĐ)' },
  { tagClass: 'governance', label: 'Bộ máy quản trị (HĐQT)' },
  { tagClass: 'control', label: 'Bộ máy kiểm soát' },
  { tagClass: 'business', label: 'Khối kinh doanh' },
  { tagClass: 'support', label: 'Khối hỗ trợ/vận hành' },
  { tagClass: 'center', label: 'Trung tâm' },
  { tagClass: 'council', label: 'Hội đồng' },
  { tagClass: 'company', label: 'Công ty/Đơn vị sự nghiệp' },
];

/**
 * Chiều cao cố định cho mọi card (px) — tất cả node cùng 1 chiều cao
 * thay vì co giãn theo nội dung, để các card thẳng hàng nhau. Đủ chỗ
 * cho tên dài nhất hiện có (tối đa 3 dòng ở card rộng 288px); tên dài
 * hơn nữa sẽ bị line-clamp (xem .org-card__name trong file scss).
 */
const CARD_HEIGHT = 84;

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
  protected readonly legendOpen = signal(false);
  protected readonly searchOpen = signal(false);

  private chart: OrgChart<OrgNode> | null = null;
  private listenerAttached = false;
  private resizeObserver: ResizeObserver | null = null;

  constructor(private readonly zone: NgZone) {
    // d3-org-chart thao tác DOM trực tiếp (không qua Angular renderer),
    // nên phải khởi tạo sau khi view đã render xong.
    afterNextRender(() => {
      this.zone.runOutsideAngular(() => this.initChart());
    });

    // Render lại khi data hoặc node được chọn đổi (không destroy/recreate
    // instance). Focus mode: khi có node được chọn, CHỈ render nhánh liên
    // quan (tổ tiên + chính nó + con cháu) — chart tự sắp xếp lại gọn gàng
    // thay vì ẩn tại chỗ để lại khoảng trống — kèm highlight đường về gốc
    // và fit khung nhìn. Bỏ chọn thì render lại đầy đủ.
    effect(() => {
      const nodes = this.data();
      const id = this.selectedNodeId();
      if (!this.chart) {
        return;
      }
      this.zone.runOutsideAngular(() => {
        try {
          this.chart!.clearHighlighting();
          const selected = id && nodes.some((n) => n.id === id) ? id : null;
          const related = selected ? this.computeRelatedIds(selected, nodes) : null;
          const visible = related ? nodes.filter((n) => related.has(n.id)) : nodes;
          this.chart!.connections(this.computeConnections(visible));
          this.chart!.data(visible);
          if (selected) {
            this.chart!.setUpToTheRootHighlighted(selected);
          }
          this.chart!.render();
          this.fitChart();
        } catch (err) {
          console.error('Không thể cập nhật sơ đồ tổ chức:', err);
          this.zone.run(() => this.initError.set(true));
        }
      });
    });
  }

  /** Gộp `connections` khai báo trên từng node thành 1 mảng {from,to,label} phẳng cho d3-org-chart. */
  private computeConnections(nodes: OrgNode[]): { from: string; to: string; label?: string }[] {
    return nodes.flatMap((n) =>
      (n.connections ?? []).map((c) => ({ from: n.id, to: c.toId, label: c.label }))
    );
  }

  private computeRelatedIds(id: string, nodes: OrgNode[]): Set<string> {
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const byParent = new Map<string, OrgNode[]>();
    for (const n of nodes) {
      if (n.parentId) {
        const siblings = byParent.get(n.parentId);
        if (siblings) {
          siblings.push(n);
        } else {
          byParent.set(n.parentId, [n]);
        }
      }
    }
    const related = new Set<string>();
    // Tổ tiên (đường về gốc) + chính node
    let current = byId.get(id);
    while (current) {
      related.add(current.id);
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    // Toàn bộ con cháu
    const queue = [id];
    while (queue.length) {
      for (const child of byParent.get(queue.shift()!) ?? []) {
        if (!related.has(child.id)) {
          related.add(child.id);
          queue.push(child.id);
        }
      }
    }
    return related;
  }

  expandAll(): void {
    this.zone.runOutsideAngular(() => {
      this.chart?.expandAll();
      this.fitChart();
    });
  }

  collapseAll(): void {
    this.zone.runOutsideAngular(() => {
      this.chart?.collapseAll();
      this.fitChart();
    });
  }

  fit(): void {
    this.zone.runOutsideAngular(() => this.fitChart());
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
      // Layout ngang tự thân đã xếp con theo cột dọc nên tắt compact.
      this.chart?.layout(next).compact(next === 'top').render();
      this.fitChart();
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
    this.fitChart();
  }

  prevMatch(): void {
    const total = this.matches().length;
    if (!total) {
      return;
    }
    this.matchIndex.set((this.matchIndex() - 1 + total) % total);
    this.highlightCurrentMatch();
    this.fitChart();
  }

  exportImage(): void {
    this.zone.runOutsideAngular(() => this.chart?.exportImg({ save: true }));
  }

  private fitChart(): void {
    this.chart?.fit();
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
        // Bật compact mặc định của d3-org-chart: các node con xếp thành
        // 2 cột cạnh nhau dưới 1 đường thẳng từ node cha (giống sơ đồ tổ
        // chức cổ điển), chỉ bật ở layout dọc; layout ngang tự thân đã
        // xếp dọc nên không cần compact.
        .compact(this.layoutDirection() === 'top')
        .layout(this.layoutDirection())
        .initialExpandLevel(2)
        .setActiveNodeCentered(false)
        .nodeWidth(() => 288)
        .nodeHeight(() => CARD_HEIGHT)
        .childrenMargin(() => 50)
        .siblingsMargin(() => 30)
        .nodeContent((d) => this.renderCard(d.data))
        .connections(this.computeConnections(this.data()))
        // Đường nối quan hệ chéo (connections) vẽ cong, màu cam nét đứt,
        // khác với đường cây (xám) để phân biệt rõ 2 loại quan hệ.
        .connectionsUpdate((d, i, arr) => {
          const el = arr[i];
          el.setAttribute('stroke', '#c57622');
          el.setAttribute('stroke-width', '2');
          el.setAttribute('stroke-dasharray', '4 4');
          el.setAttribute('fill', 'none');
        })
        // Ghi đè mặc định của d3-org-chart (viền hồng #E27396) bằng màu
        // cam thương hiệu; node nằm trên đường đi tới node được chọn /
        // kết quả tìm kiếm sẽ có viền cam quanh card.
        .nodeUpdate((d, i, arr) => {
          const el = arr[i];
          const rect = el.querySelector<SVGRectElement>('.node-rect');
          if (!rect) {
            return;
          }
          const highlighted = Boolean(d.data._highlighted || d.data._upToTheRootHighlighted);
          rect.setAttribute('rx', '10');
          rect.setAttribute('stroke', highlighted ? '#c57622' : 'none');
          rect.setAttribute('stroke-width', highlighted ? '4' : '1');
        })
        // Tô đậm đường nối trên nhánh từ node được chọn về gốc và đưa
        // nó lên trên các link khác để không bị che. Node có
        // linkStyle 'functional' được vẽ nét đứt (quan hệ chức năng).
        .linkUpdate((d, i, arr) => {
          const el = arr[i];
          const highlighted = Boolean(d.data._upToTheRootHighlighted);
          el.setAttribute('stroke', highlighted ? '#c57622' : '#c3cdda');
          el.setAttribute('stroke-width', highlighted ? '3' : '1.5');
          if (d.data.linkStyle === 'functional') {
            el.setAttribute('stroke-dasharray', '6 4');
          } else {
            el.removeAttribute('stroke-dasharray');
          }
          if (highlighted) {
            el.parentNode?.appendChild(el);
          }
        })
        .onNodeClick((d) => {
          const node: OrgNode = 'data' in d ? d.data : d;
          this.zone.run(() => this.nodeClick.emit(node));
        })
        // Bấm nút mở/thu gọn con của 1 node bất kỳ cũng tự fit khung nhìn,
        // để phần con vừa hiện ra/thu lại luôn nằm gọn trong màn hình.
        .onExpandOrCollapse(() => this.fitChart());
      this.chart.render();
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
