# PDR-016: Một hội đồng và một lượt bảo vệ có hiệu lực cho mỗi đề tài

## Trạng thái

Đã chấp nhận theo xác nhận trực tiếp của người dùng ngày 2026-10-28.

## Bối cảnh

Nếu một đề tài được xếp đồng thời ở nhiều hội đồng hoặc nhiều lượt, Sinh viên và Giảng viên có thể nhận hai lịch khác nhau; kết quả chấm cũng khó gắn với đúng hội đồng.

## Quyết định

- Trong cùng một đợt, một đề tài chỉ có **một hội đồng và một lượt bảo vệ có hiệu lực** tại một thời điểm.
- Khi Giáo vụ đổi hội đồng hoặc lịch của đề tài theo quyền được chốt sau này, cập nhật lượt có hiệu lực và **giữ lịch sử thay đổi**; không tạo lượt thứ hai đồng thời có hiệu lực.
- Backend phải kiểm tra ràng buộc này cả khi xếp từng đề tài và khi thao tác hàng loạt. Danh sách lịch của Sinh viên/Giảng viên chỉ hiển thị lượt có hiệu lực, lịch sử xem theo quyền.

## Chưa chốt

Sửa lịch sau công bố và đính chính khi đã có điểm theo [PDR-018](PDR-018-sua-lich-da-cong-bo-va-dinh-chinh.md). Hủy lịch đã công bố theo [PDR-019](PDR-019-huy-lich-bao-ve-da-cong-bo.md); thay thành viên sau điểm bị khóa theo [PDR-020](PDR-020-khoa-thay-thanh-vien-hoi-dong-sau-diem.md).

## Hệ quả

- Test gán đề tài vào hội đồng/lượt thứ hai, đổi lượt hợp lệ, thao tác đồng thời và truy vết lịch cũ.
- Phiếu điểm và phân công hội đồng phải tham chiếu đúng lượt/hội đồng có hiệu lực; không thay Chủ tịch/Thư ký sau điểm theo [PDR-020](PDR-020-khoa-thay-thanh-vien-hoi-dong-sau-diem.md).
