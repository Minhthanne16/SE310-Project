# PDR-069: Số Sinh viên tối đa mỗi nhóm theo đợt

## Trạng thái

Đã chấp nhận theo xác nhận trực tiếp của người dùng ngày 2026-11-23. Thay quy tắc "một nhóm có một hoặc hai Sinh viên" trong BUSINESS_RULES, [PDR-047](PDR-047-huy-ghi-danh-de-tai-cong-bo.md), [PDR-054](PDR-054-ghi-danh-nhom-de-tai-cong-bo.md).

## Quyết định

1. Giáo vụ đặt **số Sinh viên tối đa** mỗi nhóm cho đợt (số nguyên ≥ 1, mặc định 2). Tối thiểu luôn là 1 vì đề tài cần ít nhất một Sinh viên mới thực hiện được; không cấu hình tối thiểu.
2. Giảng viên **không** đặt số Sinh viên riêng cho từng đề tài.
3. Theo cùng luật với [PDR-065](PDR-065-cau-hinh-diem-theo-dot.md): chỉ sửa khi đợt còn `Nháp`, mở đợt thì khóa; khi lưu hệ thống hỏi có lưu làm mặc định cho chương trình không.
4. Áp cho ghi danh đề tài công bố, đề xuất của Sinh viên và giữ chỗ ([PDR-068](PDR-068-gv-gui-de-tai-kem-sinh-vien-giu-cho.md)). Phiếu chấm có số cột điểm bằng số Sinh viên thực tế của nhóm.

## Hệ quả

- Form ghi danh/đề xuất hiện số ô thành viên theo số tối đa của đợt thay vì cố định hai.
- Kiểm thử: tối đa 1, 2, 3; vượt tối đa (chặn); sửa sau khi mở đợt (409); phiếu chấm nhóm 1 và 3 Sinh viên.
