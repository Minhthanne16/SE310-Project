# Plan code: Thay đổi 23/11 (PDR-065..071), ưu tiên trang Giáo vụ

**Người đọc:** agent viết code (Gemini). Plan này tự đủ ngữ cảnh: đọc từ đầu đến cuối trước khi sửa file nào.
**Lập ngày:** 2026-11-23, trên repo local (nhánh hiện tại `phuc`). Tạo nhánh mới `feat/giao-vu-23-11` từ nhánh hiện tại.
**Phạm vi:** code các quyết định PDR-065..071. **Phần A (Giáo vụ) làm trước, làm hết A rồi mới sang B.** Phần B (Giảng viên, Sinh viên) và phần C (phụ thuộc chức năng chấm điểm chưa có) chỉ làm khi người dùng yêu cầu.

---

## 0. Luật chơi (bắt buộc)

1. Đọc `AGENTS.md`, `CLAUDE.md` (chỉ có ở máy local), `docs/CONTENT.md`, `docs/OPEN_QUESTIONS.md`, `docs/DESIGN.md` trước khi code. Ít nhất phải đọc các file ở mục 2.
2. **Thứ tự ưu tiên khi lệch nguồn:** PDR mới hơn > `docs/requirements/` > `docs/DESIGN/03` > canvas. Canvas chỉ quyết định cách trình bày.
3. **Code giao diện: đọc canvas trước rồi mới code** (artboard ở mục 4). Không mở được canvas thì dùng mô tả ở mục 4 và `docs/DESIGN/03-dac-ta-man-hinh.md`.
4. Không đoán endpoint. Mở controller/DTO backend tương ứng (mục 3) trước khi gọi API. Mọi thay đổi hợp đồng API sửa cả hai phía trong cùng commit, có test.
5. CSS: không viết hex/rgb mới, không `style={{}}` cho màu/cỡ chữ/bo góc; dùng `var(--…)` trong `:root` của `app/frontend/src/index.css` và lớp `app-*`/`rnd-*` sẵn có. Biểu tượng dùng `lucide-react`. Vùng bấm ≥ 40px. Kết quả thao tác dùng `toast`, lý do bị khóa dùng banner `role="note"`, lỗi form giữ tại chỗ (PDR-056).
6. **Quy tắc design (người dùng chốt 23/11):** không dồn mọi thứ lên một trang. Dùng danh sách gọn; bấm một dòng thì mở side panel (drawer bên phải), popup hoặc thẻ mở rộng để xem/sửa. Một chức năng xuất hiện ở hai nơi thì **dùng chung một component**, khác nhau bằng prop. Hạn chế chữ hướng dẫn (tip text): chỉ giữ câu nói lý do bị khóa hoặc lỗi.
7. Không tự chạy migration/seed trên Neon. Tạo migration bằng `dotnet ef migrations add` để người dùng review; không `database update`. Không commit `.env`. Không push `main`. Commit nhỏ theo từng bước dưới đây, thông điệp kiểu `feat(backend): …`, `feat(frontend): …`, `docs: …`.
8. Không tạo file patch, bundle hay file phụ ngoài repo. Code thẳng vào working tree.
9. File trong repo dùng CRLF; giữ nguyên kiểu xuống dòng của file đang sửa. Working tree đang có nhiều file "đã sửa" chỉ do CRLF: **không commit các file đó** nếu nội dung không đổi (`git diff --ignore-cr-at-eol` để kiểm).
10. Gặp điều plan không nói và tài liệu cũng không nói: **dừng, ghi câu hỏi vào mục 9 của file này**, không tự đặt quy tắc nghiệp vụ.

**Bước 0 trước khi code:** working tree đang chứa phần docs chưa commit (PDR-065..071, OQ-033, sửa BUSINESS_RULES/ROLES/WORKFLOWS/DOMAIN_MODEL/STRUCTURE/DESIGN-03, plan). Commit riêng thành một commit `docs: PDR-065..071 thay đổi 23/11` trên nhánh mới, chỉ gồm file có nội dung đổi thật.

---

## 1. Thứ tự làm

| Bước | Nội dung | PDR | Ghi chú |
| --- | --- | --- | --- |
| A1 | Backend: cấu hình đợt mới (số SV tối đa, cấu hình điểm, mặc định theo chương trình, khóa khi mở) | 065, 069 | nền cho A3, A5 |
| A2 | Backend: mốc nới quy tắc, mở đợt khi đủ 3 mốc đầu | 067 | |
| A3 | Frontend tab **Cấu hình** của Chi tiết đợt: số SV tối đa, Tự điền 9 mốc, cảnh báo + gợi ý ngày | 067, 069 | |
| A4 | Backend + Frontend tab **Giảng viên**: 3 ô tick HD/PB/HĐ, nhập Excel vai trò | 070 | |
| A5 | Frontend tab **Đánh giá**: 4 mục con Cấu hình điểm, Mẫu phiếu, Phản biện, Hội đồng | 065, 070 | |
| A6 | Component dùng chung Phản biện / Hội đồng + 2 trang lẻ chỉ xem | 070 | làm cùng A5 |
| A7 | Chặn GVHD chấm đề tài mình hướng dẫn, lọc GV theo vai trò | 070 | backend + frontend |
| A8 | Trang chủ Giáo vụ: khối "Cần xử lý" + thẻ đợt có số liệu nhanh | 071 | |
| B1 | GV gửi đề tài kèm mã SV giữ chỗ; SV xác nhận/từ chối | 068 | sau A |
| B2 | Trang chủ GV 4 khối gộp nhãn HD/PB/HĐ | 071 | sau A |
| C1 | Lệch điểm trên phiếu, chặn lưu, cờ, thông báo | 066 | cần phase 07 (phiếu chấm) có trước |

---

## 2. Tài liệu phải đọc

| File | Lấy gì |
| --- | --- |
| `docs/decisions/PDR-065-cau-hinh-diem-theo-dot.md` | hệ số CT/TK/HD/PB, ngưỡng lệch, làm tròn, xếp loại, khóa khi mở, mặc định chương trình |
| `docs/decisions/PDR-066-lech-diem-so-voi-diem-khoa-luan.md` | chỉ cần cho A8 (đếm "có lệch") và C1 |
| `docs/decisions/PDR-067-tu-dien-moc-va-mo-dot-khi-du-ba-moc-dau.md` | độ dài mốc, quy tắc thứ tự, mở đợt khi đủ 3 mốc |
| `docs/decisions/PDR-068-gv-gui-de-tai-kem-sinh-vien-giu-cho.md` | B1 |
| `docs/decisions/PDR-069-so-sinh-vien-toi-da-moi-nhom.md` | tối đa mặc định 2, tối thiểu luôn 1 |
| `docs/decisions/PDR-070-vai-tro-giang-vien-trong-dot.md` | 3 vai trò, nhập xlsx, trang lẻ chỉ xem, tab Đánh giá |
| `docs/decisions/PDR-071-trang-chu-giao-vu-va-giang-vien.md` | khối Cần xử lý, số liệu thẻ đợt, Trang chủ GV |
| `docs/decisions/PDR-062-…`, `PDR-063-…` | phân công phản biện, hội đồng đang chạy (đã có ghi chú trạng thái 23/11) |
| `docs/requirements/BUSINESS_RULES.md`, `ROLES.md`, `WORKFLOWS.md`, `DOMAIN_MODEL.md` | đã sửa theo PDR-065..071 |
| `docs/DESIGN/03-dac-ta-man-hinh.md` mục Chi tiết đợt, Phản biện, Hội đồng, Trang chủ | prop/trạng thái màn hình |
| `docs/OPEN_QUESTIONS.md` OQ-033 | các chi tiết còn tạm |

---

## 3. Bản đồ mã hiện có

**Backend** (`app/backend/src/`):
- `Backend.Domain/Entities/Rounds/ThesisRound.cs`: `ThesisRound` (Status Draft/Running/Finished, `Program`, `LecturerLoadMin/Max`, `Milestones` 9 `MilestoneKey`), `RoundMilestone`, `RoundParticipant` (UserId, Kind Lecturer/Student, **chưa có cờ vai trò**). Chưa có trường số SV tối đa, chưa có cấu hình điểm.
- `Backend.Application/Rounds/RoundRequests.cs`: `RoundRules.ValidateMilestones` (khoảng dòng 160) báo lỗi khi start > end và khi start mốc sau < start mốc trước.
- `Backend.Application/Rounds/RoundHandlers.cs`: `OpenRoundHandler` (khoảng dòng 328) đang gọi `ValidateMilestones(requireAll: true)`, tức đòi đủ 9 mốc.
- `Backend.API/Controllers/Rounds/RoundsController.cs`: `GET/POST /rounds`, `PUT /{id}`, `PUT /{id}/milestones`, `POST /{id}/open|finish|topics/publish`, `GET people/{kind}`, `GET /{id}/{kind}/candidates`, `POST /{id}/{kind}/check`, `POST /{id}/{kind}`, `DELETE /{id}/{kind}/{userId}`.
- `Backend.Domain/Entities/Evaluations/ThesisScore.cs`: công thức cứng `(CT + TK + 2HD + 2PB)/6`.
- `Backend.Domain/Entities/Evaluations/EvaluationTemplate.cs`: `EvaluationTemplateAssignment` (RoundId **kiểu string**, Role `GradingRole` Supervisor/Reviewer/Committee, TemplateId). API ở `Controllers/Evaluations/EvaluationTemplatesController.cs`: `GET assignments`, `PUT assignments/{roundId}/{role}`, `DELETE assignments/{roundId}/{role}`.
- `Backend.Application/Reviewers/ReviewerRules.cs`: đã chặn GVHD làm PB (`SupervisorMessage`), gợi ý PB lấy GV `Active` khác GVHD.
- `Backend.Application/Councils/CouncilRules.cs` (khoảng dòng 142): đã báo lỗi khi GVHD ngồi hội đồng chấm đề tài mình.
- `Controllers/Topics/ReviewerAssignmentsController.cs`, `Controllers/Councils/CouncilsController.cs` (`GET`, `POST check`, `POST`, `PUT {id}`, `DELETE {id}`, `POST publish`, `POST {id}/cancel`, `POST {id}/corrections`, `GET mine`).
- `Controllers/Statistics/StatisticsController.cs` `GET /api/statistics/{roundId}`: `RoundStatisticsDto` (Items, Loads, Students; `GradesAvailable` luôn false).
- Migration mới nhất: `Backend.Infrastructure/Data/Migrations/20261117124114_AddDefenseCouncils`.

**Frontend** (`app/frontend/`):
- Route giáo vụ: `app/(protected)/giao-vu/` gồm `page.tsx` (Trang chủ), `dot/`, `dot/[id]/`, `phan-bien/`, `hoi-dong/`, `phieu-danh-gia/`, `de-tai/`, `nguoi-dung/`, `thong-ke/`. Menu ở `src/features/navigation/menuConfig.ts`.
- `src/features/rounds/components/`: `RoundDetailPage.tsx` (6 tab `tien-do|cau-hinh|giang-vien|sinh-vien|de-tai|danh-gia`, tham số URL `tab`), `RoundConfigTab.tsx`, `RoundParticipantsTab.tsx`, `AddParticipantsDialog.tsx`, `RoundEvaluationTab.tsx` (hiện là các thẻ dẫn sang trang lẻ), `RoundHomePage.tsx` (Trang chủ = thẻ đợt), `RoundGantt.tsx`. Kiểm tra mốc ở `src/features/rounds/roundValidation.ts`. Service `roundApiService`/`roundDemoService`.
- `src/features/reviewers/components/ReviewerAssignmentPage.tsx` (~660 dòng), `reviewerDraft.ts`.
- `src/features/councils/components/CouncilBoardPage.tsx` (~658), `CouncilEditor.tsx`, `CouncilDetail.tsx`, `CouncilReasonDialog.tsx`, `councilDraft.ts`.
- `src/features/evaluations/components/EvaluationTemplatePage.tsx`, `RoundAssignmentList.tsx`, `TemplateDrawer.tsx` (mẫu cho kiểu "danh sách trước, bấm mở drawer").
- Kiểu dữ liệu ở `src/types/round.ts`, `src/types/evaluation.ts`.
- Test: vitest (`npm run test`), lint oxlint (`npm run lint`), typecheck (`npm run typecheck` hoặc `tsc --noEmit`, xem `package.json`).

---

## 4. Màn hình cần đạt (tóm tắt canvas)

Canvas: https://claude.ai/artifact/J23aEMjV4mBv6DZ2mB8HWr (bản 327). Artboard liên quan: `GiaoVu-DotKhoaLuan`, `PhanBienPanel`, `HoiDongPanel`, `GiaoVu-PhanBien`, `GiaoVu-HoiDong`, `TrangChu` (vai giáo vụ). Mô tả dưới đây trích từ bản 327.

**Chi tiết đợt, tab Cấu hình**
- Khối thông tin chung thêm ô **"Số SV tối đa mỗi nhóm"** (số, mặc định 2; ghi rõ tối thiểu là 1). Khóa khi đợt không còn Nháp.
- Khối mốc: ô "Ngày bắt đầu" + nút **"Tự điền 9 mốc"**. Bảng 9 mốc vẫn sửa từng ô. Khi ngày bắt đầu một mốc sớm hơn ngày bắt đầu mốc trước: hiện lỗi ngay dòng đó + nút "Dùng ngày gợi ý" (đặt bằng ngày bắt đầu mốc trước). Mốc trùng ngày bắt đầu là hợp lệ.
- Nút "Mở đợt" bật khi đủ 3 mốc đầu; 6 mốc còn lại để trống được và vẫn sửa được sau khi mở.

**Chi tiết đợt, tab Giảng viên**
- Bảng GV của đợt thêm 3 cột tick **HD / PB / HĐ** (mặc định HD khi thêm GV). Bỏ tick HD khi GV đã có đề tài thì chặn, nói lý do.
- Nút **"Nhập vai trò từ Excel"**: chọn file → bảng xem trước (dòng hợp lệ, dòng lỗi có lý do) → "Áp dụng". Dòng lỗi bị bỏ qua.

**Chi tiết đợt, tab Đánh giá** (4 mục con, dạng tab nhỏ hoặc segmented, lưu ở URL `?tab=danh-gia&muc=…`):
1. **Cấu hình điểm:** 4 ô hệ số (CT, TK, HD, PB), ngưỡng lệch, làm tròn 2 chữ số (chỉ hiển thị), bảng xếp loại (chỉ hiển thị), một dòng ví dụ tính điểm. Ô tick "Lưu làm mặc định cho chương trình …". Nút Lưu. Khóa khi đợt không còn Nháp (banner `role="note"` nói lý do).
2. **Mẫu phiếu:** danh sách gọn 3 dòng vai trò (GV hướng dẫn, GV phản biện, Thành viên hội đồng), mỗi dòng ghi mẫu phiếu đang gán (hoặc "Chưa gán"). Bấm dòng mở **side panel**: chọn mẫu phiếu (chỉ mẫu đã ban hành), Lưu/Gỡ. Đọc mẫu và phép gán từ API `evaluation-templates`. Khóa sửa khi đợt không còn Nháp (theo quy tắc gán mẫu hiện có, kiểm `EvaluationTemplateRequests.cs`).
3. **Phản biện:** nhúng `ReviewerPanel` (mục A6) ở chế độ sửa: hàng lọc trên danh sách có nút **"Tự gợi ý"** và **"Lưu"**; danh sách chờ phân công ngay dưới.
4. **Hội đồng:** nhúng `CouncilPanel` (mục A6) ở chế độ sửa: **danh sách hội đồng toàn bề rộng trước** (tên, ngày, phòng, CT, TK, số đề tài, trạng thái), nút **"Tạo hội đồng"** và **"Công bố lịch bảo vệ"** trên danh sách. Bấm một dòng hoặc "Tạo hội đồng" mở **drawer bên phải** chứa phần xem/sửa (thành viên, lịch, phòng, xếp đề tài). Cách làm giống `EvaluationTemplatePage` + `TemplateDrawer`.

**Trang lẻ `/giao-vu/phan-bien` và `/giao-vu/hoi-dong`:** dùng đúng `ReviewerPanel` / `CouncilPanel` ở chế độ **chỉ xem**, bộ lọc đợt mặc định **"Tất cả đợt đang diễn ra"**, mỗi dòng có nút "Mở tab Đánh giá" dẫn tới `/giao-vu/dot/{id}?tab=danh-gia&muc=phan-bien|hoi-dong`. Không có nút sửa, select/checkbox bị disable. Không có banner hướng dẫn dài.

**Trang chủ Giáo vụ** (`/giao-vu`):
- Trên cùng: khối **"Cần xử lý"**: mỗi dòng là một loại bất thường, gồm tên đợt, số lượng, nút mở đúng chỗ (đã lọc đợt). Không có dòng nào thì khối ghi "Không có việc cần xử lý".
- Bên dưới: thẻ đợt như hiện nay, thêm trạng thái đợt, mốc đang chạy, số liệu nhanh: số đề tài, SV có nhóm / tổng SV, đề tài đã phân công PB, đề tài đã có điểm, đề tài có lệch. Bấm thẻ vào Chi tiết đợt như cũ.

---

## 5. Các bước Phần A (Giáo vụ)

### A1. Backend: cấu hình đợt (PDR-065, PDR-069)

1. `ThesisRound` thêm:
   - `MaxGroupSize` (int, mặc định 2, hợp lệ 1..10; tối thiểu nhóm luôn là 1, không lưu).
   - Cấu hình điểm: `WeightChair`, `WeightSecretary`, `WeightSupervisor`, `WeightReviewer` (decimal, mặc định 1, 1, 2, 2), `DeviationThreshold` (decimal, mặc định 2). Làm tròn 2 chữ số và bảng xếp loại là cố định theo PDR-065: để thành hằng số trong Domain, không lưu cột, trừ khi PDR-065 nói khác.
   - Có thể gom thành owned type `RoundGradingConfig` (EF `OwnsOne`), tùy cách code sẵn có; giữ tên cột rõ.
2. Mặc định theo chương trình: bảng mới `ProgramRoundDefaults` (khóa `Program`, các cột như trên + `MaxGroupSize`, `UpdatedAt`, `UpdatedById`). Khi tạo đợt: lấy mặc định của chương trình nếu có, không có thì dùng hằng số. Ai sửa mặc định và lưu ở đâu là OQ-033(e): tạm cho Giáo vụ sửa qua ô tick "Lưu làm mặc định" khi lưu cấu hình đợt. Ghi rõ trong code bằng `// OQ-033(e)`.
3. `ThesisScore`: thêm `Calculate(chair, secretary, supervisor, reviewer, RoundGradingConfig cfg)` tính trung bình có hệ số, làm tròn 2 chữ số nửa lên. Hàm cũ giữ lại, gọi hàm mới với hệ số mặc định. Thêm `ThesisGrade.Classify(decimal score)` trả `Xuất sắc` (≥ 9,00), `Giỏi` (≥ 8,00), `Khá` (≥ 7,00), `Trung bình` (≥ 5,00), `Không đạt` (< 5,00).
4. API:
   - `RoundDto` thêm `maxGroupSize`, `grading { weightChair, weightSecretary, weightSupervisor, weightReviewer, deviationThreshold }`.
   - `PUT /rounds/{id}` nhận thêm `maxGroupSize`. Nếu đợt không còn Draft và giá trị đổi: trả lỗi nghiệp vụ "Đợt đã mở, không sửa số sinh viên tối đa." (dùng kiểu lỗi đang có của `TopicResult`/`RoundResult`).
   - Endpoint mới `PUT /rounds/{id}/grading` body `{ weights…, deviationThreshold, saveAsProgramDefault: bool }`. Chỉ khi Draft. Kiểm: mỗi hệ số > 0 và ≤ 10, ngưỡng > 0 và ≤ 10.
   - `GET /rounds/defaults/{program}` trả mặc định (để form tạo đợt điền sẵn nếu cần).
5. Đăng ký nhóm/ghi danh: chỗ nào đang dùng số SV tối đa cố định (tìm `MaxMembers`, `2` trong `Topics`), đổi sang `round.MaxGroupSize`. GV **không** đặt số SV riêng cho từng đề tài (PDR-069): nếu `ThesisTopic`/DTO đề tài đang có trường số SV, giữ dữ liệu cũ nhưng thôi dùng trong kiểm tra, ghi `// PDR-069`.
6. Migration `AddRoundGradingConfigAndGroupSize` (chỉ tạo, không chạy). Đợt cũ nhận giá trị mặc định.
7. Test (`app/backend/tests/…`, theo cấu trúc test sẵn có): tính điểm có hệ số (ví dụ 8, 7, 9, 6 với 1,1,2,2 → 7,50), xếp loại ở các ngưỡng biên, sửa cấu hình khi Running bị chặn, tạo đợt lấy mặc định chương trình.

### A2. Backend: mốc (PDR-067)

1. `RoundRules.ValidateMilestones`: giữ "start ≤ end" của mỗi mốc; thứ tự: ngày bắt đầu mốc sau **không được sớm hơn** ngày bắt đầu mốc trước (bằng nhau hợp lệ). Mốc còn trống (chưa có ngày) bỏ qua khi so thứ tự; so với mốc có ngày gần nhất phía trước. Ngoại lệ: mốc 8 "Cho điểm" bắt đầu cùng mốc 6 nên so với mốc 6, không so với mốc 7. Đọc lại PDR-067 để chắc chắn trước khi code.
2. `OpenRoundHandler`: thay `requireAll: true` bằng điều kiện **đủ 3 mốc đầu** (`TopicSubmission`, `TopicRegistration`, `Outline`), các mốc khác nếu đã nhập thì vẫn phải hợp lệ. Thông báo lỗi: "Cần nhập đủ 3 mốc đầu (Gửi đề tài, Đăng ký, Đề cương) trước khi mở đợt."
3. `PUT /rounds/{id}/milestones` khi Running: cho thêm và sửa các mốc chưa bắt đầu. Kiểm hành vi hiện tại; nếu đang chặn sửa khi Running thì nới theo PDR-067 và ghi rõ: mốc đã bắt đầu thì giữ nguyên quy tắc hiện có (xem PDR-007/008 ghi chú 23/11).
4. Các chỗ đọc mốc giả định đủ 9 mốc (Gantt, nhắc mốc, job `ThesisFinalizationJob`, thống kê): xử lý mốc chưa có ngày, không ném lỗi.
5. Test: mở đợt với 3 mốc, mở đợt thiếu mốc 3 bị chặn, hai mốc trùng ngày bắt đầu hợp lệ, mốc sau sớm hơn bị chặn, mốc 8 bắt đầu cùng mốc 6 hợp lệ.

### A3. Frontend tab Cấu hình (PDR-067, PDR-069)

1. `src/types/round.ts`: thêm `maxGroupSize`, `grading`. Cập nhật `roundApiService` và `roundDemoService` (demo giữ khớp hợp đồng mới).
2. Hàm thuần mới `src/features/rounds/milestoneAutofill.ts`:
   - `MILESTONE_WEEKS = [2, 2, 2, 4, 4, 2, 2, 4, 2]` (một chỗ duy nhất, chú thích `// OQ-033(a): giá trị tạm`).
   - `autofillMilestones(startIso)`: mốc 1 bắt đầu tại ngày nhập; mốc i bắt đầu **đúng ngày kết thúc** mốc i−1; riêng mốc 8 bắt đầu cùng mốc 6, mốc 9 bắt đầu tại ngày kết thúc mốc 7; ngày kết thúc = ngày bắt đầu + số tuần × 7 ngày. (Khớp hàm `fillAuto` trong canvas.)
   - `suggestStart(milestones, index)`: trả ngày gợi ý cho mốc bị xung đột.
   - Test vitest cho cả hai hàm, gồm năm nhuận và đổi tháng.
3. `roundValidation.ts`: đổi quy tắc thứ tự giống A2 (trùng hợp lệ, trống bỏ qua, mốc 8 so với mốc 6). Điều kiện bật nút "Mở đợt": đủ 3 mốc đầu.
4. `RoundConfigTab.tsx`: thêm ô "Số SV tối đa mỗi nhóm"; thêm ô ngày bắt đầu + nút "Tự điền 9 mốc" (nếu bảng đã có ngày thì hỏi xác nhận ghi đè); lỗi thứ tự hiện tại dòng + nút "Dùng ngày gợi ý". Giữ cơ chế "có thay đổi chưa lưu" đang có ở `RoundDetailPage`.
5. Test: `RoundDetailPage.test.tsx`/test mới cho tab Cấu hình: tự điền ra đúng 9 cặp ngày, mở đợt khi đủ 3 mốc, số SV tối đa bị khóa khi đợt đang diễn ra.

### A4. Vai trò giảng viên trong đợt (PDR-070)

Backend:
1. `RoundParticipant` thêm `IsSupervisor` (mặc định true), `IsReviewer`, `IsCommittee` (mặc định false). Chỉ có nghĩa khi `Kind = Lecturer`. Migration `AddLecturerRoundRoles`; dữ liệu cũ: GV đang có trong đợt → HD = true, PB = true, HĐ = true để không làm mất người đang được phân công (ghi rõ trong mô tả migration, người dùng review).
2. GV **không thuộc đợt** vẫn có thể được thêm chỉ với vai trò PB hoặc HĐ (PDR-070): thêm qua cùng API thêm GV, với HD = false.
3. Endpoint `PUT /rounds/{id}/lecturers/{userId}/roles` body `{ supervisor, reviewer, committee }`. Bỏ HD khi GV đã có đề tài trong đợt → lỗi "GV đang hướng dẫn đề tài trong đợt, không bỏ vai trò Hướng dẫn được." Bỏ PB/HĐ khi GV đang được phân công PB/ngồi hội đồng → lỗi tương tự.
4. Nhập vai trò: `POST /rounds/{id}/lecturers/roles/preview` (multipart xlsx) → trả từng dòng `{ row, lecturerCode, fullName, supervisor, reviewer, committee, error? }`; `POST /rounds/{id}/lecturers/roles/import` nhận các dòng hợp lệ đã xem trước. Cột: `Mã GV`, `Họ tên`, `HD`, `PB`, `HĐ` (ô có `x` = có vai trò). Đối chiếu theo Mã GV với tài khoản có sẵn; không tạo tài khoản; dòng lỗi bỏ qua. GV có trong file: ghi đè cả 3 vai trò; GV ngoài file giữ nguyên. GV trong file chưa thuộc đợt thì thêm vào đợt. Dùng thư viện đọc xlsx mà chức năng nhập người dùng (PDR về nhập xlsx/csv ở `Users`) đang dùng, không thêm thư viện mới.
5. Các chỗ dùng danh sách GV của đợt: đếm min–max đề tài, gửi đề tài, nhận đề xuất của SV **chỉ tính GV có HD**. Ứng viên PB (`ReviewerRules`) chỉ lấy GV có PB; ứng viên thành viên hội đồng (`CouncilRules`/council check) chỉ lấy GV có HĐ.
6. `ParticipantDto` thêm 3 cờ.
7. Test: đếm tải chỉ GV có HD, ứng viên PB/HĐ lọc theo cờ, nhập xlsx (dòng sai mã, dòng trùng, GV ngoài đợt được thêm, GV ngoài file giữ nguyên).

Frontend:
1. `RoundParticipantsTab.tsx` (dạng GV): thêm 3 cột checkbox, đổi ngay khi tick (gọi API, toast kết quả, lỗi thì trả checkbox về cũ và toast lý do). Bộ lọc nhanh "Tất cả / HD / PB / HĐ".
2. `AddParticipantsDialog.tsx`: khi thêm GV có lựa chọn vai trò ban đầu (mặc định HD).
3. Hộp thoại mới `LecturerRoleImportDialog.tsx`: chọn file, bảng xem trước (số dòng hợp lệ / lỗi, lỗi ghi lý do), nút "Áp dụng N dòng". Có link tải file mẫu nếu repo đã có cơ chế tải mẫu cho nhập người dùng.
4. Test cho tab và hộp thoại.

### A5. Tab Đánh giá với 4 mục con (PDR-065, PDR-070)

1. `RoundEvaluationTab.tsx` viết lại: bỏ các thẻ dẫn sang trang lẻ. Thanh mục con `role="tablist"` (Cấu hình điểm, Mẫu phiếu, Phản biện, Hội đồng), giữ ở URL `muc` qua `useUrlParam` như `tab`. Mặc định `cau-hinh-diem`.
2. `GradingConfigSection.tsx` (mới): form hệ số + ngưỡng; dòng "Làm tròn 2 chữ số"; bảng xếp loại chỉ đọc (lấy từ hằng số dùng chung với backend, khai báo ở `src/types/round.ts` hoặc `src/features/rounds/grading.ts`); dòng ví dụ tính điểm cập nhật theo hệ số đang nhập (hàm thuần `weightedScore` có test). Ô tick "Lưu làm mặc định cho chương trình X" → khi Lưu mà ô đang tick thì hộp thoại xác nhận trước. Khóa toàn bộ khi đợt không Nháp, banner lý do.
3. `TemplateAssignmentSection.tsx` (mới): danh sách 3 vai trò, cột "Vai trò", "Mẫu phiếu", "Thang", "Trạng thái" (có `min-width` cho tiêu đề cột để chữ "Chưa gán" không lệch). Bấm dòng mở drawer: select mẫu đã ban hành (`GET /evaluation-templates`), Lưu (`PUT assignments/{roundId}/{role}`), Gỡ (`DELETE …`). Tái dùng code từ `RoundAssignmentList.tsx` nếu được (tách phần dùng chung, không sao chép). Lưu ý `EvaluationTemplateAssignment.RoundId` là string: truyền `round.id` như trang Phiếu đánh giá đang làm.
4. Mục Phản biện và Hội đồng: nhúng component ở A6 với `mode="edit"`, `roundId` cố định.
5. Test: chuyển mục con giữ URL, cấu hình điểm khóa khi Running, gán mẫu phiếu gọi đúng API.

### A6. Component dùng chung Phản biện / Hội đồng (PDR-070)

1. Tách phần thân của `ReviewerAssignmentPage.tsx` thành `src/features/reviewers/components/ReviewerPanel.tsx` với prop:
   - `mode: 'edit' | 'view'`
   - `roundId?: string` (có thì khóa vào đợt đó, ẩn bộ lọc đợt), không có thì hiện bộ lọc đợt, mặc định **Tất cả đợt đang diễn ra**
   - `embedded: boolean` (nhúng trong tab thì không vẽ tiêu đề trang)
   - Chế độ `edit`: hàng lọc có "Tự gợi ý" + "Lưu" ngay trên danh sách chờ phân công. Chế độ `view`: select/checkbox disable, mỗi dòng có nút "Mở tab Đánh giá".
   - `ReviewerAssignmentPage.tsx` còn lại là vỏ trang gọi `<ReviewerPanel mode="view" embedded={false} />`.
2. Tương tự `CouncilBoardPage.tsx` → `src/features/councils/components/CouncilPanel.tsx`, đổi bố cục:
   - Danh sách hội đồng toàn bề rộng (bảng). Trên bảng: nút "Tạo hội đồng" và "Công bố lịch bảo vệ" (chỉ `edit`).
   - Bấm dòng → `CouncilDrawer.tsx` (mới, drawer bên phải, đóng bằng Esc/nút X, trả focus về dòng đã bấm) chứa `CouncilDetail` ở chế độ xem; trong `edit` có nút Sửa → `CouncilEditor` ngay trong drawer; Xóa/Hủy/Đính chính giữ hộp thoại `CouncilReasonDialog` hiện có.
   - "Tạo hội đồng" mở drawer với `CouncilEditor` trống.
   - Xem `TemplateDrawer.tsx` để dùng lại lớp CSS/kiểu drawer; nếu chưa có component drawer dùng chung thì tạo `src/components/ui/SideDrawer.tsx` và cho `TemplateDrawer` dùng luôn (commit riêng).
3. Trang lẻ `app/(protected)/giao-vu/phan-bien/page.tsx` và `hoi-dong/page.tsx`: render panel chế độ `view`. Tham số `?dot=` cũ vẫn dùng được (lọc sẵn đợt). Menu `menuConfig.ts` giữ 2 mục "Giảng viên phản biện", "Hội đồng bảo vệ".
4. Cập nhật test hiện có (`ReviewerAssignmentPage.test.tsx`, `CouncilBoardPage.test.tsx`) theo chế độ view; thêm test chế độ edit qua `RoundEvaluationTab`. Không xóa test, chỉ sửa cho đúng hành vi mới.

### A7. Chặn GVHD chấm đề tài mình hướng dẫn (PDR-070)

Đã có một phần (`ReviewerRules.SupervisorMessage`, `CouncilRules` dòng ~142 báo khi GVHD ngồi hội đồng). Việc cần làm:
1. Kiểm rằng cả hai kiểm tra là **lỗi chặn**, không phải cảnh báo, khi lưu (POST/PUT council, lưu phân công PB). Nếu đang là cảnh báo thì đổi thành lỗi, thông báo: "DT-xxx: <tên> là GVHD, không được làm PB/CT/TK của đề tài này. Xếp đề tài vào hội đồng khác."
2. Frontend: danh sách chọn PB và chọn thành viên hội đồng không hiện GVHD của đề tài/không cho xếp đề tài vào hội đồng có GVHD của nó (disable kèm lý do).
3. Test cả hai phía.

### A8. Trang chủ Giáo vụ (PDR-071)

Backend:
1. Endpoint mới `GET /api/statistics/overview` (Giáo vụ) trả:
   - `rounds[]`: `{ roundId, name, status, currentMilestoneKey, topicCount, studentsWithGroup, studentCount, topicsWithReviewer, topicsScored, topicsWithDeviation }`. Khi chưa có phiếu chấm (phase 07 chưa làm) thì `topicsScored`, `topicsWithDeviation` trả `null`, frontend hiện "—".
   - `alerts[]`: `{ kind, roundId, roundName, count, target }` với `target` là đường dẫn frontend đã lọc đợt (hoặc để frontend tự dựng từ `kind` + `roundId`; chọn một cách và ghi lại).
2. Danh sách `kind` tạm (OQ-033(d)), làm những loại tính được bằng dữ liệu hiện có, loại cần dữ liệu chưa có thì để TODO:
   - `LecturerBelowMin` / `LecturerAboveMax` (GV có HD dưới min/vượt max đề tài)
   - `StudentsWithoutGroup` (khi mốc Đăng ký đã hết)
   - `TopicsWithoutReviewer` (khi mốc Lịch PB sắp tới trong 7 ngày hoặc đang chạy)
   - `TopicsWithoutCouncil` (khi mốc Lịch BV sắp tới trong 7 ngày hoặc đang chạy)
   - `CouncilConflicts` (trùng giờ/phòng, dùng lại `CouncilRules`)
   - `MilestoneMissing` (mốc kế tiếp chưa có ngày khi mốc trước còn ≤ 7 ngày)
   - `LateSubmissions` (nộp trễ, nếu `TopicSubmission` có cờ trễ)
   - TODO sau B1: `ReservationExpiring`; TODO sau C1: `ScoreDeviation`.
   - Ngưỡng "sắp tới" 7 ngày để thành hằng số, ghi `// OQ-033(d)`.
3. Test handler với dữ liệu đợt mẫu.

Frontend:
1. `RoundHomePage.tsx` (vai Giáo vụ): thêm khối `AttentionList` trên cùng (danh sách gọn, mỗi dòng: nhãn loại, tên đợt, số lượng, nút "Xử lý" dẫn đúng chỗ đã lọc đợt, ví dụ `/giao-vu/dot/{id}?tab=danh-gia&muc=phan-bien`). Khối rỗng ghi "Không có việc cần xử lý".
2. Thẻ đợt thêm số liệu nhanh từ `overview.rounds`. Giữ thứ tự sắp và hành vi bấm thẻ hiện có.
3. Test: khối Cần xử lý hiện đúng dòng và link; thẻ đợt hiện "—" khi `topicsScored` null.

---

## 6. Phần B (làm sau, khi người dùng yêu cầu)

### B1. GV gửi đề tài kèm SV giữ chỗ (PDR-068)
- `ThesisTopic` thêm danh sách giữ chỗ `TopicReservation { TopicId, StudentId, Status Pending/Confirmed/Declined/Expired, CreatedAt, RespondedAt }`. Số chỗ giữ + SV đã ghi danh ≤ `round.MaxGroupSize`.
- Màn GV gửi đề tài (`GV-DeTai` trên canvas): ô nhập mã SV giữ chỗ (nhiều mã), kiểm SV thuộc đợt và chưa có nhóm.
- SV nhận thông báo trong ứng dụng + email, xác nhận/từ chối trong thời gian Đăng ký (`DonDangKy` scenario "Lời mời giữ chỗ"). Từ chối hoặc hết hạn → trả chỗ, GV nhận thông báo; đã xác nhận thì giữ. Job hết hạn chạy cùng chỗ với job đóng đăng ký (PDR-064).
- Hạn liên kết email và cách nhắc là OQ-033(c): không tự đặt, hỏi trước khi làm email.

### B2. Trang chủ GV (PDR-071)
- 4 khối gộp chung, mỗi dòng gắn nhãn HD/PB/HĐ: Đợt đang tham gia; Việc cần làm có hạn; Thay đổi mới nhất; Lịch hội đồng sắp tới (+ Thông báo giáo vụ dùng `NoticeBoard` có sẵn). Bấm dòng mở đúng chỗ, lọc sẵn đợt. Endpoint `GET /api/statistics/lecturer-overview`.

## 7. Phần C (chờ chức năng chấm điểm)

Repo chưa có phiếu chấm điểm (phase 07). Lệch điểm (PDR-066) chỉ làm được sau khi có phiếu. Khi làm: khi đủ 4 điểm, so từng điểm với Điểm KL (trung bình có hệ số của đợt); `|điểm − Điểm KL| ≥ DeviationThreshold` là lệch; chặn lưu khi điểm đang nhập chính là điểm lệch, còn lệch do điểm người khác thì vẫn lưu, gắn cờ và thông báo người có điểm lệch (lệch điểm hội đồng gửi cả CT và TK); còn lệch thì Giáo vụ không xác nhận nhóm. Viết vào plan phase 07, không làm ở nhánh này.

---

## 8. Kiểm thử và hoàn tất mỗi bước

- Backend: `dotnet build` và `dotnet test` trong `app/backend`. Test cần PostgreSQL thì chạy theo hướng dẫn trong `AGENTS.md` (container local), không dùng Neon.
- Frontend: `npm run lint`, `npm run typecheck` (hoặc lệnh tương đương trong `package.json`), `npm run test` trong `app/frontend`. Khi sửa, chỉ chạy lại test vừa hỏng.
- Mỗi bước A1..A8 xong: commit riêng, cập nhật ghi chú trạng thái "Đã triển khai (ngày, nhánh)" ở cuối PDR tương ứng và tick mục liên quan trong `docs/plan/MVP-COMPLETION-PLAN.md`.
- Không push. Khi xong Phần A, báo lại danh sách commit và các câu hỏi ở mục 9.

---

## 9. Câu hỏi mở

Từ OQ-033 (không chặn Phần A, dùng giá trị tạm và đánh dấu trong code):
- (a) Độ dài 9 mốc là tạm: `MILESTONE_WEEKS`.
- (b) Quy trình SV xếp loại Không đạt: chỉ hiển thị nhãn, chưa làm luồng bảo vệ lại.
- (c) Hạn liên kết giữ chỗ và cách nhắc: chặn B1 phần email.
- (d) Danh sách bất thường Trang chủ là tạm.
- (e) Mặc định theo chương trình lưu ở đâu, ai sửa: tạm bảng `ProgramRoundDefaults`, Giáo vụ sửa qua ô tick.
- (f) SV đã ghi danh khi số tối đa/vai trò GV đổi sau khi mở: tạm khóa số tối đa khi mở; bỏ vai trò bị chặn khi đang được dùng.

Câu hỏi agent ghi thêm khi code (ghi bên dưới, kèm bước và file liên quan):

- **Đã hoàn thành toàn bộ Phần A (A1..A8) ngày 2026-11-23 trên nhánh `feat/giao-vu-23-11`:**
  - `3018163`: `feat(backend): cau hinh dot va diem theo PDR-065, PDR-069 (A1)`
  - `2467c4c`: `feat(backend): quy tac 9 moc va mo dot khi du 3 moc dau (A2)`
  - `18bb449`: `feat(frontend): tab cau hinh so sv toi da, tu dien 9 moc va goi y ngay (A3)`
  - `129dffe`: `feat: vai tro giang vien trong dot theo PDR-070 (A4)`
  - `8ed010d`: `feat(frontend): tab danh gia voi 4 muc con theo PDR-065, PDR-070 (A5)`
  - `8b8ca84`: `feat(frontend): component dung chung phan bien va hoi dong theo PDR-070 (A6)`
  - `aebc29f`: `feat: chan GVHD cham de tai minh huong dan theo PDR-070 (A7)`
  - `0ee4fe6`: `feat: trang chu giao vu va khoi can chu y theo PDR-071 (A8)`
  - Toàn bộ test Backend: 444 tests passed (0 fail, 18 skipped môi trường DB).
  - Toàn bộ test Frontend: 232 tests passed (0 fail), typecheck và lint 0 errors, 0 warnings.

