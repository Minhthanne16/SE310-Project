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

**Ghi nhận triển khai 2026-11-17 — P08-S02 (chưa hoàn tất CP07):**
- Trang `/giao-vu/thong-ke` lấy dữ liệu thật theo đợt qua `GET /api/statistics/{roundId}`: số đề tài theo trạng thái, bằng chứng hoàn thành 6 chặng, tải GV hướng dẫn theo định mức của đợt, danh sách chi tiết và sinh viên tham gia. `snapshotAt` là thời điểm máy chủ tổng hợp lần tải gần nhất; nút Làm mới yêu cầu dữ liệu lại. Đợt Nháp/rỗng được hiển thị rõ thay vì dùng dữ liệu mẫu.
- Danh sách đề tài xuất theo bộ lọc trạng thái/tìm kiếm/GV của đợt đang chọn, gồm **Mã, Tên đề tài, Lĩnh vực, GV hướng dẫn, Nhóm, Nguồn, Trạng thái, Tiến độ khóa luận**. Danh sách đăng ký xuất toàn đợt, mỗi SV một dòng, gồm **MSSV, Họ tên, Lớp, Mã đề tài, Tên đề tài, GV hướng dẫn, Trạng thái đăng ký**. Mẫu cột theo phần **Chi tiết đợt → Tab Đề tài → Popup xuất Excel** của [DESIGN/03](../DESIGN/03-dac-ta-man-hinh.md), không lấy từ artboard. Excel dùng dữ liệu đang hiển thị ở lần tải gần nhất; API CSV truy vấn dữ liệu mới tại thời điểm yêu cầu xuất.
- Chỉ vai trò **Giáo vụ** được truy cập `/api/statistics/{roundId}` và các endpoint xuất `topics.csv`, `registrations.csv`, `grades.csv`, kể cả gọi API trực tiếp. Cả CSV UTF-8 BOM và Excel đều vô hiệu hóa chuỗi có tiền tố công thức `=`, `+`, `-`, `@` (kể cả khoảng trắng/ký tự điều khiển đầu ô).
- **Chưa nghiệm thu phân bố điểm và xuất bảng điểm:** CP07 chưa lưu đủ phiếu chấm và kết quả xác nhận/công bố trong DB. `grades.csv` trả **409 Conflict** cho Giáo vụ và vẫn từ chối **401/403** đối với người không có quyền; UI thông báo thiếu dữ liệu và vô hiệu hóa xuất điểm. Sau CP07 cần chốt các cột bảng điểm, nguồn điểm theo từng SV, thời điểm chốt và phạm vi xem theo trạng thái xác nhận/công bố trước khi bật xuất.

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
