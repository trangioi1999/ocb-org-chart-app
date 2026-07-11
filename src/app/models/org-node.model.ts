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
}
