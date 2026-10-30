# PDR-041: Hạn nộp trễ riêng cho từng mốc

## Trạng thái

Đã chấp nhận theo xác nhận trực tiếp của người dùng ngày 2026-10-28.

## Bối cảnh

DESIGN có công tắc “Cho nộp trễ” ở các mốc Đề cương, Giữa kỳ, Cuối kỳ nhưng chưa xác định thời điểm dừng nhận. Nếu công tắc mở mà không có hạn kết thúc, nhóm không biết thời hạn cuối và hệ thống không có điều kiện khóa rõ ràng.

## Quyết định

- Với từng mốc nộp Đề cương, Giữa kỳ, Cuối kỳ, khi Giáo vụ bật “Cho nộp trễ”, Giáo vụ phải đặt **hạn trễ cụ thể của chính mốc đó**, sau hạn nộp thông thường. Không dùng chung một hạn trễ cho cả ba mốc.
- Đến hết hạn thông thường, bài nộp hợp lệ tính đúng hạn; sau đó đến hết hạn trễ, bài nộp hợp lệ được nhận và gắn nhãn `Nộp trễ`. Sau hạn trễ, hệ thống từ chối nộp theo chính sách chung. Khi tắt “Cho nộp trễ”, hạn trễ của mốc không mở quyền nộp.
- Không được bật “Cho nộp trễ” mà thiếu hạn trễ hợp lệ; khi mở đợt phải kiểm tra cấu hình này cùng chín mốc bắt buộc. Hạn trễ và thay đổi của nó phải hiển thị cho nhóm liên quan và được lưu lịch sử.
- Hạn bổ sung riêng cho một nhóm chưa có bản khóa luận theo PDR-011 vẫn được ưu tiên cho đúng nhóm trong phạm vi hạn được cấp, kể cả khi công tắc nộp trễ chung tắt hoặc đã hết hạn trễ chung.

## Hệ quả

- Mỗi mốc nộp có cấu hình hạn trễ riêng; sao chép đợt chỉ sao chép cờ “Cho nộp trễ”, không sao chép ngày/giờ hạn trễ của đợt cũ theo PDR-034.
- Kiểm thử tắt/bật công tắc, thiếu hạn trễ, hạn trễ không sau hạn thường, nộp đúng hạn, trong khoảng trễ, sau hạn trễ và trường hợp nhóm có hạn bổ sung riêng.
