# Phase 07 — Chấm điểm, xác nhận và công bố kết quả

## Mục tiêu

Mỗi SV nhận bốn thành phần điểm độc lập; kết quả được tính, kiểm tra, xác nhận và công bố đúng điều kiện, không lộ sớm cho SV.

## Step P07-S01 — Nhập phiếu theo phân công

**Tham chiếu:** [BUSINESS_RULES — Chấm điểm](../requirements/BUSINESS_RULES.md), [ROLES](../product/ROLES.md), [PDR-006](../decisions/PDR-006-xac-nhan-diem-chu-tich-hoi-dong.md), [PDR-022](../decisions/PDR-022-dieu-kien-nhap-diem-phan-bien.md), [PDR-023](../decisions/PDR-023-khoa-thay-giang-vien-phan-bien-sau-phieu.md), [PDR-024](../decisions/PDR-024-mau-hoi-dong-chung-phieu-diem-rieng.md), [PDR-035](../decisions/PDR-035-cong-diem-tieu-chi-cap-cuoi.md), [DESIGN — Không gian đề tài GV](../DESIGN/03-dac-ta-man-hinh.md#không-gian-đề-tài-góc-nhìn-giảng-viên), R03/R05.

**Công việc:**
- [ ] Thiết kế phiếu theo SV, vai trò chấm, người nhập/người xác nhận và phiên bản mẫu; áp dụng PDR-006 cho điểm CTHĐ và PDR-024 cho hai phiếu hội đồng độc lập cùng mẫu.
- [ ] Bổ sung luồng Chủ tịch trả lại có lý do → Thư ký sửa → trình Chủ tịch xác nhận lại; giữ lịch sử từng lần.
- [ ] Triển khai nhập/sửa điểm HD, PB, CTHĐ, TKHĐ theo quyền ngữ cảnh; chỉ cho nhập điểm PB sau báo cáo cuối kỳ theo PDR-022, khóa thay PB từ phiếu đầu tiên theo PDR-023; tính tổng điểm cấp cuối theo PDR-035.
- [ ] Khóa sửa khi đã xác nhận theo quyết định; ghi mọi lần thay đổi điểm.

**Acceptance criteria:**
- [ ] Một nhóm 2 SV có thể có điểm khác nhau; thiếu hạng mục không lưu phiếu hoàn tất; người không được phân công không nhập điểm.
- [ ] Phiếu phản biện bị chặn nếu chưa có báo cáo cuối kỳ; vẫn nhập được nếu thiếu báo cáo giữa kỳ hoặc chưa chốt bản cuối, khi các điều kiện khác hợp lệ.
- [ ] Trên mỗi phiếu biết rõ ai chấm, ai nhập, thời điểm và bản mẫu dùng để chấm.
- [ ] Với mỗi Sinh viên, phiếu CTHĐ và TKHĐ có thể có điểm khác nhau, tham chiếu cùng phiên bản mẫu hội đồng và không được gộp thành một phiếu.
- [ ] Điểm phiếu bằng tổng điểm các tiêu chí cấp cuối đã chấm, trong khoảng 0–10; thiếu tiêu chí hoặc vượt mức làm phiếu chưa hợp lệ, tiêu chí cha không cộng trùng.
- [ ] Chủ tịch xác nhận điểm CTHĐ của từng SV trước Giáo vụ; nếu Thư ký sửa điểm đó, xác nhận cũ mất hiệu lực; không thể coi im lặng là đã xác nhận.
- [ ] Điểm CTHĐ bị trả lại giữ trạng thái chưa xác nhận; Giáo vụ không xác nhận kết quả cho SV đó; lý do và các lần trình lại tra cứu được.
- [ ] Không tự khóa phiếu CTHĐ bị trả lại khi hết mốc cho điểm; việc cần xử lý còn hiển thị đến khi Chủ tịch xác nhận.

**Verification:** Test ma trận bốn vai trò, một/hai SV, thiếu điểm, trả lại có/không lý do, sửa rồi xác nhận lại, sai hội đồng và truy vết.

**Dependencies:** `CP04`, `CP05`, `CP06`; PDR-006 cho xác nhận, trả lại và mốc nhắc; PDR-022/023 cho điểm và phân công PB.

## Step P07-S02 — Tính điểm và cảnh báo

**Tham chiếu:** [BUSINESS_RULES — Chấm điểm](../requirements/BUSINESS_RULES.md), [PDR-007](../decisions/PDR-007-canh-bao-lech-diem-bon-cap-cheo.md), [PDR-008](../decisions/PDR-008-lam-tron-diem-tong.md), R04/R09.

**Công việc:**
- [ ] Hiện thực `(CTHĐ + TKHĐ + 2×CBHD + 2×CBPB) / 6`, làm tròn số học lên hai chữ số theo PDR-008.
- [ ] Hiện thực bốn cặp chéo theo PDR-007 để cảnh báo lệch ≥ 2; cảnh báo không chặn lưu nhưng hiện khi Giáo vụ xác nhận.
- [ ] Tổng hợp trạng thái từng SV và đề tài khi một thành viên thiếu phiếu.

**Acceptance criteria:**
- [ ] Chỉ tính điểm tổng khi đủ bốn giá trị mỗi SV; cùng đầu vào cho cùng kết quả ở API/UI/xuất dữ liệu.
- [ ] Mốc lệch 1,99 và 2,00, từng cặp chéo, cùng các giá trị làm tròn giữa được test bằng ví dụ đã chốt.

**Verification:** Unit test công thức và test tích hợp 1/2 SV, thiếu một phiếu, điểm 0/10, cảnh báo biên.

**Dependencies:** `P07-S01`; PDR-007/008/009.

## Step P07-S03 — Xác nhận, công bố và xem kết quả

**Tham chiếu:** [BUSINESS_RULES — Chấm điểm](../requirements/BUSINESS_RULES.md), [WORKFLOWS — Chấm điểm](../requirements/WORKFLOWS.md), [PDR-010](../decisions/PDR-010-xu-ly-ket-qua-theo-lo.md), [PDR-011](../decisions/PDR-011-tham-quyen-xu-ly-nhom-chua-nop-ban-khoa-luan.md), [DESIGN — Kết quả](../DESIGN/03-dac-ta-man-hinh.md#kết-quả), R01/R02/R09.

**Công việc:**
- [ ] Áp dụng PDR-009/010 cho xác nhận/công bố từng SV và lô có báo cáo; giữ PDR-011 về Giáo vụ xử lý nhóm chưa có bản nào; áp dụng PDR-005 cho mở lại trước công bố.
- [ ] Triển khai xác nhận/công bố theo từng bản ghi và lô: xử lý người đủ điều kiện, báo lý do từng người bị bỏ qua; khóa sửa điểm khi đã xác nhận, cho Giáo vụ mở lại trước công bố với lý do/lịch sử, xác nhận lại rồi mới công bố.
- [ ] Cập nhật trạng thái `Đã cho điểm`/`Đã hoàn tất` đúng quy tắc; chỉ SV liên quan thấy điểm sau công bố.

**Acceptance criteria:**
- [ ] Không thể công bố điểm chưa xác nhận hoặc trường hợp bản cuối không đủ điều kiện; lô hỗn hợp xử lý người hợp lệ và trả báo cáo từng người bị bỏ qua với lý do rõ.
- [ ] Một SV thiếu phiếu không làm SV khác lộ điểm sai; sau công bố SV chỉ xem điểm của mình; Giáo vụ thấy lý do bị chặn.
- [ ] Mở lại trước công bố ghi lý do và không xóa dấu vết điểm/xác nhận cũ; mở lại sau công bố bị từ chối.
- [ ] Nhóm được Giáo vụ kết thúc `Không đủ điều kiện công bố` vì không nộp bản nào sau hạn bổ sung không xuất hiện như điểm không đạt, kết quả đã công bố hoặc đề tài `Đã hoàn tất`; lý do quyết định tra cứu được theo quyền.

**Verification:** Test trường hợp không có bản cuối, bản có nhưng chưa chốt, đủ/thiếu 4 phiếu, hai SV khác trạng thái, lô toàn hợp lệ/toàn không hợp lệ/hỗn hợp, thao tác lặp và sửa sau xác nhận.

**Dependencies:** `P07-S02`, `P04-S03`; PDR-009/010/011.

## Checkpoint CP07 — Kết quả đúng và có thể giải thích

- [ ] Một đề tài 1 SV và một đề tài 2 SV đi hết luồng chấm → xác nhận → công bố.
- [ ] Công thức, cảnh báo, quyền xem/sửa và lịch sử có test với dữ liệu thực tế.
- [ ] R01–R04/R09 đã chốt; không còn hai điều kiện công bố khác nhau giữa tài liệu và hệ thống.
