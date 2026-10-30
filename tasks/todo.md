# Checklist hoàn thiện QLKLTN

Chi tiết đầu ra, phụ thuộc, tiêu chí nghiệm thu, kiểm thử và vị trí code của từng task nằm trong [plan.md](plan.md). Tick `[x]` chỉ sau khi đã qua checkpoint tương ứng; trạng thái “bị chặn” nghĩa là chờ quyết định trong `docs/OPEN_QUESTIONS.md`, không phải đã hoàn tất.

## Phase 0 — Quy tắc và hợp đồng

- [ ] T00: Chốt ma trận quy tắc và G-01…G-08 với nhóm/Khoa; cập nhật tài liệu chuẩn.
- [ ] T01: Lập bản đồ use case, quyền, hợp đồng FE/BE, dữ liệu và transaction.
- [ ] Checkpoint P0: không còn mâu thuẫn ngầm; các task bị chặn được chỉ rõ.

## Phase 1 — Tài khoản

- [ ] T02: Đổi mật khẩu thông thường qua API và hồ sơ.
- [ ] T03: Quên/đặt lại mật khẩu qua email (G-08).
- [ ] T04: Quản trị tài khoản và vô hiệu hóa/kích hoạt lại.
- [ ] T05: Giao diện nhập CSV preview/commit và báo cáo lỗi.
- [ ] T06: Sửa hồ sơ/hoạt động đăng nhập; ảnh chờ G-06.
- [ ] Checkpoint P1: ba vai trò đăng nhập và được quản lý bằng API/UI thật.

## Phase 2 — Đợt và đề tài

- [ ] T07: Vòng đời đợt khóa luận (G-08).
- [ ] T08: Mốc, hạn và thành viên đợt (G-08).
- [ ] T09: Dashboard đợt/việc cần làm tối thiểu.
- [ ] T10: GV tạo và quản lý đề tài (G-08 cho quyền sửa sau công bố).
- [ ] T11: Giáo vụ công bố, SV tra cứu danh sách đề tài.
- [ ] Checkpoint P2: đợt và đề tài công bố qua dữ liệu thật.

## Phase 3 — Đăng ký và đề xuất

- [ ] T12: Nhóm, ghi danh và kiểm thử tranh chấp một đề tài.
- [ ] T13: Đề xuất và GV duyệt/từ chối có lý do.
- [ ] T14: Sửa/hủy/đề xuất lại và lịch sử (G-01).
- [ ] Checkpoint P3: đăng ký nhất quán, không mất lịch sử.

## Phase 4 — Tài liệu

- [ ] T15: Không gian đề tài và audit theo quyền.
- [ ] T16: Lưu phiên bản tài liệu, upload/download riêng tư (G-06).
- [ ] T17: Đề cương, duyệt và yêu cầu sửa (G-03, G-06).
- [ ] T18: Báo cáo giữa kỳ/cuối kỳ và nộp trễ (G-06).
- [ ] T19: Chốt bản cuối và trường hợp thiếu bản nộp (G-02, G-06).
- [ ] Checkpoint P4: lịch sử tài liệu và quyền tải được kiểm thử.

## Phase 5 — Phản biện và bảo vệ

- [ ] T20: Phân công phản biện (G-08 cho điều kiện/gợi ý).
- [ ] T21: Hội đồng, thành viên và thay đổi sau có điểm (G-04, G-05).
- [ ] T22: Lịch bảo vệ, xung đột và công bố (G-04).
- [ ] Checkpoint P5: lịch và phân công hợp lệ, đúng người xem.

## Phase 6 — Chấm và công bố

- [ ] T23: Mẫu phiếu/tiêu chí/gán theo đợt (G-08).
- [ ] T24: Điểm hướng dẫn/phản biện từng SV.
- [ ] T25: Điểm chủ tịch/thư ký do thư ký nhập (G-05).
- [ ] T26: Tính điểm và cảnh báo lệch theo quy tắc.
- [ ] T27: Giáo vụ xác nhận/công bố; SV xem kết quả (G-02, G-05).
- [ ] Checkpoint P6: một nhóm đi hết luồng từ nộp đến công bố.

## Phase 7 — Thông báo và báo cáo

- [ ] T28: Thông báo tự động/gửi tay và chuông.
- [ ] T29: Lịch sử, dashboard và Gantt hoàn chỉnh.
- [ ] T30: Thống kê và xuất danh sách/bảng điểm.
- [ ] Checkpoint P7: số liệu và thông báo khớp dữ liệu nguồn.

## Phase 8 — Phát hành

- [ ] T31: Rà soát bảo mật, dữ liệu, backup/restore và vận hành (G-07).
- [ ] T32: E2E ba vai trò, ca lỗi/đồng thời và tiêu chí phi chức năng (G-07).
- [ ] T33: Staging, runbook, UAT và checklist phát hành.
- [ ] Checkpoint phát hành: toàn bộ luồng trong `docs/requirements/WORKFLOWS.md` đạt; G-01…G-08 liên quan đã đóng.

## Công việc nền đã hoàn thành trước kế hoạch này

- [x] Gom mã theo feature và chuyển runtime workspace vào `app/`.
- [x] Nền Auth/OTP, CSV backend, Products mẫu, sidebar và các kiểm tra baseline hiện có.
