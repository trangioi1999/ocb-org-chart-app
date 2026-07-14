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

  it('omits the title element when title is empty', () => {
    const fixture = TestBed.createComponent(OrgChartComponent);
    fixture.componentRef.setInput('data', NODES);
    fixture.detectChanges();

    const node: OrgNode = { id: 'unit', parentId: null, name: 'Hội đồng quản trị', title: '' };
    const html = (fixture.componentInstance as unknown as { renderCard: (n: OrgNode) => string })[
      'renderCard'
    ](node);

    expect(html).not.toContain('org-card__title');
  });

  it('renders a numbered badge instead of initials for khoi-* leaf nodes', () => {
    const fixture = TestBed.createComponent(OrgChartComponent);
    fixture.componentRef.setInput('data', NODES);
    fixture.detectChanges();

    const node: OrgNode = { id: 'khoi-05', parentId: 'tgd', name: 'Trung tâm Quản lý Tài sản Nợ và Có', title: '' };
    const html = (fixture.componentInstance as unknown as { renderCard: (n: OrgNode) => string })[
      'renderCard'
    ](node);

    expect(html).toContain('<div class="org-card__avatar">5</div>');
  });

  it('renders the default OCB legend when legendItems is not provided', () => {
    const fixture = TestBed.createComponent(OrgChartComponent);
    fixture.componentRef.setInput('data', NODES);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const items = Array.from(compiled.querySelectorAll('.legend-item')).map((el) =>
      el.textContent?.trim()
    );
    expect(items).toEqual([
      'Cơ quan quản trị / điều hành',
      'Khối / Trung tâm / Phòng',
      'Đơn vị kinh doanh / Chi nhánh',
    ]);
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
