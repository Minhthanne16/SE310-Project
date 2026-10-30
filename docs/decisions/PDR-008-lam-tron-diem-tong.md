# PDR-008: Làm tròn điểm tổng kết hai chữ số thập phân

## Trạng thái

Đã chấp nhận theo xác nhận trực tiếp của người dùng ngày 2026-10-28.

## Bối cảnh

Điểm tổng kết tính theo công thức `(CTHĐ + TKHĐ + 2 × CBHD + 2 × CBPB) / 6`, nhưng tài liệu chưa xác định cách xử lý khi chữ số thứ ba đúng bằng 5. Các cách làm tròn khác nhau có thể tạo kết quả công bố khác nhau.

## Quyết định

- Tính từ bốn điểm thành phần gốc, rồi làm tròn điểm tổng theo **làm tròn số học lên tại mốc giữa** đến hai chữ số thập phân (decimal half up). Ví dụ `7,125 → 7,13`; `7,124 → 7,12`.
- Quy tắc áp dụng thống nhất cho điểm hiển thị, kết quả xác nhận/công bố và file xuất. Điểm thành phần không bị làm tròn lại theo PDR này.

## Hệ quả

- Test công thức với giá trị dưới mốc, đúng mốc và trên mốc; tránh khác biệt do kiểu số dấu phẩy động.
- Quy tắc cảnh báo lệch điểm dùng bốn điểm thành phần gốc theo PDR-007, không dùng điểm tổng đã làm tròn.
