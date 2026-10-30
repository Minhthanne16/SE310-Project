# PDR-036: Chủ tài khoản và Giáo vụ đều được sửa họ tên

## Trạng thái

Đã chấp nhận theo xác nhận trực tiếp của người dùng ngày 2026-10-28.

## Bối cảnh

DESIGN vừa mô tả hồ sơ cho phép người dùng sửa họ tên, vừa có ghi chú nói chỉ Giáo vụ sửa. Quyền không thống nhất sẽ làm UI và backend xử lý khác nhau.

## Quyết định

- Sinh viên, Giảng viên và Giáo vụ được **tự sửa họ tên của chính mình** trong hồ sơ. Giáo vụ cũng được **sửa họ tên tài khoản khác** qua chức năng quản lý người dùng.
- Mọi lần sửa họ tên ghi người thực hiện, tài khoản được sửa, giá trị trước/sau và thời điểm để truy vết. Quyền tự sửa chỉ áp dụng tài khoản đang đăng nhập; người dùng thường không sửa tên của người khác.
- Mã người dùng và vai trò vẫn không đổi sau khi tạo tài khoản theo quy tắc hiện hành. Đổi họ tên không tạo tài khoản mới hoặc thay khóa liên kết của đề tài/phiếu điểm.

## Hệ quả

- Màn hồ sơ cho sửa họ tên với cả ba vai trò; màn quản lý người dùng của Giáo vụ cũng sửa được trường này.
- Kiểm thử tự sửa, Giáo vụ sửa tài khoản khác, người dùng sửa tài khoản khác bị chặn, lịch sử trước/sau và dữ liệu đề tài/điểm vẫn liên kết đúng tài khoản.
