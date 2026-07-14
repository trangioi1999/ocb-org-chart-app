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

  it('shows CRUD actions in view mode and disables delete for the root node', () => {
    const fixture = TestBed.createComponent(DetailPanelComponent);
    fixture.componentRef.setInput('node', { ...NODE, parentId: null });
    fixture.detectChanges();

    const buttons = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>(
      '.detail-panel__actions .panel-btn'
    );
    expect(buttons).toHaveLength(3);
    expect(buttons[2].disabled).toBe(true);
  });

  it('emits createChild with the form values when adding a subordinate', async () => {
    const fixture = TestBed.createComponent(DetailPanelComponent);
    fixture.componentRef.setInput('node', NODE);
    fixture.detectChanges();

    const emitted: unknown[] = [];
    fixture.componentInstance.createChild.subscribe((p) => emitted.push(p));

    const el = fixture.nativeElement as HTMLElement;
    el.querySelectorAll<HTMLButtonElement>('.detail-panel__actions .panel-btn')[0].click();
    fixture.detectChanges();
    await fixture.whenStable();

    const setField = (name: string, value: string) => {
      const input = el.querySelector<HTMLInputElement>(`input[name="${name}"]`)!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
    };
    setField('name', 'Trần Thị B');
    setField('title', 'Giám đốc Khối');
    setField('department', 'Khối Bán lẻ');
    fixture.detectChanges();

    el.querySelector<HTMLFormElement>('form.detail-panel__form')!.dispatchEvent(
      new Event('submit')
    );

    expect(emitted).toEqual([
      { parentId: 'ceo', name: 'Trần Thị B', title: 'Giám đốc Khối', department: 'Khối Bán lẻ' },
    ]);
  });

  it('emits updated with the edited values', async () => {
    const fixture = TestBed.createComponent(DetailPanelComponent);
    fixture.componentRef.setInput('node', NODE);
    fixture.detectChanges();

    const emitted: unknown[] = [];
    fixture.componentInstance.updated.subscribe((p) => emitted.push(p));

    const el = fixture.nativeElement as HTMLElement;
    el.querySelectorAll<HTMLButtonElement>('.detail-panel__actions .panel-btn')[1].click();
    fixture.detectChanges();
    await fixture.whenStable();

    const nameInput = el.querySelector<HTMLInputElement>('input[name="name"]')!;
    expect(nameInput.value).toBe('Nguyễn Văn A');
    nameInput.value = 'Nguyễn Văn A Sửa';
    nameInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    el.querySelector<HTMLFormElement>('form.detail-panel__form')!.dispatchEvent(
      new Event('submit')
    );

    expect(emitted).toEqual([
      {
        id: 'ceo',
        name: 'Nguyễn Văn A Sửa',
        title: 'Tổng Giám đốc',
        department: 'Ban điều hành',
      },
    ]);
  });

  it('emits deleted only after the user confirms', () => {
    const fixture = TestBed.createComponent(DetailPanelComponent);
    fixture.componentRef.setInput('node', NODE);
    fixture.detectChanges();

    const emitted: string[] = [];
    fixture.componentInstance.deleted.subscribe((id) => emitted.push(id));

    const el = fixture.nativeElement as HTMLElement;
    el.querySelectorAll<HTMLButtonElement>('.detail-panel__actions .panel-btn')[2].click();
    fixture.detectChanges();
    expect(emitted).toEqual([]);

    el.querySelector<HTMLButtonElement>('.detail-panel__confirm .panel-btn--danger')!.click();
    expect(emitted).toEqual(['ceo']);
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

  it('renders the direct-children list when children input is non-empty', () => {
    const node: OrgNode = { id: 'hdqt', parentId: 'dhdcd', name: 'Hội đồng quản trị', title: '' };
    const kids: OrgNode[] = [
      { id: 'cqt-hdqt', parentId: 'hdqt', name: 'Các cơ quan trực thuộc HĐQT', title: '' },
      { id: 'vp-hdqt', parentId: 'hdqt', name: 'Văn phòng HĐQT', title: '' },
    ];
    const fixture = TestBed.createComponent(DetailPanelComponent);
    fixture.componentRef.setInput('node', node);
    fixture.componentRef.setInput('children', kids);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const items = Array.from(compiled.querySelectorAll('.detail-panel__children li')).map((el) =>
      el.textContent?.trim()
    );
    expect(items).toEqual(['Các cơ quan trực thuộc HĐQT', 'Văn phòng HĐQT']);
  });

  it('omits the children list when there are no children', () => {
    const node: OrgNode = { id: 'khoi-01', parentId: 'tgd', name: 'Khối Bán lẻ', title: '' };
    const fixture = TestBed.createComponent(DetailPanelComponent);
    fixture.componentRef.setInput('node', node);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.detail-panel__children')).toBeNull();
  });
});
