# Mô hình miền khái niệm

Đây là mô hình nghiệp vụ, không phải lược đồ bảng hay hợp đồng API.

| Khái niệm | Trách nhiệm | Liên hệ chính |
| --- | --- | --- |
| Người dùng | Đại diện Sinh viên, Giảng viên hoặc Giáo vụ | Tham gia nhóm, hướng dẫn/chấm, nhận thông báo, tạo lịch sử. |
| Đợt khóa luận | Bao bọc mốc và cấu hình cho một chu kỳ khóa luận | Có nhiều đề tài, hội đồng và mẫu phiếu được gán. |
| Mốc đợt | Khoảng thời gian cho một chặng của đợt | Thuộc đợt; mốc Đề cương/Giữa kỳ/Cuối kỳ có thể bật nộp trễ với hạn riêng sau hạn thường (PDR-041). |
| Đề tài | Trung tâm của vòng đời khóa luận | Thuộc một đợt, có hướng dẫn viên, nhóm, bài nộp, phân công và lịch sử. |
| Thành viên đề tài | Liên kết Sinh viên với đề tài | Một đến hai thành viên, có một đại diện. |
| Bài nộp | Một phiên bản đề cương, báo cáo giữa kỳ/cuối kỳ hoặc khóa luận | Thuộc đề tài, có người nộp, tệp PDF và các nhận xét; mọi phiên bản được giữ sau khi kết thúc đợt (PDR-039/042). |
| Nhận xét | Kết quả phản hồi cho bài nộp | Có tác giả là Giảng viên; có thể yêu cầu chỉnh sửa. |
| Yêu cầu chỉnh sửa đề cương | Việc GVHD giao cho nhóm xử lý trước khi duyệt | Gắn đề tài/bản đề cương, liên kết các lần nộp lại và người xác nhận hoàn tất. |
| Hội đồng | Nhóm chấm các đề tài được gán | Thuộc đợt, có chủ tịch/thư ký; thành viên bị khóa thay khi đã có phiếu điểm (PDR-020). |
| Lượt bảo vệ | Khoảng thời gian bảo vệ của một đề tài | Gắn hội đồng, đề tài, giờ bắt đầu/kết thúc, phòng và trạng thái lịch; chỉ một lượt có hiệu lực, bản đã hủy/đổi còn trong lịch sử (PDR-016–019). |
| Mẫu phiếu và tiêu chí | Cấu hình cách chấm | Mẫu được gán cho HD, PB hoặc hội đồng trong một đợt; Chủ tịch/Thư ký dùng chung mẫu hội đồng nhưng mỗi người có phiếu riêng (PDR-024). |
| Phiếu điểm và chi tiết điểm | Điểm của một người chấm cho một Sinh viên | Gắn vai trò, mẫu phiếu, người chấm/người nhập và các tiêu chí. |
| Thông báo | Thông tin gửi tới người dùng | Có người nhận, có thể có người gửi và trạng thái đã đọc; ẩn khỏi danh sách đã gửi chỉ tác động người gửi, bản người nhận còn nguyên (PDR-038). |
| Lịch sử đề tài | Dấu vết thay đổi nghiệp vụ | Gắn đề tài, người thực hiện (có thể là hệ thống), thời điểm và nội dung. |

## Quan hệ và bất biến quan trọng

- Một đề tài thuộc một đợt, có một giảng viên hướng dẫn và tối đa một nhóm đang đăng ký.
- Một đợt có nhiều đề tài/hội đồng và gán mẫu phiếu cho các vai trò chấm.
- Một bài nộp thuộc một đề tài; các phiên bản trước không bị ghi đè khi có lần nộp mới.
- Mỗi bản nộp học thuật là PDF tối đa 20 MB; nộp trong hạn trễ theo mốc và hạn bổ sung riêng theo ngoại lệ có phạm vi khác nhau (PDR-011/039–041).
- Một Sinh viên có bốn kết quả chấm độc lập khi đủ điều kiện: hướng dẫn, phản biện, chủ tịch và thư ký.
- Mỗi đề tài có tối đa một hội đồng/lượt bảo vệ có hiệu lực trong một đợt; các lượt đã thay đổi hoặc hủy còn ở lịch sử (PDR-016/019).
- Lịch sử và thông báo bổ trợ cho mọi thay đổi, nhưng không được thay thế trạng thái nghiệp vụ chính.

Các thuộc tính vật lý, khoá, enum kỹ thuật, quan hệ xóa và migration chỉ được quyết định khi có đặc tả triển khai sau này.
