import { Component, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { OrgNode } from '../models/org-node.model';

/** Giá trị form thêm/sửa đơn vị trong panel chi tiết. */
export interface OrgNodeFormValue {
  name: string;
  title: string;
  department?: string;
}

type PanelMode = 'view' | 'add' | 'edit' | 'delete';

@Component({
  selector: 'app-detail-panel',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './detail-panel.component.html',
  styleUrl: './detail-panel.component.scss',
})
export class DetailPanelComponent {
  readonly node = input<OrgNode | null>(null);
  readonly children = input<OrgNode[]>([]);
  readonly closed = output<void>();

  /** Yêu cầu thêm 1 cấp dưới cho node đang chọn. */
  readonly createChild = output<OrgNodeFormValue & { parentId: string }>();
  /** Yêu cầu cập nhật thông tin node đang chọn. */
  readonly updated = output<OrgNodeFormValue & { id: string }>();
  /** Yêu cầu xóa node đang chọn (kèm toàn bộ cấp dưới). */
  readonly deleted = output<string>();

  protected readonly mode = signal<PanelMode>('view');
  protected draft = { name: '', title: '', department: '' };

  constructor() {
    // Chọn node khác (hoặc đóng/mở panel) thì quay về chế độ xem.
    effect(() => {
      this.node();
      this.mode.set('view');
    });
  }

  protected close(): void {
    this.closed.emit();
  }

  protected startAdd(): void {
    this.draft = { name: '', title: '', department: '' };
    this.mode.set('add');
  }

  protected startEdit(node: OrgNode): void {
    this.draft = {
      name: node.name,
      title: node.title,
      department: node.department ?? '',
    };
    this.mode.set('edit');
  }

  protected cancel(): void {
    this.mode.set('view');
  }

  protected submitForm(node: OrgNode): void {
    const name = this.draft.name.trim();
    if (!name) {
      return;
    }
    const title = this.draft.title.trim();
    const department = this.draft.department.trim() || undefined;
    if (this.mode() === 'add') {
      this.createChild.emit({ parentId: node.id, name, title, department });
    } else {
      this.updated.emit({ id: node.id, name, title, department });
    }
    this.mode.set('view');
  }

  protected confirmDelete(node: OrgNode): void {
    this.deleted.emit(node.id);
    this.mode.set('view');
  }
}
