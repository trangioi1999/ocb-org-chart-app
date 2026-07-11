import { Component } from '@angular/core';
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
export class App {
  protected readonly orgData;

  constructor(private readonly orgDataService: OrgDataService) {
    this.orgData = this.orgDataService.data;
  }

  protected onNodeClick(node: OrgNode): void {
    // Chỗ này sau này có thể mở panel chi tiết / điều hướng.
    console.log('Node clicked:', node);
  }
}
