import { Component, computed, inject, OnInit, signal, viewChild } from '@angular/core';
import { OrgChartComponent } from './org-chart/org-chart.component';
import { DetailPanelComponent, OrgNodeFormValue } from './detail-panel/detail-panel.component';
import { OrgDataService } from './services/org-data.service';
import { OrgNode } from './models/org-node.model';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [OrgChartComponent, DetailPanelComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  private readonly orgDataService = inject(OrgDataService);
  private readonly orgChart = viewChild(OrgChartComponent);

  protected readonly orgData = this.orgDataService.data;
  protected readonly isLoading = this.orgDataService.isLoading;
  protected readonly hasError = this.orgDataService.hasError;
  protected readonly selectedNode = signal<OrgNode | null>(null);
  protected readonly selectedChildren = computed(() => {
    const node = this.selectedNode();
    return node ? this.orgData().filter((n) => n.parentId === node.id) : [];
  });

  ngOnInit(): void {
    this.orgDataService.load();
  }

  protected reload(): void {
    this.orgDataService.load();
  }

  protected onNodeClick(node: OrgNode): void {
    this.selectedNode.set(node);
  }

  protected onCreateChild(payload: OrgNodeFormValue & { parentId: string }): void {
    const parent = this.orgData().find((n) => n.id === payload.parentId);
    const child: OrgNode = {
      id: this.generateId(),
      parentId: payload.parentId,
      name: payload.name,
      title: payload.title,
      department: payload.department,
      // Node mới kế thừa nhóm màu của cấp trên cho đồng bộ về hình ảnh.
      tag: parent?.tag ?? 'regular',
    };
    this.orgDataService.addNode(child);
    // Mở nhánh + căn giữa cấp trên để node vừa thêm hiện ra trong khung
    // nhìn (node mới chưa có trong chart nên phải reveal qua cấp trên),
    // rồi chọn luôn node mới.
    this.orgChart()?.revealNode(payload.parentId);
    this.selectedNode.set(child);
  }

  protected onUpdateNode(payload: OrgNodeFormValue & { id: string }): void {
    const updated = this.orgDataService.updateNode(payload.id, {
      name: payload.name,
      title: payload.title,
      department: payload.department,
    });
    if (updated) {
      this.selectedNode.set(updated);
    }
  }

  protected onDeleteNode(id: string): void {
    this.orgDataService.removeNode(id);
    this.selectedNode.set(null);
  }

  protected onChildrenLayoutChanged(payload: { id: string; layout: 'row' | 'column' }): void {
    const updated = this.orgDataService.updateNode(payload.id, {
      childrenLayout: payload.layout,
    });
    if (updated) {
      this.selectedNode.set(updated);
    }
  }

  private generateId(): string {
    return typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `node-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
}
