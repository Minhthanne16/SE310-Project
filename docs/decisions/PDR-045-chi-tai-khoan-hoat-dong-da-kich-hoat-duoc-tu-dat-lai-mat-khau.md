# PDR-045: Chỉ tài khoản hoạt động đã kích hoạt được tự đặt lại mật khẩu

## Trạng thái

Đã chấp nhận theo xác nhận trực tiếp của người dùng ngày 2026-10-28; đóng OQ-017.

## Bối cảnh

PDR-037 chốt phản hồi trung tính cho yêu cầu quên mật khẩu nhưng chưa xác định tài khoản nào được nhận liên kết. Hệ thống có tài khoản bị vô hiệu hóa và tài khoản chưa hoàn tất bước kích hoạt bằng OTP theo PDR-003.

## Quyết định

- Chỉ tài khoản **đang hoạt động và đã hoàn tất kích hoạt** được gửi liên kết tự đặt lại mật khẩu khi yêu cầu hợp lệ và chưa vượt giới hạn PDR-044.
- Tài khoản bị vô hiệu hóa hoặc chưa hoàn tất kích hoạt **không nhận liên kết**; người yêu cầu vẫn thấy cùng phản hồi trung tính như email không có tài khoản theo PDR-037. Người dùng liên hệ Giáo vụ để được xử lý theo luồng quản lý tài khoản hiện hành.
- Khi sử dụng liên kết, hệ thống kiểm tra lại tài khoản vẫn hoạt động và đã kích hoạt. Liên kết không được dùng để vượt qua trạng thái vô hiệu hóa hoặc bước OTP kích hoạt.

## Hệ quả

- Luồng quên mật khẩu và luồng OTP kích hoạt giữ trách nhiệm riêng; đặt lại mật khẩu không tự kích hoạt tài khoản.
- Kiểm thử bốn trạng thái: không có tài khoản, đang hoạt động đã kích hoạt, bị vô hiệu hóa, chưa kích hoạt. Cả bốn cho cùng phản hồi yêu cầu với email đúng định dạng; chỉ trạng thái đủ điều kiện và chưa bị giới hạn phát sinh thư. Kiểm thử tài khoản bị vô hiệu hóa sau khi phát liên kết.
