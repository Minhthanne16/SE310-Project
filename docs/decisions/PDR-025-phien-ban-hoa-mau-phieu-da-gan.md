# PDR-025: Phiên bản hóa mẫu phiếu từ khi đã gán cho đợt

## Trạng thái

Đã chấp nhận theo xác nhận trực tiếp của người dùng ngày 2026-10-28.

## Bối cảnh

Nếu sửa tiêu chí trực tiếp trên mẫu đã gán cho đợt, không còn biết cấu trúc nào được công bố cho người chấm ở từng thời điểm. Cần giữ lịch sử cấu hình ngay cả trước khi có phiếu điểm.

## Quyết định

- Mẫu **Nháp chưa gán** được Giáo vụ sửa trực tiếp.
- Từ khi một phiên bản mẫu **đã được gán cho đợt**, không sửa trực tiếp cấu trúc tiêu chí của phiên bản đó. Muốn thay đổi, Giáo vụ tạo **phiên bản mới**; phiên bản đã gán được giữ nguyên và tra cứu được trong lịch sử.
- Phiếu điểm tham chiếu đúng phiên bản mẫu dùng khi chấm. Việc tạo phiên bản mới không tự sửa phiếu đã có hoặc tự đổi mẫu đang dùng của đợt.

## Chưa chốt

Điều kiện chuyển phiên bản đang dùng trong đợt đã chốt tại [PDR-026](PDR-026-khoa-phien-ban-mau-trong-dot-sau-diem.md); quyền xóa mẫu ở [PDR-027](PDR-027-chi-xoa-mau-nhap-chua-gan.md), tác động của Đóng ở [PDR-028](PDR-028-dong-mau-khong-chan-dot-dang-dung.md).

## Hệ quả

- Ghi nhận phiên bản, trạng thái gán và lịch sử tạo phiên bản mới; giao diện phân biệt sửa Nháp với tạo phiên bản mới từ mẫu đã gán.
- Kiểm thử sửa Nháp chưa gán, từ chối sửa trực tiếp mẫu đã gán, tạo phiên bản mới và phiếu cũ giữ phiên bản ban đầu.
