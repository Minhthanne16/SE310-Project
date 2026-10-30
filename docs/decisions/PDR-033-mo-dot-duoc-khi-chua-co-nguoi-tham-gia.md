# PDR-033: Cho mở đợt khi chưa có người tham gia, kèm cảnh báo

## Trạng thái

Đã chấp nhận theo xác nhận trực tiếp của người dùng ngày 2026-10-28.

## Bối cảnh

Giáo vụ có thể cần mở đợt sau khi cấu hình mốc, rồi mới nhập danh sách Sinh viên/Giảng viên. DESIGN từng cảnh báo khi thiếu người nhưng chưa phân biệt với điều kiện chín mốc bắt buộc.

## Quyết định

- Đợt `Nháp` có đủ chín mốc hợp lệ theo [PDR-032](PDR-032-du-chin-moc-hop-le-truoc-khi-mo-dot.md) **được mở** dù danh sách Sinh viên, Giảng viên hoặc cả hai đang trống.
- Trước khi xác nhận mở, UI cảnh báo rõ vai trò nào chưa có người và cho Giáo vụ tiếp tục. Thiếu người không phải lỗi chặn mở; hệ thống không tự tạo người tham gia.
- Sau khi mở, các thao tác cần người tham gia/phân công vẫn phải kiểm tra dữ liệu và quyền của chính thao tác đó; không suy ra quyền hoặc tạo bản ghi mặc định từ việc đợt đã mở.

## Hệ quả

- Kiểm thử đủ mốc nhưng thiếu SV, thiếu GV, thiếu cả hai; cảnh báo và mở thành công; thêm người sau khi mở; thao tác cần người khi danh sách còn trống.
- Nếu mốc không hợp lệ thì vẫn chặn mở theo PDR-032, không biến lỗi mốc thành cảnh báo.
