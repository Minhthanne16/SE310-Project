# PDR-027: Chỉ xóa mẫu phiếu Nháp chưa từng gán

## Trạng thái

Đã chấp nhận theo xác nhận trực tiếp của người dùng ngày 2026-10-28.

## Bối cảnh

Mẫu đã gán cho đợt là một phần cấu hình chấm điểm, kể cả khi chưa có phiếu. Xóa mẫu như vậy sẽ làm mất lịch sử về tiêu chí đã được chọn cho đợt.

## Quyết định

- Giáo vụ chỉ được **xóa mẫu Nháp chưa từng được gán cho bất kỳ đợt nào**.
- Mẫu hoặc phiên bản mẫu **đã từng được gán** không được xóa vật lý, kể cả khi chưa có phiếu điểm. Giữ phiên bản, lịch sử gán và liên kết phiếu đã có.
- Mẫu đã gán có thể được **đóng để ngừng gán mới** thay cho xóa; đợt đã dùng mẫu vẫn chấm tiếp theo [PDR-028](PDR-028-dong-mau-khong-chan-dot-dang-dung.md).

## Hệ quả

- Kiểm tra điều kiện xóa ở backend dựa trên lịch sử gán, không chỉ trạng thái hiện tại hoặc số phiếu điểm.
- Kiểm thử Nháp chưa gán, đã gán rồi gỡ, đã gán chưa có điểm, đã có điểm và thao tác xóa đồng thời với gán.
