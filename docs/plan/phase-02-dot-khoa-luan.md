# Phase 02 — Đợt khóa luận, mốc và người tham gia

## Mục tiêu

Giáo vụ vận hành một đợt có mốc và người tham gia; SV/GV chỉ thấy đợt được phép. Thay kho demo frontend bằng dữ liệu bền vững.

## Step P02-S01 — Mô hình đợt và vòng đời

**Tham chiếu:** [WORKFLOWS — Mở đợt](../requirements/WORKFLOWS.md), [DOMAIN_MODEL](../architecture/DOMAIN_MODEL.md), [DESIGN — Danh sách/Chi tiết đợt](../DESIGN/03-dac-ta-man-hinh.md), [PDR-031](../decisions/PDR-031-chi-ket-thuc-dot-khi-moi-de-tai-ket-thuc.md), [PDR-032](../decisions/PDR-032-du-chin-moc-hop-le-truoc-khi-mo-dot.md), [PDR-033](../decisions/PDR-033-mo-dot-duoc-khi-chua-co-nguoi-tham-gia.md), [PDR-034](../decisions/PDR-034-sao-chep-khung-cau-hinh-dot.md), R07.

**Công việc:**
- [ ] Đặc tả trạng thái Nháp/Đang diễn ra/Đã kết thúc, thao tác tạo/mở/kết thúc/xóa và dữ liệu không được xóa.
- [ ] Đối chiếu hợp đồng API với UI hiện có; triển khai backend, migration và frontend cho danh sách/chi tiết/tạo/mở/kết thúc/xóa.
- [ ] Sao chép đợt chỉ tạo Nháp mới với khung chín mốc/cờ “Cho nộp trễ”, không mang ngày, hạn trễ, người hoặc dữ liệu nghiệp vụ theo PDR-034; mở đợt phải đủ chín mốc và hạn trễ của các mốc bật nộp trễ hợp lệ theo PDR-032/041 nhưng thiếu người chỉ cảnh báo theo PDR-033; kết thúc đợt theo PDR-031.

**Acceptance criteria:**
- [ ] Nháp chỉ Giáo vụ thấy; mở đợt chuyển khả năng nhìn thấy theo quyền; xóa chỉ áp dụng với Nháp đủ điều kiện.
- [ ] Sau tải lại trang, dữ liệu đợt vẫn còn và trạng thái đồng nhất ở ba vai trò.
- [ ] Đợt có ít nhất một đề tài chưa `Đã hoàn tất`/`Không đủ điều kiện công bố` không kết thúc được và nêu đề tài còn dở; hỗn hợp hai trạng thái kết thúc hợp lệ không bị chặn bởi quy tắc này.
- [ ] Không mở đợt thiếu một trong chín mốc, mốc thiếu đầu/cuối hoặc sai thứ tự; lỗi chỉ rõ mốc để sửa.
- [ ] Đợt đủ mốc nhưng thiếu SV, GV hoặc cả hai vẫn mở được sau cảnh báo rõ vai trò thiếu; không tự tạo người, thao tác sau mở vẫn kiểm tra người tham gia.
- [ ] Đợt sao chép ở trạng thái Nháp, không có ngày/giờ/hạn trễ, người, mẫu phiếu, đề tài, điểm hoặc lịch sử từ nguồn; lưu được tham chiếu đợt nguồn và không mở được trước khi nhập đủ mốc/hạn trễ hợp lệ.

**Verification:** Test sao chép từ đợt có ngày/người/điểm, mở khi thiếu SV/GV, kết thúc khi đề tài còn dở/đã kết thúc, 401/403, thao tác lặp, danh sách theo vai trò và luồng UI→API.

**Dependencies:** `CP00` cho R07; `CP01` cho tài khoản.

## Step P02-S02 — Cấu hình chín mốc và chính sách thời gian

**Tham chiếu:** [DESIGN — Gantt/Chi tiết đợt](../DESIGN/03-dac-ta-man-hinh.md), [NON_FUNCTIONAL](../requirements/NON_FUNCTIONAL.md), [PDR-041](../decisions/PDR-041-han-nop-tre-rieng-tung-moc.md).

**Công việc:**
- [ ] Giữ chín mốc bắt buộc trước khi mở đợt theo PDR-032; chốt ý nghĩa từng mốc và phân biệt mốc nhắc với mốc khóa thao tác.
- [ ] Lưu cấu hình theo đợt và cung cấp UI Gantt cho từng vai trò; kiểm tra ngày sai thứ tự và khoảng trống.
- [ ] Bật “Cho nộp trễ” chỉ khi có hạn trễ riêng sau hạn thường của từng mốc Đề cương/Giữa kỳ/Cuối kỳ; hiện hạn cho nhóm liên quan, ghi lịch sử khi đổi theo PDR-041.

**Acceptance criteria:**
- [ ] Cấu hình không hợp lệ bị từ chối với lỗi chỉ rõ mốc; thay đổi hợp lệ hiện đúng trên Gantt sau tải lại.
- [ ] Đợt Nháp thiếu hoặc sai một mốc không mở được; đủ chín mốc hợp lệ thì không bị chặn bởi điều kiện mốc.
- [ ] Thời gian cho điểm chỉ nhắc, không tự khóa phiếu chấm theo DESIGN; nộp đúng hạn/trong khoảng trễ/sau hạn trễ cho kết quả đúng PDR-041, hạn bổ sung riêng PDR-011 chỉ áp dụng đúng nhóm.

**Verification:** Test ranh giới ngày/giờ, lệch múi giờ và trạng thái trước/trong/sau mốc.

**Dependencies:** `P02-S01`; PDR-041 đã chốt chính sách hạn trễ.

## Step P02-S03 — Danh sách người tham gia

**Tham chiếu:** [DESIGN — Chi tiết đợt](../DESIGN/03-dac-ta-man-hinh.md), [BUSINESS_RULES](../requirements/BUSINESS_RULES.md), [PDR-029](../decisions/PDR-029-mot-sinh-vien-mot-dot-dang-dien-ra.md), [PDR-030](../decisions/PDR-030-khoa-go-nguoi-tham-gia-da-co-du-lieu.md), R07.

**Công việc:**
- [ ] Thêm/gỡ SV và GV bằng tài khoản có thật; chặn SV thuộc hai đợt `Đang diễn ra` khi thêm vào đợt mở hoặc mở đợt Nháp theo PDR-029; khóa gỡ cả SV/GV đã có dữ liệu nghiệp vụ liên quan theo PDR-030.
- [ ] Cập nhật các trang chủ theo vai trò để lấy đúng đợt và việc cần làm từ backend.
- [ ] Ghi lịch sử mở/kết thúc/thay người, bảo toàn tham chiếu khi đợt đã có đề tài.

**Acceptance criteria:**
- [ ] Sinh viên không được ghi danh vào đề tài của đợt mình không tham gia; người bị gỡ không còn quyền thao tác dữ liệu đợt.
- [ ] Sinh viên có thể ở danh sách chuẩn bị của đợt Nháp, nhưng không mở được đợt nếu người đó đang thuộc đợt khác `Đang diễn ra`; hai thao tác mở/thêm đồng thời không tạo hai đợt đang diễn ra cho cùng người.
- [ ] Gỡ người đã có dữ liệu nghiệp vụ trong đợt bị chặn cho cả Sinh viên và Giảng viên, nêu bản ghi liên quan; chỉ có thông báo thì không tự khóa gỡ. Gỡ người chưa có dữ liệu có lịch sử.
- [ ] Trường hợp trùng người, gỡ người đã có dữ liệu và hai thao tác đồng thời cho kết quả theo quyết định đã chốt.

**Verification:** Test quyền xuyên đợt, trùng người khi thêm/mở đợt, hai thao tác đồng thời, chuyển trạng thái có người tham gia; kiểm chứng trang chủ ba vai trò.

**Dependencies:** `P02-S01`; PDR-029/030.

## Checkpoint CP02 — Một đợt vận hành được

- [ ] Giáo vụ tạo và mở đợt với cấu hình hợp lệ; SV/GV thấy đúng phần của mình trên dữ liệu thật.
- [ ] Không còn dữ liệu ngày “hôm nay” cố định hoặc kho demo là nguồn chính cho các màn đợt.
- [ ] Quy tắc sao chép/gỡ theo PDR-030/034 và hạn trễ từng mốc theo PDR-041 có bằng chứng kiểm thử.
