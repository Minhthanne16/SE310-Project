# PDR-020: Khóa thay thành viên hội đồng sau khi có phiếu điểm

## Trạng thái

Đã chấp nhận theo xác nhận trực tiếp của người dùng ngày 2026-10-28.

## Bối cảnh

Thay Chủ tịch hoặc Thư ký sau khi đã có phiếu điểm khiến điểm mang tên người cũ không còn khớp với phân công hiện hành. OQ-005 chưa có quy tắc giữ, hủy hay nhập lại điểm trong tình huống này.

## Quyết định

- Từ khi **hội đồng có bất kỳ phiếu điểm nào**, không cho thay Chủ tịch hoặc Thư ký của hội đồng đó. Backend phải chặn thay người ngay cả khi thay đổi được gửi qua thao tác khác hoặc đồng thời với việc nhập điểm.
- Trước khi có phiếu điểm, Giáo vụ có thể thay thành viên theo các kiểm tra phân công/xung đột hiện hành; thay đổi phải lưu lịch sử. Nếu lịch đã công bố, phải thông báo người bị ảnh hưởng và kiểm tra lại xung đột theo [PDR-018](PDR-018-sua-lich-da-cong-bo-va-dinh-chinh.md).
- Phiếu điểm đã nhập giữ nguyên người chấm và phân công tương ứng. Không có luồng chuyển, hủy hoặc tái nhập phiếu do thay thành viên sau điểm, vì thao tác thay người bị chặn.

## Hệ quả

- Kiểm thử thay Chủ tịch/Thư ký trước điểm, thay sau khi chỉ một Sinh viên có điểm, thao tác thay đồng thời với nhập điểm và quyền Giáo vụ.
- Màn hội đồng nêu rõ lý do khóa thay người khi đã có điểm; điểm và lịch sử phân công tiếp tục tra cứu được.
