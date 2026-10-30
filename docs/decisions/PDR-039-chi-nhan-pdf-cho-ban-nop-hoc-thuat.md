# PDR-039: Chỉ nhận PDF cho các bản nộp học thuật

## Trạng thái

Đã chấp nhận theo xác nhận trực tiếp của người dùng ngày 2026-10-28.

## Bối cảnh

DESIGN mô tả nộp PDF, nhưng OQ-006 chưa chốt có chấp nhận định dạng khác hay không. Các luồng đề cương, báo cáo và khóa luận đều lưu nhiều phiên bản để xem, nhận xét và truy vết.

## Quyết định

- Bản nộp chính thức của **đề cương, báo cáo giữa kỳ, báo cáo cuối kỳ và bản khóa luận** chỉ chấp nhận tệp PDF. Mỗi lần nộp lại hoặc bổ sung cũng tuân theo cùng quy tắc.
- Tệp không phải PDF bị từ chối với lỗi rõ ràng; kiểm tra nội dung tệp, không chỉ dựa vào phần mở rộng hay tên do trình duyệt gửi.
- Quy tắc này không áp dụng cho ảnh đại diện hoặc tệp CSV nhập tài khoản, vì đó là các luồng riêng.
- Dung lượng tối đa đã chốt 20 MB mỗi PDF tại [PDR-040](PDR-040-gioi-han-pdf-hai-muoi-megabyte.md); hạn nộp trễ từng mốc theo [PDR-041](PDR-041-han-nop-tre-rieng-tung-moc.md), các phiên bản được giữ theo [PDR-042](PDR-042-giu-moi-phien-ban-tai-lieu-khong-tu-xoa.md).

## Hệ quả

- Các màn nộp tài liệu và thông báo lỗi dùng chung quy tắc PDF; phiên bản PDF cũ được giữ để truy vết theo quy tắc lưu trữ sẽ chốt.
- Kiểm thử PDF hợp lệ, tệp sai phần mở rộng, tệp giả PDF và nộp lại; kiểm tra dung lượng theo PDR-040.
