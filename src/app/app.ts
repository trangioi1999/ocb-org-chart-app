import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { OrgChartComponent } from './org-chart/org-chart.component';
import { DetailPanelComponent } from './detail-panel/detail-panel.component';
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
}
