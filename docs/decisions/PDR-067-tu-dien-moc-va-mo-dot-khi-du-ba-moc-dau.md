# PDR-067: Tự điền mốc đợt và mở đợt khi đủ ba mốc đầu

## Trạng thái

Đã chấp nhận theo xác nhận trực tiếp của người dùng ngày 2026-11-23. Thay [PDR-032](PDR-032-du-chin-moc-hop-le-truoc-khi-mo-dot.md) (đủ chín mốc mới mở đợt). Độ dài mặc định của từng mốc là **tạm**, xem [OQ-033](../OPEN_QUESTIONS.md).

## Bối cảnh

Giáo vụ đang phải nhập ngày đầu/cuối cho cả chín mốc. Các mốc báo cáo và chấm điểm thường chưa biết chính xác khi mở đợt.

## Quyết định

1. **Tự điền:** Giáo vụ nhập ngày bắt đầu; hệ thống điền chín mốc theo độ dài mặc định. Mốc sau bắt đầu đúng ngày mốc trước kết thúc, riêng mốc 8 bắt đầu cùng ngày mốc 6. Giáo vụ sửa được từng mốc.

   | # | Mốc | Độ dài mặc định (tạm) |
   | --- | --- | --- |
   | 1 | GV gửi đề tài | 2 tuần |
   | 2 | Công bố đề tài · SV đăng ký | 2 tuần |
   | 3 | Đề cương | 2 tuần |
   | 4 | Báo cáo giữa kỳ | 4 tuần |
   | 5 | Báo cáo cuối kỳ | 4 tuần |
   | 6 | Lịch phản biện | 2 tuần |
   | 7 | Lịch bảo vệ | 2 tuần |
   | 8 | Thời gian cho điểm | 4 tuần (song song mốc 6–7) |
   | 9 | Chốt bản cuối · công bố | 2 tuần |

2. **Thứ tự:** mỗi mốc có bắt đầu không sau kết thúc. Ngày bắt đầu các mốc có thể trùng nhau, nhưng mốc sau **tuyệt đối không** bắt đầu trước mốc trước.
3. **Xung đột khi sửa:** nếu sửa một mốc làm mốc sau vi phạm thứ tự, hệ thống cảnh báo và gợi ý ngày mới cho các mốc sau (dời theo khoảng lệch, giữ độ dài). Giáo vụ nhận gợi ý hoặc tự sửa; backend không lưu cấu hình vi phạm.
4. **Mở đợt:** đợt `Nháp` được mở khi **ba mốc đầu** (GV gửi đề tài, SV đăng ký, Đề cương) có thời gian hợp lệ. Mốc 4–9 có thể để trống và cấu hình sau, kể cả khi đợt đã `Đang diễn ra`; khi điền vẫn theo mục 2. Chức năng phụ thuộc một mốc còn trống chưa mở cho tới khi mốc được cấu hình.
5. Khác cấu hình điểm ([PDR-065](PDR-065-cau-hinh-diem-theo-dot.md)) bị khóa khi mở đợt, mốc vẫn sửa được sau khi mở; đổi mốc vẫn gửi thông báo như quy tắc hiện có. Cho nộp trễ vẫn theo [PDR-041](PDR-041-han-nop-tre-rieng-tung-moc.md).

## Hệ quả

- Kiểm thử: tự điền từ một ngày bắt đầu, sửa mốc giữa gây xung đột và nhận gợi ý, hai mốc trùng ngày bắt đầu, mốc sau bắt đầu trước mốc trước (chặn), mở đợt khi thiếu mốc 1–3 (chặn) và khi chỉ có mốc 1–3 (được), thêm mốc 4–9 sau khi mở.
- Các màn và tác vụ đọc mốc (Gantt, nộp bài, nhắc hạn, đóng đăng ký PDR-064) phải chịu được mốc trống.

## Trạng thái triển khai

- **2026-11-23:** Đã triển khai backend trên nhánh `feat/giao-vu-23-11` (bước A2): `RoundRules.ValidateMilestones` cho phép trùng ngày bắt đầu, ngoại lệ mốc 8 và mốc 9, `OpenRoundHandler` cho phép mở đợt khi đủ 3 mốc đầu, 5 test `RoundMilestoneRuleTests` đạt.
