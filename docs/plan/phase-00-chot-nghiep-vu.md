# Phase 00 — Chốt quy tắc nghiệp vụ trước khi triển khai

## Mục tiêu

Biến câu hỏi mở và các điểm bất nhất trong [REVIEW.md](REVIEW.md) thành quyết định có thể kiểm thử. Phase này không tự chọn kết quả thay người có thẩm quyền nghiệp vụ.

## Step P00-S01 — Chốt vòng đời đợt, nhóm và đề tài

**Tham chiếu:** [OPEN_QUESTIONS](../OPEN_QUESTIONS.md); [BUSINESS_RULES](../requirements/BUSINESS_RULES.md); [WORKFLOWS](../requirements/WORKFLOWS.md); PDR-012/029/030/047; R07, R12, R15.

**Công việc:**
- [ ] Vẽ bảng trạng thái và chuyển trạng thái của đợt, đề tài công bố, đề xuất và nhóm; xác định người thao tác, hạn, dữ liệu cần giữ.
- [ ] Giữ PDR-012 cho hủy/đề xuất lại, PDR-047 cho hủy ghi danh/giữ nhóm và PDR-029–034 cho tham gia, gỡ người, mở/kết thúc và sao chép đợt.
- [ ] Ghi ví dụ tranh chấp hai nhóm cùng ghi danh một đề tài và quy tắc thắng/thua.

**Acceptance criteria:**
- [ ] Mỗi chuyển trạng thái có tiền điều kiện, kết quả, quyền, lịch sử và cách xử lý thao tác lặp/đồng thời; quy tắc gỡ người theo PDR-030 được đối chiếu với cả hai vai trò.

**Verification:** Đối chiếu bảng trạng thái với màn SV/GV/Giáo vụ và thử các tình huống hủy, từ chối, đăng ký đồng thời trên giấy.

**Dependencies:** Không.

## Step P00-S02 — Chốt tài liệu, phân công và lịch

**Tham chiếu:** PDR-011/013/014–023/039–043; R01, R05, R06, R11, R13; [DESIGN/03](../DESIGN/03-dac-ta-man-hinh.md).

**Công việc:**
- [ ] Kiểm chứng PDR-013 về yêu cầu sửa đề cương, quyền GVHD, cách nộp lại và điều kiện duyệt.
- [ ] Kiểm chứng PDR-011 cho trường hợp không có bản cuối và tự chốt bản bổ sung; đối chiếu PDF 20 MB, hạn trễ từng mốc, giữ mọi phiên bản và giới hạn ảnh theo PDR-039–043.
- [ ] Giữ mốc phân công phản biện sau duyệt đề cương theo PDR-021, nhập điểm sau báo cáo cuối kỳ theo PDR-022 và khóa thay phản biện từ phiếu đầu tiên theo PDR-023. Giữ các quy tắc xung đột, thời lượng, sửa/đính chính/hủy lịch và khóa thay thành viên sau điểm tại PDR-014–020.

**Acceptance criteria:**
- [ ] Với mỗi ngoại lệ có người xử lý, trạng thái sau xử lý và bằng chứng lịch sử; không còn hai điều kiện công bố đối nghịch giữa yêu cầu và thiết kế.

**Verification:** Diễn tập trường hợp không nộp bản nào, nộp trễ, trùng phòng, đổi thư ký sau khi đã nhập điểm.

**Dependencies:** `P00-S01` cho trạng thái đề tài.

## Step P00-S03 — Chốt chấm điểm, xác nhận và quyền tài khoản

**Tham chiếu:** PDR-005–010/024–028/036–038/044/045; R02–R05, R08–R10, R14; [ROLES](../product/ROLES.md).

**Công việc:**
- [ ] Giữ PDR-006–008 về xác nhận/trả lại điểm CTHĐ không có hạn riêng, bốn cặp cảnh báo và làm tròn; đối chiếu cấu trúc mẫu phiếu đã chốt.
- [ ] Giữ PDR-024–028/035: Chủ tịch/Thư ký chung mẫu hội đồng nhưng phiếu riêng; mẫu đã gán đổi tiêu chí bằng phiên bản mới, khóa bản đang dùng từ phiếu đầu tiên, chỉ xóa Nháp chưa từng gán, Đóng chỉ ngăn gán mới; điểm phiếu cộng các tiêu chí cấp cuối có tổng tối đa 10.
- [ ] Giữ PDR-005/009/010 về mở lại trước công bố, kết quả theo từng SV và xử lý lô có báo cáo từng người.
- [ ] Đối chiếu quyền sửa họ tên theo PDR-036, phản hồi khôi phục mật khẩu theo PDR-037, thao tác ẩn thông báo theo PDR-038, giới hạn yêu cầu khôi phục theo PDR-044 và điều kiện tài khoản nhận thư theo PDR-045.
- [ ] Cập nhật `OPEN_QUESTIONS.md`, `requirements/`, `decisions/` và `DESIGN/` ở các chỗ thay đổi.

**Acceptance criteria:**
- [ ] Các tình huống một SV thiếu điểm, điểm lệch đúng 2, điểm tổng ở giá trị làm tròn giữa, hủy xác nhận và nhóm không có bản cuối đều có kết quả xác định.
- [ ] Mọi OQ còn mở liên quan đến phase được đóng hoặc gắn rõ vào bước phụ thuộc; không ghi “đã chốt” cho nhận định chưa được xác nhận.

**Verification:** Review chéo ma trận quy tắc–vai trò–trạng thái với người phụ trách sản phẩm và kỹ thuật.

**Dependencies:** `P00-S01`, `P00-S02`.

## Checkpoint CP00 — Cho phép triển khai nghiệp vụ phụ thuộc

- [ ] Quyết định được ghi bằng văn bản và có người chấp thuận.
- [ ] Danh sách OQ/R ảnh hưởng từng phase đã được cập nhật.
- [ ] Không còn mâu thuẫn chưa giải quyết trong luồng chuẩn và các ngoại lệ chặn nghiệm thu.
