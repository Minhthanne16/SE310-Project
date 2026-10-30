# PDR-031: Chỉ kết thúc đợt khi mọi đề tài đã kết thúc

## Trạng thái

Đã chấp nhận theo xác nhận trực tiếp của người dùng ngày 2026-10-28.

## Bối cảnh

DESIGN trước đây chỉ cảnh báo khi còn đề tài chưa công bố nhưng vẫn để Giáo vụ kết thúc đợt. Kết thúc khi đề tài còn chờ chấm, công bố hoặc xử lý ngoại lệ có thể bỏ dở quy trình.

## Quyết định

- Giáo vụ chỉ được kết thúc đợt khi **mọi đề tài của đợt** đều ở một trong hai trạng thái kết thúc: `Đã hoàn tất` hoặc `Không đủ điều kiện công bố`.
- Nếu còn bất kỳ đề tài nào ở trạng thái khác, backend **chặn** kết thúc đợt và trả danh sách/số lượng đề tài chưa đủ điều kiện cùng trạng thái hiện tại để Giáo vụ xử lý. Cảnh báo đơn thuần không đủ để vượt qua điều kiện này.
- Quy tắc áp dụng khi kết thúc từng đợt và khi thao tác lặp/đồng thời với cập nhật trạng thái đề tài. Các điều kiện kết thúc đợt khác, nếu có, được kiểm tra riêng.

## Hệ quả

- Kiểm thử đợt có đề tài còn `Đang thực hiện`, `Đã cho điểm` nhưng chưa công bố đủ, tất cả `Đã hoàn tất`, tất cả `Không đủ điều kiện công bố`, và hỗn hợp hai trạng thái kết thúc.
- Giao diện hiển thị đề tài cần xử lý thay vì chỉ hỏi xác nhận khi điều kiện chưa đạt.
