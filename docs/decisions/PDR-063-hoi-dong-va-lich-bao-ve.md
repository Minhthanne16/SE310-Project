# PDR-063: Hội đồng và lịch bảo vệ (P06-S01/S02/S03)

## Trạng thái

Đã chấp nhận ngày 2026-11-17 khi triển khai Phase 06. Bốn điểm tài liệu và canvas chưa thống nhất đã được người dùng chốt trực tiếp cùng ngày (mục "Quyết định của người dùng"). Quy tắc còn lại thực thi [PDR-014](PDR-014-chan-trung-phong-bao-ve.md)–[PDR-020](PDR-020-khoa-thay-thanh-vien-hoi-dong-sau-diem.md), [BUSINESS_RULES](../requirements/BUSINESS_RULES.md) và DESIGN 03 · Hội đồng bảo vệ, không đổi chúng. Các mục ghi "lựa chọn triển khai" do người làm task đề xuất; nhóm có thể đổi trong PDR sau. **Bổ sung 2026-11-23 ([PDR-070](PDR-070-vai-tro-giang-vien-trong-dot.md)): thành viên hội đồng chỉ chọn từ Giảng viên có vai trò Hội đồng trong đợt, lập hội đồng làm trong tab Đánh giá của đợt, và đề tài không xếp vào hội đồng có Chủ tịch hoặc Thư ký là GVHD của đề tài đó.**

## Bối cảnh

- [OQ-032](../OPEN_QUESTIONS.md) (GVPB có được ngồi hội đồng chấm cùng đề tài không) còn Mở và chặn P06-S01.
- Canvas `GiaoVu-HoiDong` đặt lịch bằng "Giờ bắt đầu + Phút mỗi đề tài" rồi tự tính giờ từng đề tài, trong khi [PDR-017](PDR-017-thoi-gian-tung-luot-bao-ve.md) yêu cầu Giáo vụ nhập giờ bắt đầu/kết thúc từng lượt, không áp một thời lượng chung (OQ-025 mục b).
- Canvas đặt một phòng cho cả hội đồng; [DOMAIN_MODEL](../architecture/DOMAIN_MODEL.md) ghi phòng thuộc lượt.
- Tài liệu chưa nói đề tài nào được xếp vào hội đồng.
- Canvas coi trùng phòng/giảng viên là "cảnh báo, còn cảnh báo thì không công bố"; PDR-014/015 đã chốt là **chặn lưu**. Theo [CONTENT.md](../CONTENT.md), PDR thắng canvas.

## Quyết định của người dùng

1. **OQ-032 — cho phép.** Giảng viên phản biện của một đề tài được làm Chủ tịch hoặc Thư ký hội đồng chấm chính đề tài đó. Chỉ GVHD bị chặn ngồi hội đồng chấm đề tài mình hướng dẫn (BUSINESS_RULES).
2. **Giờ từng lượt — kết hợp.** Mỗi lượt lưu giờ bắt đầu và kết thúc riêng (PDR-017). Màn sửa có công cụ "Điền giờ tự động" (giờ bắt đầu + số phút, 10–180) chỉ để điền sẵn; Giáo vụ sửa được từng lượt và máy chủ không áp thời lượng chung.
3. **Một phòng mỗi hội đồng.** Hội đồng có một ngày bảo vệ và một phòng; mọi lượt dùng phòng đó. Trùng phòng xét theo khoảng giờ từng lượt (PDR-014/017).
4. **Đề tài được xếp:** đề tài có nhóm, chưa kết thúc (`Đã hoàn tất`, `Không đủ điều kiện công bố`, `Không có nhóm`) và **đã được GVHD duyệt đề cương**. Không bắt buộc đã có GVPB hay đã nộp báo cáo cuối kỳ; màn hình hiện lý do khi chưa đủ điều kiện.

## Quy tắc thực thi

### Hội đồng và thành viên (P06-S01)

- Hội đồng có đúng một Chủ tịch và một Thư ký, là hai giảng viên khác nhau, đang hoạt động và thuộc danh sách giảng viên của đợt. Ràng buộc `CK_DefenseCouncils_ChairNotSecretary` chặn thêm ở database.
- Trạng thái: `Nháp` (chỉ Giáo vụ thấy) → `Đã công bố` → `Đã hủy` (PDR-019). Chỉ xóa được hội đồng Nháp; hội đồng đã công bố/đã hủy không xóa vật lý.
- Mỗi đề tài tối đa **một lượt có hiệu lực** (PDR-016): chỉ mục duy nhất có lọc `IX_DefenseSlots_ActiveTopic` (`TopicId` khi `Status = 'Active'`). Lượt bị bỏ khỏi hội đồng đã công bố chuyển `Removed`, lượt của lịch đã hủy chuyển `Cancelled`; cả hai được giữ để tra cứu.
- **Khóa sau điểm (PDR-018/019/020):** cột `DefenseCouncils.FirstScoredAt` là dấu khóa, như `ReviewerFirstScoredAt` của PDR-062. P07 phải đặt giá trị này bằng một câu `UPDATE … WHERE FirstScoredAt IS NULL` trong **cùng transaction** với phiếu điểm hội đồng đầu tiên. Từ đó: không sửa giờ/phòng/ngày/thành viên/đề tài, không hủy lịch; chỉ ghi đính chính. Trước P07 cột luôn rỗng.
- Không gỡ được giảng viên khỏi đợt khi đang là Chủ tịch/Thư ký của hội đồng chưa hủy trong đợt (mở rộng PDR-030). Tài khoản là thành viên hội đồng hoặc GVPB tính là "đã có dữ liệu" nên chỉ bị vô hiệu hóa (bổ sung PDR-004).

### Lịch và xung đột (P06-S02)

- Mỗi lượt có giờ `HH:mm`, giờ kết thúc sau giờ bắt đầu (cũng là ràng buộc `CK_DefenseSlots_EndAfterStart`). Các lượt trong một hội đồng theo đúng thứ tự và không chồng nhau; hai lượt chỉ chạm nhau ở đầu/cuối không chồng lấn (PDR-017).
- **Chặn lưu và chặn công bố** (PDR-014/015) khi, trên cùng ngày, có hội đồng chưa hủy khác (Nháp hoặc đã công bố, **kể cả đợt khác**) mà một lượt chồng lấn với một lượt của hội đồng đang lưu và:
  - cùng phòng (so khớp không phân biệt hoa thường và khoảng trắng thừa), hoặc
  - có chung Chủ tịch/Thư ký, bất kể vai trò ở mỗi hội đồng.
- Lỗi nêu rõ phòng hoặc giảng viên, hội đồng gây xung đột (kèm tên đợt nếu khác đợt) và khung giờ, ví dụ "Phòng B4.12 trùng giờ với Hội đồng 1 (07:30–09:00).".
- **Đồng thời:** mọi thao tác ghi lịch chạy dưới một khóa advisory PostgreSQL (`pg_advisory_xact_lock`) rồi kiểm tra lại trên dữ liệu mới nhất, nên hai Giáo vụ lưu lịch trùng cùng lúc chỉ một bên thắng. Sửa hội đồng dùng `expectedVersion`: lệch thì 409 "Hội đồng vừa được người khác sửa. Tải lại rồi thử lại.".
- **Sửa lịch đã công bố trước điểm (PDR-018):** bắt buộc lý do (400 nếu thiếu); kiểm tra lại toàn bộ xung đột; lịch sử hội đồng ghi "Trước: … / Sau: …" để lịch cũ vẫn tra cứu được; lịch sử đề tài (nhóm "Lịch bảo vệ") ghi "Đổi lịch bảo vệ", "Xếp lịch bảo vệ", "Bỏ khỏi lịch bảo vệ", "Đổi thành viên hội đồng"; thông báo người bị ảnh hưởng.
- **Hủy lịch đã công bố trước điểm (PDR-019):** bắt buộc lý do; lịch giữ trạng thái `Đã hủy`, đề tài quay về kho chưa xếp và xếp lại được vào hội đồng khác; hủy lặp, hủy lịch Nháp hoặc hủy sau điểm trả 409.
- **Đính chính sau điểm (PDR-018):** chỉ khi hội đồng đã công bố và đã có điểm; nội dung (≤ 2000) và lý do (≤ 800) bắt buộc; lịch gốc giữ nguyên; đính chính hiện ở màn Giáo vụ, màn Hội đồng của GV và aside Không gian đề tài. Trước điểm trả 409 "sửa lịch trực tiếp".

### Công bố và góc nhìn người tham gia (P06-S03)

- Công bố theo lô của đợt (mọi hội đồng Nháp) hoặc theo danh sách id. Mỗi hội đồng một transaction: kiểm tra lại xung đột và điều kiện đề tài lúc công bố; hội đồng chưa có đề tài hoặc còn xung đột được bỏ qua kèm lý do; hội đồng hợp lệ vẫn được công bố.
- Công bố lặp: không tạo lịch sử hay thông báo mới (cập nhật có điều kiện `Status = Draft`).
- Thông báo loại `schedule` cùng transaction với thay đổi:
  - Chủ tịch, Thư ký nhận "Bạn là {vai trò} {hội đồng}: {ngày}, phòng {phòng}, {n} đề tài." (liên kết `/gv/hoi-dong`);
  - thành viên nhóm, GVHD, GVPB của từng đề tài nhận "Lịch bảo vệ DT-xxx: {ngày} {giờ}, phòng {phòng} ({hội đồng})." (liên kết `/de-tai/{id}`);
  - sửa, hủy, đính chính gửi cho người bị ảnh hưởng, gồm thành viên bị thay.
- **Quyền xem:**
  - Hội đồng Nháp chỉ Giáo vụ thấy (cả trong chi tiết đề tài, đánh dấu chưa công bố).
  - Sau công bố, `GET /api/topics/{id}` trả `defense` cho thành viên nhóm, GVHD, GVPB và hội đồng.
  - Chủ tịch/Thư ký của hội đồng đã công bố có lượt có hiệu lực của đề tài được **chỉ xem** đề tài, đề cương, bài nộp (`viewerRole = "council"`); người khác nhận 404.
  - Lịch đã hủy không còn hiện trong `defense` của đề tài; giảng viên hội đồng vẫn thấy hội đồng đã hủy (kèm lý do) ở `/gv/hoi-dong`.

## Hợp đồng API

Gốc `api/councils`, mọi endpoint yêu cầu đăng nhập; lỗi dùng `ApiResponse`. Ngày `yyyy-MM-dd`, giờ `HH:mm` (giờ Việt Nam).

| Method + route | Vai trò | Body | Thành công | Lỗi |
| --- | --- | --- | --- | --- |
| `GET /?roundId=` | Giáo vụ | — | 200 `CouncilBoardDto` | 401, 403, 404 |
| `POST /check` | Giáo vụ | `CouncilInputDto` + `councilId?` | 200 `{ ok, problems[] }` (không lưu) | 400, 401, 403, 404 |
| `POST /` | Giáo vụ | `CouncilInputDto` | 201 `CouncilDto` | 400, 404, 409 `errors[]` |
| `PUT /{id}` | Giáo vụ | `CouncilInputDto` (bắt buộc `expectedVersion`; `reason` khi đã công bố) | 200 `CouncilDto` | 400, 404, 409 |
| `DELETE /{id}` | Giáo vụ | — | 200 `true` | 404, 409 đã công bố/đã hủy |
| `POST /publish` | Giáo vụ | `{ roundId, councilIds? }` | 200 `{ published, skipped, results[{ councilId, name, ok, message }] }` | 400, 404 |
| `POST /{id}/cancel` | Giáo vụ | `{ reason }` | 200 `CouncilDto` | 400, 404, 409 |
| `POST /{id}/corrections` | Giáo vụ | `{ content, reason }` | 200 `CouncilDto` | 400, 404, 409 |
| `GET /mine?roundId=` | Giảng viên | — | 200 `MyCouncilsDto` | 401, 403 |

- **`CouncilInputDto`:** `{ roundId, name, chairId, secretaryId, date, room, slots[{ topicId, start, end }], expectedVersion?, reason? }`. Thứ tự `slots` là thứ tự bảo vệ.
- **`CouncilDto`:** `{ id, roundId, name, status, version, chair, secretary, date, room, publishedAt, cancelledAt, cancelReason, scored, slots[], conflicts[], corrections[], history[], canEdit, editBlockedReason, canDelete, canPublish, publishBlockedReason, canCancel, canCorrect }`.
  - `slots[]`: `{ id, order, topicId, code, title, group[], supervisor, reviewer, start, end, thesisVersionCount, finalLocked, status }`.
  - `conflicts[]`: xung đột hiện tại, chỉ tính cho hội đồng Nháp hoặc đã công bố chưa có điểm.
- **`CouncilBoardDto`:** `{ round{ id, name, status, defenseStart, defenseEnd }, councils[], pool[{ topicId, code, title, group, supervisor, reviewer, thesisVersionCount, eligible, blockedReason }], lecturers[], stats{ councils, total, scheduled, unscheduled, conflicts } }`.
- **`MyCouncilsDto`:** `{ rounds[], roundId, councils[{ id, name, status, myRole: chair|secretary, chair, secretary, date, room, cancelReason, slots[], corrections[] }] }`; chỉ hội đồng đã công bố hoặc đã hủy.
- **`TopicDetailDto.defense`** (bổ sung `GET /api/topics/{id}`): `{ councilId, council, councilPublished, chair, secretary, date, start, end, room, order, corrections[] }`, với `start`/`end` dạng `yyyy-MM-ddTHH:mm:ss` như `TopicDefense` phía frontend.
- **`OutlineDto.viewerRole`** thêm `council`.

## Lựa chọn triển khai

- **Tên hội đồng** do Giáo vụ đặt (≤ 100 ký tự), không trùng trong đợt (không phân biệt hoa thường, khoảng trắng thừa), trừ hội đồng đã hủy. Phòng ≤ 50 ký tự. Tối đa 30 đề tài mỗi hội đồng.
- **Công bố cần ít nhất một đề tài.** Hội đồng rỗng vẫn lưu được ở Nháp (canvas "Hội đồng mới (chưa có đề tài)").
- **Ngày bảo vệ ngoài mốc 7 "Lịch bảo vệ" không bị chặn.** Màn sửa gợi ý khoảng ngày của mốc; dùng ô chọn ngày của trình duyệt thay cho lịch tháng tự dựng của canvas.
- **Một `viewerRole = council`** cho cả Chủ tịch và Thư ký, vì trước P07 quyền của hai vai trò như nhau (chỉ xem). [plan/khong-gian-de-tai.md](../plan/khong-gian-de-tai.md) mục B3 đề xuất tách `councilChair`/`councilSecretary`; P07 tách khi cần quyền nhập điểm của Thư ký. Tab mặc định vẫn là Hoạt động, như GVPB hiện nay.
- **Lịch sử hội đồng** lưu ở bảng `DefenseCouncilLogs` (tạo, sửa, công bố, hủy, đính chính; người, thời điểm, lý do, mô tả lịch trước/sau). Lịch sử đề tài chỉ ghi các sự kiện đã công bố (nhóm "Lịch bảo vệ"); thao tác trên hội đồng Nháp không ghi vào lịch sử đề tài vì chưa ai ngoài Giáo vụ thấy.
- **Màn Hội đồng của GV**: cột "Điểm hội đồng" hiện "Chưa nhập điểm" / "Thư ký chưa nhập" cho tới khi có phiếu ở P07; nút "Mở" dẫn tới Không gian đề tài. Chưa hiển thị bộ lọc theo điểm trong P06 vì API chưa có trạng thái điểm từng lượt; triển khai bộ lọc cùng phiếu điểm ở P07.

## Hệ quả

- Migration `AddDefenseCouncils` chỉ thêm ba bảng `DefenseCouncils`, `DefenseSlots`, `DefenseCouncilLogs` cùng ràng buộc và chỉ mục nêu trên; `Down` xóa đúng ba bảng đó. Xóa đợt Nháp xóa theo hội đồng (cascade). Áp dụng có kiểm soát ở từng môi trường; không tự chạy trên Neon/dữ liệu dùng chung.
- **Kiểm thử:**
  - `CouncilWorkflowTests` + `CouncilRulesTests`: handler thật trên SQLite, 41 ca, gồm biên chồng lấn, liền kề, bao trùm, xung đột khác đợt, sửa/hủy/đính chính trước và sau điểm, quyền xem.
  - `CouncilApiTests`: hợp đồng HTTP, 401/403/400/404/409.
  - `CouncilConcurrencyTests`: PostgreSQL thật qua `app/scripts/test-ghi-danh.ps1` (hai lịch trùng phòng/giảng viên/đề tài lưu cùng lúc, thay thành viên đua với phiếu đầu tiên, ràng buộc của migration). Đạt ngày 2026-11-17 trên PostgreSQL 17.
  - Frontend: `councilDraft`, `councilService`, `CouncilBoardPage`, `LecturerCouncilPage`, `WorkspaceAside`.
- **P07** phải đặt `FirstScoredAt` cùng transaction với phiếu hội đồng đầu tiên, và dùng `CouncilDto.chair/secretary` của lượt có hiệu lực khi xác định ai nhập phiếu CTHĐ/TKHĐ.
