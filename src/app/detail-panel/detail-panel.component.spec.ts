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
