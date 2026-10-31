# PDR-029: Mỗi Sinh viên chỉ tham gia một đợt đang diễn ra

## Trạng thái

Đã chấp nhận theo xác nhận trực tiếp của người dùng ngày 2026-10-28.

## Bối cảnh

BUSINESS_RULES chỉ giới hạn một nhóm trong cùng đợt, còn DESIGN chặn một Sinh viên thuộc hai đợt đang diễn ra. Thiếu quy tắc thống nhất có thể tạo hai khóa luận và hai bộ kết quả đồng thời cho một người.

## Quyết định

- Một Sinh viên chỉ được là thành viên của **tối đa một đợt ở trạng thái `Đang diễn ra`** tại một thời điểm. Lịch sử tham gia các đợt đã kết thúc vẫn được giữ.
- Kiểm tra khi Giáo vụ thêm Sinh viên vào đợt `Đang diễn ra` và khi chuyển đợt `Nháp` sang `Đang diễn ra`. Nếu có xung đột, chặn thao tác và nêu Sinh viên/đợt gây xung đột.
- Đợt `Nháp` có thể chuẩn bị danh sách Sinh viên, nhưng chỉ được mở khi toàn bộ danh sách không vi phạm ràng buộc trên. Backend phải bảo vệ cả trường hợp hai đợt được mở hoặc thêm người đồng thời.
- Quy tắc một nhóm mỗi Sinh viên **trong cùng đợt** vẫn áp dụng riêng; không thay thế ràng buộc đợt đang diễn ra.

## Hệ quả

- Kiểm thử thêm vào đợt đang diễn ra, mở đợt Nháp có người trùng, hai thao tác đồng thời, và tham gia đợt mới sau khi đợt cũ kết thúc.
- Màn mở đợt/nhập người tham gia hiển thị lý do từ chối theo từng Sinh viên.
