/**
 * d3-org-chart không phát hành file .d.ts kèm package, nên khai báo
 * kiểu tối thiểu ở đây (đủ dùng cho OrgChartComponent) để tránh lỗi
 * TS7016 (Could not find a declaration file) khi build.
 */
declare module 'd3-org-chart' {
  /**
   * Cờ trạng thái d3-org-chart tự gắn lên từng phần tử data
   * (setHighlighted / setUpToTheRootHighlighted / setExpanded).
   */
  export interface D3OrgChartStateFlags {
    _highlighted?: boolean;
    _upToTheRootHighlighted?: boolean;
    _expanded?: boolean;
  }

  export interface D3OrgChartHierarchyNode<T> {
    data: T & D3OrgChartStateFlags;
    children?: D3OrgChartHierarchyNode<T>[];
    parent?: D3OrgChartHierarchyNode<T> | null;
    depth: number;
  }

  export class OrgChart<T = unknown> {
    constructor();

    container(selectorOrElement: string | HTMLElement): this;
    data(data: T[]): this;
    svgWidth(value: number): this;
    svgHeight(value: number): this;
    nodeId(fn: (d: T) => string): this;
    parentNodeId(fn: (d: T) => string | undefined): this;
    nodeWidth(fn: (d: D3OrgChartHierarchyNode<T>) => number): this;
    nodeHeight(fn: (d: D3OrgChartHierarchyNode<T>) => number): this;
    childrenMargin(fn: (d: D3OrgChartHierarchyNode<T>) => number): this;
    siblingsMargin(fn: (d: D3OrgChartHierarchyNode<T>) => number): this;
    neighbourMargin(fn: (n1: D3OrgChartHierarchyNode<T>, n2: D3OrgChartHierarchyNode<T>) => number): this;
    compact(value: boolean): this;
    compactMarginBetween(fn: (d?: unknown) => number): this;
    compactMarginPair(fn: (d?: unknown) => number): this;
    layout(value: 'top' | 'bottom' | 'left' | 'right'): this;
    nodeContent(fn: (d: D3OrgChartHierarchyNode<T>) => string): this;
    onNodeClick(fn: (d: D3OrgChartHierarchyNode<T> | T) => void): this;
    /** Được gọi qua selection.each() -> `this` là phần tử <g> của node. */
    nodeUpdate(
      fn: (this: SVGGraphicsElement, d: D3OrgChartHierarchyNode<T>, i: number, arr: ArrayLike<SVGGraphicsElement>) => void
    ): this;
    /** Được gọi qua selection.each() -> `this` là phần tử <path> của link. */
    linkUpdate(
      fn: (this: SVGPathElement, d: D3OrgChartHierarchyNode<T>, i: number, arr: ArrayLike<SVGPathElement>) => void
    ): this;
    initialExpandLevel(value: number): this;

    render(): this;
    fit(options?: { animate?: boolean; scale?: boolean; onCompleted?: () => void }): this;
    setActiveNodeCentered(value: boolean): this;
    expandAll(): this;
    collapseAll(): this;
    setExpanded(id: string, expandedFlag?: boolean): this;
    setCentered(id: string): this;
    setHighlighted(id: string): this;
    setUpToTheRootHighlighted(id: string): this;
    clearHighlighting(): this;
    zoomIn(): this;
    zoomOut(): this;
    exportImg(options?: {
      full?: boolean;
      scale?: number;
      save?: boolean;
      backgroundColor?: string;
    }): void;
  }
}
