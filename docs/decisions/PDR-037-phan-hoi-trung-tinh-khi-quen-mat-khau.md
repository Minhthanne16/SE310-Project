# PDR-037: Phản hồi trung tính khi yêu cầu đặt lại mật khẩu

## Trạng thái

Đã chấp nhận theo xác nhận trực tiếp của người dùng ngày 2026-10-28.

## Bối cảnh

DESIGN từng hiển thị lỗi “Email không tồn tại” khi yêu cầu đặt lại mật khẩu. Phản hồi này cho phép người ngoài thử email để biết tài khoản nào có trong hệ thống.

## Quyết định

- Với một email đúng định dạng, màn hình và API trả cùng thông báo trung tính dù email có tài khoản hay không: “Nếu email thuộc hệ thống, bạn sẽ nhận liên kết đặt lại mật khẩu.” Không hiển thị trạng thái “Email không tồn tại”.
- Chỉ gửi liên kết khi email thuộc một tài khoản đủ điều kiện khôi phục. Việc không gửi thư không làm thay đổi phản hồi cho người yêu cầu.
- Chỉ tài khoản đang hoạt động và đã hoàn tất kích hoạt được gửi liên kết theo [PDR-045](PDR-045-chi-tai-khoan-hoat-dong-da-kich-hoat-duoc-tu-dat-lai-mat-khau.md); phản hồi trung tính vẫn áp dụng cho các trường hợp còn lại.
- Email sai định dạng vẫn được báo lỗi định dạng; lỗi này không xác nhận email có tài khoản. Liên kết đặt lại vẫn có hiệu lực 30 phút và dùng một lần theo quy tắc hiện hành.
- Giới hạn tần suất yêu cầu/gửi liên kết đã được chốt riêng tại [PDR-044](PDR-044-gioi-han-yeu-cau-dat-lai-mat-khau.md). Khi bị giới hạn, phản hồi cho email đúng định dạng vẫn trung tính.

## Hệ quả

- Bỏ nhánh lỗi “Email không tồn tại” khỏi luồng thực thi, dù artboard mẫu còn trạng thái đó; dùng cùng mã trạng thái, cấu trúc phản hồi và câu chữ cho hai trường hợp email đúng định dạng.
- Kiểm thử email có tài khoản và không có tài khoản cho phản hồi giống nhau, chỉ trường hợp có tài khoản mới phát sinh thư; kiểm thử riêng email sai định dạng, liên kết hết hạn/đã dùng.
