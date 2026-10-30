# PDR-032: Đủ chín mốc hợp lệ trước khi mở đợt

## Trạng thái

Đã chấp nhận theo xác nhận trực tiếp của người dùng ngày 2026-10-28.

## Bối cảnh

DESIGN từng cho mở đợt sau cảnh báo thiếu ngày. Các thao tác đăng ký, nộp tài liệu, phân công, bảo vệ và chấm điểm phụ thuộc cấu hình mốc của đợt.

## Quyết định

- Chỉ được chuyển đợt `Nháp` sang `Đang diễn ra` khi **đủ cả chín mốc thời gian** của đợt và mỗi mốc có ngày/giờ bắt đầu, kết thúc hợp lệ.
- Mỗi mốc phải có bắt đầu không sau kết thúc; ngày/giờ bắt đầu của các mốc không được đi ngược thứ tự chín mốc đã định nghĩa. Nếu thiếu hoặc sai, backend **chặn mở đợt**, nêu mốc và lỗi cụ thể; cảnh báo đơn thuần không đủ.
- Kiểm tra lại cấu hình tại thời điểm mở, kể cả khi đợt đã từng lưu cấu hình hợp lệ trước đó hoặc có hai Giáo vụ thao tác đồng thời.

## Quy tắc liên quan

Đợt đủ mốc được mở dù thiếu người sau cảnh báo theo [PDR-033](PDR-033-mo-dot-duoc-khi-chua-co-nguoi-tham-gia.md). Nếu bật “Cho nộp trễ” cho một mốc, phải có hạn trễ hợp lệ theo [PDR-041](PDR-041-han-nop-tre-rieng-tung-moc.md).

## Hệ quả

- Kiểm thử thiếu một mốc, thiếu đầu/cuối, đầu sau cuối, thứ tự sai, đủ chín mốc hợp lệ và cập nhật cấu hình đồng thời với mở đợt.
- Màn mở đợt hiển thị lỗi theo từng mốc để Giáo vụ sửa trước khi thử lại.
