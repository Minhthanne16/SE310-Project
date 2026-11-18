# PDR-053: Đề tài của giảng viên và công bố danh sách (P03-S01)

## Trạng thái

Đã chấp nhận khi triển khai P03-S01 ngày 2026-11-07. Quy tắc nghiệp vụ lấy từ [BUSINESS_RULES](../requirements/BUSINESS_RULES.md), DESIGN 03 (Đề tài của tôi, Quản lý đề tài, Chi tiết đợt) và [PDR-030](PDR-030-khoa-go-nguoi-tham-gia-da-co-du-lieu.md), [PDR-031](PDR-031-chi-ket-thuc-dot-khi-moi-de-tai-ket-thuc.md), [PDR-048](PDR-048-cong-bo-de-tai-o-chi-tiet-dot.md), [PDR-049](PDR-049-vong-doi-ket-qua-theo-nhom-de-tai.md). Các mục ghi "lựa chọn triển khai" do người làm task đề xuất; nhóm có thể đổi trong PDR sau.

## Bối cảnh

Màn đề tài của Giáo vụ chạy trên kho demo, giảng viên và sinh viên chưa có màn đề tài, backend chưa có bảng đề tài. Vì vậy công bố chưa kiểm tra được "có ít nhất 1 đề tài", kết thúc đợt chưa chặn được đề tài chưa kết thúc, và PDR-030 chưa khóa gỡ giảng viên đã có đề tài.

## Quyết định

### Hợp đồng API

Mọi endpoint yêu cầu đăng nhập; lỗi dùng `ApiResponse`.

| Method + route | Vai trò | Thành công | Lỗi |
| --- | --- | --- | --- |
| `GET /api/topics?roundId=` | Giáo vụ | 200 `{ round, items, loads }` | 403, 404 |
| `GET /api/topics/mine?roundId=` | GV của đợt | 200 `{ round, items, load }` | 403 không thuộc đợt, 404 |
| `GET /api/topics/published?roundId=` | SV của đợt | 200 `{ round, items, loads: [] }` | 403 không thuộc đợt, 404, 409 chưa công bố |
| `GET /api/topics/{id}` | Giáo vụ; GVHD của đề tài; SV của đợt sau công bố | 200 `TopicDetailDto` (SV không nhận lịch sử) | 404 (kể cả khi không có quyền, để không lộ đề tài) |
| `POST /api/topics` | GV của đợt | 201 `TopicDto` | 400 `errors[]`, 403, 404, 409 |
| `PUT /api/topics/{id}` | GVHD | 200 `TopicDto` | 400, 403, 404, 409 |
| `DELETE /api/topics/{id}` | GVHD | 200 `true` | 403, 404, 409 |

- **`TopicDto`:** `{ id, roundId, code, title, field, description, requirements, supervisor{id,code,name}, source, status, createdAt, updatedAt, canEdit, canDelete }`.
  - `status` là nhãn tiếng Việt, trùng `TOPIC_STATUSES` ở frontend.
  - `canEdit` thuộc `all | content | none`; `canDelete` là quyền của chính người xem.
- **`round`:** `{ roundId, roundName, roundStatus, topicsPublishedAt, submissionStart, submissionEnd, registrationEnd, canSubmit, submitBlockedReason }`.
- **`load`:** `{ lecturerId, count, min, max, level: below | ok | over }`.
- **`TopicDetailDto.history`:** `{ id, at, actor, category, action, detail }`.
- Công bố vẫn ở `POST /api/rounds/{id}/topics/publish` (PDR-048).
- `RoundDto.topicSummary.byStatus` trả đủ 12 trạng thái của PDR-049; trước đây backend chỉ trả 9 trong khi frontend khai báo 12.

### Quy tắc đã chốt trong tài liệu, nay thực thi ở backend

- **GV thêm/sửa/xóa đề tài:** phải thuộc danh sách giảng viên của đợt, đợt Đang diễn ra và chưa công bố danh sách. Chỉ được thao tác trong mốc "GV gửi đề tài", từ ngày bắt đầu đến hết 23:59 ngày kết thúc theo giờ Việt Nam. Hết mốc GV gửi thì chặn cả thêm, sửa, xóa dù Giáo vụ chưa công bố. Kiểm tra hạn ở backend cho cả ba endpoint; yêu cầu quá hạn trả 409 (PDR-048, OQ-025(c)).
- **Sau công bố:**
  - Toàn bộ đề tài GV chỉ xem, không thêm, sửa hoặc xóa, kể cả đề tài chưa có nhóm.
  - API thêm/sửa/xóa từ chối với 409; `canEdit=none`, `canDelete=false`.
  - Đợt Đã kết thúc cũng chỉ xem.
- **Mức đề tài GV:** số đề tài = đề tài GV gửi + đề xuất SV đã chấp nhận. Vượt mức chỉ cảnh báo (thông điệp lưu và cờ trên danh sách), không chặn.
- **Công bố:** Giáo vụ thực hiện thủ công sau hạn GV gửi đề tài và trước khi kết thúc hạn SV đăng ký, cần ít nhất 1 đề tài; không cho công bố sớm. Mỗi đề tài nhận một mục lịch sử "Công bố danh sách đề tài" ghi Giáo vụ đã công bố.
- **Kết thúc đợt:** bị chặn khi còn đề tài chưa ở trạng thái kết thúc (PDR-031/048), thông báo "Còn n đề tài chưa công bố kết quả…".
- **PDR-030:** không gỡ được giảng viên đã có đề tài trong đợt. Tài khoản là GVHD của đề tài tính là "đã có dữ liệu", nên chỉ bị vô hiệu hóa, không xóa (bổ sung vào PDR-004).
- **Sinh viên:** chỉ thấy đề tài GV công bố của đợt mình thuộc, sau khi Giáo vụ công bố.

### Lựa chọn triển khai

- **Trường:**
  - Tên đề tài ≤ 300 ký tự, bắt buộc.
  - Lĩnh vực ≤ 100 ký tự, bắt buộc; nhập tự do, giao diện có gợi ý.
  - Mô tả ≤ 4000 ký tự, bắt buộc.
  - Yêu cầu ≤ 2000 ký tự, không bắt buộc.
  - Khoảng trắng đầu/cuối được bỏ.
- **Mã đề tài:** `DT-001`, `DT-002`… theo thứ tự trong đợt. Chỉ mục duy nhất `(RoundId, Number)`, thử lại khi hai GV gửi cùng lúc.
- **Xóa trong hạn GV gửi và trước công bố:** xóa hẳn đề tài cùng lịch sử của nó. Đề tài chưa từng hiện cho sinh viên và chưa có nhóm.
- **Lịch sử:** thêm nhóm "Nội dung" cho sửa tên/lĩnh vực/mô tả/yêu cầu (giá trị trước → sau). "Gửi đề tài" và "Công bố danh sách đề tài" thuộc nhóm "Trạng thái". Sửa không đổi gì thì không ghi.
- **Trạng thái khi hết hạn đăng ký** (PDR-049, [PDR-064](PDR-064-dong-dang-ky-va-luu-trang-thai-het-han.md)): tác vụ tự động ghi trạng thái thực vào CSDL và lưu lịch sử có tác nhân `Hệ thống`; không chuyển trạng thái khi đọc. Sau khi hết hạn:
  - đề tài `Chưa đăng ký` chuyển và được lưu thành `Không có nhóm`;
  - đề tài `Đã đăng ký` chuyển và được lưu thành `Đang thực hiện`;
  - đề xuất còn `Chờ GV duyệt` chuyển và được lưu thành `Đã hủy`.
  - backend kiểm tra hạn trên thao tác ghi và cập nhật trạng thái/lịch sử an toàn khi retry hoặc chạy đồng thời.
- **Frontend:**
  - Màn GV `/gv/de-tai` và SV `/sv/dang-ky` chỉ dùng API thật.
  - Màn Giáo vụ (Đề tài, Chi tiết đề tài, tab Đề tài của Chi tiết đợt) dùng API. Cập nhật 2026-11-11: đã bỏ cờ `NEXT_PUBLIC_ROUNDS_API`; kho trong bộ nhớ chỉ còn phục vụ test.
  - Xác nhận/công bố kết quả (Phase 07) chưa có API nên trả "Bỏ qua: chức năng kết quả chưa có API".
  - Màn SV chỉ xem danh sách và chi tiết; ghi danh thuộc P03-S02, đề xuất thuộc P03-S03.

## Hệ quả

- Migration `AddThesisTopics` chỉ thêm hai bảng:
  - `ThesisTopics`: khóa ngoại tới đợt (xóa đợt Nháp thì xóa theo) và tới `Users` (Restrict).
  - `TopicHistoryEntries`.
  - Áp dụng có kiểm soát ở từng môi trường; không tự chạy trên Neon/dữ liệu dùng chung.
- Nhóm, ghi danh (`Đã đăng ký`) và chặn gỡ sinh viên đã có nhóm đã làm ở [PDR-054](PDR-054-ghi-danh-nhom-de-tai-cong-bo.md). Đề xuất `SV đề xuất` (P03-S03) vẫn chưa làm, sẽ dùng cùng bảng.
