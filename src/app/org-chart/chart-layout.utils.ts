/**
 * Hằng số ước lượng số dòng text khi wrap, phải khớp với padding/font
 * của .org-card trong org-chart.component.scss (card rộng cố định 288px).
 */
const NAME_CHARS_PER_LINE = 22;
const TITLE_CHARS_PER_LINE = 26;
const DEPT_CHARS_PER_LINE = 28;

const NAME_LINE_HEIGHT = 20;
const TITLE_LINE_HEIGHT = 17;
const DEPT_LINE_HEIGHT = 15;
const VERTICAL_PADDING = 24;
const ROW_GAP = 4;

function countLines(text: string, charsPerLine: number): number {
  return Math.max(1, Math.ceil(text.length / charsPerLine));
}

/**
 * Ước lượng chiều cao card (px) theo nội dung thực tế, để d3-org-chart
 * cấp đủ chỗ dọc cho card thay vì dùng 1 chiều cao cố định.
 */
export function estimateCardHeight(node: { name: string; title?: string; department?: string }): number {
  let height = VERTICAL_PADDING + countLines(node.name, NAME_CHARS_PER_LINE) * NAME_LINE_HEIGHT;
  if (node.title) {
    height += ROW_GAP + countLines(node.title, TITLE_CHARS_PER_LINE) * TITLE_LINE_HEIGHT;
  }
  if (node.department) {
    height += ROW_GAP + countLines(node.department, DEPT_CHARS_PER_LINE) * DEPT_LINE_HEIGHT;
  }
  return height;
}

/** Số node con lá tối thiểu để bắt đầu xếp thành lưới nhiều cột thay vì 1 hàng ngang. */
export const GRID_GROUP_THRESHOLD = 4;

/** true nếu nhóm node con lá này nên xếp lưới thay vì dàn hàng ngang mặc định. */
export function shouldGridPack(leafCount: number): boolean {
  return leafCount > GRID_GROUP_THRESHOLD;
}

/** Số cột lưới gần-vuông cho 1 nhóm node con lá, giới hạn bởi maxColumns. */
export function computeGridColumns(leafCount: number, maxColumns = 4): number {
  if (leafCount <= 0) {
    return 1;
  }
  return Math.min(maxColumns, Math.ceil(Math.sqrt(leafCount)));
}
