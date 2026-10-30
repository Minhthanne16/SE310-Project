# Phase 04 — Đề cương, bài nộp và bản khóa luận cuối

## Mục tiêu

Nhóm nộp tài liệu theo phiên bản; GVHD nhận xét/duyệt đề cương; bản khóa luận cuối được chốt theo quy tắc đã quyết định.

## Step P04-S01 — Đề cương và yêu cầu chỉnh sửa

**Tham chiếu:** [WORKFLOWS — Thực hiện](../requirements/WORKFLOWS.md), [BUSINESS_RULES — Tài liệu](../requirements/BUSINESS_RULES.md), [PDR-013](../decisions/PDR-013-yeu-cau-chinh-sua-de-cuong.md), [PDR-041](../decisions/PDR-041-han-nop-tre-rieng-tung-moc.md).

**Công việc:**
- [ ] Áp dụng PDR-013: GVHD tạo/đóng từng yêu cầu, nhóm nộp một phiên bản cho cả lần sửa, mốc Đề cương chung; xác định bản hiện hành đang chờ GVHD xử lý.
- [ ] Triển khai nộp phiên bản, nhận xét, yêu cầu sửa, nộp lại có liên kết yêu cầu và duyệt đề cương; giữ phiên bản cũ.
- [ ] Chuyển đề tài sang `Đang thực hiện` chỉ khi đề cương được GVHD hợp lệ duyệt.

**Acceptance criteria:**
- [ ] Nộp lại không ghi đè bản cũ; GVHD chỉ duyệt đề cương mình hướng dẫn; SV nhìn được yêu cầu cần xử lý.
- [ ] Nhóm không tự đóng yêu cầu; một lần nộp lại có thể xử lý nhiều yêu cầu; còn bất kỳ yêu cầu nào mở thì không duyệt hoặc chuyển `Đang thực hiện`.

**Verification:** Test vòng yêu cầu sửa nhiều lần, quyền GV khác, lịch sử phiên bản và trạng thái đề tài.

**Dependencies:** `CP03`; PDR-013/041 cho yêu cầu sửa và nhánh nộp trễ.

## Step P04-S02 — Báo cáo giữa kỳ/cuối kỳ và lưu trữ

**Tham chiếu:** [DESIGN — Không gian đề tài](../DESIGN/03-dac-ta-man-hinh.md#không-gian-đề-tài-sinh-viên), [NON_FUNCTIONAL](../requirements/NON_FUNCTIONAL.md), [PDR-039](../decisions/PDR-039-chi-nhan-pdf-cho-ban-nop-hoc-thuat.md)–[PDR-042](../decisions/PDR-042-giu-moi-phien-ban-tai-lieu-khong-tu-xoa.md), R11.

**Công việc:**
- [ ] Áp dụng PDF tối đa 20 MB mỗi tệp theo PDR-039/040, hạn trễ riêng từng mốc theo PDR-041 và giữ mọi phiên bản sau kết thúc đợt theo PDR-042; xác định quyền tải/xem theo vai trò, thiết kế storage không đưa secret lên frontend.
- [ ] Triển khai upload/đọc tài liệu theo quyền; ghi người nộp, thời điểm, phiên bản, ghi chú thay đổi khi quy tắc yêu cầu.
- [ ] Kết nối cấu hình mốc của đợt với nhận/từ chối nộp, nhãn nộp trễ và lỗi file.

**Acceptance criteria:**
- [ ] Tệp không phải PDF, giả PDF, quá 20 MB hoặc vượt quyền bị từ chối; PDF hợp lệ có thể tải lại, mọi phiên bản cũ còn nguyên sau khi đợt kết thúc.
- [ ] Trước, đúng và sau hạn cho kết quả theo quyết định; thao tác thất bại không để bản ghi/tệp mồ côi.

**Verification:** Test upload thật trên storage test, quyền tải của SV/GVHD/GVPB/Giáo vụ và tình huống lỗi storage.

**Dependencies:** `P04-S01`, `P02-S02`; PDR-039–042.

## Step P04-S03 — Chốt bản cuối và ngoại lệ không có bản nộp

**Tham chiếu:** [BUSINESS_RULES — Chấm điểm](../requirements/BUSINESS_RULES.md), [DESIGN — Không gian đề tài/Kết quả](../DESIGN/03-dac-ta-man-hinh.md), OQ-002/R01.

**Công việc:**
- [ ] Giữ PDR-011: không có bản nào lúc hết hạn → chờ ngoại lệ; Giáo vụ cấp hạn bổ sung riêng **một lần** ưu tiên cấu hình nộp trễ chung; nhóm tự chốt hoặc hệ thống chốt bản mới nhất khi hết hạn; nếu vẫn không có bản, Giáo vụ kết thúc đề tài ở trạng thái riêng `Không đủ điều kiện công bố` có lý do, không tự đánh không đạt và không mở lại bằng thao tác thường.
- [ ] Triển khai chốt thủ công/tự động theo quyết định; idempotent để job chạy lặp không tạo nhiều bản cuối.
- [ ] Hiển thị trạng thái bản cuối và trường hợp chờ xử lý ngoại lệ cho Giáo vụ.

**Acceptance criteria:**
- [ ] Chỉ một phiên bản được đánh dấu bản cuối; bản trước còn tra cứu được; trường hợp không có bản được xử lý rõ theo OQ-002.
- [ ] Hạn bổ sung của một nhóm không mở quyền nộp cho nhóm khác; nhóm được cấp hạn nhìn thấy thời điểm kết thúc và lý do.
- [ ] Nếu nhóm đã nộp trong hạn bổ sung nhưng chưa tự chốt, hệ thống chốt đúng bản mới nhất khi hết hạn; job chạy lại không đổi bản cuối hoặc nhân đôi lịch sử.
- [ ] Khi hết hạn bổ sung mà vẫn không có bản, hệ thống không tự kết thúc; chỉ Giáo vụ được ghi quyết định “Không đủ điều kiện công bố”, có lý do và lịch sử, không xuất thành điểm không đạt.
- [ ] Quyết định kết thúc đưa đề tài vào trạng thái riêng, không vào `Đã hoàn tất`; hạn riêng cho đúng nhóm vẫn nhận nộp khi cấu hình nộp trễ chung tắt.
- [ ] Sau khi đã cấp hạn bổ sung một lần, yêu cầu cấp lần hai cho cùng nhóm/đề tài bị từ chối và lịch sử lần đầu vẫn còn.
- [ ] Đề tài đã kết thúc `Không đủ điều kiện công bố` không nhận nộp/chấm tiếp hoặc mở lại bằng thao tác thông thường.
- [ ] Điều kiện công bố được Phase 07 dùng đúng, không tự coi hết hạn là có bản cuối nếu quyết định không cho.

**Verification:** Test không có bản, một bản, nhiều bản, chốt lặp và job sau hạn.

**Dependencies:** `P04-S02`; OQ-002.

## Checkpoint CP04 — Tài liệu có thể truy vết

- [ ] Đề cương duyệt/chỉnh sửa, báo cáo nhiều phiên bản và bản cuối hoạt động trên dữ liệu thật.
- [ ] PDR-011/013/039–042 được đối chiếu; quyền tải và lỗi tệp có bằng chứng kiểm thử.
