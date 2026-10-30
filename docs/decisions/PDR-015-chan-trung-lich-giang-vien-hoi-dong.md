# PDR-015: Chặn trùng lịch Giảng viên giữa các hội đồng

## Trạng thái

Đã chấp nhận theo xác nhận trực tiếp của người dùng ngày 2026-10-28.

## Bối cảnh

Một Giảng viên có thể tham gia nhiều hội đồng trong một đợt, nhưng không thể có mặt trong hai hội đồng có thời gian bảo vệ chồng lấn. Thiết kế trước đây chỉ ghi “trùng giờ” là cảnh báo, chưa chỉ rõ đối tượng.

## Quyết định

- Khi cùng một Giảng viên được phân vào **hai hội đồng có thời gian bảo vệ chồng lấn**, hệ thống **chặn lưu lịch gây trùng** và **không cho công bố lịch trùng**. Áp dụng dù Giảng viên giữ vai trò Chủ tịch hay Thư ký ở từng hội đồng.
- Kiểm tra ở backend khi lưu và công bố; UI nêu rõ Giảng viên, hai hội đồng và khoảng thời gian gây xung đột để Giáo vụ sửa.

## Hệ quả

- Test hai khoảng trùng hoàn toàn, giao nhau một phần, liền kề không giao nhau và hai thao tác lưu đồng thời.
- Quy tắc trùng phòng đã chốt riêng tại [PDR-014](PDR-014-chan-trung-phong-bao-ve.md); giờ từng lượt theo [PDR-017](PDR-017-thoi-gian-tung-luot-bao-ve.md), sửa lịch theo [PDR-018](PDR-018-sua-lich-da-cong-bo-va-dinh-chinh.md), hủy lịch theo [PDR-019](PDR-019-huy-lich-bao-ve-da-cong-bo.md).
