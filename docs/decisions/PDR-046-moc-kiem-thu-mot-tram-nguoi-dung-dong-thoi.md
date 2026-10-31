# PDR-046: Mốc kiểm thử 100 người sử dụng đồng thời

## Trạng thái

Đã chấp nhận theo xác nhận trực tiếp của người dùng ngày 2026-10-28; ngày 2026-10-28 người dùng chuyển việc đánh giá chịu tải sang giai đoạn sau khi tập trung hoàn thiện ứng dụng.

## Bối cảnh

OQ-007 chưa có quy mô tải để đặt tiêu chí nghiệm thu hiệu năng. Hệ thống phục vụ một Khoa, với nhiều vai trò cùng truy cập trong các đợt đăng ký, nộp bài và chấm điểm.

## Quyết định

- Giữ **100 người đang sử dụng đồng thời** làm mốc đánh giá chịu tải khi triển khai phần hiệu năng sau giai đoạn hoàn thiện ứng dụng.
- Kịch bản kiểm thử phải có đủ ba vai trò và phối hợp các thao tác đọc/ghi đại diện cho một đợt đang diễn ra; không thay mốc này bằng 100 phiên đăng nhập nhàn rỗi hoặc một truy vấn đơn lẻ.
- Chỉ tiêu thời gian đáp ứng, thời hạn lưu trữ và khôi phục được chốt riêng trong OQ-007; con số 100 không tự xác định cấu hình máy chủ hay cam kết SLA sản xuất.

## Hệ quả

- Việc chạy bài kiểm thử 100 người, ghi tỷ lệ lỗi, thời gian đáp ứng và tài nguyên được để sau Phase 08; không là cổng chặn các phase phát triển chức năng.
- Khi có số liệu sử dụng thực tế, người phụ trách sản phẩm có thể xem xét nâng mốc bằng quyết định mới trước giai đoạn đánh giá chịu tải.
