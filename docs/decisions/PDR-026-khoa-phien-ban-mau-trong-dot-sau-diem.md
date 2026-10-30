# PDR-026: Khóa phiên bản mẫu đang dùng trong đợt sau phiếu đầu tiên

## Trạng thái

Đã chấp nhận theo xác nhận trực tiếp của người dùng ngày 2026-10-28.

## Bối cảnh

Một phiên bản mẫu đã gán có thể được thay bằng phiên bản mới theo PDR-025. Nếu đổi phiên bản đang dùng sau khi đã có điểm, các Sinh viên trong cùng đợt và cùng loại vai trò có thể được chấm theo cấu trúc khác nhau.

## Quyết định

- Với mỗi **loại mẫu** trong một đợt (Hướng dẫn, Phản biện, Hội đồng), từ khi có **phiếu điểm đầu tiên dùng phiên bản mẫu đó**, khóa phiên bản đang dùng của loại mẫu ấy cho đợt. Không chuyển đợt sang phiên bản mới của cùng loại để chấm các phiếu còn lại.
- Phiên bản mới có thể được chuẩn bị nhưng chỉ gán để dùng từ đợt khác/chưa phát sinh phiếu của loại mẫu đó. Phiếu đã có tiếp tục tham chiếu đúng phiên bản đã dùng; không tự chuyển hoặc tính lại.
- Trước phiếu đầu tiên của loại mẫu trong đợt, Giáo vụ có thể chọn phiên bản mới để dùng; giữ lịch sử thay đổi gán mẫu. Mẫu đã gán vẫn không được sửa trực tiếp theo [PDR-025](PDR-025-phien-ban-hoa-mau-phieu-da-gan.md).

## Chưa chốt

Quyền xóa mẫu đã chốt tại [PDR-027](PDR-027-chi-xoa-mau-nhap-chua-gan.md). Đóng mẫu không chặn đợt đang dùng theo [PDR-028](PDR-028-dong-mau-khong-chan-dot-dang-dung.md).

## Hệ quả

- Backend kiểm tra tại thời điểm đổi mẫu, kể cả trường hợp phiếu đầu tiên được lưu đồng thời; UI nêu lý do khóa và phiên bản áp dụng.
- Kiểm thử đổi trước/sau phiếu đầu tiên, ba loại mẫu độc lập trong cùng đợt, hai Sinh viên cùng dùng mẫu hội đồng và bảo toàn phiếu cũ.
