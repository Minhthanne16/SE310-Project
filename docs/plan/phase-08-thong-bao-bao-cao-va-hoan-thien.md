# Phase 08 — Thông báo, báo cáo và hoàn thiện luồng xuyên suốt

## Mục tiêu

Người dùng nhận đúng việc cần làm; Giáo vụ theo dõi/xuất dữ liệu; toàn bộ một đợt chạy từ mở đến công bố với bằng chứng kiểm thử và vận hành.

## Step P08-S01 — Thông báo và lịch sử nghiệp vụ

**Tham chiếu:** [FEATURE — Vận hành](../FEATURE.md), [BUSINESS_RULES — Truy vết](../requirements/BUSINESS_RULES.md), [DESIGN — Chuông/Gửi thông báo](../DESIGN/03-dac-ta-man-hinh.md), [PDR-038](../decisions/PDR-038-an-thong-bao-da-gui-chi-voi-nguoi-gui.md), R14.

**Công việc:**
- [ ] Chốt ai gửi/nhận và phạm vi nhóm/đợt; áp dụng PDR-038 cho thao tác ẩn thông báo đã gửi, tách bảng thông báo và trạng thái đọc của từng người nhận.
- [ ] Triển khai thông báo thủ công và sự kiện nghiệp vụ quan trọng; đảm bảo gửi/lưu không tạo bản trùng khi thao tác lặp.
- [ ] Cung cấp chuông, danh sách, đánh dấu đã đọc; lịch sử đề tài lọc theo nhóm, bài nộp, phân công, điểm.

**Acceptance criteria:**
- [ ] SV chỉ thấy thông báo đúng đợt/nhóm; GV chỉ gửi cho nhóm mình hướng dẫn; Giáo vụ gửi đúng phạm vi đã chọn.
- [ ] Ẩn thông báo đã gửi làm mục đó biến mất khỏi “Tôi đã gửi” của chính người gửi, nhưng người nhận vẫn xem được từ các nơi được phép, trạng thái đã đọc và lịch sử gửi không đổi; người khác không ẩn hộ được.
- [ ] Mốc đăng ký, duyệt, phân công, đổi điểm, xác nhận và công bố có lịch sử đọc được với người/thời điểm/nội dung.

**Verification:** Test quyền người gửi/người nhận, thao tác gửi lặp, đánh dấu đã đọc và truy vết từ một đề tài mẫu.

**Dependencies:** `CP01`–`CP07`; PDR-038 đã chốt thao tác ẩn phía người gửi.

## Step P08-S02 — Thống kê và xuất dữ liệu

**Tham chiếu:** [FEATURE — Kết quả/Vận hành](../FEATURE.md), [DESIGN — Thống kê/Kết quả/Đề tài](../DESIGN/03-dac-ta-man-hinh.md).

**Công việc:**
- [ ] Xác định mẫu xuất danh sách đề tài/bảng điểm, cột, phạm vi quyền và thời điểm dữ liệu; không suy từ file canvas.
- [ ] Triển khai thống kê trạng thái đề tài, 6 chặng, tải GV, phân bố điểm từ dữ liệu bền vững.
- [ ] Xuất file an toàn (giá trị văn bản không được thực thi như công thức), giữ nhất quán với lọc/đợt và quyền công bố.

**Acceptance criteria:**
- [ ] Số liệu tổng khớp danh sách chi tiết; đợt rỗng/đầu đợt hiển thị rõ; bảng điểm xuất khớp kết quả đã xác nhận/công bố theo quyền.
- [ ] Người không có quyền không tải được file qua API trực tiếp; dữ liệu CSV/Excel có nội dung bắt đầu `=`, `+`, `-`, `@` không chạy thành công thức.

**Verification:** Đối chiếu thủ công bộ dữ liệu test có 1/2 SV, nhiều trạng thái; mở file xuất và kiểm tra quyền.

**Dependencies:** `CP03`, `CP07`.

## Step P08-S03 — Kiểm thử xuyên suốt và chuẩn bị vận hành

**Tham chiếu:** [VISION](../product/VISION.md), [NON_FUNCTIONAL](../requirements/NON_FUNCTIONAL.md), [NEON](../NEON.md). Đánh giá chịu tải theo PDR-046 được để sau phase này.

**Công việc:**
- [ ] Chạy kịch bản một đợt từ tạo tài khoản đến công bố cho nhóm 1/2 SV và các ngoại lệ đã chốt; kiểm tra vai trò trực tiếp ở backend.
- [ ] Kiểm tra dữ liệu và quyền qua luồng UI→API→DB trên môi trường test; xác nhận bài nộp, điểm và lịch sử còn đúng sau khởi động lại ứng dụng.
- [ ] Kiểm tra CI, build, migration SQL, cấu hình email/storage/DB, secret và hướng dẫn vận hành; loại kho demo khỏi các luồng đã nghiệm thu.
- [ ] Rà lại `docs/CONTENT.md`, `OPEN_QUESTIONS.md`, quyết định và màn hình để không còn khác hệ thống đã giao.

**Acceptance criteria:**
- [ ] Một đợt có thể theo dõi từ ghi danh đến công bố mà bảng tính không là nguồn dữ liệu chính; lịch sử giải thích được các thay đổi trọng yếu.
- [ ] Tất cả tiêu chí chức năng đã chốt có bằng chứng kiểm thử; tài liệu vận hành nêu đúng môi trường, cấu hình cần thiết và giới hạn còn lại.

**Verification:** Chạy lệnh phù hợp trong `AGENTS.md`/`README.md`, luồng UI→API→DB trên môi trường test và test quyền; không thử trên database chung/production.

**Dependencies:** `CP01`–`CP07`; OQ-007/PDR-046 không chặn checkpoint chức năng này.

## Checkpoint CP08 — Hoàn thiện sản phẩm mục tiêu

- [ ] Ba vai trò thực hiện được phần việc của mình trong một đợt trọn vẹn.
- [ ] Không còn màn nghiệp vụ nghiệm thu chỉ dùng dữ liệu giả, stub hoặc trạng thái “Đang xây dựng”.
- [ ] Các câu hỏi mở ảnh hưởng sản phẩm đã có quyết định và test; giới hạn còn lại được ghi rõ, không trình bày như đã hoàn thành.
