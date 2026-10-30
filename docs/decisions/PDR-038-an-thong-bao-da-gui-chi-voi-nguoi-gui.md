# PDR-038: Xóa thông báo đã gửi chỉ ẩn với người gửi

## Trạng thái

Đã chấp nhận theo xác nhận trực tiếp của người dùng ngày 2026-10-28.

## Bối cảnh

DESIGN có thao tác “Xóa” ở danh sách thông báo đã gửi nhưng chưa xác định tác động tới người nhận. Nếu xóa bản gửi gốc hoặc bản của người nhận, nội dung họ đã thấy và lịch sử gửi sẽ bị mất.

## Quyết định

- Khi Giảng viên hoặc Giáo vụ chọn “Xóa” một thông báo **mình đã gửi**, chỉ ẩn thông báo đó khỏi danh sách “Tôi đã gửi” của chính người gửi.
- Thông báo vẫn tồn tại ở Bảng thông báo, tab đề tài và chuông của những người nhận có quyền xem; trạng thái đã đọc của họ không đổi. Nội dung và danh sách người nhận của bản gửi gốc được giữ để truy vết.
- Chỉ người gửi được thực hiện thao tác ẩn trên danh sách của mình; thao tác không thu hồi hoặc xóa vật lý thông báo. Ghi người thực hiện và thời điểm ẩn; thao tác lặp không tạo thêm thay đổi.

## Hệ quả

- Hộp xác nhận phải nói rõ “Ẩn khỏi danh sách đã gửi của bạn”; không dùng lời xác nhận khiến người dùng hiểu là đã thu hồi thông báo.
- Kiểm thử một người gửi và nhiều người nhận: sau khi ẩn, danh sách của người gửi không còn mục đó, người nhận vẫn xem được và lịch sử gửi còn nguyên; người khác không ẩn hộ được.
