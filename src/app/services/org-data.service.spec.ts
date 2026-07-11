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

  it('search() matches by name or title, case-insensitive', () => {
    service.setData(SAMPLE);
    expect(service.search('cntt')).toEqual([SAMPLE[1]]);
    expect(service.search('nguyen')).toEqual([SAMPLE[0]]);
    expect(service.search('')).toEqual([]);
  });
});
