import { Injectable, signal } from '@angular/core';
import { OrgNode } from '../models/org-node.model';
import { OCB_ORG_DATA } from '../data/ocb-org-data';

@Injectable({ providedIn: 'root' })
export class OrgDataService {
  private readonly _data = signal<OrgNode[]>(OCB_ORG_DATA);

  /** Toàn bộ danh sách node (dạng phẳng, id/parentId). */
  readonly data = this._data.asReadonly();

  /** Thay dữ liệu (ví dụ khi load từ API thật thay cho dummy). */
  setData(nodes: OrgNode[]): void {
    this._data.set(nodes);
  }

  /** Tìm node theo tên hoặc chức danh (không phân biệt hoa/thường). */
  search(term: string): OrgNode[] {
    const keyword = term.trim().toLowerCase();
    if (!keyword) {
      return [];
    }
    return this._data().filter(
      (node) =>
        node.name.toLowerCase().includes(keyword) ||
        node.title.toLowerCase().includes(keyword)
    );
  }
}
