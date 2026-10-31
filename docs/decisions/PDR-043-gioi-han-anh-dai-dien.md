# PDR-043: Định dạng và dung lượng ảnh đại diện

## Trạng thái

Đã chấp nhận theo xác nhận trực tiếp của người dùng ngày 2026-10-28; đóng phần còn lại của OQ-006.

## Bối cảnh

DESIGN có tải ảnh đại diện nhưng ghi chú triển khai chỉ tạm dùng JPG/PNG/WebP và 2 MB. Giới hạn PDF học thuật ở PDR-040 không áp dụng cho ảnh hồ sơ.

## Quyết định

- Ảnh đại diện của tài khoản chấp nhận **JPG, PNG hoặc WebP**, dung lượng **tối đa 2 MB mỗi tệp**.
- Tệp khác định dạng hoặc vượt giới hạn bị từ chối với lỗi rõ ràng; kiểm tra nội dung tệp tại nơi tiếp nhận, không chỉ dựa vào phần mở rộng hay khai báo của trình duyệt.
- Quy tắc ảnh đại diện độc lập với PDF tối đa 20 MB của đề cương, báo cáo và khóa luận.

## Hệ quả

- Màn hồ sơ nêu rõ loại và giới hạn ảnh được nhận; không ảnh hưởng quyền sửa họ tên theo PDR-036.
- Kiểm thử JPG/PNG/WebP hợp lệ, tệp giả ảnh, tệp vừa ngưỡng và quá ngưỡng, quyền đổi ảnh của bản thân và quyền truy cập ảnh sau tải lại.
