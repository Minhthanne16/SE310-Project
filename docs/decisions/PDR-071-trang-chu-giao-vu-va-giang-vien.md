# PDR-071: Trang chủ Giáo vụ và Giảng viên làm lối tắt thao tác

## Trạng thái

Đã chấp nhận theo xác nhận trực tiếp của người dùng ngày 2026-11-23. Danh sách trường hợp bất thường là **tạm**, xem [OQ-033](../OPEN_QUESTIONS.md).

## Quyết định

### Trang chủ Giáo vụ

1. Trên cùng là khối **Cần xử lý** gom các trường hợp bất thường của mọi đợt Giáo vụ quản lý; mỗi dòng ghi đợt, số lượng và nút mở đúng chỗ thao tác, đã lọc sẵn đợt.
2. Danh sách bất thường (tạm): đề tài có lệch điểm; Sinh viên nộp trễ đề cương/giữa kỳ/cuối kỳ; Giảng viên dưới mức tối thiểu hoặc vượt tối đa số đề tài; Sinh viên chưa có nhóm khi đã hết đăng ký; Sinh viên giữ chỗ chưa xác nhận khi sắp hết hạn; đề tài đủ điều kiện nhưng chưa có phản biện hoặc chưa xếp hội đồng khi sắp tới lịch; hội đồng trùng giờ hoặc phòng; mốc chưa cấu hình khi mốc trước sắp kết thúc.
3. Bên dưới là thẻ từng đợt như hiện nay, thêm trạng thái đợt (Nháp, Đang diễn ra, Đã kết thúc), mốc đang chạy và số liệu nhanh (số đề tài, Sinh viên có nhóm, đã phân công phản biện, đã có điểm, có lệch). Bấm thẻ vào Chi tiết đợt như cũ.

### Trang chủ Giảng viên

Một danh sách gộp, không tách theo vai trò; mỗi dòng gắn nhãn vai trò (HD, PB, HĐ) và bấm vào là mở đúng chỗ thao tác, đã lọc sẵn đợt:

1. **Đợt đang tham gia:** vai trò trong đợt, mốc đang chạy, số đề tài đang hướng dẫn so với mức tối thiểu/tối đa.
2. **Việc cần làm có hạn** (sắp theo hạn gần nhất): đề cương chờ duyệt, đề xuất chờ trả lời, thiếu đề tài so với mức tối thiểu khi sắp hết hạn gửi, phiếu chấm của mình chưa nhập khi sắp hết Thời gian cho điểm, điểm của mình bị lệch cần sửa.
3. **Thay đổi mới nhất của đề tài:** Sinh viên nộp đề cương/giữa kỳ/cuối kỳ/phiên bản mới, nộp trễ, Sinh viên giữ chỗ xác nhận hoặc từ chối, mình vừa được phân công phản biện hoặc xếp vào hội đồng.
4. **Lịch hội đồng sắp tới:** ngày, giờ, phòng, số đề tài, nút mở phiếu chấm.
5. **Thông báo từ Giáo vụ.**

## Hệ quả

- Cần API tổng hợp theo người dùng (đợt, đếm theo loại bất thường/việc, mục mới nhất) để Trang chủ không gọi từng màn.
- Trang Thống kê đầy đủ ngoài phạm vi PDR này.
