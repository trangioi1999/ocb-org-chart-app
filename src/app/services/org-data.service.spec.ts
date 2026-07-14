import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { OrgDataService } from './org-data.service';
import { OrgNode } from '../models/org-node.model';

const SAMPLE: OrgNode[] = [
  { id: 'a', parentId: null, name: 'Alice Nguyen', title: 'Chủ tịch', tag: 'regular' },
  { id: 'b', parentId: 'a', name: 'Bob Tran', title: 'Giám đốc CNTT', tag: 'executive' },
];

describe('OrgDataService', () => {
  let service: OrgDataService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(OrgDataService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('starts idle with no data', () => {
    expect(service.data()).toEqual([]);
    expect(service.status()).toBe('idle');
  });

  it('loads data from the JSON asset and sets status to loaded', () => {
    service.load();
    expect(service.isLoading()).toBe(true);

    const req = httpMock.expectOne('data/org-chart.json');
    req.flush(SAMPLE);

    expect(service.status()).toBe('loaded');
    expect(service.data()).toEqual(SAMPLE);
  });

  it('sets status to error when the request fails', () => {
    service.load();
    const req = httpMock.expectOne('data/org-chart.json');
    req.flush('fail', { status: 500, statusText: 'Server Error' });

    expect(service.hasError()).toBe(true);
    expect(service.data()).toEqual([]);
  });
  it('addNode() appends a node to the data', () => {
    service.setData(SAMPLE);
    const child: OrgNode = { id: 'c', parentId: 'b', name: 'Chi Le', title: 'Trưởng phòng' };
    service.addNode(child);
    expect(service.data()).toHaveLength(3);
    expect(service.data()[2]).toEqual(child);
  });

  it('updateNode() replaces name/title/department and returns the updated node', () => {
    service.setData(SAMPLE);
    const updated = service.updateNode('b', {
      name: 'Bob Tran',
      title: 'Giám đốc Vận hành',
      department: 'Khối Vận hành',
    });
    expect(updated?.title).toBe('Giám đốc Vận hành');
    expect(service.data().find((n) => n.id === 'b')?.department).toBe('Khối Vận hành');
    // Giữ nguyên các field không nằm trong changes
    expect(service.data().find((n) => n.id === 'b')?.tag).toBe('executive');
  });

  it('updateNode() returns undefined for an unknown id', () => {
    service.setData(SAMPLE);
    expect(service.updateNode('missing', { name: 'X', title: 'Y' })).toBeUndefined();
    expect(service.data()).toEqual(SAMPLE);
  });

  it('removeNode() removes the node and all of its descendants', () => {
    const tree: OrgNode[] = [
      ...SAMPLE,
      { id: 'c', parentId: 'b', name: 'Chi Le', title: 'Trưởng phòng' },
      { id: 'd', parentId: 'c', name: 'Dung Pham', title: 'Chuyên viên' },
      { id: 'e', parentId: 'a', name: 'Em Vo', title: 'Kiểm soát viên' },
    ];
    service.setData(tree);
    service.removeNode('b');
    expect(service.data().map((n) => n.id)).toEqual(['a', 'e']);
  });
});
