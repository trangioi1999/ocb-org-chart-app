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

  /**
   * Tải dữ liệu từ file JSON tĩnh (public/data/org-chart.json). Thêm
   * ?demo=1 trên URL để tải bản demo (org-chart.demo.json, có vài
   * quan hệ chéo dummy) thay vì data thật — chỉ để xem thử tính năng
   * connections, không ảnh hưởng tới data production.
   */
  load(): void {
    this._status.set('loading');
    const isDemo = new URLSearchParams(window.location.search).get('demo') === '1';
    const file = isDemo ? 'data/org-chart.demo.json' : 'data/org-chart.json';
    this.http
      .get<OrgNode[]>(file)
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

  /** Thêm 1 node mới (in-memory; dữ liệu gốc là JSON tĩnh nên không persist). */
  addNode(node: OrgNode): void {
    this._data.update((nodes) => [...nodes, node]);
  }

  /** Cập nhật 1 phần thông tin của node (tên/chức danh/phòng ban/hướng xếp con). */
  updateNode(
    id: string,
    changes: Partial<Pick<OrgNode, 'name' | 'title' | 'department'>>
  ): OrgNode | undefined {
    const nodes = this._data();
    const index = nodes.findIndex((n) => n.id === id);
    if (index === -1) {
      return undefined;
    }
    const updated: OrgNode = { ...nodes[index], ...changes };
    const next = [...nodes];
    next[index] = updated;
    this._data.set(next);
    return updated;
  }

  /** Xóa 1 node cùng toàn bộ cấp dưới của nó. */
  removeNode(id: string): void {
    this._data.update((nodes) => {
      const doomed = new Set([id]);
      let grew = true;
      while (grew) {
        grew = false;
        for (const node of nodes) {
          if (node.parentId && doomed.has(node.parentId) && !doomed.has(node.id)) {
            doomed.add(node.id);
            grew = true;
          }
        }
      }
      return nodes.filter((node) => !doomed.has(node.id));
    });
  }
}
