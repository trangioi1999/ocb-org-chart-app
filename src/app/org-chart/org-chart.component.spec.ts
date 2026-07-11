import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { OrgChartComponent } from './org-chart.component';
import { OrgNode } from '../models/org-node.model';
import { OrgDataService } from '../services/org-data.service';

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
    TestBed.inject(OrgDataService).setData(NODES);
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
});
