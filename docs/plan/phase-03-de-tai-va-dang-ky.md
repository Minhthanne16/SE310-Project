# Phase 03 — Đề tài, ghi danh và đề xuất

## Mục tiêu

Tạo được đề tài công bố, nhóm 1–2 SV, ghi danh hoặc đề xuất; bảo đảm một đề tài không bị hai nhóm nhận và toàn bộ lịch sử được giữ.

## Step P03-S01 — Đề tài của giảng viên và công bố danh sách

**Tham chiếu:** [BUSINESS_RULES — Đợt, đề tài và nhóm](../requirements/BUSINESS_RULES.md), [DESIGN — GV Đề tài/Giáo vụ Đề tài](../DESIGN/03-dac-ta-man-hinh.md).

**Công việc:**
- [ ] Đặc tả trường đề tài, thời điểm thêm/sửa/xóa, điều kiện công bố danh sách và cảnh báo mức đề tài GV.
- [ ] Triển khai API/UI theo quyền GVHD và Giáo vụ; xuất danh sách từ dữ liệu thật; giữ trạng thái và lịch sử.
- [ ] Chặn thay đổi bị cấm sau công bố; mức tối thiểu/tối đa chỉ cảnh báo theo BUSINESS_RULES.

**Acceptance criteria:**
- [ ] Trước/sau công bố cho phép đúng thao tác; danh sách SV chỉ hiện khi đã công bố; cảnh báo vượt mức không cản lưu.
- [ ] Đề tài đã có nhóm không bị xóa/sửa trái quy tắc.

**Verification:** Test ma trận quyền–trạng thái–trường sửa và một luồng GV gửi → Giáo vụ công bố → SV xem.

**Dependencies:** `CP02`.

## Step P03-S02 — Ghi danh nhóm vào đề tài công bố

**Tham chiếu:** [BUSINESS_RULES](../requirements/BUSINESS_RULES.md), [WORKFLOWS — Mở đợt và đăng ký](../requirements/WORKFLOWS.md), [DESIGN — Chi tiết đề tài](../DESIGN/03-dac-ta-man-hinh.md), [PDR-047](../decisions/PDR-047-huy-ghi-danh-de-tai-cong-bo.md), R15.

**Công việc:**
- [ ] Xác thực thành viên thuộc đợt, chưa có nhóm, đúng 1–2 người, có một đại diện; chỉ người được phép gửi yêu cầu.
- [ ] Thiết kế ràng buộc database/transaction cho cạnh tranh ghi danh và thao tác lặp; lưu lịch sử từng thành viên.
- [ ] Dựng tìm kiếm, chi tiết, xác nhận ghi danh và lỗi đề tài vừa được nhóm khác nhận.
- [ ] Triển khai hủy ghi danh theo PDR-047: bất kỳ thành viên nào thao tác khi đợt còn mở đăng ký và nhóm chưa nộp đề cương; giữ nguyên nhóm và lịch sử, đề tài quay lại `Chưa đăng ký`.

**Acceptance criteria:**
- [ ] Hai nhóm ghi danh đồng thời: đúng một nhóm thành công; nhóm thua nhận lỗi rõ và có thể làm mới danh sách.
- [ ] Một SV không thuộc hai nhóm trong cùng đợt; sau tải lại không thay đổi đại diện hay thành viên.
- [ ] Thành viên không phải đại diện cũng hủy được cho cả nhóm trong thời hạn hợp lệ; sau hủy nhóm/đại diện không đổi, đề tài trống trở lại, lần ghi danh cũ tra cứu được đúng quyền; hủy lặp không làm sai trạng thái.

**Verification:** Test tích hợp đồng thời và ranh giới 1/2/3 thành viên, quyền SV khác đợt, thao tác lặp.

**Dependencies:** `P03-S01`, `P02-S03`; PDR-047 đã chốt thao tác hủy ghi danh.

## Step P03-S03 — Đề xuất, duyệt/từ chối và hủy

**Tham chiếu:** [BUSINESS_RULES](../requirements/BUSINESS_RULES.md), [DESIGN — Đề xuất/Đơn đăng ký](../DESIGN/03-dac-ta-man-hinh.md), OQ-001, R12.

**Công việc:**
- [ ] Giữ PDR-012: chỉ hủy khi Chờ GV duyệt, lưu đề xuất `Đã hủy` trong lịch sử và ẩn khỏi danh sách chờ; giữ nguyên nhóm, cho đề xuất lại bằng nhóm đó ngay khi đợt còn mở và không có đơn khác đang hoạt động.
- [ ] Triển khai tạo/sửa/hủy theo quyết định; chỉ GVHD được nêu trong đề xuất chấp nhận/từ chối, từ chối bắt buộc lý do.
- [ ] Thêm màn GV xử lý và SV theo dõi; ghi lịch sử người/thời điểm/lý do.

**Acceptance criteria:**
- [ ] Đề xuất được chấp nhận chuyển `Đã đăng ký` đúng một lần; từ chối giữ lý do và lịch sử; người khác không duyệt được.
- [ ] Hủy khi còn chờ được lưu `Đã hủy` với người/thời điểm; hủy sau khi GV xử lý hoặc hủy lặp bị từ chối; đề xuất lại dùng cùng nhóm/thành viên/đại diện, không sinh nhóm thứ hai.

**Verification:** Test chuỗi tạo → sửa → chấp nhận/từ chối/hủy, quyền sai, xử lý đồng thời và lịch sử GV/Giáo vụ.

**Dependencies:** `P03-S02`; PDR-012.

## Checkpoint CP03 — Đăng ký xong không cần bảng tính

- [ ] Một nhóm 1 SV và một nhóm 2 SV đi hết luồng ghi danh hoặc đề xuất; lỗi cạnh tranh được xử lý nhất quán.
- [ ] Giáo vụ/GV/SV thấy cùng trạng thái và lịch sử tương ứng với quyền.
- [ ] PDR-012 và R12 đã được xử lý trong tài liệu và test.
