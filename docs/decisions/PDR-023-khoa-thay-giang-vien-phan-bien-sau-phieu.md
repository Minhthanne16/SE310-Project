# PDR-023: Khóa thay Giảng viên phản biện từ phiếu điểm đầu tiên

## Trạng thái

Đã chấp nhận theo xác nhận trực tiếp của người dùng ngày 2026-10-28.

## Bối cảnh

Phiếu phản biện gắn với người thực sự chấm từng Sinh viên. Nếu đổi người sau khi đã có phiếu, phân công hiện hành sẽ không còn giải thích được điểm đã nhập.

## Quyết định

- Từ khi Giảng viên phản biện của đề tài đã nhập **phiếu điểm cho ít nhất một Sinh viên**, Giáo vụ không được đổi sang Giảng viên phản biện khác cho đề tài đó. Backend chặn cả thao tác đơn lẻ, hàng loạt và thao tác đồng thời với nhập điểm.
- Trước phiếu điểm đầu tiên, Giáo vụ được đổi người theo các kiểm tra phân công hiện hành; phải lưu người cũ/mới, thời điểm, người thực hiện trong lịch sử và thông báo cho người bị ảnh hưởng.
- Phiếu đã nhập giữ nguyên người chấm. Không có luồng chuyển, hủy hoặc tái nhập phiếu do đổi phản biện sau phiếu vì thao tác đổi người bị chặn. Quy tắc này độc lập với khóa thay Chủ tịch/Thư ký sau điểm tại [PDR-020](PDR-020-khoa-thay-thanh-vien-hoi-dong-sau-diem.md).

## Hệ quả

- Màn phân công nêu rõ lý do khóa thay người khi đã có phiếu phản biện.
- Kiểm thử đổi trước phiếu, đổi sau phiếu của một trong hai Sinh viên, đổi hàng loạt lẫn dòng hợp lệ/không hợp lệ, và nhập điểm đồng thời với đổi người.
