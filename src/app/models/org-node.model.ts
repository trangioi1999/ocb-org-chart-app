/**
 * Nhóm màu phân loại đơn vị trên sơ đồ.
 * 8 nhóm chính theo chú thích chuẩn: top (Cấp cao nhất), governance
 * (Bộ máy quản trị HĐQT), control (Bộ máy kiểm soát), business (Khối
 * kinh doanh), support (Khối hỗ trợ/vận hành), center (Trung tâm),
 * council (Hội đồng), company (Công ty/Đơn vị sự nghiệp).
 * 3 tag cũ (regular/executive/independent) giữ lại để tương thích với
 * dữ liệu chưa migrate (VD: branch-org.json).
 */
export type OrgNodeTag =
  | 'top'
  | 'governance'
  | 'control'
  | 'business'
  | 'support'
  | 'center'
  | 'council'
  | 'company'
  | 'independent'
  | 'executive'
  | 'regular';

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
  /** 'functional' -> đường nối tới cấp trên vẽ nét đứt (quan hệ chức năng, không phải trực thuộc). */
  linkStyle?: 'functional';
  /**
   * Hướng xếp các node CON LÁ của node này ở layout dọc:
   * 'row' (mặc định) = dàn hàng ngang, 'column' = xếp 1 cột dọc.
   */
  childrenLayout?: 'row' | 'column';
  /**
   * Quan hệ chéo tới các node KHÁC ngoài cây cha/con (VD: phối hợp,
   * kiêm nhiệm) — vẽ thành 1 đường cong mũi tên riêng, độc lập với vị
   * trí node trong cây. Chỉ hiện khi cả 2 node đang cùng hiển thị trên
   * sơ đồ (không bị thu gọn).
   */
  connections?: { toId: string; label?: string }[];
}
