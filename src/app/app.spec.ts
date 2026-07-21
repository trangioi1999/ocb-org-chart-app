import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { App } from './app';

describe('App', () => {
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders full-screen with no header', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('header')).toBeNull();
    httpMock.expectOne('data/org-chart.json').flush([]);
  });

  it('shows a loading indicator while data is in flight', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.app-status')?.textContent).toContain('Đang tải');
    httpMock.expectOne('data/org-chart.json').flush([]);
  });

  it('shows an error state and can retry', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    httpMock.expectOne('data/org-chart.json').flush('fail', { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.app-status--error')).toBeTruthy();

    (compiled.querySelector('.app-status--error button') as HTMLButtonElement).click();
    httpMock.expectOne('data/org-chart.json').flush([]);
  });

  it('opens the detail panel when a node is clicked and closes it on close', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    httpMock.expectOne('data/org-chart.json').flush([
      { id: 'a', parentId: null, name: 'Alice', title: 'Chủ tịch', tag: 'regular' },
    ]);
    fixture.detectChanges();

    fixture.componentInstance['onNodeClick']({
      id: 'a',
      parentId: null,
      name: 'Alice',
      title: 'Chủ tịch',
      tag: 'regular',
    });
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.detail-panel')).toBeTruthy();

    compiled.querySelector<HTMLButtonElement>('.detail-panel__close')!.click();
    fixture.detectChanges();
    expect(compiled.querySelector('.detail-panel')).toBeNull();
  });

  it('computes selectedChildren as the direct children of the selected node', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    httpMock.expectOne('data/org-chart.json').flush([
      { id: 'a', parentId: null, name: 'Alice', title: 'Chủ tịch', tag: 'regular' },
      { id: 'b', parentId: 'a', name: 'Bob', title: 'Thành viên', tag: 'regular' },
      { id: 'c', parentId: 'a', name: 'Carol', title: 'Thành viên', tag: 'regular' },
    ]);
    fixture.detectChanges();

    fixture.componentInstance['onNodeClick']({
      id: 'a',
      parentId: null,
      name: 'Alice',
      title: 'Chủ tịch',
      tag: 'regular',
    });

    expect(fixture.componentInstance['selectedChildren']().map((n) => n.name)).toEqual([
      'Bob',
      'Carol',
    ]);
  });
});
