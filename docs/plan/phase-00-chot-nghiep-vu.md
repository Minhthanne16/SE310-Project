# Phase 00 — Chốt quy tắc nghiệp vụ trước khi triển khai

## Mục tiêu

Biến câu hỏi mở và các điểm bất nhất trong [REVIEW.md](REVIEW.md) thành quyết định có thể kiểm thử. Phase này không tự chọn kết quả thay người có thẩm quyền nghiệp vụ.

**Bằng chứng rà soát 2026-11-17:** [Ma trận quy tắc, quyền, trạng thái và ca giấy T01–T40](PHASE-00-RULE-MATRIX.md). Dấu `[x]` ở công việc thể hiện đã **đối chiếu và lập đặc tả**, chưa xác nhận hành vi chạy thật. Những mục nghiệm thu hoặc checkpoint chưa được đánh dấu còn phụ thuộc quyết định chủ nghiệp vụ, kiểm chứng tích hợp hoặc phê duyệt.

## Step P00-S01 — Chốt vòng đời đợt, nhóm và đề tài

**Tham chiếu:** [OPEN_QUESTIONS](../OPEN_QUESTIONS.md); [BUSINESS_RULES](../requirements/BUSINESS_RULES.md); [WORKFLOWS](../requirements/WORKFLOWS.md); PDR-012/029–034/047–049/053–054; R07, R12, R15.

**Công việc:**
- [x] Vẽ bảng trạng thái và chuyển trạng thái của đợt, đề tài công bố, đề xuất và nhóm; xác định người thao tác, hạn, dữ liệu cần giữ.
- [x] Giữ PDR-012 cho hủy/đề xuất lại, PDR-047 cho hủy ghi danh/giữ nhóm và PDR-029–034 cho tham gia, gỡ người, mở/kết thúc và sao chép đợt.
- [x] Ghi ví dụ tranh chấp hai nhóm cùng ghi danh một đề tài và quy tắc thắng/thua.

**Acceptance criteria:**
- [ ] Mỗi chuyển trạng thái có tiền điều kiện, kết quả, quyền, lịch sử và cách xử lý thao tác lặp/đồng thời; quy tắc gỡ người theo PDR-030 được đối chiếu với cả hai vai trò.

**Verification:** Đã đối chiếu bảng trạng thái với tài liệu màn SV/GV/Giáo vụ và các tình huống T01–T12 trên giấy. **Chưa đạt acceptance criteria** vì OQ-028/029/030 còn mở, cần chốt cơ chế xử lý đồng thời và lịch sử; kiểm chứng transaction thật thuộc G2/G3.

**Dependencies:** Không.

## Step P00-S02 — Chốt tài liệu, phân công và lịch

**Tham chiếu:** PDR-011/013/014–023/039–043/057–060; R01, R05, R06, R11, R13; [DESIGN/03](../DESIGN/03-dac-ta-man-hinh.md).

**Công việc:**
- [x] Kiểm chứng PDR-013 về yêu cầu sửa đề cương, quyền GVHD, cách nộp lại và điều kiện duyệt; đối chiếu PDR-057 và PDR-060 về yêu cầu sửa từng loại.
- [x] Kiểm chứng PDR-011 cho trường hợp không có bản cuối và tự chốt bản bổ sung; đối chiếu PDF 20 MB, hạn trễ từng mốc, giữ mọi phiên bản và giới hạn ảnh theo PDR-039–043/057–060; phân biệt chốt Thesis thủ công (bị chặn khi có yêu cầu sửa Cuối kỳ mở) với tự chốt khi hết hạn (vẫn diễn ra).
- [x] Giữ mốc phân công phản biện sau duyệt đề cương theo PDR-021, nhập điểm sau báo cáo cuối kỳ theo PDR-022 và khóa thay phản biện từ phiếu đầu tiên theo PDR-023. Giữ các quy tắc xung đột, thời lượng, sửa/đính chính/hủy lịch và khóa thay thành viên sau điểm tại PDR-014–020.

**Acceptance criteria:**
- [ ] Với mỗi ngoại lệ có người xử lý, trạng thái sau xử lý và bằng chứng lịch sử; không còn hai điều kiện công bố đối nghịch giữa yêu cầu và thiết kế.

**Verification:** Đã lập ca giấy T13–T23/T35–T37/T40 cho không có bản cuối, nộp trễ, trùng phòng, đổi Thư ký sau điểm, chốt Thesis và công bố. **Acceptance criteria còn mở** vì OQ-020/025/031 chưa được chủ nghiệp vụ giải quyết, đặc biệt tập trạng thái nguồn để kết thúc `Không đủ điều kiện công bố`.

**Dependencies:** `P00-S01` cho trạng thái đề tài.

## Step P00-S03 — Chốt chấm điểm, xác nhận và quyền tài khoản

**Tham chiếu:** PDR-005–010/024–028/035–038/044/045/049/050; R02–R05, R08–R10, R14; [ROLES](../product/ROLES.md).

**Công việc:**
- [x] Giữ PDR-007–008 về bốn cặp cảnh báo và làm tròn (PDR-007 đã sửa một phần theo PDR-049); điểm CTHĐ theo PDR-050, thay PDR-006; đối chiếu cấu trúc mẫu phiếu đã chốt.
- [x] Giữ PDR-024–028/035: Chủ tịch/Thư ký chung mẫu hội đồng nhưng phiếu riêng; mẫu đã gán đổi tiêu chí bằng phiên bản mới, khóa bản đang dùng từ phiếu đầu tiên, chỉ xóa Nháp chưa từng gán, Đóng chỉ ngăn gán mới; điểm phiếu cộng các tiêu chí cấp cuối có tổng tối đa 10.
- [x] Giữ PDR-005 về mở lại trước công bố; áp dụng PDR-049 **thay PDR-009/010**: mỗi SV có bốn điểm riêng, nhưng chỉ xác nhận/công bố **cả đề tài** khi tất cả SV đủ điều kiện; xử lý lô và báo lý do theo **từng đề tài**.
- [x] Đối chiếu quyền sửa họ tên theo PDR-036, phản hồi khôi phục mật khẩu theo PDR-037, thao tác ẩn thông báo theo PDR-038, giới hạn yêu cầu khôi phục theo PDR-044 và điều kiện tài khoản nhận thư theo PDR-045.
- [x] Cập nhật `OPEN_QUESTIONS.md`, `requirements/`, `decisions/` và `DESIGN/` ở các chỗ thay đổi.

**Acceptance criteria:**
- [ ] Các tình huống một SV thiếu điểm, điểm lệch đúng 2, điểm tổng ở giá trị làm tròn giữa, hủy xác nhận và nhóm không có bản cuối đều có kết quả xác định.
- [x] Mọi OQ còn mở liên quan đến phase được đóng hoặc gắn rõ vào bước phụ thuộc; không ghi “đã chốt” cho nhận định chưa được xác nhận.

**Verification:** Đã review chéo tài liệu và lập ca giấy T24–T34/T39/T40. **Acceptance criteria về kết quả xác định của nhóm không có Thesis còn mở** vì OQ-031 cần chốt tập trạng thái nguồn; chưa có xác nhận của người phụ trách sản phẩm/kỹ thuật.

**Dependencies:** `P00-S01`, `P00-S02`.

## Checkpoint CP00 — Cho phép triển khai nghiệp vụ phụ thuộc

- [ ] Quyết định được ghi bằng văn bản và có người chấp thuận.
- [x] Danh sách OQ/R ảnh hưởng từng phase đã được cập nhật.
- [ ] Không còn mâu thuẫn chưa giải quyết trong luồng chuẩn và các ngoại lệ chặn nghiệm thu.

**Kết luận checkpoint 2026-11-17:** Đã hoàn tất **11/11 công việc lập đặc tả** của S01–S03 và **1/4 acceptance criteria** (S03, mục truy vết OQ), cùng **1/3** mục CP00. Còn OQ-020/025/028/029/030/031, phê duyệt owner và kiểm chứng API/DB phù hợp trước khi có thể đánh dấu CP00 hoàn thành. Xem [ma trận Phase 00](PHASE-00-RULE-MATRIX.md) để tiếp tục từ các ca T01–T40.
