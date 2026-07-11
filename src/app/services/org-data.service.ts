import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { catchError, of, tap } from 'rxjs';
import { OrgNode } from '../models/org-node.model';

export type OrgDataStatus = 'idle' | 'loading' | 'loaded' | 'error';

@Injectable({ providedIn: 'root' })
export class OrgDataService {
  private readonly http = inject(HttpClient);

  private readonly _data = signal<OrgNode[]>([]);
  private readonly _status = signal<OrgDataStatus>('idle');

  /** Toàn bộ danh sách node (dạng phẳng, id/parentId). */
  readonly data = this._data.asReadonly();
  readonly status = this._status.asReadonly();
  readonly isLoading = computed(() => this._status() === 'loading');
  readonly hasError = computed(() => this._status() === 'error');

  /** Tải dữ liệu từ file JSON tĩnh (public/data/org-chart.json). */
  load(): void {
    this._status.set('loading');
    this.http
      .get<OrgNode[]>('data/org-chart.json')
      .pipe(
        tap((nodes) => {
          this._data.set(nodes);
          this._status.set('loaded');
        }),
        catchError(() => {
          this._status.set('error');
          return of([] as OrgNode[]);
        })
      )
      .subscribe();
  }

  /** Thay dữ liệu trực tiếp (dùng trong test hoặc khi cần bơm data thủ công). */
  setData(nodes: OrgNode[]): void {
    this._data.set(nodes);
    this._status.set('loaded');
  }

  /** Tìm node theo tên hoặc chức danh (không phân biệt hoa/thường). */
  search(term: string): OrgNode[] {
    const keyword = term.trim().toLowerCase();
    if (!keyword) {
      return [];
    }
    return this._data().filter(
      (node) =>
        node.name.toLowerCase().includes(keyword) || node.title.toLowerCase().includes(keyword)
    );
  }
}
