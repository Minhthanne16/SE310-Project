# PDR-014: Chặn lịch bảo vệ trùng phòng

## Trạng thái

Đã chấp nhận phần trùng phòng theo xác nhận trực tiếp của người dùng ngày 2026-10-28. Giờ từng lượt và quyền sửa sau công bố đã chốt ở PDR-017/018.

## Bối cảnh

Thiết kế hội đồng trước đây ghi trùng giờ/phòng “chỉ cảnh báo” nhưng lại không cho công bố khi còn cảnh báo. Hai hội đồng không thể sử dụng cùng một phòng trong thời gian chồng lấn.

## Quyết định

- Khi hai hội đồng có thời gian bảo vệ **chồng lấn và cùng phòng**, hệ thống **chặn lưu lịch gây trùng** và **không cho công bố lịch trùng phòng**. Không coi đây là cảnh báo có thể bỏ qua.
- Kiểm tra ở backend trên dữ liệu có hiệu lực tại thời điểm lưu/công bố; UI hiển thị hội đồng, phòng và khoảng thời gian gây xung đột để Giáo vụ sửa.

## Chưa chốt

Trùng lịch Giảng viên đã chốt tại [PDR-015](PDR-015-chan-trung-lich-giang-vien-hoi-dong.md); giờ từng lượt ở [PDR-017](PDR-017-thoi-gian-tung-luot-bao-ve.md), sửa/đính chính ở [PDR-018](PDR-018-sua-lich-da-cong-bo-va-dinh-chinh.md), hủy lịch đã công bố ở [PDR-019](PDR-019-huy-lich-bao-ve-da-cong-bo.md).

## Hệ quả

- Test hai khoảng trùng hoàn toàn, giao nhau một phần và liền kề không giao nhau; test hai thao tác lưu đồng thời.
- Phase hội đồng phải có dữ liệu bắt đầu/kết thúc đủ để xác định xung đột trước khi công bố.
