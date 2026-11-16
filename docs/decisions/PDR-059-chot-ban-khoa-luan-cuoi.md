# PDR-059: Chốt bản khóa luận cuối và xử lý ngoại lệ P04-S03

## Trạng thái

Đã xác nhận trực tiếp ngày 2026-11-15 khi triển khai P04-S03; cụ thể hóa PDR-011 và PDR-041.

## Quyết định

- **Bản khóa luận** là `SubmissionKind.Thesis`, tách khỏi **Báo cáo cuối kỳ** (`Final`). Bản khóa luận dùng mốc 9 “Chốt bản cuối · công bố”; báo cáo cuối kỳ dùng mốc 5.
- Mốc 9 có công tắc “Cho nộp trễ” và hạn trễ riêng, mặc định **tắt** cho đợt mới và đợt hiện có. Khi bật, phải đặt hạn sau hạn thường theo PDR-041. Hạn bổ sung của Giáo vụ ghi trên đề tài của đúng nhóm và ưu tiên hạn trễ chung, kể cả khi công tắc mốc 9 tắt.
- Hạn nộp được tính đến hết ngày theo giờ Việt Nam. Giáo vụ chỉ cấp hạn bổ sung sau hạn gốc khi nhóm chưa có bản khóa luận, hạn bổ sung phải là ngày tương lai, có lý do, và chỉ được cấp **một lần**. Không xóa dấu vết lần cấp sau khi hết hạn.
- Thành viên nhóm chọn một phiên bản `Thesis` đã nộp để chốt. Con trỏ `FinalThesisSubmissionId` trên đề tài chỉ nhận giá trị một lần; bản khác vẫn đọc/tải được. Sau khi chốt không nộp thêm bản khóa luận.
- Job chạy mỗi phút, xét đề tài có bản khóa luận nhưng chưa chốt sau hạn có hiệu lực. Nó chốt phiên bản mới nhất và ghi đúng một mục lịch sử. Trường hợp không có bản vẫn chờ Giáo vụ; job không đổi trạng thái hay tạo điểm.
- Sau hạn bổ sung mà vẫn không có bản, chỉ Giáo vụ được kết thúc `Không đủ điều kiện công bố` với lý do và lịch sử. Trạng thái này chặn nộp, chấm và mở lại thông thường. Phase 07 không được coi hết hạn đơn thuần là có bản cuối; thiếu bản khóa luận thì không công bố.

## Hợp đồng API

`GET|POST /api/topics/{id}/submissions` hỗ trợ thêm `kind=thesis` và trả `kinds[].versions[].isFinal`, `canLock`, `extensionDeadline`, `extensionReason`, `waitingException`, `canGrantExtension`, `canMarkIneligible`, `ineligibleReason`. Tất cả hạn là `yyyy-MM-dd`; quyền đọc/tải theo PDR-058. `POST /api/topics/{id}/thesis/lock` nhận `{ submissionId }` (chỉ thành viên), `/thesis/extension` nhận `{ endDate, reason }` (chỉ Giáo vụ), `/thesis/ineligible` nhận `{ reason }` (chỉ Giáo vụ). Thành công trả `TopicSubmissionsDto`; lỗi xác thực 401/403, dữ liệu không hợp lệ 400, trạng thái/hạn/xung đột 409.

`GET /api/topics?roundId=...` và `GET /api/topics/{id}` trả thêm `thesisVersionCount`, `finalLockedVersionNo`, `thesisWaitingException` cho người có quyền xem đề tài. Danh sách Giáo vụ dùng các trường này để không nhầm báo cáo khác với bản khóa luận.

## Lưu trữ và kiểm thử

Migration `AddThesisFinalization` thêm các cột nullable, giữ bản cũ và đặt cờ nộp trễ mốc 9 của đợt hiện có thành `false`. Không tự áp dụng migration lên dữ liệu dùng chung. Thao tác chốt/cấp hạn/kết thúc ghi lịch sử trong cùng transaction và dùng cập nhật có điều kiện; job chạy lặp không ghi trùng.
