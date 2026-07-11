import { Component, input, output } from '@angular/core';
import { OrgNode } from '../models/org-node.model';

@Component({
  selector: 'app-detail-panel',
  standalone: true,
  templateUrl: './detail-panel.component.html',
  styleUrl: './detail-panel.component.scss',
})
export class DetailPanelComponent {
  readonly node = input<OrgNode | null>(null);
  readonly closed = output<void>();

  protected close(): void {
    this.closed.emit();
  }
}
