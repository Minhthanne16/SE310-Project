# PDR-035: Cộng điểm tiêu chí cấp cuối thành điểm phiếu

## Trạng thái

Đã chấp nhận theo xác nhận trực tiếp của người dùng ngày 2026-10-28.

## Bối cảnh

Mẫu phiếu có tiêu chí cha/con nhưng chưa có quy tắc tính điểm từ chi tiết. Nếu cho nhập điểm phiếu độc lập, tổng điểm có thể khác các tiêu chí và không giải thích được kết quả.

## Quyết định

- Giáo vụ cấu hình **điểm tối đa cho từng tiêu chí chấm ở cấp cuối**. Tổng điểm tối đa của tất cả tiêu chí cấp cuối trong một mẫu phiếu có hiệu lực phải **bằng đúng 10**.
- Người chấm nhập điểm cho từng tiêu chí cấp cuối trong khoảng từ 0 đến điểm tối đa của tiêu chí đó. Điểm của phiếu là **tổng các điểm cấp cuối**; không nhập một điểm phiếu độc lập khác tổng này.
- Tiêu chí cha chỉ dùng để nhóm/hiển thị, không được cộng thêm lần nữa. Phiếu chưa đủ điểm ở các tiêu chí cấp cuối không được coi là phiếu hoàn tất.
- Quy tắc áp dụng cho mẫu Hướng dẫn, Phản biện và Hội đồng; phiếu CTHĐ/TKHĐ vẫn là hai phiếu độc lập cùng dùng mẫu hội đồng theo [PDR-024](PDR-024-mau-hoi-dong-chung-phieu-diem-rieng.md).

## Hệ quả

- Backend kiểm tra tổng điểm tối đa khi đưa mẫu vào dùng và khi lưu phiếu; hiển thị lỗi theo tiêu chí nếu điểm vượt mức/thiếu.
- Kiểm thử cấu trúc cha/con nhiều cấp, tổng tối đa dưới/trên/đúng 10, tiêu chí bằng 0/điểm tối đa, thiếu tiêu chí và không cộng trùng tiêu chí cha.
