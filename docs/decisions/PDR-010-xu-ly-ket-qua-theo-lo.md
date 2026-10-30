# PDR-010: Xác nhận và công bố theo lô với kết quả từng Sinh viên

## Trạng thái

Đã chấp nhận theo xác nhận trực tiếp của người dùng ngày 2026-10-28.

## Bối cảnh

PDR-009 cho phép xác nhận/công bố kết quả theo từng Sinh viên. Khi Giáo vụ chọn nhiều người cùng lúc, một số người có thể thiếu phiếu, thiếu xác nhận điểm CTHĐ hoặc chưa đủ điều kiện bản cuối. Cần xác định có xử lý những người còn lại hay dừng cả lô.

## Quyết định

- Với thao tác **xác nhận hoặc công bố theo lô**, hệ thống xử lý từng Sinh viên đủ điều kiện. Người không đủ điều kiện được bỏ qua, không đổi trạng thái.
- Sau thao tác, Giáo vụ nhận **báo cáo theo từng Sinh viên**: thành công hoặc bị bỏ qua, kèm lý do cụ thể. Không có bản ghi nào bị bỏ qua âm thầm.
- Điều kiện được kiểm tra tại lúc thực hiện thao tác, kể cả khi danh sách chọn trước đó từng hiển thị hợp lệ. Trạng thái đề tài được tính theo quy tắc PDR-009 sau khi xử lý từng kết quả cá nhân.

## Hệ quả

- UI phải hiển thị số lượng và danh sách thành công/bị bỏ qua, có thể mở lý do từng người; không báo “toàn bộ thành công” nếu có dòng lỗi.
- Kiểm thử lô toàn hợp lệ, toàn không hợp lệ, lô hỗn hợp, thao tác lặp và một Sinh viên đổi điều kiện giữa lúc chọn và lúc gửi.
- Hợp đồng API, mã trạng thái HTTP và cấu trúc báo cáo sẽ được thiết kế sau khi đối chiếu frontend/backend hiện có; PDR này không tự ấn định route hay payload.
