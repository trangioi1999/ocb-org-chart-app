export type OrgNodeTag = 'independent' | 'executive' | 'regular';

/**
 * Flat node shape consumed by d3-org-chart.
 * The library builds the tree itself from `id` / `parentId` — no need
 * to nest children manually.
 */
export interface OrgNode {
  id: string;
  parentId: string | null;
  name: string;
  title: string;
  department?: string;
  imageUrl?: string;
  tag?: OrgNodeTag;
  isDummy?: boolean;
  /** Tên các cá nhân thuộc đơn vị này (VD: 8 thành viên HĐQT), hiển thị ở detail panel. */
  members?: string[];
  /** Ghi chú dài (VD: danh sách các cơ quan trực thuộc), hiển thị ở detail panel. */
  note?: string;
}
