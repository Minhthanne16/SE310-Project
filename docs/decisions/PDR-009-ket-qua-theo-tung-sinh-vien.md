# PDR-009: Xác nhận và công bố kết quả theo từng Sinh viên

## Trạng thái

Đã chấp nhận theo xác nhận trực tiếp của người dùng ngày 2026-10-28.

## Bối cảnh

Nhóm khóa luận có một hoặc hai Sinh viên, điểm được nhập riêng cho từng người. Khi một thành viên đủ điều kiện trước người kia, tài liệu chưa nói rõ Giáo vụ phải chờ cả nhóm hay có thể xử lý từng kết quả.

## Quyết định

- Giáo vụ **xác nhận và công bố kết quả theo từng Sinh viên** khi kết quả của Sinh viên đó đủ điều kiện, bao gồm xác nhận điểm CTHĐ của Chủ tịch theo PDR-006 và điều kiện bản cuối áp dụng cho nhóm.
- Thành viên chưa đủ phiếu/điều kiện giữ trạng thái chờ tương ứng; không được công bố điểm của người đó chỉ vì thành viên khác đã đủ.
- Trạng thái chung của đề tài `Đã cho điểm` chỉ khi **mọi Sinh viên** có đủ bốn phiếu theo `BUSINESS_RULES.md`; `Đã hoàn tất` chỉ khi kết quả của **mọi Sinh viên** đã được công bố và điều kiện bản cuối được đáp ứng. Một kết quả cá nhân đã công bố không tự chuyển trạng thái đề tài sang `Đã hoàn tất`.

## Quy tắc liên quan

Thao tác xác nhận/công bố **theo lô** xử lý người hợp lệ và báo cáo lý do từng người bị bỏ qua theo [PDR-010](PDR-010-xu-ly-ket-qua-theo-lo.md).

## Hệ quả

- Dữ liệu và UI cần trạng thái kết quả theo Sinh viên bên cạnh trạng thái đề tài.
- Test nhóm hai Sinh viên, một đủ điều kiện và một thiếu phiếu, ở cả bước xác nhận lẫn công bố.
