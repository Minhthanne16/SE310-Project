# PDR-058: Nộp và lưu trữ báo cáo giữa kỳ/cuối kỳ (P04-S02)

## Trạng thái

Đã chấp nhận khi triển khai P04-S02 ngày 2026-11-12. Quy tắc nghiệp vụ đã chốt tại [PDR-039](PDR-039-chi-nhan-pdf-cho-ban-nop-hoc-thuat.md), [PDR-040](PDR-040-gioi-han-pdf-hai-muoi-megabyte.md), [PDR-041](PDR-041-han-nop-tre-rieng-tung-moc.md), [PDR-042](PDR-042-giu-moi-phien-ban-tai-lieu-khong-tu-xoa.md), [BUSINESS_RULES](../requirements/BUSINESS_RULES.md) và DESIGN 03 · Không gian đề tài. PDR này ghi hợp đồng API, cách lưu và các mục "lựa chọn triển khai" do người làm task đề xuất; nhóm có thể đổi trong PDR sau.

## Bối cảnh

Mốc của đợt mới có công tắc "Cho nộp trễ", chưa có hạn trễ (PDR-041). Đề cương (P04-S01, [PDR-057](PDR-057-de-cuong-va-yeu-cau-chinh-sua.md)) đã có bảng bài nộp `TopicSubmission`, kho `IDocumentStorage` và thao tác duyệt đề cương; báo cáo dùng lại chúng. Phân công phản biện (P05) chưa được xây nên quyền của GV phản biện chưa thực thi được (mục "Chưa làm").

## Hợp đồng API

Mọi endpoint yêu cầu đăng nhập với một trong ba vai trò; lỗi dùng `ApiResponse`.

| Method + route | Ai | Thành công | Lỗi |
| --- | --- | --- | --- |
| `GET /api/topics/{id}/submissions` | Thành viên nhóm của đề tài, GVHD của đề tài, Giáo vụ | 200 `TopicSubmissionsDto` | 401, 404 (kể cả khi không có quyền, để không lộ đề tài) |
| `POST /api/topics/{id}/submissions` | Thành viên nhóm của đề tài | 201 `TopicSubmissionsDto` | 400 tệp/ghi chú/loại không hợp lệ, 401, 403 GVHD/Giáo vụ nộp thay, 404, 409 hết hạn hoặc đề tài chưa/không còn nhận bài, 503 kho lưu trữ không sẵn sàng |
| `GET /api/submissions/{id}/file` | Như `GET` danh sách | 200 tệp PDF (`attachment`) | 401, 404 (không có quyền, không có bài nộp, hoặc tệp không còn trong kho), 503 |

- **`POST`** là `multipart/form-data`: `kind` (`midterm` \| `final`), `note` (không bắt buộc với giữa kỳ, **bắt buộc với cuối kỳ**, ≤ 500 ký tự), `file`.
- **`TopicSubmissionsDto`:** `{ topicId, maxBytes, kinds[] }`. Mỗi `kinds[]`: `{ kind, name, deadline, allowLate, lateDeadline, window, canSubmit, blockedReason, noteRequired, versions[] }`.
  - `deadline`, `lateDeadline` dạng `yyyy-MM-dd`; `lateDeadline` rỗng khi mốc tắt nộp trễ hoặc chưa có hạn trễ hợp lệ.
  - `window` thuộc `onTime | late | closed`; `canSubmit` chỉ `true` với thành viên nhóm khi còn nhận bài.
  - `versions[]` (mới nhất trước): `{ id, version, fileName, sizeBytes, note, submittedAt, submittedBy{id,code,name}, isLate, isLatest, downloadUrl }`. `downloadUrl` là đường dẫn API ở trên.
- **Mốc đợt:** `RoundDto.milestones[]` và body của `PUT /api/rounds/{id}/milestones` thêm `lateEndDate` (`yyyy-MM-dd`; rỗng/null = chưa đặt), chỉ có nghĩa với Đề cương, Giữa kỳ, Cuối kỳ.

## Quy tắc thực thi

- **PDF (PDR-039):** xét nội dung tệp, không tin tên, phần mở rộng hay `Content-Type`: phải có chữ ký `%PDF-` ở đầu và dấu kết `%%EOF` ở cuối. Tệp đổi đuôi thành `.pdf` bị từ chối với "Tệp không phải PDF hợp lệ. Chỉ nhận tệp PDF."
- **20 MB (PDR-040):** đúng 20 MB được nhận, hơn 1 byte bị từ chối. Kiểm ở controller (trước khi đọc tệp vào bộ nhớ), ở handler, và giao diện báo sớm cùng câu chữ. Giới hạn request của endpoint là 20 MB + 256 KB cho phần multipart.
- **Hạn và nộp trễ (PDR-041):** hạn tính đến 23:59 giờ Việt Nam của ngày kết thúc mốc tương ứng (Báo cáo giữa kỳ / Báo cáo cuối kỳ), cùng quy ước các mốc khác.
  - Đến hết hạn thường: nhận, đúng hạn.
  - Sau hạn thường đến hết `lateEndDate` của **chính mốc đó**, khi công tắc bật: nhận và gắn `isLate` (nhãn "Nộp trễ").
  - Còn lại: 409 kèm ngày hết hạn. Công tắc tắt thì hạn trễ đã lưu không mở quyền nộp.
- **Cấu hình hạn trễ:** `lateEndDate` phải sau ngày kết thúc của mốc. Đợt Nháp được lưu khi bật nộp trễ mà chưa đặt hạn; **mở đợt** và **lưu cấu hình của đợt Đang diễn ra** thì bắt buộc mốc bật nộp trễ có hạn trễ hợp lệ (báo lỗi theo từng mốc). Sao chép đợt chỉ mang công tắc, không mang hạn trễ (PDR-034).
- **Điều kiện đề tài:** đợt Đang diễn ra, đề tài đã `Đang thực hiện` trở đi (sau khi hết thời gian đăng ký, PDR-049), chưa `Đã hoàn tất`/`Không đủ điều kiện công bố`, và **đề cương đã được GVHD duyệt** (BUSINESS_RULES · Tài liệu và phân công; lỗi 409 "Chỉ nộp báo cáo sau khi GVHD duyệt đề cương."). Nhóm đã nộp báo cáo không còn hủy ghi danh được vì cửa sổ đăng ký đã đóng.
- **Phiên bản (PDR-042):** mỗi lần nộp là một bản ghi mới, đánh số từ 1 trong từng loại của đề tài; không có API sửa hay xóa. Kết thúc đợt không đổi gì: mọi phiên bản vẫn xem và tải được đúng quyền, chỉ không nộp thêm.
- **Truy vết:** mỗi lần nộp ghi người nộp, thời điểm, phiên bản, ghi chú và nhãn nộp trễ; lịch sử đề tài có mục nhóm "Bài nộp" ("Nộp báo cáo giữa kỳ" / "Nộp báo cáo cuối kỳ"), lưu cùng lần ghi với bài nộp.
- **Tài khoản:** người đã nộp bài tính là "đã có dữ liệu" nên chỉ bị vô hiệu hóa, không xóa (bổ sung PDR-004).

## Lựa chọn triển khai

- **Lưu trữ:** dùng chung object storage và `IDocumentStorage` với ảnh đại diện (PDR-051) và đề cương (PDR-057): bucket riêng tư `Storage:Bucket`, khóa ngẫu nhiên `submissions/{topicId}/{kind}/{guid}.pdf`, không chứa tên tệp. Thông tin kết nối và khóa object chỉ nằm ở backend; frontend chỉ nhận `downloadUrl` của API, không có URL ký sẵn hay khóa nào của MinIO.
- **Không để mồ côi:** ghi tệp vào storage → ghi bản ghi + lịch sử trong một lần lưu database. Storage lỗi thì chưa có bản ghi nào và API trả 503; database lỗi thì xóa tệp vừa ghi rồi mới báo lỗi (không xóa được thì ghi log kèm khóa object). Thiếu cấu hình `Storage` thì xem danh sách vẫn chạy, nộp/tải trả 503.
- **Tranh chấp:** chỉ mục duy nhất `(TopicId, Kind, Version)`; hai thành viên nộp cùng lúc được hai số phiên bản khác nhau (thử lại tối đa 3 lần).
- **Tải về:** `Content-Disposition: attachment`, `X-Content-Type-Options: nosniff`, CSP `sandbox`, `Cache-Control: private, no-store`. Tên tệp gốc được làm sạch (bỏ đường dẫn, ký tự điều khiển, tối đa 200 ký tự, luôn đuôi `.pdf`) và chỉ dùng để hiển thị/đặt tên khi tải.
- **Không giải mã nội dung PDF** (cần thêm thư viện): tệp có đủ chữ ký đầu/cuối nhưng ruột hỏng vẫn được nhận và chỉ lỗi khi mở. Không quét mã độc.
- **Tệp nằm trọn trong bộ nhớ** khi nộp và khi tải (tối đa 20 MB mỗi request), như ảnh đại diện; chưa stream.
- **Chưa chặn nộp trước ngày bắt đầu mốc:** PDR-041 chỉ quy định hạn cuối, nên bài nộp trước ngày bắt đầu mốc vẫn được nhận là đúng hạn.
- **Giao diện:** Không gian đề tài `/de-tai/[id]` (nhúng ở `/sv/de-tai`) có thêm mục "Báo cáo giữa kỳ và cuối kỳ" sau chặng Đề cương, gồm hai khối Báo cáo giữa kỳ/cuối kỳ (hạn, nhãn nộp trễ, lỗi không phải PDF/quá 20 MB, danh sách phiên bản, nút Tải). Trang Chi tiết đề tài của Giáo vụ, tab "Báo cáo và phiên bản", dùng cùng thành phần khi `NEXT_PUBLIC_ROUNDS_API=true`. Tab Cấu hình của Chi tiết đợt có ô "Hạn nộp trễ" dưới công tắc của từng mốc.

## Chưa làm

- **Quyền của Giảng viên phản biện và hội đồng:** chưa có dữ liệu phân công (P05/P06) nên hiện chỉ nhóm, GVHD và Giáo vụ đọc được. Thêm ở `SubmissionMapping.Load` khi có phân công.
- **Danh sách Nhóm hướng dẫn** chưa hiện cột báo cáo giữa kỳ/cuối kỳ; GVHD xem và tải báo cáo trong Không gian đề tài `/de-tai/[id]`.
- **Lịch sử thay đổi hạn trễ** của mốc (PDR-041): đợt chưa có bảng lịch sử cấu hình nên chưa ghi; nhóm thấy hạn hiện hành trên màn nộp bài.
- **Hạn bổ sung riêng cho nhóm** (PDR-011), chốt bản cuối và nhận xét: thuộc P04-S03.
- **Mốc Đề cương** dùng cùng hạn trễ riêng: P04-S01 nay nhận bài trong hạn trễ, gắn `Late` và trả `lateDeadline` (thay cho "sau hạn thường là đóng" của PDR-057). **Bản khóa luận** (P04-S03) dùng chung bảng `TopicSubmission` với `Kind = Thesis`.
- **Kiểm thử trên MinIO thật:** test tự động dùng storage giả trong bộ nhớ; luồng UI → proxy Next.js → API → MinIO với tệp gần 20 MB chưa được chạy.

## Hệ quả

- Migration `AddMilestoneLateDeadline` chỉ thêm cột cho phép null `RoundMilestones.LateEndDate`; báo cáo lưu trong bảng `TopicSubmissions` của PDR-057 (`Kind` = `Midterm`/`Final`, `VersionNo`, `Late`), không thêm bảng. Áp dụng có kiểm soát ở từng môi trường; không tự chạy trên Neon/dữ liệu dùng chung.
- **Đợt đang diễn ra có sẵn** bật "Cho nộp trễ" nhưng chưa có hạn trễ: sau hạn thường sẽ không nhận bài cho tới khi Giáo vụ đặt hạn trễ; lần lưu cấu hình mốc kế tiếp của đợt đó bắt buộc đặt hạn trễ hoặc tắt công tắc.
- Backup/restore phải gồm cả bucket và bảng `TopicSubmissions` (PDR-042).
- **Kiểm thử:** `SubmissionWorkflowTests` (handler trên SQLite: PDF/giả PDF/20 MB, quyền, đúng hạn/trễ/quá hạn theo giờ Việt Nam, giữ phiên bản sau kết thúc đợt, lỗi storage/database không để mồ côi, cấu hình hạn trễ), `TopicApiTests.GroupSubmitsReportsAndOnlyRelatedPeopleDownload` (hợp đồng HTTP), `SubmissionPanel.test.tsx` (giao diện).
