# PDR-040: Giới hạn 20 MB cho mỗi tệp PDF học thuật

## Trạng thái

Đã chấp nhận theo xác nhận trực tiếp của người dùng ngày 2026-10-28.

## Bối cảnh

Màn nộp bài mẫu hiển thị lỗi tệp lớn hơn 20 MB, nhưng OQ-006 chưa coi đây là giới hạn chính thức. PDR-039 đã chốt chỉ nhận PDF cho các bản nộp học thuật.

## Quyết định

- Mỗi tệp PDF nộp cho đề cương, báo cáo giữa kỳ, báo cáo cuối kỳ hoặc bản khóa luận có dung lượng **tối đa 20 MB**. Quy tắc áp dụng cho cả lần nộp đầu, nộp lại và nộp bổ sung; tính trên từng tệp, không cộng dồn các phiên bản.
- Tệp đúng giới hạn được phép qua kiểm tra dung lượng; tệp vượt giới hạn bị từ chối với lỗi rõ ràng. Kiểm tra tại nơi tiếp nhận tệp, không chỉ dựa vào giao diện.
- Giới hạn ảnh đại diện là quy tắc riêng theo [PDR-043](PDR-043-gioi-han-anh-dai-dien.md). Hạn nộp trễ theo [PDR-041](PDR-041-han-nop-tre-rieng-tung-moc.md) và lưu trữ theo [PDR-042](PDR-042-giu-moi-phien-ban-tai-lieu-khong-tu-xoa.md).

## Hệ quả

- UI hiển thị “PDF tối đa 20 MB”; backend và giới hạn upload của hạ tầng phải cho cùng kết quả, tránh UI nhận nhưng máy chủ từ chối không rõ lý do.
- Kiểm thử tệp dưới, đúng và vượt ngưỡng; PDF có nội dung không hợp lệ vẫn bị từ chối theo PDR-039 dù dung lượng đạt.
