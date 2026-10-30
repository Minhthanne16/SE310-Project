# PDR-028: Đóng mẫu không chặn đợt đang dùng

## Trạng thái

Đã chấp nhận theo xác nhận trực tiếp của người dùng ngày 2026-10-28.

## Bối cảnh

Mẫu đã gán không được xóa và có trạng thái `Đã đóng` theo PDR-027. Nếu Đóng lập tức khóa chấm ở đợt đang dùng mẫu, các Sinh viên còn lại không thể hoàn thành phiếu theo cùng phiên bản.

## Quyết định

- Khi Giáo vụ **Đóng** một mẫu/phiên bản mẫu đã gán, mẫu đó **không được gán cho đợt mới** kể từ thời điểm đóng.
- Các đợt đã gán mẫu trước khi đóng **tiếp tục dùng đúng phiên bản đã gán** để hoàn thành các phiếu còn thiếu; đóng không sửa, xóa hoặc tính lại phiếu đã có.
- Quy tắc khóa chuyển phiên bản trong đợt sau phiếu đầu tiên theo [PDR-026](PDR-026-khoa-phien-ban-mau-trong-dot-sau-diem.md) vẫn áp dụng. Đóng mẫu không phải cách đổi mẫu đang dùng trong đợt.

## Hệ quả

- Phân biệt khả năng gán mới với khả năng chấm tiếp ở đợt đã gán; lưu người/thời điểm đóng và lịch sử trạng thái.
- Kiểm thử đóng trước/sau phiếu đầu tiên, đợt cũ còn phiếu chưa chấm, gán cho đợt mới bị chặn và phiếu cũ không đổi.
