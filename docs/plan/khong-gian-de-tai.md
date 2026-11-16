# Plan code: Không gian đề tài (3 vai trò)

**Người đọc:** agent viết code (Gemini). Plan này tự đủ ngữ cảnh: đọc từ đầu đến cuối trước khi sửa file nào.
**Lập ngày:** 2026-11-16, trên nhánh local `feat/khong-gian-de-tai` (tách từ `main` 53de57b, sau PR #37).
**Phạm vi:** dựng lại màn `/de-tai/[id]` thành Không gian đề tài hoàn chỉnh theo canvas, dùng chung cho Sinh viên, Giảng viên và Giáo vụ, chỉ trên API thật. Phần chưa có backend thì dựng khung và trạng thái trống trung thực, không dùng dữ liệu giả.

---

## 0. Luật chơi (bắt buộc)

1. Đọc `AGENTS.md`, `CLAUDE.md` (chỉ có ở máy local), `docs/CONTENT.md`, `docs/OPEN_QUESTIONS.md`, `docs/DESIGN.md` trước khi code. AGENTS.md yêu cầu đọc toàn bộ `docs/`; ít nhất phải đọc các file ở mục 2.
2. **Thứ tự ưu tiên khi lệch nguồn:** PDR mới hơn > `docs/requirements/` > `docs/DESIGN/03` > canvas. Canvas chỉ quyết định cách trình bày. Mục 4 liệt kê các chỗ canvas đã lỗi thời, **không làm theo canvas ở những chỗ đó**.
3. Không đoán endpoint. Trước khi gọi API, mở controller/DTO backend tương ứng (đường dẫn ở mục 3). Mọi thay đổi hợp đồng API phải sửa cả hai phía trong cùng commit và có test.
4. CSS: không viết hex/rgb mới, không `style={{}}` cho màu/cỡ chữ/bo góc; dùng `var(--…)` trong `:root` của `app/frontend/src/index.css` và lớp `app-*` sẵn có. Biểu tượng dùng `lucide-react`. Vùng bấm ≥ 40px. Kết quả thao tác dùng `toast`, lý do bị khóa dùng banner `role="note"`, lỗi trong form giữ tại chỗ (PDR-056).
5. Không tự chạy migration/seed trên Neon. Không commit `.env`. Không push lên `main`; làm trên `feat/khong-gian-de-tai`, commit nhỏ theo từng bước dưới đây.
6. Gặp điều plan không nói và tài liệu cũng không nói: **dừng, ghi câu hỏi vào cuối file này (mục 9)**, không tự đặt quy tắc nghiệp vụ.

---

## 1. Màn hình cần đạt (tóm tắt canvas)

Canvas gốc: artboard `project/KhongGianDeTai.dc.html` và `project/KhongGianDeTai-GV.dc.html` trong Claude Design (link ở `CLAUDE.md`). Hai artboard cùng mã, khác vai trò người xem. Nếu không mở được canvas, dùng mô tả dưới đây (đã trích từ canvas ngày 2026-11-16) cùng `docs/DESIGN/03-dac-ta-man-hinh.md` mục "Không gian đề tài (sinh viên)" và "Không gian đề tài (góc nhìn giảng viên)".

Bố cục từ trên xuống:

1. **Liên kết quay lại** (ẩn khi nhúng ở `/sv/de-tai`): GV → "Nhóm hướng dẫn" (hoặc "Đề tài phản biện"/"Hội đồng" về sau); Giáo vụ → "Chi tiết đề tài".
2. **Tiêu đề:** h1 tên đề tài; hàng chip: trạng thái đề tài, mã đề tài (`DT-001`), tên đợt. Bên phải hàng tiêu đề có nút hành động theo vai trò:
   - Thành viên nhóm: "Hủy ghi danh" (nút nguy hiểm) + chú thích "Hủy được trong thời gian đăng ký, khi nhóm chưa nộp bài nào." Chỉ hiện khi được phép.
   - GVHD: "Gửi thông báo cho nhóm" (phụ thuộc màn Gửi thông báo, xem bước B5).
3. **Khung TIẾN ĐỘ** (thẻ, thu gọn được, mặc định mở, nút "Thu gọn"/"Mở rộng" có `aria-expanded`). Mở: 6 hàng, mỗi hàng nhãn chữ hoa bên trái và chuỗi chip bước nối bằng gạch ngang. Thu gọn: một dãy 6 chip, chip chặng hiện tại ghi thêm bước đang chờ (ví dụ "Đề cương · Chờ GVHD duyệt").
   - Ba kiểu chip: `done` (nền ok, chấm đặc), `now` (nền đậm `--ink`, chữ trắng, chấm `--accent`), `todo` (nền trắng viền, chấm rỗng).
   - Hàng có thể kèm chú thích bên phải (ví dụ "Hạn nộp 18/10/2026", "Mở sau khi đề cương được duyệt", "Chấm song song, không theo thứ tự").
4. **Dãy tab** `role="tablist"`: "Tổng quan đề tài", "Thông báo", "Hoạt động" (có số đếm), "Điểm số". Tab chọn có gạch chân đậm.
5. **Vùng nội dung 2 cột:** cột trái là tabpanel, cột phải là `aside` gồm các thẻ:
   - Chỉ ở tab Tổng quan: "GIẢNG VIÊN HƯỚNG DẪN" (avatar chữ, tên, vai trò, bộ môn) và "NHÓM" (thành viên, Đại diện/Thành viên, MSSV).
   - Luôn hiện: "GIẢNG VIÊN PHẢN BIỆN" ("Chưa phân công" hoặc tên + "Giáo vụ phân công ngày … Nhóm tự liên hệ giảng viên phản biện.") và "HỘI ĐỒNG · LỊCH BẢO VỆ" ("Chưa phân công" + "Giáo vụ sẽ thông báo hội đồng, phòng và giờ bảo vệ khi xếp lịch." hoặc ngày giờ, phòng, hội đồng, Chủ tịch, Thư ký).
   - Ở bề rộng điện thoại, `aside` xuống dưới tabpanel.

Nội dung từng tab:

- **Tổng quan đề tài:** lưới 4 ô sự kiện (LĨNH VỰC, NGUỒN ĐỀ TÀI, QUY MÔ NHÓM, … ) + "Mô tả đề tài" + "Yêu cầu" (danh sách gạch đầu dòng).
- **Thông báo:** câu dẫn ("Thông báo gửi đến nhóm bạn, từ giảng viên hướng dẫn và giáo vụ. Mới nhất ở trên." với SV; "Thông báo đã gửi đến nhóm này, từ giảng viên hướng dẫn và giáo vụ." với GV) + danh sách thẻ: avatar chữ, tiêu đề, người gửi + chip vai trò ("Giáo vụ"/"GV hướng dẫn"/"Bạn"), "gửi <phạm vi>", thời điểm, nội dung nhiều dòng. Không trả lời, không số người xem.
- **Hoạt động:** 3 khối accordion có chip trạng thái ở tiêu đề: "Đề cương", "Báo cáo giữa kỳ", "Báo cáo cuối kỳ · khóa luận". Khối Giữa kỳ/Cuối kỳ khóa với câu "Mục nộp báo cáo … mở sau khi giảng viên hướng dẫn duyệt đề cương. Thời gian nộp theo đợt: [từ – đến]." khi đề cương chưa duyệt. Mặc định mở khối của chặng hiện tại.
- **Điểm số:**
  - SV: thẻ "Kết quả" + chip "Chưa công bố"/"Đã công bố". Chưa công bố: "Điểm hướng dẫn, phản biện, hội đồng và điểm tổng kết hiển thị sau khi giáo vụ công bố kết quả." Đã công bố: 4 dòng điểm của riêng SV đang xem + điểm khóa luận + nút "Xem chi tiết từng phiếu đánh giá" (hộp thoại chỉ xem).
  - GV (và Giáo vụ): dải ghi chú "Bạn đang xem với vai trò … Ba phần chấm diễn ra song song, mỗi người chỉ nhập phiếu của mình." + nhãn "SINH VIÊN KHÔNG THẤY"; 3 thẻ accordion "Chấm điểm hướng dẫn", "Chấm điểm phản biện", "Điểm hội đồng" (chip Chưa nhập/Đang nhập/Đã lưu, nhãn "Bạn nhập" ở thẻ của mình); cuối cùng là khối "Điểm khóa luận (tạm tính) · theo từng sinh viên" với công thức và "Chưa đủ điểm" khi thiếu.
- **Hộp thoại:** "Hủy ghi danh đề tài?", "Chốt bản cuối?" (phase sau), xem chi tiết phiếu (phase sau).
- **Trạng thái "Chưa có đề tài"** (SV chưa có nhóm/đề tài): đã có ở `/sv/de-tai` (`StudentMyTopicPage`), giữ nguyên.

---

## 2. Tài liệu phải đọc cho màn này

| File | Lấy gì |
| --- | --- |
| `docs/DESIGN/03-dac-ta-man-hinh.md` mục Không gian đề tài (SV và GV) | prop/trạng thái canvas, quy tắc, ghi chú triển khai 2026-11-12 |
| `docs/DESIGN/01-sitemap.md` dòng 18, 132–144 | màn dùng chung 3 vai trò; GV vào từ Hướng dẫn/Phản biện/Hội đồng |
| `docs/decisions/PDR-057-…` | hợp đồng đề cương, quyền `member/supervisor/staff`, 404 cho người ngoài |
| `docs/decisions/PDR-058-…` | hợp đồng báo cáo giữa kỳ/cuối kỳ, cửa sổ nộp, "Chưa làm" |
| `docs/decisions/PDR-049-…` | vòng đời trạng thái đề tài, duyệt đề cương không đổi trạng thái |
| `docs/decisions/PDR-047-…`, `PDR-054-…` | hủy ghi danh, nhóm |
| `docs/decisions/PDR-011, 021, 022, 024, 035, 050, 007, 008` | bản cuối, phản biện, phiếu, lệch điểm, công thức (cho phần B) |
| `docs/decisions/PDR-038, 051, 056` | thông báo, chuông, toast |
| `docs/requirements/BUSINESS_RULES.md` | quy tắc tổng |
| `docs/plan/phase-04 … phase-08` | phụ thuộc và tiêu chí nghiệm thu |
| `docs/DESIGN.md`, `docs/DESIGN/02-thiet-ke-dung-chung.md` | token, thành phần dùng chung, lệnh kiểm tra |

---

## 3. Hiện trạng code (đã kiểm ngày 2026-11-16)

### Frontend (`app/frontend/`)

| File | Vai trò hiện tại |
| --- | --- |
| `app/(protected)/de-tai/[id]/page.tsx` | route, render `TopicWorkspacePage` |
| `app/(protected)/de-tai/layout.tsx` | `AppShell`, title "Không gian đề tài · QLKLTN", không chặn vai trò (quyền do backend) |
| `app/(protected)/sv/de-tai/page.tsx` → `features/outline/components/StudentMyTopicPage.tsx` | tìm đợt "Đang diễn ra" → `myRegistration` → nhúng `TopicWorkspacePage embedded` |
| `src/features/outline/components/TopicWorkspacePage.tsx` (173 dòng) | trang hiện tại: tiêu đề + thẻ Tổng quan + `OutlineSection` + `SubmissionPanel` xếp dọc; không có tiến độ, tab, aside |
| `src/features/outline/components/OutlineSection.tsx` (695 dòng) | toàn bộ chặng Đề cương (nộp, yêu cầu, phiên bản, nhận xét, duyệt); `outlineStage()` tính chip lượt; gọi `onReady(outline)` |
| `src/features/submissions/components/SubmissionPanel.tsx` (295 dòng) | 2 khối Giữa kỳ/Cuối kỳ từ `GET /api/topics/{id}/submissions` |
| `src/features/outline/services/outlineService.ts` | `topic(id)` (GET /api/topics/{id}), các thao tác đề cương, `OutlineNotFoundError` |
| `src/features/submissions/services/submissionApiService.ts` | `list`, `submit` |
| `src/features/topics/services/topicApiService.ts` | `studentTopicService.myRegistration(roundId)`, `cancel(topicId)` (DELETE registration) |
| `src/types/topic.ts`, `outline.ts`, `submission.ts`, `round.ts` | kiểu dữ liệu; `TopicDetailDto`, `MyRegistration.canCancel` |
| `src/components/ui/ConfirmDialog.tsx`, `StatusState.tsx`, `AppToaster.tsx` | hộp xác nhận, trạng thái trống, toast |
| `src/lib/useUrlParam.ts` | state theo `?param=` (trang phải bọc `<Suspense>`) |
| `src/features/outline/outline.css` (`otl-`), `submissions/submissions.css` (`sub-`), `topics/topics.css` (`tpc-`) | CSS hiện có |

### Backend (`app/backend/src/`)

| Endpoint | Ai gọi được | Ghi chú |
| --- | --- | --- |
| `GET /api/topics/{id}` → `TopicDetailDto` | SV/GV/Giáo vụ; người ngoài 404 | có `group`, `supervisor`, `status`, `outlineApprovedAt`, `history`, `submissions` (tóm tắt); **không có** tên đợt, phản biện, hội đồng, điểm |
| `GET /api/topics/{id}/outline` → `OutlineDto` | thành viên, GVHD, Giáo vụ | có `viewerRole`: `member` / `supervisor` / `staff` |
| `GET|POST /api/topics/{id}/submissions`, `GET /api/submissions/{id}/file` | như trên (nộp: chỉ thành viên) | `kinds[]` midterm/final với `window`, `canSubmit`, `blockedReason`, `versions[]` |
| `GET /api/topics/my-registration?roundId=` | SV | `canCancel`, `registrationOpen` |
| `DELETE /api/topics/{id}/registration` | SV | 409 "Nhóm đã nộp đề cương nên không hủy ghi danh được." |
| `GET /api/notifications/me`, `POST /api/notifications/read` | mọi vai trò | chỉ chuông cá nhân; **chưa có** thông báo gắn đề tài, chưa có API gửi thông báo |
| `GET /api/rounds/{id}` | theo quyền đợt | tên đợt, 9 mốc (có `lateEndDate`) |

Chưa có ở backend: phân công phản biện (P05), hội đồng/lịch (P06), phiếu điểm/kết quả (P07, Domain mới có `ThesisScore.Calculate`), thông báo gửi theo nhóm (P08), chốt bản cuối và hạn bổ sung (P04-S03), nhận xét báo cáo giữa kỳ.

Controller: `Backend.API/Controllers/Topics/TopicsController.cs`, `OutlineController.cs`, `Submissions/SubmissionsController.cs`. Handler: `Backend.Application/Topics/TopicRequests.cs` (`GetTopicQuery`, `TopicMapping.Fill`). Test: `app/backend/tests/Backend.Tests/` (`Features/…`, `Api/TopicApiTests`).

---

## 4. Chỗ canvas đã lỗi thời: làm theo PDR, không theo canvas

| Canvas | Làm theo |
| --- | --- |
| SV tick vào yêu cầu chỉnh sửa khi sửa xong; GV có "Mở lại", nút xóa yêu cầu | PDR-013/057: chỉ GVHD "Xác nhận hoàn tất" sau khi nhóm nộp lại; không xóa, không mở lại. Giữ nguyên `OutlineSection` hiện có; Giữa kỳ/Cuối kỳ (A13) làm cùng luồng. Người dùng xác nhận giữ luồng này ngày 2026-11-16. |
| Nút "Hoàn tác" sau khi duyệt đề cương | Không có (PDR-057). |
| Text "Bản nộp sau hạn vẫn được nhận và gắn nhãn Nộp trễ" | Chỉ khi mốc bật nộp trễ và còn hạn trễ (PDR-041/058). Lấy câu từ `blockedReason`/`window` của API. |
| Chủ tịch xác nhận/trả lại điểm | Bỏ (PDR-050). Chủ tịch chỉ xem. |
| `viewAs` chỉ có SV/GV | Thêm góc nhìn Giáo vụ (`staff`), chỉ xem (PDR-057). |
| Badge "Bản chính thức" | Chưa có cho tới P04-S03 (chốt bản cuối). |
| Chip trạng thái đề tài lấy theo `phase` canvas | Lấy `topic.status` từ API (PDR-049). Duyệt đề cương không đổi trạng thái. |
| Ô "CÔNG NGHỆ" trong lưới sự kiện | Không có trường dữ liệu; bỏ ô này (không thêm field). |
| Email GV/SV trong aside | Hiện (người dùng chốt 2026-11-16). DTO chưa có email nên thêm ở A2. |

---

## 5. Quyền theo vai trò

Vai trò ngữ cảnh lấy từ máy chủ, không suy ở frontend. Hiện có `member | supervisor | staff` (từ `OutlineDto.viewerRole`). Phần B mở rộng thêm `reviewer`, `councilChair`, `councilSecretary`.

| Khu vực | Thành viên nhóm (`member`) | GVHD (`supervisor`) | Giáo vụ (`staff`) | GV phản biện / hội đồng (phần B) |
| --- | --- | --- | --- | --- |
| Truy cập trang | đề tài của nhóm mình | đề tài mình hướng dẫn | mọi đề tài | đề tài được phân công |
| Người khác | 404 "Không tìm thấy đề tài" | — | — | — |
| Hủy ghi danh | khi `MyRegistration.canCancel` | không | không | không |
| Gửi thông báo cho nhóm | không | có (B5) | không ở màn này | không |
| Tiến độ 6 chặng | xem | xem | xem | xem |
| Tab Tổng quan | xem | xem | xem | xem |
| Tab Thông báo | xem (B5) | xem (B5) | xem (B5) | không hiện tab cho tới khi có quyết định |
| Đề cương | nộp | nhận xét, yêu cầu, xác nhận hoàn tất, duyệt | chỉ xem/tải | xem/tải (PDR-058 "Chưa làm") |
| Giữa kỳ / Cuối kỳ | nộp | xem/tải | xem/tải | xem/tải (B2) |
| Chốt bản cuối | có (B1) | không | không | không |
| Tab Điểm số | thẻ Kết quả, điểm riêng sau công bố | 3 thẻ, nhập phiếu HD (B4), xem phiếu khác đã lưu | 3 thẻ chỉ xem | nhập phiếu của mình (B4) |

---

## 6. Phần A: làm ngay trên API đã có

Mỗi bước là một commit (hoặc vài commit nhỏ). Commit message tiếng Việt theo kiểu đang dùng trong repo (`feat(frontend): …`, `docs: …`).

### A0. Chuẩn bị

- `git status` sạch; `git fetch origin && git merge origin/main` vào `feat/khong-gian-de-tai` nếu `main` có commit mới.
- Chạy baseline: `app/frontend`: `npm ci`, `npm run typecheck`, `npm run lint`, `npm test`; `app/backend`: `dotnet restore Backend.sln --locked-mode`, `dotnet test Backend.sln --no-restore`. Ghi lại test nào đỏ sẵn (không sửa ngoài phạm vi).

**Xong khi:** baseline đã ghi lại; nhánh cập nhật.

### A1. Ghi quyết định trước khi code (docs)

Tạo `docs/decisions/PDR-059-khong-gian-de-tai-khung-va-tab.md` (định dạng như PDR-057: Trạng thái / Bối cảnh / Quyết định / Hợp đồng API / Giao diện / Hệ quả), ghi:

- Một route `/de-tai/[id]` cho 3 vai trò; vai trò từ máy chủ.
- Tab giữ trong `?tab=` với giá trị `tong-quan | thong-bao | hoat-dong | diem-so`; mặc định `hoat-dong` cho mọi vai trò hiện có (phần B: `diem-so` cho phản biện/hội đồng). Giá trị lạ → mặc định.
- Khung tiến độ tính ở frontend từ dữ liệu API (quy tắc ở A4), không lưu.
- Giáo vụ xem cùng màn, chỉ xem.
- Bảng "canvas lỗi thời" ở mục 4.
- Thêm trường `round` vào `TopicDetailDto` (A2).
- Tab Thông báo và phần điểm chưa có dữ liệu: hiện trạng thái trống, không dữ liệu giả.

Sửa `docs/DESIGN/03-dac-ta-man-hinh.md`: thay hai ghi chú triển khai 2026-11-12 của Không gian đề tài bằng ghi chú mới trỏ tới PDR-059. Thêm PDR-059 vào bảng/mục lục nếu `docs/STRUCTURE.md` có liệt kê PDR.

**Xong khi:** PDR-059 tồn tại, DESIGN/03 không còn câu "Chưa có: khung tiến độ 6 chặng, các tab…".

### A2. Backend: thêm thông tin đợt vào chi tiết đề tài

- `TopicDetailDto` (Application/Topics) thêm `Round = { Id, Name, Status }` lấy từ `round` đã nạp trong `GetTopicQuery` handler (`TopicRequests.cs` quanh dòng 355). Không thêm query mới.
- Frontend `types/topic.ts`: `TopicDetailDto.round: { id: string; name: string; status: RoundStatus }`.
- **Email (người dùng chốt 2026-11-16):** chỉ trong `TopicDetailDto` của `GET /api/topics/{id}` (không thêm vào danh sách đề tài, không thêm vào `TopicDto` dùng chung), thêm `supervisor.email` và `group[].email` (`string | null`, lấy email tài khoản). Theo canvas: email GVHD trả cho mọi người xem được đề tài; email thành viên nhóm chỉ trả cho GVHD và Giáo vụ (thành viên nhóm nhận `null` cho email của nhau trừ chính mình). Quyền xem đề tài giữ nguyên (người ngoài 404).
- Test: mở rộng test API hiện có cho `GET /api/topics/{id}` kiểm `round.name`, email GVHD với SV, email SV với GVHD/Giáo vụ và `null` với SV khác trong nhóm. Sửa các fixture test frontend dùng `TopicDetailDto`.

**Xong khi:** `dotnet test` và `npm run typecheck`, `npm test` xanh; JSON thật có `round`.

### A3. Tách module `features/workspace` và tải dữ liệu

Tạo thư mục `app/frontend/src/features/workspace/`:

```text
workspace/
  components/
    WorkspacePage.tsx          (thay TopicWorkspacePage)
    WorkspaceHeader.tsx
    ProgressPanel.tsx
    WorkspaceTabs.tsx
    WorkspaceAside.tsx
    tabs/OverviewTab.tsx
    tabs/NoticeTab.tsx
    tabs/ActivityTab.tsx
    tabs/ScoresTab.tsx
    CancelRegistrationDialog.tsx
  services/workspaceService.ts
  workspaceProgress.ts         (hàm thuần tính tiến độ)
  workspaceProgress.test.ts
  workspace.css                (tiền tố lớp `wsp-`)
```

- `workspaceService.load(topicId)` gọi song song `GET /api/topics/{id}`, `GET /api/topics/{id}/outline`, `GET /api/topics/{id}/submissions`. Trả `{ topic, outline, submissions, viewerRole }`. Topic 404 → `WorkspaceNotFoundError`. Submissions lỗi 503 không làm hỏng cả trang (khối báo cáo tự báo lỗi).
- Khi `viewerRole === 'member'`: gọi thêm `myRegistration(topic.round.id)` để lấy `canCancel`.
- Cho phép tiêm service qua prop (giống `OutlineSection`) để test.
- `TopicWorkspacePage.tsx` cũ: chuyển thành re-export hoặc xóa và sửa `page.tsx`, `StudentMyTopicPage.tsx` dùng `WorkspacePage`. Giữ prop `embedded`.
- Trang dùng `useUrlParam` nên route `page.tsx` bọc `<Suspense>`.
- Sau mỗi thao tác làm đổi dữ liệu (nộp, duyệt, hủy…), gọi `reload()` để tiến độ và chip cập nhật. `OutlineSection` đã có `onReady`; thêm callback `onChanged` nếu cần, hoặc nâng state đề cương lên `WorkspacePage` và truyền xuống. Không để hai nơi giữ hai bản `Outline` lệch nhau.

**Xong khi:** trang tải được cả 3 nguồn; 404 và lỗi mạng hiện `status-state` như hiện tại; test service.

### A4. Khung tiến độ 6 chặng

`workspaceProgress.ts` xuất `buildProgress(input): ProgressRow[]`, thuần, không phụ thuộc React. `input` gồm `topic`, `outline`, `submissions`, `today` (truyền vào để test). Mỗi `ProgressRow = { key, label, steps: { text, kind: 'done'|'now'|'todo' }[], note?, parallel? }`.

Quy tắc (chỉ dùng dữ liệu có thật):

| Chặng | Bước và điều kiện |
| --- | --- |
| ĐĂNG KÝ | `topic.source === 'SV đề xuất'` → "Đề xuất được chấp nhận"; ngược lại "Đã ghi danh". `done` khi `topic.group.length > 0`. |
| ĐỀ CƯƠNG | Chưa có phiên bản: "Chưa nộp" `now`, note "Hạn nộp dd/MM/yyyy" (`outline.deadline`). Có phiên bản: "Đã nộp · lần n" `done` + bước thứ hai: đã duyệt → "GVHD đã duyệt" `done`; còn yêu cầu mở → "Cần chỉnh sửa · k yêu cầu" `now`; còn lại → "Chờ GVHD duyệt" `now`. Tái dùng `outlineStage()` trong `OutlineSection.tsx` nếu khớp, đừng viết lại logic hai lần. |
| GIỮA KỲ | Đề cương chưa duyệt: "Chưa mở" `todo`, note "Mở sau khi đề cương được duyệt". Đã duyệt: có phiên bản → "Đã nộp · bản n" (thêm "Nộp trễ" nếu bản mới nhất `isLate`) `done`; chưa có và `window === 'closed'` → "Chưa nộp · đã khóa nộp" `now`, note hạn; chưa có và `window === 'late'` → "Quá hạn · cho nộp trễ" `now`; còn lại "Chưa nộp" `now`, note hạn. Bước thứ hai "GVHD nhận xét" (A13): `done` khi bản mới nhất đã có nhận xét và không còn yêu cầu mở; "Cần chỉnh sửa · k yêu cầu" `now` khi còn yêu cầu mở; còn lại `todo`. |
| CUỐI KỲ | Như Giữa kỳ với `kind === 'final'`, chữ "Đã nộp · n phiên bản". Bước "Chốt bản cuối" hiện `todo` (chưa có dữ liệu, B1 thay). |
| ĐÁNH GIÁ | Ba bước song song (`parallel`, không gạch nối): "Điểm hướng dẫn", "Điểm phản biện", "Điểm hội đồng"; note "Chấm song song, không theo thứ tự". Trạng thái suy từ `topic.status`: `Đã cho điểm`/`Có lệch điểm`/`Đã xác nhận`/`Đã hoàn tất` → cả ba `done`; còn lại `todo` (B4 thay bằng dữ liệu phiếu). |
| KẾT QUẢ | "Đã cho điểm" `done` khi status ∈ {Đã cho điểm, Có lệch điểm, Đã xác nhận, Đã hoàn tất}; "Xác nhận kết quả" `done` khi ∈ {Đã xác nhận, Đã hoàn tất}; "Công bố · hoàn tất" `done` khi `Đã hoàn tất`. |

- Chặng hiện tại = hàng đầu tiên chưa `done` hết. Ở chế độ thu gọn, chip chặng hiện tại ghi "<Tên chặng> · <bước đang chờ>".
- Trạng thái kết thúc riêng: `Không đủ điều kiện công bố` → hàng KẾT QUẢ một bước "Không đủ điều kiện công bố" (kiểu `now`, chữ đầy đủ); `Không có nhóm` không thể có không gian đề tài (không có thành viên) nhưng GVHD/Giáo vụ vẫn mở được: hiện banner `role="note"` "Đề tài không có nhóm sau hạn đăng ký." và không vẽ tiến độ.
- `ProgressPanel.tsx`: thẻ `app-card`, tiêu đề "TIẾN ĐỘ" (h2 nhãn chữ hoa 11px), nút "Thu gọn"/"Mở rộng" `aria-expanded`, `aria-controls`. Chip dùng lớp mới `wsp-step` + `wsp-step--done|now|todo`, màu chỉ từ token: done `--ok-bg/--ok-ink`, now `--ink/--surface` chấm `--accent`, todo `--surface` viền `--line` chữ `--muted`. Nhớ chữ luôn có (không chỉ màu).
- Ở màn hẹp, các bước xuống dòng (flex-wrap), nhãn hàng nằm trên chuỗi chip.

**Xong khi:** `workspaceProgress.test.ts` phủ ít nhất: chưa nộp đề cương; chờ duyệt; còn 2 yêu cầu mở; đã duyệt + giữa kỳ khóa nộp; giữa kỳ trễ; cuối kỳ 3 phiên bản; trạng thái Đã xác nhận; Đã hoàn tất; Không đủ điều kiện công bố. Panel có test thu gọn/mở rộng.

### A5. Tiêu đề, tab và aside

- `WorkspaceHeader`: h1 `topic.title`; chip `TopicStatusChip` (tái dùng `features/topics/components/TopicChips.tsx`), chip mã `topic.code` (font mono), chip "Đợt <round.name>". Liên kết quay lại theo bảng `BACK` hiện có trong `TopicWorkspacePage`; với GVHD nối thêm `?dot=<roundId>` nếu trang `/gv/huong-dan` đọc tham số đợt (kiểm tra `SupervisionPage.tsx`; nếu chưa đọc thì không thêm).
- `WorkspaceTabs`: `role="tablist"`, mỗi tab `role="tab"`, `aria-selected`, `aria-controls`, `id`; phím mũi tên trái/phải chuyển tab, Home/End. Đổi tab gọi `setTab(value, 'replace')`. Số đếm tab Hoạt động = số yêu cầu chỉnh sửa đang mở khi đề cương chưa duyệt (giống canvas), ẩn khi 0. Số đếm là chip có chữ số, `aria-label` "Hoạt động, 2 việc cần xử lý".
- Bố cục 2 cột: CSS grid `minmax(0,1fr) 320px`, khoảng 20px; dưới ~960px chuyển 1 cột, `aside` xuống dưới. Không cuộn ngang ở 390px.
- `WorkspaceAside`:
  - Tab Tổng quan: thẻ "GIẢNG VIÊN HƯỚNG DẪN" (avatar chữ viết tắt theo `features/navigation/initials.ts`, tên, "Hướng dẫn" hoặc "Hướng dẫn · bạn" khi `supervisor`, mã GV, email dạng liên kết `mailto:`) và thẻ "NHÓM" (mỗi thành viên: avatar, tên, "Đại diện"/"Thành viên" · MSSV · lớp, email `mailto:` khi API trả khác `null`). Email dùng `var(--link)`, cho phép xuống dòng (`overflow-wrap: anywhere`) để không tràn ở 390px.
  - Thẻ phản biện (B2) cũng có email GV phản biện như canvas.
  - Mọi tab: "GIẢNG VIÊN PHẢN BIỆN" → "Chưa phân công"; "HỘI ĐỒNG · LỊCH BẢO VỆ" → "Chưa phân công" + "Giáo vụ sẽ thông báo hội đồng, phòng và giờ bảo vệ khi xếp lịch." (B2/B3 thay bằng dữ liệu thật).

**Xong khi:** test chuyển tab bằng chuột và bàn phím, tab giữ sau reload (`?tab=`), giá trị `?tab=` lạ rơi về mặc định.

### A6. Tab Tổng quan

- Lưới sự kiện: LĨNH VỰC (`topic.field`), NGUỒN ĐỀ TÀI ("Giảng viên gửi · nhóm ghi danh dd/MM/yyyy" hoặc "Sinh viên đề xuất · GVHD chấp nhận dd/MM/yyyy"; lấy ngày từ `topic.history` mục nhóm "Nhóm"/"Trạng thái" nếu có, không có thì bỏ phần ngày), QUY MÔ NHÓM ("n sinh viên"), TRẠNG THÁI ĐỀ CƯƠNG ("Đã duyệt dd/MM/yyyy" từ `outlineApprovedAt` hoặc "Chưa duyệt"). Không thêm ô "Công nghệ".
- "Mô tả đề tài": giữ xuống dòng (`white-space: pre-line`).
- "Yêu cầu": tách theo dòng thành `<ul>`; trống thì bỏ mục.

**Xong khi:** test hiển thị đúng với đề tài GV gửi và đề tài SV đề xuất, yêu cầu rỗng.

### A7. Tab Hoạt động

- `ActivityTab` gồm 3 khối accordion (nút tiêu đề `aria-expanded`, chip trạng thái bên phải tiêu đề):
  1. **Đề cương:** bọc `OutlineSection` hiện có (không viết lại). Chip tiêu đề: "Chưa nộp" / "Chờ duyệt" / "Cần chỉnh sửa" / "Đã duyệt" (cùng nguồn với A4).
  2. **Báo cáo giữa kỳ** và 3. **Báo cáo cuối kỳ · khóa luận:** tách `SubmissionPanel` cho phép render một `kind` (thêm prop `kind?: 'midterm' | 'final'` và prop `data` để dùng dữ liệu đã tải ở A3 thay vì tự gọi lại; giữ tương thích nơi khác đang dùng, ví dụ Chi tiết đề tài của Giáo vụ). Chip tiêu đề: "Chưa mở" (đề cương chưa duyệt) / "Chưa nộp" / "Đã nộp · n phiên bản" / "Quá hạn · cho nộp trễ" / "Đã khóa nộp".
- Khi đề cương chưa duyệt, khối báo cáo hiện câu khóa: "Mục nộp báo cáo giữa kỳ mở sau khi giảng viên hướng dẫn duyệt đề cương. Thời gian nộp theo đợt: <từ> – <hạn>." (ngày lấy từ mốc của đợt qua `deadline` của kind; nếu cần ngày bắt đầu, lấy `GET /api/rounds/{id}` milestones; nếu không lấy được thì chỉ ghi hạn).
- Mặc định mở khối của chặng hiện tại (A4), người dùng mở/đóng tự do.
- Nộp thành công ở bất kỳ khối nào → `reload()` để tiến độ và chip đổi theo.

**Xong khi:** test: chưa duyệt → 2 khối báo cáo khóa; đã duyệt → nộp được giữa kỳ; GVHD không thấy ô nộp; Giáo vụ không thấy nút thao tác nào ngoài Tải. Test cũ của `OutlineSection` và `SubmissionPanel` vẫn xanh.

### A8. Tab Điểm số (khung, chưa có phiếu)

- `member`: thẻ "Kết quả" + chip. Khi `topic.status !== 'Đã hoàn tất'`: chip "Chưa công bố" + câu "Điểm hướng dẫn, phản biện, hội đồng và điểm tổng kết hiển thị sau khi giáo vụ công bố kết quả." Khi `Đã hoàn tất`: hiện banner `role="note"` "Kết quả đã công bố. Bảng điểm chi tiết sẽ hiện ở đây khi hệ thống có phiếu điểm." (B4 thay).
- `supervisor` / `staff`: dải ghi chú vai trò ("Bạn đang xem với vai trò giảng viên hướng dẫn." / "Bạn đang xem với vai trò giáo vụ, chỉ xem.") + nhãn "SINH VIÊN KHÔNG THẤY"; 3 thẻ "Chấm điểm hướng dẫn", "Chấm điểm phản biện", "Điểm hội đồng", mỗi thẻ chip "Chưa nhập" và câu "Phiếu chấm sẽ mở khi có chức năng chấm điểm." Khối "Điểm khóa luận (tạm tính) · theo từng sinh viên" liệt kê từng thành viên với "Chưa đủ điểm" và dòng công thức "(CTHĐ + TKHĐ + CBHD×2 + CBPB×2) / 6 · chỉ tính khi đủ 4 điểm".
- Không có ô nhập, không có điểm giả.

**Xong khi:** test 3 vai trò; SV không bao giờ thấy chữ "SINH VIÊN KHÔNG THẤY" hay thẻ phiếu.

### A9. Tab Thông báo (trạng thái trống)

- Câu dẫn theo vai trò (mục 1). Nội dung: `status-state app-empty` tiêu đề "Chưa có thông báo cho đề tài này", câu "Thông báo của giảng viên hướng dẫn và giáo vụ gửi đến nhóm sẽ hiện ở đây." Không gọi `/api/notifications/me` để ghép tạm (chuông là hộp thư cá nhân, không phải bảng thông báo của nhóm).
- Thành phần thẻ thông báo (`NoticeCard`: avatar, tiêu đề h3, người gửi, chip vai trò, "gửi <phạm vi>", thời gian, nội dung `pre-line`) dựng sẵn với props và test render, để B5 chỉ cần nối dữ liệu.

**Xong khi:** tab hiện trạng thái trống đúng chữ; `NoticeCard` có test.

### A10. Hủy ghi danh trong không gian đề tài

- Hiện nút "Hủy ghi danh" ở `WorkspaceHeader` chỉ khi `viewerRole === 'member'` và `myRegistration.canCancel === true`, kèm chú thích "Hủy được trong thời gian đăng ký, khi nhóm chưa nộp bài nào."
- `CancelRegistrationDialog` dùng `ConfirmDialog` (danger): tiêu đề "Hủy ghi danh đề tài?", mô tả nêu áp dụng cho cả nhóm và đề tài trở về danh sách chưa đăng ký, ô hiện tên đề tài, câu "Nhóm vẫn giữ nguyên thành viên và có thể ghi danh lại đề tài còn trống trong thời gian đăng ký." (PDR-047; **không** dùng câu canvas "Không hoàn tác được… đăng ký lại từ đầu"). Nút trái "Giữ ghi danh", nút phải "Hủy ghi danh".
- Gọi `studentTopicService.cancel(topicId)`. Thành công: `toast.success("Đã hủy ghi danh đề tài <mã>.")` rồi `router.replace('/sv/de-tai')` (trang sẽ hiện "Chưa có đề tài"). Lỗi 409: giữ hộp thoại, hiện lỗi tại chỗ trong hộp thoại (`error` prop) bằng message API.

**Xong khi:** test: nút ẩn khi `canCancel=false`; hủy thành công; 409 hiện lỗi tại chỗ.

### A11. Điểm vào và điều hướng

- `/sv/de-tai`: giữ luồng hiện có (`StudentMyTopicPage`) dùng `WorkspacePage embedded`.
- `/gv/huong-dan`: nút "Mở" đã trỏ `/de-tai/[id]`; giữ.
- Chi tiết đề tài Giáo vụ `/giao-vu/de-tai/[id]` (`features/topics/components/TopicDetailPage.tsx`): thêm liên kết phụ "Mở không gian đề tài" tới `/de-tai/[id]` ở hàng tiêu đề, chỉ khi đề tài có nhóm.
- Ghi nhớ quy tắc dự án: từ Trang chủ trong một đợt sang Đề tài/Đề xuất phải áp sẵn bộ lọc đợt. Màn này không phải trang danh sách nên không có bộ lọc; chỉ giữ `?dot=` trên liên kết quay lại nếu trang đích dùng tham số đó.
- Chuông thông báo (PDR-057) đã có `href=/de-tai/{id}`; không đổi. Có thể nối thêm `?tab=hoat-dong` khi tạo thông báo nộp/duyệt, nhưng đó là đổi backend: làm trong cùng commit, cập nhật PDR-059.

**Xong khi:** đi được từ 3 vai trò vào màn và quay lại đúng trang.

### A12. Hoàn thiện, kiểm tra, tài liệu

- Chạy lệnh kiểm tra cuối `docs/DESIGN.md` (hex còn sót, cỡ chữ ngoài thang, chiều cao < 40px) và `npm run typecheck && npm run lint && npm test`; backend `dotnet test`.
- Chạy app (`chay-du-an.bat`), đăng nhập 3 tài khoản seed (`sv.22520001@qlkltn.local`, `gv.0001@qlkltn.local`, `giaovu.0001@qlkltn.local`), mở cùng một đề tài: kiểm quyền, tab, tiến độ; xem ở 390px và 1440px.
- Gọi API bằng vai trò sai (SV khác nhóm, GV khác) → phải 404.
- Cập nhật `docs/plan/phase-04-de-cuong-va-tai-lieu.md` (ghi chú P04-S02: "màn của GVHD" nay có trong Không gian đề tài) và tick các mục phần A ở mục 8 file này.

**Xong khi:** mọi lệnh xanh; ảnh chụp 3 vai trò (tùy chọn) lưu ngoài repo.

---

## 7. Phần B: mở rộng khi phase sau có backend

Mỗi bước B **chỉ bắt đầu khi phase tương ứng đã có hợp đồng API được ghi trong PDR**. Gemini không tự thiết kế nghiệp vụ ở phần này; nếu được giao làm luôn backend thì phải viết PDR trước, theo phase file tương ứng.

### A13. Nhận xét và checklist yêu cầu chỉnh sửa cho Giữa kỳ và Cuối kỳ

**Quyết định của người dùng (2026-11-16):** GVHD nhận xét được cả ba mục Đề cương, Báo cáo giữa kỳ, Báo cáo cuối kỳ, và Giữa kỳ/Cuối kỳ có checklist yêu cầu chỉnh sửa giống Đề cương. Bước này cần backend mới, làm sau A12 và trước B1.

1. **Docs trước:** ghi quyết định vào PDR-059 (hoặc PDR riêng PDR-060 nếu PDR-059 đã đóng), sửa `docs/requirements/BUSINESS_RULES.md` mục Tài liệu, ghi chú ở DESIGN/03 và mục "Chưa làm" của PDR-058.
2. **Quy tắc, lấy theo PDR-057 trừ phần duyệt:**
   - Nhận xét gắn với từng phiên bản, chỉ GVHD viết/sửa, ≤ 2000 ký tự, rỗng để xóa; không chặn gì.
   - Yêu cầu chỉnh sửa: chỉ GVHD tạo (cần đã có ít nhất một phiên bản của **đúng loại** đó), ghi phiên bản đang xem; trạng thái `open`/`resolved`.
   - Lần nộp tiếp theo của loại đó liên kết với mọi yêu cầu đang mở **của cùng loại**.
   - GVHD "Xác nhận hoàn tất" một yêu cầu chỉ sau khi nhóm đã nộp ít nhất một phiên bản liên kết với nó; đóng lặp 409. Nhóm không tự đóng (giữ PDR-013/057, người dùng xác nhận 2026-11-16).
   - Giữa kỳ/Cuối kỳ **không có bước duyệt**. Tạo yêu cầu không mở thêm hạn nộp (cửa sổ nộp vẫn theo PDR-058).
   - **Điều kiện chặn:** chốt bản cuối cần mọi yêu cầu Cuối kỳ đã được GVHD xác nhận hoàn tất (Q2b); Giữa kỳ không chặn gì; Đề cương giữ như PDR-057.
   - Lịch sử đề tài nhóm "Bài nộp" và chuông thông báo như PDR-057 (nhận xét/yêu cầu → thành viên nhóm).
3. **Backend:**
   - `RevisionRequest` thêm cột `Kind` (`SubmissionKind`, mặc định `Outline` cho bản ghi cũ). Migration mới, review SQL, không chạy trên Neon.
   - Cột nhận xét đã có sẵn trên `TopicSubmission` (`ReviewComment`, `ReviewedById`, `ReviewedAt`): dùng lại.
   - Endpoint mới dưới `api/topics/{topicId}/submissions` (đặt tên chốt trong PDR): `PUT /{submissionId}/comment`, `POST /requests` body `{ kind, content }`, `POST /requests/{requestId}/resolve`. Quyền: GVHD; SV gọi → 403; người ngoài → 404. Tách logic dùng chung với Outline (không chép code), ví dụ đưa phần yêu cầu/nhận xét thành service chung tham số theo `Kind`. API đề cương giữ nguyên. Quyền: GVHD; SV gọi → 403; người ngoài → 404. Tách logic dùng chung với Outline (không chép code), ví dụ đưa phần yêu cầu/nhận xét thành service chung tham số theo `Kind`.
   - `TopicSubmissionsDto.kinds[]` thêm `requests[]` (cùng dạng `RevisionRequest` của outline), `canReview`; `versions[]` thêm `reviewComment`, `reviewedBy`, `reviewedAt`, `addressedRequestIds[]`.
   - Outline cũ chỉ lấy yêu cầu `Kind = Outline`; test cũ `OutlineWorkflowTests` vẫn xanh.
   - Test: tạo yêu cầu khi chưa có phiên bản (409), yêu cầu giữa kỳ không liên kết với bản cuối kỳ, đóng trước khi nộp lại (409), quyền 3 vai trò + người ngoài; `OutlineWorkflowTests` cũ vẫn xanh.
4. **Frontend:** trong khối Giữa kỳ và Cuối kỳ (A7) thêm danh sách yêu cầu và ô nhận xét theo phiên bản, **tái dùng thành phần của `OutlineSection`** (tách phần "Yêu cầu chỉnh sửa" và "Nhận xét" ra component chung trong `features/outline` hoặc `features/workspace`). Chip tiêu đề khối thêm "Cần chỉnh sửa · k yêu cầu". Số đếm tab Hoạt động = tổng yêu cầu mở của cả ba loại.

**Xong khi:** GVHD nhận xét và tạo/xác nhận hoàn tất yêu cầu ở cả 3 mục; nhóm thấy và nộp lại; Giáo vụ chỉ xem; test backend/frontend xanh; yêu cầu mở ở Giữa kỳ không chặn gì; ở Cuối kỳ chặn chốt bản cuối (B1).

### B1. Chốt bản cuối, hạn bổ sung (P04-S03)

- **Quyết định 2026-11-16:** bỏ loại nộp `Thesis` (`SubmissionKind.Thesis`, `'Bản khóa luận'` trong `SUBMISSION_KINDS` ở `types/topic.ts`) và nhóm "Bản khóa luận" ở tab Báo cáo và phiên bản của Chi tiết đề tài Giáo vụ. Chốt bản cuối đánh dấu một phiên bản `Final`; phiên bản đó hiện nhãn "Bản chính thức" và là bản khóa luận chính thức (dùng cho điều kiện công bố PDR-011/049). Ghi vào PDR của P04-S03 và sửa PDR-058 mục "Chưa làm" (câu "Bản khóa luận dùng `Kind = Thesis`"). Không cần migration dữ liệu vì chưa có bản ghi `Thesis` (kiểm lại trước khi xóa enum).
- Khối Cuối kỳ thêm: dòng "Hạn chốt bản cuối", "Bản mới nhất", thanh "Chốt bản cuối" (chỉ `member`), hộp thoại "Chốt bản cuối?" ("Sau khi chốt, nhóm không tải lên thêm phiên bản nào và không hoàn tác được."), nhãn "Bản chính thức" / "Hệ thống tự chốt", banner hạn bổ sung riêng (PDR-011).
- Nhận xét và checklist của Giữa kỳ/Cuối kỳ đã chuyển sang A13.
- **Chặn chốt khi còn yêu cầu mở (2026-11-16, Q2b):** nút "Chốt bản cuối" khóa và hiện lý do `role="note"` "Còn k yêu cầu chỉnh sửa chưa được GVHD xác nhận hoàn tất." khi Báo cáo cuối kỳ còn yêu cầu `open`. Backend kiểm lại ngay trong câu cập nhật (409 nếu có yêu cầu mới mở cùng lúc). Hệ thống tự chốt lúc hết hạn không bị chặn bởi điều kiện này.
- Tiến độ: bước "Chốt bản cuối"/"Hệ thống tự chốt" `done`.
- Chờ câu hỏi Q1, Q2 (mục 9).

### B2. Phản biện (P05-S02)

- Backend mở quyền đọc đề tài/đề cương/bài nộp cho GV phản biện (`SubmissionMapping.Load`, outline query), `viewerRole` thêm `reviewer`.
- Aside "GIẢNG VIÊN PHẢN BIỆN" hiện tên, ngày phân công, câu "Nhóm tự liên hệ giảng viên phản biện."
- Liên kết quay lại "Đề tài phản biện" (`/gv/phan-bien`). Tab mặc định `diem-so`.

### B3. Hội đồng và lịch (P06)

- Aside "HỘI ĐỒNG · LỊCH BẢO VỆ": thứ, ngày, giờ bắt đầu–kết thúc, phòng, tên hội đồng, Chủ tịch, Thư ký; chỉ lịch đã công bố và lượt có hiệu lực (PDR-016); đính chính hiện kèm (PDR-018).
- `viewerRole` thêm `councilChair`, `councilSecretary`. Liên kết quay lại "Hội đồng".

### B4. Phiếu điểm và kết quả (P07)

- Thẻ phiếu: bảng tiêu chí chung → hạng mục con, cột "Tối đa", cột "Điểm SV1/SV2" theo từng sinh viên (nhóm 1 hoặc 2 SV), ô số `step=0.25`, `min=0`, `max` theo tiêu chí; tổng tự cộng (PDR-035); lỗi "Có hạng mục vượt điểm tối đa. Sửa lại trước khi lưu." `role="alert"`; thiếu hạng mục → lỗi tại chỗ; nhận xét (PB: không bắt buộc).
- Ai nhập: GVHD → phiếu HD; GV phản biện → phiếu PB, chỉ khi nhóm đã nộp báo cáo cuối kỳ (PDR-022, hiện lý do khóa); Thư ký → hai phiếu CTHĐ và TKHĐ (công tắc "Phiếu chủ tịch"/"Phiếu thư ký"); Chủ tịch chỉ xem (PDR-050); Giáo vụ chỉ xem.
- Sửa được tới khi Giáo vụ xác nhận; sau đó trạng thái "Kết quả đã xác nhận, không sửa được."
- Cảnh báo lệch: bốn cặp chéo, ngưỡng ≥ 2,00 do backend tính (PDR-007/049), hiện ở thẻ hội đồng cho Thư ký/Chủ tịch; không chặn lưu.
- "Điểm khóa luận (tạm tính)": `(CTHĐ + TKHĐ + 2×CBHD + 2×CBPB)/6`, làm tròn nửa lên 2 chữ số (PDR-008), backend trả số, frontend chỉ định dạng dấu phẩy.
- SV sau công bố: 4 dòng điểm riêng + điểm khóa luận + hộp thoại "Chi tiết phiếu đánh giá" (chỉ xem, có các nút chọn phiếu).
- Tiến độ ĐÁNH GIÁ lấy từng phiếu thay cho suy từ `topic.status`.

### B5. Thông báo theo nhóm (P08-S01)

- Cần mô hình "bài đăng" gắn phạm vi (đợt/nhóm/vai trò) tách khỏi chuông, PDR-038 (ẩn chỉ phía người gửi). Khi có `GET /api/topics/{id}/notices` (tên chốt trong PDR), nối vào `NoticeTab` bằng `NoticeCard` đã dựng ở A9.
- Nút "Gửi thông báo cho nhóm" (GVHD) mở màn Gửi thông báo với nhóm chọn sẵn.

---

## 8. Checklist tiến độ (Gemini tick khi xong, kèm commit)

- [x] A0 Chuẩn bị, baseline (commit `9ef806a` merged main, test baseline xanh)
- [x] A1 PDR-059 + DESIGN/03 (commit `a21340f`)
- [x] A2 `round` trong `TopicDetailDto` (commit `529974a`)
- [x] A3 Module `features/workspace`, tải dữ liệu (`workspaceService.ts`, `workspaceProgress.ts`)
- [x] A4 Khung tiến độ + test (`workspace.css`, `ProgressPanel.tsx`, `workspaceProgress.test.ts`)
- [x] A5 Tiêu đề, tab, aside (`WorkspaceHeader.tsx`, `WorkspaceTabs.tsx`, `WorkspaceAside.tsx`)
- [x] A6 Tab Tổng quan (`OverviewTab.tsx`)
- [x] A7 Tab Hoạt động (`ActivityTab.tsx`, tích hợp `OutlineSection` và nâng cấp `SubmissionPanel.tsx`)
- [x] A8 Tab Điểm số (khung) (`ScoresTab.tsx`)
- [x] A9 Tab Thông báo (trống + `NoticeCard`) (`NoticeTab.tsx`)
- [x] A10 Hủy ghi danh (`CancelRegistrationDialog.tsx`)
- [x] A11 Điểm vào, điều hướng (cập nhật routes `/de-tai/[id]`, `/sv/de-tai` và nút "Mở không gian đề tài" tại `TopicDetailPage.tsx`)
- [x] A12 Kiểm tra, tài liệu (tokens chuẩn `docs/DESIGN.md`, `typecheck` 0 lỗi, `lint` 0 warnings, 324 backend tests passed, 501 frontend tests passed)
- [x] A13 Nhận xét + checklist yêu cầu cho Giữa kỳ/Cuối kỳ (backend + frontend)
- [ ] B1–B5: theo phase sau

**Định nghĩa xong của phần A:** 3 vai trò mở cùng một đề tài thấy đúng tiến độ, 4 tab, aside; thao tác đề cương/báo cáo/hủy ghi danh chạy trên API thật và cập nhật tiến độ ngay; người ngoài nhận 404; không có dữ liệu giả; test frontend/backend và lệnh kiểm tra giao diện xanh; tài liệu đã cập nhật.

---

## 9. Câu hỏi cần chốt (không tự quyết)

| ID | Câu hỏi | Ảnh hưởng | Tạm thời |
| --- | --- | --- | --- |
| Q1 | Chốt bản cuối áp lên loại nào? | B1, P04-S03 | **Đã chốt 2026-11-16:** không có loại nộp riêng "Bản khóa luận". Chốt bản cuối là chọn một phiên bản Báo cáo cuối kỳ (`Final`); phiên bản được chốt là bản khóa luận chính thức. |
| Q2 | GVHD có nhận xét báo cáo giữa kỳ không? | A13 | **Đã chốt 2026-11-16:** có, cả 3 mục có nhận xét và checklist yêu cầu như đề cương (A13). |
| Q2b | Yêu cầu chỉnh sửa còn mở ở Báo cáo cuối kỳ có chặn "Chốt bản cuối" không? | A13, B1 | **Đã chốt 2026-11-16:** chặn. Nhóm chỉ chốt được khi mọi yêu cầu chỉnh sửa của Báo cáo cuối kỳ đã hoàn tất (theo PDR-013/057, GVHD là người xác nhận hoàn tất, nhóm không tự tick). Giữa kỳ: yêu cầu mở không chặn gì. Hệ thống tự chốt khi hết hạn (PDR-011) vẫn chạy kể cả còn yêu cầu mở, ghi lịch sử. |
| Q3 | Có hiện email trong aside như canvas không? | A2, A5 | **Đã chốt 2026-11-16:** hiện (email GVHD cho mọi người xem; email SV cho GVHD và Giáo vụ). |
| Q4 | Giáo vụ có thấy tab Điểm số với 3 thẻ chỉ xem không? | A8 | **Đã chốt 2026-11-16:** có, chỉ xem. |
| Q5 | Tab Thông báo lấy dữ liệu từ đâu? | A9, B5, P08 | **Đã chốt 2026-11-16:** để trạng thái trống tới P08; nguồn dữ liệu chốt trong PDR của P08-S01. |
| Q6 | Ai đóng yêu cầu chỉnh sửa? | A13 | **Đã chốt 2026-11-16:** giữ PDR-013/057: GVHD xác nhận hoàn tất sau khi nhóm nộp lại; nhóm không tự tick. Áp cho cả 3 mục. |

Tất cả Q1–Q6 đã chốt ngày 2026-11-16. Câu hỏi mới phát sinh khi code: thêm dòng vào bảng này và dừng phần liên quan.
