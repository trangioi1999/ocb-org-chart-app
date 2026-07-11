import { OrgNode } from '../models/org-node.model';

/**
 * Dữ liệu sơ đồ tổ chức OCB.
 *
 * Khối "Hội đồng quản trị" lấy từ trang chính thức
 * https://ocb.com.vn/vi/ve-ocb/co-cau-quan-ly (nhiệm kỳ 2025-2030, 8 thành viên).
 *
 * Khối "Ban điều hành" và các Khối/Phòng ban bên dưới là DỮ LIỆU DÀN DỰNG
 * (đánh dấu "[Dummy]") vì trang OCB tải phần này bằng JavaScript nên không
 * lấy được dữ liệu thật qua fetch tĩnh. Thay thế bằng dữ liệu thật khi có
 * nguồn chính thức (báo cáo thường niên / báo cáo quản trị OCB).
 */
export const OCB_ORG_DATA: OrgNode[] = [
  { id: 'hdqt-chairman', parentId: null, name: 'Trịnh Văn Tuấn', title: 'Chủ tịch Hội đồng quản trị', department: 'Hội đồng quản trị', tag: 'regular' },

  { id: 'hdqt-01', parentId: 'hdqt-chairman', name: 'Ngô Hà Bắc', title: 'Thành viên HĐQT', department: 'Hội đồng quản trị', tag: 'regular' },
  { id: 'hdqt-02', parentId: 'hdqt-chairman', name: 'Trịnh Thị Mai Anh', title: 'Thành viên HĐQT', department: 'Hội đồng quản trị', tag: 'regular' },
  { id: 'hdqt-03', parentId: 'hdqt-chairman', name: 'Yoshizawa Toshiki', title: 'Thành viên HĐQT', department: 'Hội đồng quản trị', tag: 'regular' },
  { id: 'hdqt-04', parentId: 'hdqt-chairman', name: 'Segawa Mitsuhiro', title: 'Thành viên HĐQT', department: 'Hội đồng quản trị', tag: 'regular' },
  { id: 'hdqt-05', parentId: 'hdqt-chairman', name: 'Phan Trung', title: 'Thành viên HĐQT', department: 'Hội đồng quản trị', tag: 'regular' },
  { id: 'hdqt-06', parentId: 'hdqt-chairman', name: 'Dương Kỳ Hiệp', title: 'Thành viên độc lập HĐQT', department: 'Hội đồng quản trị', tag: 'independent' },
  { id: 'hdqt-07', parentId: 'hdqt-chairman', name: 'Lê Xuân Nghĩa', title: 'Thành viên độc lập HĐQT', department: 'Hội đồng quản trị', tag: 'independent' },

  { id: 'ceo', parentId: 'hdqt-chairman', name: '[Dummy] Nguyễn Văn A', title: 'Tổng Giám đốc', department: 'Ban điều hành', tag: 'executive' },

  { id: 'deputy-khcn', parentId: 'ceo', name: '[Dummy] Trần Thị B', title: 'Phó Tổng Giám đốc phụ trách Khối KHCN', department: 'Ban điều hành', tag: 'executive' },
  { id: 'deputy-khdn', parentId: 'ceo', name: '[Dummy] Lê Văn C', title: 'Phó Tổng Giám đốc phụ trách Khối KHDN', department: 'Ban điều hành', tag: 'executive' },
  { id: 'deputy-vanhanh', parentId: 'ceo', name: '[Dummy] Phạm Thị D', title: 'Phó Tổng Giám đốc phụ trách Khối Vận hành', department: 'Ban điều hành', tag: 'executive' },
  { id: 'deputy-rui-ro', parentId: 'ceo', name: '[Dummy] Hoàng Văn E', title: 'Phó Tổng Giám đốc kiêm Giám đốc Khối Quản trị rủi ro', department: 'Ban điều hành', tag: 'executive' },
  { id: 'director-cntt', parentId: 'ceo', name: '[Dummy] Vũ Thị F', title: 'Giám đốc Khối CNTT & Chuyển đổi số', department: 'Ban điều hành', tag: 'executive' },
  { id: 'director-taichinh', parentId: 'ceo', name: '[Dummy] Đặng Văn G', title: 'Giám đốc Khối Tài chính', department: 'Ban điều hành', tag: 'executive' },
  { id: 'director-nhansu', parentId: 'ceo', name: '[Dummy] Bùi Thị H', title: 'Giám đốc Khối Nhân sự', department: 'Ban điều hành', tag: 'executive' },

  { id: 'khcn-p1', parentId: 'deputy-khcn', name: '[Dummy] Ngô Thị I', title: 'Trưởng phòng Sản phẩm bán lẻ', department: 'Khối KHCN', tag: 'regular' },
  { id: 'khcn-p2', parentId: 'deputy-khcn', name: '[Dummy] Đỗ Văn K', title: 'Trưởng phòng Kênh phân phối', department: 'Khối KHCN', tag: 'regular' },
  { id: 'khcn-p3', parentId: 'deputy-khcn', name: '[Dummy] Lý Thị L', title: 'Trưởng phòng Ngân hàng ưu tiên', department: 'Khối KHCN', tag: 'regular' },

  { id: 'khdn-p1', parentId: 'deputy-khdn', name: '[Dummy] Trương Văn M', title: 'Trưởng phòng KH Doanh nghiệp lớn', department: 'Khối KHDN', tag: 'regular' },
  { id: 'khdn-p2', parentId: 'deputy-khdn', name: '[Dummy] Phan Thị N', title: 'Trưởng phòng SME', department: 'Khối KHDN', tag: 'regular' },
  { id: 'khdn-p3', parentId: 'deputy-khdn', name: '[Dummy] Vương Văn O', title: 'Trưởng phòng Tài trợ thương mại', department: 'Khối KHDN', tag: 'regular' },

  { id: 'vh-p1', parentId: 'deputy-vanhanh', name: '[Dummy] Chu Thị P', title: 'Trưởng phòng Vận hành giao dịch', department: 'Khối Vận hành', tag: 'regular' },
  { id: 'vh-p2', parentId: 'deputy-vanhanh', name: '[Dummy] Kiều Văn Q', title: 'Trưởng phòng Quản lý mạng lưới CN/PGD', department: 'Khối Vận hành', tag: 'regular' },

  { id: 'rr-p1', parentId: 'deputy-rui-ro', name: '[Dummy] Tạ Thị R', title: 'Trưởng phòng Quản lý rủi ro tín dụng', department: 'Khối Quản trị rủi ro', tag: 'regular' },
  { id: 'rr-p2', parentId: 'deputy-rui-ro', name: '[Dummy] Đinh Văn S', title: 'Trưởng phòng Tuân thủ & Pháp chế', department: 'Khối Quản trị rủi ro', tag: 'regular' },

  { id: 'cntt-p1', parentId: 'director-cntt', name: '[Dummy] Hồ Thị T', title: 'Trưởng phòng Phát triển ứng dụng', department: 'Khối CNTT & Chuyển đổi số', tag: 'regular' },
  { id: 'cntt-p2', parentId: 'director-cntt', name: '[Dummy] Mai Văn U', title: 'Trưởng phòng Hạ tầng & Bảo mật', department: 'Khối CNTT & Chuyển đổi số', tag: 'regular' },

  { id: 'tc-p1', parentId: 'director-taichinh', name: '[Dummy] Lâm Thị V', title: 'Trưởng phòng Kế toán tài chính', department: 'Khối Tài chính', tag: 'regular' },
  { id: 'tc-p2', parentId: 'director-taichinh', name: '[Dummy] Cao Văn X', title: 'Trưởng phòng Kế hoạch & Ngân sách', department: 'Khối Tài chính', tag: 'regular' },

  { id: 'ns-p1', parentId: 'director-nhansu', name: '[Dummy] Tô Thị Y', title: 'Trưởng phòng Tuyển dụng & Đào tạo', department: 'Khối Nhân sự', tag: 'regular' },
  { id: 'ns-p2', parentId: 'director-nhansu', name: '[Dummy] Đào Văn Z', title: 'Trưởng phòng Chính sách nhân sự', department: 'Khối Nhân sự', tag: 'regular' },
];
