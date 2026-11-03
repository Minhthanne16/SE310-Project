# PDR-024: Chung mẫu hội đồng, tách phiếu điểm Chủ tịch và Thư ký

## Trạng thái

Đã chấp nhận theo xác nhận trực tiếp của người dùng ngày 2026-10-28.

## Bối cảnh

Thiết kế có loại mẫu cho thành viên hội đồng, trong khi công thức kết quả cần hai điểm độc lập CTHĐ và TKHĐ cho mỗi Sinh viên. Cần tách mẫu tiêu chí khỏi phiếu chấm của từng vai trò.

## Quyết định

- Chủ tịch và Thư ký dùng **chung cấu trúc tiêu chí của mẫu phiếu hội đồng** có hiệu lực trong đợt.
- Với **mỗi Sinh viên**, lưu **hai phiếu điểm riêng**: một phiếu mang vai trò/điểm CTHĐ, một phiếu mang vai trò/điểm TKHĐ. Hai điểm có thể khác nhau và được tính riêng theo công thức hiện hành; không tạo một điểm chung của hội đồng.
- Cả hai phiếu tham chiếu đúng phiên bản mẫu hội đồng dùng khi chấm. Thư ký nhập cả hai điểm; không có bước Chủ tịch xác nhận ([PDR-050](PDR-050-bo-buoc-chu-tich-xac-nhan-diem.md), thay PDR-006).

## Chưa chốt

Mẫu đã gán phải tạo phiên bản mới nếu thay tiêu chí theo [PDR-025](PDR-025-phien-ban-hoa-mau-phieu-da-gan.md). Phiên bản đang dùng trong đợt bị khóa từ phiếu đầu tiên theo [PDR-026](PDR-026-khoa-phien-ban-mau-trong-dot-sau-diem.md). Chỉ xóa Nháp chưa từng gán theo [PDR-027](PDR-027-chi-xoa-mau-nhap-chua-gan.md); Đóng không chặn đợt đang dùng theo [PDR-028](PDR-028-dong-mau-khong-chan-dot-dang-dung.md).

## Hệ quả

- Mô hình phiếu phân biệt vai trò chấm, người nhập và người xác nhận dù dùng chung mẫu tiêu chí.
- Kiểm thử nhóm một/hai Sinh viên, hai điểm hội đồng khác nhau, chỉ có một phiếu, mẫu sai phiên bản và xác nhận điểm CTHĐ.
