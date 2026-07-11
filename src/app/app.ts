import { Component, inject, OnInit } from '@angular/core';
import { OrgChartComponent } from './org-chart/org-chart.component';
import { OrgDataService } from './services/org-data.service';
import { OrgNode } from './models/org-node.model';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [OrgChartComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  private readonly orgDataService = inject(OrgDataService);

  protected readonly orgData = this.orgDataService.data;
  protected readonly isLoading = this.orgDataService.isLoading;
  protected readonly hasError = this.orgDataService.hasError;

  ngOnInit(): void {
    this.orgDataService.load();
  }

  protected reload(): void {
    this.orgDataService.load();
  }

  protected onNodeClick(node: OrgNode): void {
    // Xử lý ở Task 12 (detail panel).
    console.log('Node clicked:', node);
  }
}
