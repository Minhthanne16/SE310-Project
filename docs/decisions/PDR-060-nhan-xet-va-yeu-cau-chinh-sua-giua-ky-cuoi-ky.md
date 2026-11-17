# PDR-060 — Nhận xét và checklist yêu cầu chỉnh sửa cho Báo cáo giữa kỳ và Cuối kỳ

- **Trạng thái:** Đã duyệt
- **Ngày:** 2026-11-16
- **Người đề xuất:** Gemini (theo chỉ đạo kiến trúc và quyết định người dùng ngày 2026-11-16)
- **Tham chiếu:**
  - [PDR-013 — Yêu cầu chỉnh sửa đề cương](PDR-013-yeu-cau-chinh-sua-de-cuong.md)
  - [PDR-041 — Hạn nộp trễ riêng từng mốc](PDR-041-han-nop-tre-rieng-tung-moc.md)
  - [PDR-058 — Hợp đồng nộp báo cáo giữa kỳ và cuối kỳ](PDR-058-nop-bao-cao-giua-ky-cuoi-ky.md)
  - [PDR-057 — Đề cương và yêu cầu chỉnh sửa](PDR-057-de-cuong-va-yeu-cau-chinh-sua.md)
  - [PDR-058 — Nộp báo cáo giữa kỳ và cuối kỳ](PDR-058-nop-bao-cao-giua-ky-cuoi-ky.md)
  - [PDR-061 — Không gian đề tài, khung và tab](PDR-061-khong-gian-de-tai-khung-va-tab.md)
  - [docs/plan/khong-gian-de-tai.md](../plan/khong-gian-de-tai.md) (mục A13, Q2, Q2b, Q6)
  - [docs/requirements/BUSINESS_RULES.md](../requirements/BUSINESS_RULES.md) (mục Tài liệu)
  - [docs/DESIGN/03-dac-ta-man-hinh.md](../DESIGN/03-dac-ta-man-hinh.md)

---

## 1. Ngữ cảnh

Trong quy trình thực hiện khóa luận tốt nghiệp, nhóm sinh viên nộp 3 loại tài liệu học thuật theo phiên bản:
1. **Đề cương** (`Outline`): GVHD nhận xét, tạo yêu cầu chỉnh sửa, nhóm nộp lại liên kết yêu cầu và GVHD xác nhận duyệt đề cương (PDR-013, PDR-057).
2. **Báo cáo giữa kỳ** (`Midterm`): Đánh giá tiến độ nửa đầu kỳ.
3. **Báo cáo cuối kỳ** (`Final`): Đánh giá kết quả trước khi nghiệm thu/bảo vệ.

Theo quyết định đã chốt ngày 2026-11-16 (Q2 trong kế hoạch Không gian đề tài), GVHD cần nhận xét được trên từng phiên bản nộp và có checklist yêu cầu chỉnh sửa cho cả Báo cáo giữa kỳ và Báo cáo cuối kỳ tương tự như Đề cương, giúp sinh viên có phản hồi cụ thể để hoàn thiện tài liệu.

Tuy nhiên, Báo cáo giữa kỳ và Cuối kỳ có sự khác biệt quan trọng so với Đề cương về mặt quy trình:
- **Không có bước "Duyệt"**: Giữa kỳ và Cuối kỳ không có trạng thái "Đã duyệt" làm kết thúc chặng.
- **Tạo yêu cầu không mở thêm hạn nộp**: Thời gian nộp vẫn tuân thủ cửa sổ nộp cấu hình của mốc đợt (PDR-041/058).
- **Điều kiện chặn**:
  - Yêu cầu chỉnh sửa mở ở Giữa kỳ **không chặn** nộp cuối kỳ hay các bước tiếp theo.
  - Yêu cầu chỉnh sửa mở ở Cuối kỳ **chặn hành động "Chốt bản cuối"** của nhóm sinh viên (Q2b): Nhóm chỉ chốt bản cuối được khi mọi yêu cầu chỉnh sửa của Báo cáo cuối kỳ đã được GVHD xác nhận hoàn tất. Hành động chốt là `POST /api/topics/{id}/thesis/lock` của [PDR-059](PDR-059-chot-ban-khoa-luan-cuoi.md): backend từ chối (409) khi còn yêu cầu mở; `SubmissionKindDto.CanLock` của bản `Thesis` là `false` và `LockBlockedReason` nêu số yêu cầu còn mở. Chốt tự động khi hết hạn vẫn chạy.
  - Hệ thống tự chốt bản cuối lúc hết hạn (PDR-011) vẫn hoạt động kể cả khi còn yêu cầu mở (ghi nhận lịch sử).

---

## 2. Quyết định

### 2.1. Nhận xét của giảng viên hướng dẫn

1. Nhận xét gắn liền với từng phiên bản bài nộp (`TopicSubmission`), lưu ở các cột `ReviewComment`, `ReviewedById`, `ReviewedAt` đã có sẵn trên bảng `TopicSubmissions`.
2. Chỉ GVHD của đề tài được tạo/sửa nhận xét. Người khác gọi bị từ chối 403; người ngoài đề tài nhận 404.
3. Nội dung nhận xét tối đa 2000 ký tự; gửi rỗng (`null` hoặc khoảng trắng) để xóa nhận xét.
4. Nhận xét không làm chặn hay thay đổi trạng thái của phiên bản bài nộp.
5. Ghi lịch sử đề tài thuộc nhóm "Bài nộp" và gửi chuông thông báo đến các thành viên trong nhóm sinh viên.

### 2.2. Yêu cầu chỉnh sửa (Revision Requests)

1. Mở rộng entity `RevisionRequest`:
   - Thêm cột `Kind` kiểu `SubmissionKind` (`Outline = 1`, `Midterm = 2`, `Final = 3`, `Thesis = 4`), mặc định `SubmissionKind.Outline` cho các bản ghi cũ.
   - Thêm chỉ mục tra cứu `(TopicId, Kind, ResolvedAt)`.
2. Quy tắc tạo yêu cầu:
   - Chỉ GVHD của đề tài được tạo yêu cầu chỉnh sửa.
   - Đề tài phải đã có ít nhất một phiên bản của **đúng loại bài nộp đó** (`TopicSubmission.Kind == request.Kind`). Nếu chưa nộp bản nào mà tạo yêu cầu, API trả 409 Conflict.
   - Yêu cầu ghi nhận `RaisedOnSubmissionId` là phiên bản mới nhất của loại đó mà GVHD đang xem khi tạo yêu cầu.
   - Trạng thái ban đầu: `open` (`ResolvedAt == null`).
3. Quy tắc nộp lại và liên kết yêu cầu:
   - Khi nhóm sinh viên nộp một phiên bản mới của loại `Kind`, hệ thống tự động liên kết phiên bản đó với **mọi yêu cầu đang mở của cùng loại `Kind`** (`RevisionRequest.Kind == submission.Kind && ResolvedAt == null`) thông qua bảng liên kết `RevisionRequestLinks`.
   - Tuyệt đối không liên kết chéo giữa các loại khác nhau (yêu cầu của Đề cương không liên kết với bản Giữa kỳ, yêu cầu của Giữa kỳ không liên kết với bản Cuối kỳ).
4. Quy tắc xác nhận hoàn tất yêu cầu:
   - Giữ nguyên quy tắc PDR-013/057: **Chỉ GVHD bấm "Xác nhận hoàn tất"**, sinh viên không được tự tick hoàn tất.
   - GVHD chỉ được xác nhận hoàn tất một yêu cầu sau khi nhóm sinh viên đã nộp ít nhất một phiên bản liên kết với yêu cầu đó. Nếu nhóm chưa nộp lại bản sửa, thao tác xác nhận bị từ chối 409 Conflict.
   - Xác nhận lặp lại trên yêu cầu đã đóng trả 409 Conflict.

### 2.3. Hợp đồng API

Dưới tiền tố `/api/topics/{topicId}/submissions`:

1. **Nhận xét phiên bản:**
   - `PUT /api/topics/{topicId}/submissions/{submissionId}/comment`
   - Request body: `{ "comment": string | null }`
   - Response: `ApiResponse<TopicSubmissionsDto>`
   - Quyền: `[Authorize(Roles = AppRoles.Lecturer)]`, bắt buộc `topic.SupervisorId == CurrentUserId`.

2. **Tạo yêu cầu chỉnh sửa:**
   - `POST /api/topics/{topicId}/submissions/requests`
   - Request body: `{ "kind": "midterm" | "final", "content": string }`
   - Response: `ApiResponse<TopicSubmissionsDto>`
   - Quyền: `[Authorize(Roles = AppRoles.Lecturer)]`, bắt buộc `topic.SupervisorId == CurrentUserId`.

3. **Xác nhận hoàn tất yêu cầu:**
   - `POST /api/topics/{topicId}/submissions/requests/{requestId:guid}/resolve`
   - Response: `ApiResponse<TopicSubmissionsDto>`
   - Quyền: `[Authorize(Roles = AppRoles.Lecturer)]`, bắt buộc `topic.SupervisorId == CurrentUserId`.

### 2.4. Bổ sung trường trong DTO

1. **`TopicSubmissionsDto`**:
   - `kinds[].canReview`: `boolean` — `true` khi người xem là GVHD của đề tài.
   - `kinds[].requests`: `List<RevisionRequestDto>` — danh sách các yêu cầu chỉnh sửa của loại đó, sắp xếp yêu cầu mở lên trước.
   - `kinds[].versions[].reviewComment`: `string?` — nhận xét của GVHD.
   - `kinds[].versions[].reviewedBy`: `string?` — tên GVHD đã nhận xét.
   - `kinds[].versions[].reviewedAt`: `DateTime?` — thời điểm nhận xét.
   - `kinds[].versions[].addressedRequestIds`: `List<Guid>` — danh sách id các yêu cầu được giải quyết bởi phiên bản này.

### 2.5. Giao diện người dùng (Frontend)

1. Tái sử dụng thành phần hiển thị yêu cầu chỉnh sửa và nhận xét:
   - Khối Báo cáo giữa kỳ và Báo cáo cuối kỳ trong `ActivityTab` hiển thị danh sách yêu cầu chỉnh sửa và ô nhận xét gắn với phiên bản.
   - GVHD có nút "Thêm yêu cầu chỉnh sửa" mở hộp thoại tạo yêu cầu và nút "Xác nhận hoàn tất" trên từng yêu cầu đủ điều kiện.
   - Sinh viên nhìn thấy các yêu cầu cần xử lý và ghi chú phiên bản đã sửa.
   - Giáo vụ ở chế độ chỉ xem (`read-only`).
2. Badge số đếm trên tab Hoạt động:
   - Tổng số yêu cầu đang mở của cả 3 loại (Đề cương + Giữa kỳ + Cuối kỳ).
   - Chip tiêu đề khối Giữa kỳ / Cuối kỳ hiển thị "Cần chỉnh sửa · k yêu cầu" khi có yêu cầu đang mở.

---

## 3. Hệ quả

- **Tích cực:**
  - Quy trình nhận xét và phản hồi chỉnh sửa đồng nhất trên cả 3 chặng học thuật (Đề cương, Giữa kỳ, Cuối kỳ).
  - Tách bạch rõ ràng giữa các loại bài nộp: yêu cầu giữa kỳ không ảnh hưởng đề cương hay cuối kỳ.
  - Đảm bảo chất lượng bài khóa luận trước khi chốt bản cuối.
- **Cần lưu ý:**
  - Cần thêm migration EF Core bổ sung cột `Kind` cho bảng `RevisionRequests`.
  - Migration phải đặt giá trị mặc định `1` (`Outline`) cho toàn bộ dữ liệu hiện có trong DB để đảm bảo tương thích ngược 100%.
