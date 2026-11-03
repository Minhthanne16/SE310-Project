# PDR-050: Bỏ bước Chủ tịch xác nhận điểm CTHĐ

## Trạng thái

Đã chấp nhận theo lựa chọn trực tiếp của người dùng ngày 2026-11-03. Thay thế [PDR-006](PDR-006-xac-nhan-diem-chu-tich-hoi-dong.md); giải quyết mục 5 của [REPORT_SPEC.md §10](../REPORT_SPEC.md#10-chỗ-báo-cáo-khác-tài-liệu-hiện-hành) (OQ-020).

## Bối cảnh

PDR-006 yêu cầu Chủ tịch xác nhận hoặc trả lại điểm CTHĐ do Thư ký nhập hộ trước khi Giáo vụ xác nhận kết quả. Báo cáo cuối kỳ bản 03-11 và canvas đã duyệt (Chi tiết đợt, Kết quả, Hội đồng GV) không có bước này: Thư ký nhập điểm cho cả Chủ tịch và Thư ký.

## Quyết định

- **Thư ký nhập điểm CTHĐ và TKHĐ** cho từng Sinh viên; không có trạng thái Chờ xác nhận / Đã trả lại / Đã xác nhận cho điểm CTHĐ và Chủ tịch không có thao tác xác nhận hay trả lại.
- Chủ tịch xem được điểm hội đồng đã lưu. Muốn sửa thì Thư ký sửa phiếu, như mọi phiếu khác, cho tới khi Giáo vụ xác nhận kết quả.
- Điều kiện để Giáo vụ xác nhận kết quả đề tài giữ theo [PDR-049](PDR-049-vong-doi-ket-qua-theo-nhom-de-tai.md): mọi Sinh viên đủ bốn điểm và không còn cặp lệch ≥ 2.

## Hệ quả

- Không cần trường trạng thái xác nhận CTHĐ trong phiếu điểm, API hay CSDL; lịch sử vẫn ghi người nhập/sửa điểm.
- OQ-009 (hạn sửa điểm CTHĐ bị trả lại) không còn áp dụng.
- Màn Hội đồng của Giảng viên và Không gian đề tài (`gvRole` Chủ tịch hội đồng) bỏ thao tác xác nhận/trả lại.
