# Ràng buộc phi chức năng

Chỉ các ràng buộc có căn cứ từ tài liệu hiện hành hoặc quyết định đã được người dùng xác nhận mới là yêu cầu. Mốc tải 100 người đồng thời được giữ cho giai đoạn sau khi hoàn thiện ứng dụng; thời gian đáp ứng, dung lượng lưu trữ tổng và SLA vẫn chưa chốt.

| Nhóm | Ràng buộc đã biết |
| --- | --- |
| Nền tảng | Hệ thống là ứng dụng web, truy cập qua trình duyệt và cần kết nối Internet. |
| Dữ liệu | Dữ liệu khóa luận, tài liệu, phân công và kết quả được lưu tập trung; cần giữ lịch sử thay đổi/tài liệu để tra cứu. |
| Phân quyền | Người dùng có tài khoản và quyền phù hợp vai trò; kiểm tra quyền phải ở backend. |
| Tính đúng đắn | Các thay đổi liên quan đăng ký, phân công và kết quả phải giữ nhất quán, đặc biệt khi có thao tác đồng thời. |
| Tệp nộp học thuật | Chỉ PDF, tối đa 20 MB mỗi tệp theo PDR-039/040; giữ mọi phiên bản sau khi đợt kết thúc theo PDR-042. |
| Ảnh hồ sơ | Chỉ JPG/PNG/WebP, tối đa 2 MB mỗi tệp theo PDR-043. |
| Vận hành | Hệ thống phụ thuộc vào máy chủ, cơ sở dữ liệu và kết nối Internet. Các mốc/thời hạn chịu sự điều chỉnh của Khoa. |
| Quy mô kiểm thử sau phát triển | Mục tiêu đánh giá chịu tải 100 người sử dụng đồng thời, có thao tác đọc/ghi đại diện và đủ ba vai trò theo [PDR-046](../decisions/PDR-046-moc-kiem-thu-mot-tram-nguoi-dung-dong-thoi.md); không chặn nghiệm thu chức năng Phase 00–08. |

OQ-007 được để sau khi hoàn thiện ứng dụng theo [OPEN_QUESTIONS.md](../OPEN_QUESTIONS.md). Chính sách upload và giới hạn khôi phục mật khẩu đã chốt tại PDR-039–044; việc hoãn chỉ tiêu tải không thay đổi kiểm thử đúng chức năng, quyền và an toàn dữ liệu trong các phase hiện tại.
