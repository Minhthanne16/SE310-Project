# Phase 05 — Mẫu phiếu đánh giá và phân công phản biện

## Mục tiêu

Giáo vụ cấu hình mẫu điểm có hiệu lực và phân công phản biện đúng điều kiện, không để thay mẫu làm sai phiếu đã nhập.

## Step P05-S01 — Mẫu phiếu và tiêu chí

**Tham chiếu:** [DOMAIN_MODEL — Mẫu phiếu](../architecture/DOMAIN_MODEL.md), [DESIGN — Mẫu phiếu](../DESIGN/03-dac-ta-man-hinh.md#mẫu-phiếu-đánh-giá), [PDR-024](../decisions/PDR-024-mau-hoi-dong-chung-phieu-diem-rieng.md), [PDR-025](../decisions/PDR-025-phien-ban-hoa-mau-phieu-da-gan.md), [PDR-026](../decisions/PDR-026-khoa-phien-ban-mau-trong-dot-sau-diem.md), [PDR-027](../decisions/PDR-027-chi-xoa-mau-nhap-chua-gan.md), [PDR-028](../decisions/PDR-028-dong-mau-khong-chan-dot-dang-dung.md), [PDR-035](../decisions/PDR-035-cong-diem-tieu-chi-cap-cuoi.md), R05.

**Công việc:**
- [ ] Dùng mẫu HD, PB và mẫu hội đồng chung cho Chủ tịch/Thư ký theo PDR-024; đặt điểm tối đa ở tiêu chí cấp cuối sao cho tổng đúng 10 và tính điểm phiếu bằng tổng điểm cấp cuối theo PDR-035.
- [ ] Mẫu Nháp chưa gán được sửa trực tiếp; từ khi đã gán phải tạo phiên bản mới và giữ bản cũ theo PDR-025. Khóa chuyển phiên bản đang dùng của từng loại mẫu trong đợt từ phiếu đầu tiên theo PDR-026. Chỉ xóa Nháp chưa từng gán theo PDR-027; Đóng ngăn gán mới nhưng đợt cũ vẫn chấm theo PDR-028.
- [ ] Triển khai form, validation trùng tên/thiếu tiêu chí và bản chụp mẫu gắn phiếu để giữ lịch sử.

**Acceptance criteria:**
- [ ] HD/PB dùng đúng mẫu của mình; Chủ tịch/Thư ký dùng cùng phiên bản mẫu hội đồng nhưng có hai phiếu điểm độc lập cho mỗi Sinh viên. Phiếu cũ giữ được tên/điểm tiêu chí dù mẫu mới thay đổi.
- [ ] Không sửa trực tiếp tiêu chí của phiên bản mẫu đã gán; tạo phiên bản mới không tự sửa phiếu cũ hoặc tự đổi mẫu đang dùng của đợt.
- [ ] Sau phiếu đầu tiên của một loại mẫu, các phiếu còn lại trong đợt dùng đúng phiên bản đã khóa; loại mẫu khác chưa có phiếu vẫn có thể chọn phiên bản mới có lịch sử.
- [ ] Mẫu đã từng gán không xóa được dù hiện đã gỡ gán hoặc chưa có điểm; mẫu Nháp chưa từng gán xóa được theo quyền Giáo vụ.
- [ ] Mẫu đã Đóng không gán được cho đợt mới; các đợt đã gán trước khi Đóng vẫn lưu phiếu còn thiếu bằng đúng phiên bản và không đổi phiếu cũ.
- [ ] Mẫu có tổng tối đa khác 10 không được đưa vào dùng; tiêu chí cha không bị cộng hai lần, điểm phiếu khớp tổng điểm cấp cuối.
- [ ] Không xóa/sửa mẫu đang được phiếu điểm tham chiếu theo quy tắc đã chốt.

**Verification:** Test gán mẫu, sửa sau gán, sửa sau khi có phiếu, trùng tiêu chí, tổng tối đa 10 và cấu trúc cha/con nhiều cấp.

**Dependencies:** `CP02`; PDR-024–028/035.

## Step P05-S02 — Phân công phản biện

**Tham chiếu:** [ROLES](../product/ROLES.md), [WORKFLOWS — Phân công](../requirements/WORKFLOWS.md), [DESIGN — Giảng viên phản biện](../DESIGN/03-dac-ta-man-hinh.md#giảng-viên-phản-biện), [PDR-021](../decisions/PDR-021-phan-cong-phan-bien-sau-duyet-de-cuong.md), [PDR-022](../decisions/PDR-022-dieu-kien-nhap-diem-phan-bien.md), [PDR-023](../decisions/PDR-023-khoa-thay-giang-vien-phan-bien-sau-phieu.md), R05.

**Công việc:**
- [ ] Giao phản biện từ khi đề cương đã duyệt theo PDR-021, không chờ hai báo cáo; chỉ mở **nhập điểm** sau khi có báo cáo cuối kỳ theo PDR-022, hiển thị lý do chưa đủ điều kiện.
- [ ] Triển khai gán từng đề tài/hàng loạt; chặn GVHD phản biện chính đề tài mình, kiểm tra một người được gán đồng thời.
- [ ] Nếu giữ chức năng “Tự gợi ý”, chốt thuật toán và tính chất gợi ý; Giáo vụ xác nhận trước khi lưu.
- [ ] Cho đổi Giảng viên phản biện trước phiếu có lịch sử/thông báo; từ phiếu đầu tiên khóa thay người theo PDR-023, kể cả khi chỉ một Sinh viên đã có phiếu.

**Acceptance criteria:**
- [ ] Đề tài đã duyệt đề cương nhưng chưa nộp một hoặc cả hai báo cáo vẫn được phân công; đề tài chưa duyệt bị chặn với lý do. Gán hợp lệ hiện ở màn GV phản biện; GV không được phân công không xem/chấm dữ liệu kín.
- [ ] Đã phân công nhưng chưa có báo cáo cuối kỳ thì không lưu được phiếu phản biện; thiếu báo cáo giữa kỳ hoặc chưa chốt bản cuối không tự khóa nhập điểm nếu báo cáo cuối kỳ đã nộp.
- [ ] Gán trùng, gán GVHD và thay sau điểm được xử lý theo quy tắc; thao tác hàng loạt báo rõ dòng thành công/thất bại.
- [ ] Đổi người sau phiếu đầu tiên bị từ chối; điểm đã nhập giữ nguyên người chấm; đổi trước phiếu lưu lịch sử và thông báo người bị ảnh hưởng.

**Verification:** Test ma trận điều kiện, quyền, xung đột gán và dữ liệu đồng thời; luồng Giáo vụ gán → GV xem.

**Dependencies:** `P04-S01` cho đề cương đã duyệt; báo cáo cuối kỳ ở `P04-S02` chỉ là điều kiện nhập điểm phản biện trong Phase 07, không chặn phân công; PDR-021–023.

## Checkpoint CP05 — Phản biện sẵn sàng chấm

- [ ] Có mẫu có hiệu lực, phân công hợp lệ và danh sách GV phản biện lấy dữ liệu thật.
- [ ] Mẫu/phiếu có lịch sử phiên bản; điều kiện phân công không mâu thuẫn với WORKFLOWS.
