# PDR-044: Giới hạn yêu cầu đặt lại mật khẩu

## Trạng thái

Đã chấp nhận theo xác nhận trực tiếp của người dùng ngày 2026-10-28; đóng OQ-016.

## Bối cảnh

PDR-037 chốt phản hồi trung tính cho yêu cầu đặt lại mật khẩu, nhưng chưa có giới hạn để ngăn gửi email liên tục hoặc lạm dụng từ cùng một nguồn.

## Quyết định

- Với cùng một email, hai yêu cầu đủ điều kiện gửi liên kết phải cách nhau **ít nhất 60 giây** và tối đa **5 yêu cầu trong một giờ**.
- Với cùng một nguồn yêu cầu, tối đa **20 yêu cầu trong một giờ**. Nguồn là địa chỉ IP khách đã được xác định qua cấu hình proxy tin cậy; không tin giá trị IP do khách tự khai báo.
- Giới hạn được áp dụng cho cả email có và không có tài khoản để không tạo tín hiệu về sự tồn tại tài khoản. Khi vượt giới hạn, không gửi thêm thư nhưng vẫn trả phản hồi trung tính giống yêu cầu email đúng định dạng hợp lệ theo PDR-037. Email sai định dạng vẫn được báo lỗi định dạng.
- Các mốc giới hạn tính theo thời điểm máy chủ tiếp nhận yêu cầu; thao tác đồng thời không được vượt ngưỡng gửi thư.

## Hệ quả

- UI không hiện lỗi “email không tồn tại” hoặc thông điệp riêng cho email bị giới hạn; hướng dẫn người dùng kiểm tra hộp thư và thử lại sau.
- Kiểm thử ranh giới 60 giây, yêu cầu thứ 5/6 theo email, thứ 20/21 theo nguồn, nhiều email cùng nguồn, cùng email từ nhiều nguồn, email không có tài khoản và yêu cầu đồng thời.
