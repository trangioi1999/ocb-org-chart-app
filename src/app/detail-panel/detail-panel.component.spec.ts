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

  it('renders members list and note when present', () => {
    const node: OrgNode = {
      id: 'hdqt',
      parentId: 'dhdcd',
      name: 'Hội đồng quản trị',
      title: '',
      members: ['Trịnh Văn Tuấn — Chủ tịch Hội đồng quản trị'],
      note: 'Ủy ban Nhân sự, Ủy ban Quản lý rủi ro',
    };
    const fixture = TestBed.createComponent(DetailPanelComponent);
    fixture.componentRef.setInput('node', node);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.detail-panel__members')).toBeTruthy();
    expect(compiled.textContent).toContain('Trịnh Văn Tuấn — Chủ tịch Hội đồng quản trị');
    expect(compiled.querySelector('.detail-panel__note')?.textContent).toContain('Ủy ban Nhân sự');
  });

  it('omits the title element when title is empty', () => {
    const node: OrgNode = { id: 'dhdcd', parentId: null, name: 'Đại hội đồng cổ đông', title: '' };
    const fixture = TestBed.createComponent(DetailPanelComponent);
    fixture.componentRef.setInput('node', node);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.detail-panel__title')).toBeNull();
  });
});
