# PDR-059: Không gian đề tài — Khung tiến độ và các tab (P04-S02 / P04-S03)

## Trạng thái

Đã chấp nhận ngày 2026-11-16. Quyết định này chuẩn hóa Không gian đề tài theo canvas (`KhongGianDeTai.dc.html`, `KhongGianDeTai-GV.dc.html`), tích hợp chặng Đề cương ([PDR-057](PDR-057-de-cuong-va-yeu-cau-chinh-sua.md)), Báo cáo giữa kỳ và cuối kỳ ([PDR-058](PDR-058-nop-bao-cao-giua-ky-cuoi-ky.md)), hủy ghi danh ([PDR-047](PDR-047-huy-ghi-danh-de-tai-cong-bo.md)) và các yêu cầu giao diện của Không gian đề tài.

## Bối cảnh

Trước đây, giao diện Không gian đề tài (`app/(protected)/de-tai/[id]/page.tsx` và `/sv/de-tai/page.tsx`) chỉ hiển thị các khối dọc rời rạc: thẻ thông tin đề tài, chặng Đề cương (`OutlineSection`) và chặng Báo cáo (`SubmissionPanel`). Màn hình chưa có khung tiến độ 6 chặng, chưa chia 4 tab theo canvas, chưa có cột thông tin bên phải (aside), và chưa thống nhất quyền xem cho cả 3 vai trò (Sinh viên, Giảng viên, Giáo vụ).

Ngoài ra, một số chi tiết trên canvas ban đầu đã lỗi thời so với các PDR và quyết định nghiệp vụ mới hơn (như cơ chế đóng yêu cầu chỉnh sửa, việc không có nút hoàn tác duyệt đề cương, việc bỏ bước Chủ tịch xác nhận điểm, v.v.). Quyết định này chốt cách triển khai thống nhất trên toàn bộ hệ thống.

## Quyết định

### 1. Route và vai trò người xem

- Dùng chung một route `/de-tai/[id]` cho cả 3 vai trò: Sinh viên (thành viên nhóm), Giảng viên hướng dẫn (GVHD), và Giáo vụ (`staff`).
- `/sv/de-tai` tiếp tục nhúng màn hình này (`embedded=true`) khi sinh viên đã có đề tài trong đợt đang diễn ra.
- Quyền người xem do máy chủ trả (`viewerRole` từ `GET /api/topics/{id}/outline`):
  - `member`: Thành viên nhóm đang thực hiện đề tài.
  - `supervisor`: Giảng viên hướng dẫn của đề tài.
  - `staff`: Giáo vụ (quyền chỉ xem toàn bộ tiến độ, tài liệu, điểm số).
  - Phần B mở rộng: `reviewer` (GV phản biện), `councilChair` / `councilSecretary` (Hội đồng).
  - Người ngoài (sinh viên khác, giảng viên không liên quan): nhận HTTP 404 từ API và màn hình hiển thị trạng thái không tìm thấy đề tài.

### 2. Dãy tab và trạng thái URL

- Bốn tab: `tong-quan` (Tổng quan đề tài), `thong-bao` (Thông báo), `hoat-dong` (Hoạt động), `diem-so` (Điểm số).
- Tab hiện tại được đồng bộ với tham số truy vấn `?tab=`:
  - Giá trị hợp lệ: `tong-quan | thong-bao | hoat-dong | diem-so`.
  - Mặc định: `hoat-dong` cho `member`, `supervisor`, `staff` (ở phần B: mặc định `diem-so` cho `reviewer` và thành viên hội đồng).
  - Giá trị lạ hoặc không hợp lệ: rơi về tab mặc định.
- Số đếm trên tab Hoạt động: hiển thị tổng số yêu cầu chỉnh sửa đang mở khi đề cương chưa duyệt (và sau này là cả giữa kỳ/cuối kỳ theo A13). Ẩn chip đếm khi số lượng bằng 0.

### 3. Khung tiến độ 6 chặng

- Khung tiến độ gồm 6 chặng: **ĐĂNG KÝ**, **ĐỀ CƯƠNG**, **GIỮA KỲ**, **CUỐI KỲ**, **ĐÁNH GIÁ**, **KẾT QUẢ**.
- Tiến độ được tính thuần túy ở frontend (`workspaceProgress.ts`) dựa trên dữ liệu thật từ API (`topic`, `outline`, `submissions`), không lưu trạng thái tiến độ vào cơ sở dữ liệu.
- Mặc định mở, có nút thu gọn/mở rộng với `aria-expanded` và `aria-controls`.
  - Khi mở: hiển thị 6 hàng với các chip bước nối nhau theo thứ tự hoặc song song (Đánh giá).
  - Khi thu gọn: hiển thị dãy 6 chip chặng, chip của chặng hiện tại ghi kèm bước đang chờ.
- Ba kiểu chip bước:
  - `done`: Nền xanh lá nhạt (`--ok-bg`), chữ `--ok-ink`, chấm tròn đặc.
  - `now`: Nền đậm (`--ink`), chữ trắng (`--surface`), chấm tròn `--accent`.
  - `todo`: Nền trắng (`--surface`), viền `--line`, chữ `--muted`, chấm tròn rỗng.
- Ngoại lệ: Nếu đề tài ở trạng thái `Không đủ điều kiện công bố`, chặng KẾT QUẢ hiển thị bước "Không đủ điều kiện công bố" (`now`). Nếu đề tài `Không có nhóm`, hiển thị banner lưu ý và không vẽ tiến độ.

### 4. Bố cục và cột thông tin phụ (Aside)

- Bố cục 2 cột: Cột trái là nội dung tab (`tabpanel`), cột phải là `aside` chứa các thẻ thông tin.
- Trên màn hình hẹp (< 960px): Cột `aside` tự động chuyển xuống dưới nội dung tab, không xuất hiện thanh cuộn ngang ở 390px.
- Thẻ trong `aside`:
  - Tab Tổng quan: Thẻ "GIẢNG VIÊN HƯỚNG DẪN" (avatar, họ tên, mã GV, email dạng `mailto:`) và thẻ "NHÓM" (danh sách thành viên, vai trò Đại diện/Thành viên, MSSV, lớp, email dạng `mailto:` nếu có).
  - Mọi tab: Thẻ "GIẢNG VIÊN PHẢN BIỆN" và thẻ "HỘI ĐỒNG · LỊCH BẢO VỆ" (khi chưa có dữ liệu backend, hiển thị trạng thái "Chưa phân công" kèm câu giải thích trung thực).

### 5. Xử lý các điểm canvas lỗi thời

Theo quy tắc ưu tiên tài liệu, không làm theo canvas ở các điểm đã lỗi thời:

| Canvas cũ | Triển khai theo PDR |
| --- | --- |
| SV tick vào yêu cầu chỉnh sửa; GV có "Mở lại", nút xóa yêu cầu | Theo PDR-013/057: Chỉ GVHD "Xác nhận hoàn tất" sau khi nhóm nộp lại; không xóa, không mở lại. |
| Nút "Hoàn tác" sau khi duyệt đề cương | Không có (PDR-057). Duyệt đề cương không hoàn tác. |
| Text "Bản nộp sau hạn vẫn được nhận và gắn nhãn Nộp trễ" | Chỉ hiển thị khi mốc đợt có bật nộp trễ và còn trong hạn trễ riêng (PDR-041/058). Lấy thông tin từ `window` và `blockedReason`. |
| Chủ tịch xác nhận / trả lại điểm | Bỏ (PDR-050). Chủ tịch chỉ xem điểm do Thư ký nhập. |
| `viewAs` chỉ có Sinh viên / Giảng viên | Thêm góc nhìn Giáo vụ (`staff`), chỉ xem toàn bộ (PDR-057). |
| Badge "Bản chính thức" | Chưa có cho tới khi hoàn thiện chốt bản cuối (P04-S03). |
| Chip trạng thái đề tài lấy theo `phase` | Trạng thái hiển thị theo `topic.status` chuẩn của backend (PDR-049). Duyệt đề cương không đổi trạng thái đề tài. |
| Ô "CÔNG NGHỆ" trong lưới sự kiện | Không có trường dữ liệu này trong mô hình; bỏ ô này khỏi giao diện. |
| Email GV/SV trong aside | Hiển thị: Email GVHD cho tất cả người xem; Email thành viên nhóm hiển thị cho GVHD, Giáo vụ và chính sinh viên đó (PDR-059). |

### 6. Tab Điểm số và Tab Thông báo

- **Tab Điểm số:**
  - `member`: Thẻ kết quả. Chưa công bố kết quả → chip "Chưa công bố" + câu hướng dẫn. Khi đã công bố kết quả nhưng chưa có phiếu điểm backend → banner `role="note"` thông báo kết quả đã công bố.
  - `supervisor` và `staff`: Dải banner ghi chú vai trò kèm nhãn "SINH VIÊN KHÔNG THẤY"; 3 thẻ "Chấm điểm hướng dẫn", "Chấm điểm phản biện", "Điểm hội đồng" với chip "Chưa nhập"; khối "Điểm khóa luận (tạm tính)" hiển thị công thức và "Chưa đủ điểm".
- **Tab Thông báo:**
  - Hiển thị trạng thái trống trung thực (`status-state app-empty`): "Chưa có thông báo cho đề tài này. Thông báo của giảng viên hướng dẫn và giáo vụ gửi đến nhóm sẽ hiện ở đây."
  - Không lấy tạm dữ liệu từ hộp thư cá nhân (`/api/notifications/me`).
  - Dựng sẵn component `NoticeCard` để sẵn sàng tích hợp khi có API thông báo nhóm ở Phase 08.

### 7. Hủy ghi danh

- Nút "Hủy ghi danh" chỉ hiển thị ở tiêu đề khi `viewerRole === 'member'` và `myRegistration.canCancel === true` (đợt còn mở đăng ký và nhóm chưa nộp đề cương).
- Hộp thoại xác nhận nêu rõ: Sau khi hủy, đề tài quay lại danh sách chưa đăng ký, nhóm vẫn giữ nguyên thành viên và có thể ghi danh đề tài khác (PDR-047).
- Thao tác thành công: Báo toast và chuyển hướng về `/sv/de-tai`. Lỗi (409 do đã nộp đề cương): hiển thị thông báo lỗi tại chỗ trong hộp thoại.

## Hợp đồng API

### Bổ sung trong `GET /api/topics/{id}` (`TopicDetailDto`)

1. Thêm đối tượng `round`:
   ```json
   "round": {
     "id": "uuid",
     "name": "Khóa luận tốt nghiệp HK1 2026-2027",
     "status": "Running"
   }
   ```
2. Thêm trường `email`:
   - `supervisor.email`: `string | null` (email của GVHD, trả về cho mọi người xem được đề tài).
   - `group[].email`: `string | null` (email của từng thành viên; trả về cho GVHD và Giáo vụ; với sinh viên trong nhóm thì chỉ trả về email của chính sinh viên đó, các bạn cùng nhóm là `null`).

## Giao diện

- Thư mục thành phần: `app/frontend/src/features/workspace/`.
- Tiền tố lớp CSS: `wsp-` trong `workspace.css`. Toàn bộ màu sắc dùng token `var(--...)`, vùng bấm ≥ 40px, hỗ trợ điều hướng bàn phím đầy đủ cho tab và accordion.

## Hệ quả

- Toàn bộ Không gian đề tài được quy tụ về một nơi, tái sử dụng logic và component cho cả ba vai trò.
- Dữ liệu hoàn toàn dựa trên API thật, không dùng mock data hay suy diễn ngoài tài liệu.
- Chuẩn bị sẵn cấu trúc module cho các tính năng mở rộng tiếp theo (phản biện, hội đồng, chấm điểm, thông báo nhóm).
