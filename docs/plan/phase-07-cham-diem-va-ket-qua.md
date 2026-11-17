# Phase 07 — Chấm điểm, xác nhận và công bố kết quả

## Mục tiêu

Mỗi SV nhận bốn thành phần điểm độc lập; kết quả được tính, kiểm tra, xác nhận và công bố đúng điều kiện, không lộ sớm cho SV.

## Step P07-S01 — Nhập phiếu theo phân công

**Tham chiếu:** [BUSINESS_RULES — Chấm điểm](../requirements/BUSINESS_RULES.md), [ROLES](../product/ROLES.md), [PDR-050](../decisions/PDR-050-bo-buoc-chu-tich-xac-nhan-diem.md), [PDR-022](../decisions/PDR-022-dieu-kien-nhap-diem-phan-bien.md), [PDR-023](../decisions/PDR-023-khoa-thay-giang-vien-phan-bien-sau-phieu.md), [PDR-024](../decisions/PDR-024-mau-hoi-dong-chung-phieu-diem-rieng.md), [PDR-035](../decisions/PDR-035-cong-diem-tieu-chi-cap-cuoi.md), [DESIGN — Không gian đề tài GV](../DESIGN/03-dac-ta-man-hinh.md#không-gian-đề-tài-góc-nhìn-giảng-viên), R03/R05.

**Công việc:**
- [ ] Thiết kế phiếu theo SV, vai trò chấm, người nhập và phiên bản mẫu; Thư ký nhập điểm CTHĐ và TKHĐ theo PDR-050 (thay PDR-006) và PDR-024 cho hai phiếu hội đồng độc lập cùng mẫu.
- [ ] Khi lưu phiếu PB đầu tiên, đặt `ThesisTopic.ReviewerFirstScoredAt` bằng một câu UPDATE có điều kiện `ReviewerId = @me` trong cùng transaction với phiếu (dấu khóa PDR-023; xem [PDR-062](../decisions/PDR-062-phan-cong-phan-bien-mot-gvpb-moi-de-tai.md)); dùng `ReviewerRules.ScoreBlocker` cho điều kiện PDR-022.
- [ ] Triển khai nhập/sửa điểm HD, PB, CTHĐ, TKHĐ theo quyền ngữ cảnh; chỉ cho nhập điểm PB sau báo cáo cuối kỳ theo PDR-022, khóa thay PB từ phiếu đầu tiên theo PDR-023; tính tổng điểm cấp cuối theo PDR-035.
- [ ] Khóa sửa khi đã xác nhận theo quyết định; ghi mọi lần thay đổi điểm.

**Acceptance criteria:**
- [ ] Một nhóm 2 SV có thể có điểm khác nhau; thiếu hạng mục không lưu phiếu hoàn tất; người không được phân công không nhập điểm.
- [ ] Phiếu phản biện bị chặn nếu chưa có báo cáo cuối kỳ; vẫn nhập được nếu thiếu báo cáo giữa kỳ hoặc chưa chốt bản cuối, khi các điều kiện khác hợp lệ.
- [ ] Trên mỗi phiếu biết rõ ai chấm, ai nhập, thời điểm và bản mẫu dùng để chấm.
- [ ] Với mỗi Sinh viên, phiếu CTHĐ và TKHĐ có thể có điểm khác nhau, tham chiếu cùng phiên bản mẫu hội đồng và không được gộp thành một phiếu.
- [ ] Điểm phiếu bằng tổng điểm các tiêu chí cấp cuối đã chấm, trong khoảng 0–10; thiếu tiêu chí hoặc vượt mức làm phiếu chưa hợp lệ, tiêu chí cha không cộng trùng.
- [ ] Thư ký nhập và sửa điểm CTHĐ, TKHĐ cho tới khi Giáo vụ xác nhận kết quả; Chủ tịch chỉ xem, không có thao tác xác nhận hay trả lại (PDR-050).

**Verification:** Test ma trận bốn thành phần điểm, một/hai SV, thiếu điểm, quyền Chủ tịch chỉ xem, quyền Thư ký nhập hai phiếu, sửa trước/sau khi Giáo vụ xác nhận, sai hội đồng và truy vết.

**Dependencies:** `CP04`, `CP05`, `CP06`; PDR-050 cho quyền nhập điểm hội đồng; PDR-022/023 cho điểm và phân công PB.

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

**Dependencies:** `P07-S01`; PDR-007/008/049.

## Step P07-S03 — Xác nhận, công bố và xem kết quả

**Tham chiếu:** [BUSINESS_RULES — Chấm điểm](../requirements/BUSINESS_RULES.md), [WORKFLOWS — Chấm điểm](../requirements/WORKFLOWS.md), [PDR-049](../decisions/PDR-049-vong-doi-ket-qua-theo-nhom-de-tai.md), [PDR-011](../decisions/PDR-011-tham-quyen-xu-ly-nhom-chua-nop-ban-khoa-luan.md), [PDR-059](../decisions/PDR-059-chot-ban-khoa-luan-cuoi.md), [DESIGN — Kết quả](../DESIGN/03-dac-ta-man-hinh.md#kết-quả), R01/R02/R09.

**Công việc:**
- [ ] Áp dụng PDR-049 cho xác nhận/công bố **cả đề tài** khi mọi SV đủ bốn phiếu và không lệch điểm; lô báo cáo **từng đề tài**; giữ PDR-011 về Giáo vụ xử lý nhóm chưa có bản nào; áp dụng PDR-005 cho mở lại trước công bố.
- [ ] Triển khai xác nhận/công bố từng đề tài và theo lô: chỉ xử lý đề tài đủ điều kiện, báo lý do từng đề tài bị bỏ qua; khóa sửa điểm cả nhóm khi đã xác nhận, cho Giáo vụ mở lại trước công bố với lý do/lịch sử, xác nhận lại rồi mới công bố.
- [ ] Cập nhật trạng thái `Đã cho điểm`/`Đã hoàn tất` đúng quy tắc; chỉ SV liên quan thấy điểm sau công bố.

**Acceptance criteria:**
- [ ] Không thể công bố đề tài chưa xác nhận hoặc trường hợp bản cuối không đủ điều kiện; lô hỗn hợp xử lý đề tài hợp lệ và trả báo cáo từng đề tài bị bỏ qua với lý do rõ.
- [ ] Một SV thiếu phiếu chặn xác nhận/công bố **toàn bộ đề tài**; sau khi cả đề tài công bố, mỗi SV chỉ xem điểm của mình; Giáo vụ thấy lý do bị chặn.
- [ ] Mở lại trước công bố ghi lý do và không xóa dấu vết điểm/xác nhận cũ; mở lại sau công bố bị từ chối.
- [ ] Nhóm được Giáo vụ kết thúc `Không đủ điều kiện công bố` vì không nộp bản nào sau hạn bổ sung không xuất hiện như điểm không đạt, kết quả đã công bố hoặc đề tài `Đã hoàn tất`; lý do quyết định tra cứu được theo quyền.

**Verification:** Test trường hợp không có bản cuối, bản có nhưng chưa chốt, đủ/thiếu 4 phiếu, hai SV khác trạng thái, lô toàn hợp lệ/toàn không hợp lệ/hỗn hợp, thao tác lặp và sửa sau xác nhận.

**Dependencies:** `P07-S02`, `P04-S03`; PDR-005/011/049/059. Trạng thái nguồn cho `Không đủ điều kiện công bố` cần chốt OQ-031 tại `CP00`.

## Checkpoint CP07 — Kết quả đúng và có thể giải thích

- [ ] Một đề tài 1 SV và một đề tài 2 SV đi hết luồng chấm → xác nhận → công bố.
- [ ] Công thức, cảnh báo, quyền xem/sửa và lịch sử có test với dữ liệu thực tế.
- [ ] R01–R04/R09 đã chốt; không còn hai điều kiện công bố khác nhau giữa tài liệu và hệ thống.
