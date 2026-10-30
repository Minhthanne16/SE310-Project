# Phase 06 — Hội đồng và lịch bảo vệ

## Mục tiêu

Tạo hội đồng chủ tịch/thư ký, xếp đề tài vào lịch khả thi và công bố lịch có kiểm soát.

## Step P06-S01 — Hội đồng và thành viên

**Tham chiếu:** [ROLES — Vai trò ngữ cảnh](../product/ROLES.md), [BUSINESS_RULES — Tài liệu và phân công](../requirements/BUSINESS_RULES.md), [DESIGN — Hội đồng](../DESIGN/03-dac-ta-man-hinh.md#hội-đồng-bảo-vệ), [PDR-020](../decisions/PDR-020-khoa-thay-thanh-vien-hoi-dong-sau-diem.md).

**Công việc:**
- [ ] Chốt bất biến một chủ tịch/một thư ký, mỗi GV một vai trò mỗi hội đồng, đề tài có đúng một hội đồng và một lượt bảo vệ có hiệu lực theo PDR-016.
- [ ] Triển khai tạo/sửa/xóa hội đồng Nháp, gán/bỏ đề tài; kiểm tra GVHD không ở hội đồng chấm đề tài mình.
- [ ] Cho thay thành viên trước điểm có lịch sử/kiểm tra xung đột; khóa thay Chủ tịch/Thư ký từ khi hội đồng có bất kỳ phiếu điểm nào theo PDR-020.

**Acceptance criteria:**
- [ ] Không lưu hội đồng thiếu vai trò hoặc trùng người; không gán đề tài cho hội đồng có GVHD của đề tài.
- [ ] Thay thành viên sau điểm bị từ chối cả khi một Sinh viên đã có phiếu và người khác chưa có; phiếu đã nhập giữ nguyên người chấm.

**Verification:** Test tạo/sửa/xóa, gán đề tài, đổi người trước/sau điểm và quyền Giáo vụ.

**Dependencies:** `CP05`; PDR-020.

## Step P06-S02 — Lịch và kiểm tra xung đột

**Tham chiếu:** [WORKFLOWS — Phân công và bảo vệ](../requirements/WORKFLOWS.md), [DESIGN — Hội đồng](../DESIGN/03-dac-ta-man-hinh.md#hội-đồng-bảo-vệ), [PDR-014](../decisions/PDR-014-chan-trung-phong-bao-ve.md), [PDR-015](../decisions/PDR-015-chan-trung-lich-giang-vien-hoi-dong.md), [PDR-016](../decisions/PDR-016-mot-luot-bao-ve-co-hieu-luc-moi-de-tai.md), [PDR-017](../decisions/PDR-017-thoi-gian-tung-luot-bao-ve.md), [PDR-018](../decisions/PDR-018-sua-lich-da-cong-bo-va-dinh-chinh.md), [PDR-019](../decisions/PDR-019-huy-lich-bao-ve-da-cong-bo.md), R06/R13.

**Công việc:**
- [ ] Giữ PDR-014–017: trùng phòng/Giảng viên chặn lưu/công bố, mỗi đề tài chỉ một hội đồng/lượt có hiệu lực; nhập giờ bắt đầu/kết thúc từng lượt và chặn giờ kết thúc không sau giờ bắt đầu.
- [ ] Triển khai nhập ngày/giờ/phòng, xếp thứ tự, xem trước xung đột và lưu nhất quán khi hai Giáo vụ thao tác cùng lúc.
- [ ] Triển khai sửa lịch sau công bố trước điểm: lý do, lịch sử, kiểm tra lại xung đột và thông báo người bị ảnh hưởng theo PDR-018.
- [ ] Khi đã có điểm, khóa sửa trực tiếp giờ/phòng; cho ghi đính chính có lý do, giữ lịch gốc và hiển thị đính chính theo PDR-018.
- [ ] Cho Giáo vụ hủy lịch đã công bố trước điểm hội đồng, bắt buộc lý do/lịch sử/thông báo; khóa hủy thông thường sau điểm, giữ lịch đã hủy trong lịch sử theo PDR-019.

**Acceptance criteria:**
- [ ] Hai hội đồng cùng phòng hoặc có chung Giảng viên với thời gian chồng lấn không lưu/công bố được; lịch liền kề không giao nhau được xử lý đúng; các xung đột khác theo quyết định đã chốt.
- [ ] Đề tài không có hai lượt/hội đồng có hiệu lực đồng thời; khi đổi lịch hợp lệ, lịch cũ vẫn tra cứu được trong lịch sử.
- [ ] Mỗi lượt có giờ bắt đầu/kết thúc hợp lệ; hai lượt liền kề không bị coi là trùng.
- [ ] Sau sửa trước điểm, SV/GV thấy cùng lịch mới và có dấu vết thay đổi/thông báo; sau điểm, lịch gốc không bị ghi đè và đính chính có thể tra cứu.
- [ ] Lịch hủy trước điểm không còn hiệu lực nhưng tra cứu được; người bị ảnh hưởng được thông báo; thao tác hủy sau điểm bị từ chối và không xóa vật lý hội đồng/lịch đã công bố.

**Verification:** Test trùng phòng, trùng GV, chồng lấn một phần, giờ giáp ranh, giờ kết thúc không hợp lệ, lịch thay đồng thời, sửa/hủy trước điểm, hủy sau điểm bị chặn và đính chính sau điểm.

**Dependencies:** `P06-S01`; PDR-014–019.

## Step P06-S03 — Công bố lịch và góc nhìn người tham gia

**Tham chiếu:** [FEATURE — Phân công và bảo vệ](../FEATURE.md), [DESIGN — Hội đồng GV](../DESIGN/03-dac-ta-man-hinh.md#hội-đồng-bảo-vệ-giảng-viên), [PDR-019](../decisions/PDR-019-huy-lich-bao-ve-da-cong-bo.md).

**Công việc:**
- [ ] Triển khai thao tác công bố, sửa trước điểm theo PDR-018 và hủy trước điểm theo PDR-019; tạo sự kiện thông báo cho SV, GV phản biện và hội đồng, gồm thông báo thay/hủy lịch cho người bị ảnh hưởng.
- [ ] Hoàn thiện màn GV hội đồng và SV xem lịch, phòng, thứ tự; lọc theo quyền.

**Acceptance criteria:**
- [ ] Lịch Nháp chỉ người có quyền thấy; sau công bố đúng người thấy chi tiết cần thiết; người khác không đọc được qua API.
- [ ] Công bố lặp không tạo bản lịch/thông báo nhân đôi.

**Verification:** Test ma trận quyền và luồng Giáo vụ công bố → SV/GV xem; thao tác lặp và sửa sau công bố.

**Dependencies:** `P06-S02`; nền thông báo `P01-S03` và Phase 08 khi hoàn thiện kênh gửi.

## Checkpoint CP06 — Lịch bảo vệ có thể sử dụng

- [ ] Hội đồng, đề tài, người và phòng không vi phạm bất biến đã chốt.
- [ ] OQ-004/005 đã chốt theo PDR-014–020; R06/R13 có bằng chứng kiểm thử và lịch sử trước khi nghiệm thu phần phụ thuộc.
