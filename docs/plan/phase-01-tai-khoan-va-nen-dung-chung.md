# Phase 01 — Tài khoản và nền dùng chung

## Mục tiêu

Đưa nền xác thực, quản lý người dùng, hồ sơ và khung theo vai trò từ trạng thái có sẵn/demo thành lát cắt dùng dữ liệu thật. Auth và CSV đã có API, vì vậy ưu tiên kiểm chứng và hoàn thiện khoảng trống.

## Step P01-S01 — Kiểm chứng đăng nhập, kích hoạt và nhập CSV đã có

**Tham chiếu:** [PDR-001](../decisions/PDR-001-vai-tro-va-quy-trinh-co-kiem-soat.md), [PDR-002](../decisions/PDR-002-xac-thuc-va-lo-trinh-ma-nguon.md), [PDR-003](../decisions/PDR-003-otp-kich-hoat-qua-email.md), [PDR-004](../decisions/PDR-004-nhap-tai-khoan-csv.md).

**Công việc:**
- [ ] Đối chiếu hợp đồng `/api/auth/*`, `/api/users/import/*` với service/type/frontend và test; kiểm tra OTP, cookie, security stamp, 401/403 và lỗi CSV theo dòng.
- [ ] Kiểm tra UI đăng nhập/nhập CSV với API thật; loại bỏ mọi nhãn hoàn tất nếu chỉ chạy dữ liệu demo.
- [ ] Ghi rõ cấu hình local/test và trạng thái migration trên từng database; không áp dụng migration lên Neon/shared chỉ để kiểm thử.

**Acceptance criteria:**
- [ ] Ba vai trò đăng nhập đúng; tài khoản chưa kích hoạt không gọi được endpoint nghiệp vụ; OTP hết hạn/sai 5 lần/gửi lại quá sớm xử lý đúng PDR-003.
- [ ] CSV xem trước không ghi DB; nhập chỉ tạo dòng hợp lệ trong một transaction; cùng tệp nhập lại/tranh chấp email không tạo dữ liệu trùng.

**Verification:** Test API và một luồng UI→API trên database test cô lập; kiểm tra response thành công/lỗi, cookie và báo cáo CSV.

**Dependencies:** PDR-001–004 đã chốt; không phụ thuộc OQ nghiệp vụ đợt.

## Step P01-S02 — Quản lý người dùng và khôi phục truy cập

**Tham chiếu:** [BUSINESS_RULES — Truy vết và tài khoản](../requirements/BUSINESS_RULES.md), [DESIGN — Người dùng/Quên mật khẩu](../DESIGN/03-dac-ta-man-hinh.md), [PDR-037](../decisions/PDR-037-phan-hoi-trung-tinh-khi-quen-mat-khau.md), [PDR-044](../decisions/PDR-044-gioi-han-yeu-cau-dat-lai-mat-khau.md), [PDR-045](../decisions/PDR-045-chi-tai-khoan-hoat-dong-da-kich-hoat-duoc-tu-dat-lai-mat-khau.md), R10.

**Công việc:**
- [ ] Thiết kế, đối chiếu rồi triển khai API/UI danh sách, thêm/sửa, vô hiệu hóa/kích hoạt lại, xóa nếu chưa có dữ liệu, đặt lại mật khẩu; kiểm tra không xóa chính mình.
- [ ] Triển khai luồng quên mật khẩu 30 phút, dùng một lần, email đúng định dạng luôn nhận phản hồi trung tính theo PDR-037; chỉ tài khoản hoạt động đã kích hoạt nhận/sử dụng liên kết theo PDR-045. Áp dụng giới hạn 60 giây, 5/giờ/email và 20/giờ/nguồn theo PDR-044 mà không làm lộ email có tài khoản.
- [ ] Ghi lịch sử thao tác quản trị, bảo vệ dữ liệu cá nhân, không lộ token/mật khẩu trong log hoặc báo cáo CSV.

**Acceptance criteria:**
- [ ] Giáo vụ xử lý được tài khoản từ UI qua API thật; mã và vai trò không đổi; tài khoản có tham chiếu chỉ bị vô hiệu hóa; token cũ hết hiệu lực.
- [ ] Email có/không có tài khoản cho cùng mã trạng thái, cấu trúc và nội dung phản hồi; email sai định dạng được báo lỗi định dạng; liên kết reset hết hạn/đã dùng bị từ chối; sau reset phiên cũ hết hiệu lực.
- [ ] Yêu cầu bị giới hạn vẫn nhận phản hồi trung tính và không gửi thêm thư; kiểm thử ranh giới 60 giây, lần 5/6 theo email, lần 20/21 theo nguồn và thao tác đồng thời.
- [ ] Email không có tài khoản, tài khoản vô hiệu hóa hoặc chưa kích hoạt không phát sinh thư nhưng phản hồi như tài khoản hợp lệ; liên kết đã phát không dùng được nếu tài khoản bị vô hiệu hóa sau đó.

**Verification:** Test quyền, xóa có/không tham chiếu, đặt lại và đăng nhập lại; kiểm tra lỗi 401/403 và dữ liệu trả về.

**Dependencies:** `P01-S01`; PDR-037/044/045 đã chốt phản hồi, giới hạn yêu cầu và điều kiện nhận liên kết.

## Step P01-S03 — Hồ sơ, khung trang và nền thông báo

**Tham chiếu:** [DESIGN — Hồ sơ/Trang chủ/Chuông](../DESIGN/03-dac-ta-man-hinh.md), [ROLES](../product/ROLES.md), [PDR-036](../decisions/PDR-036-chu-tai-khoan-va-giao-vu-sua-ho-ten.md), [PDR-043](../decisions/PDR-043-gioi-han-anh-dai-dien.md).

**Công việc:**
- [ ] Cho cả ba vai trò tự sửa họ tên theo PDR-036; Giáo vụ sửa được họ tên tài khoản khác, mọi thay đổi có lịch sử. Triển khai đọc/sửa hồ sơ và đổi mật khẩu thường, kiểm tra backend từng trường.
- [ ] Hoàn thiện app shell, điều hướng theo phiên, trạng thái loading/error/empty; dựng điểm gắn chuông/thông báo dùng lại ở Phase 08.
- [ ] Triển khai ảnh đại diện JPG/PNG/WebP tối đa 2 MB theo PDR-043; bỏ dữ liệu hồ sơ demo và stub 501.

**Acceptance criteria:**
- [ ] SV/GV/Giáo vụ chỉ xem/sửa đúng trường được quyết định; tải lại trang vẫn giữ dữ liệu; đổi mật khẩu thu hồi token cũ.
- [ ] Tự sửa họ tên thành công ở cả ba vai trò; người dùng thường sửa tên tài khoản khác bị chặn; Giáo vụ sửa tài khoản khác có lịch sử, đề tài/phiếu điểm vẫn liên kết đúng người.
- [ ] Ảnh hợp lệ dưới/đúng ngưỡng 2 MB được nhận; ảnh sai định dạng, giả ảnh hoặc vượt ngưỡng bị từ chối với lỗi rõ và không thay ảnh cũ.
- [ ] Người không có quyền không vào được dữ liệu người khác dù gọi API trực tiếp; giao diện dùng bàn phím và báo lỗi rõ.

**Verification:** Test service/component và request thật cho ba vai trò; thử nhập trường cấm, dữ liệu thiếu và ảnh lỗi.

**Dependencies:** `P01-S01`, PDR-036/043.

## Checkpoint CP01 — Nền tài khoản dùng được

- [ ] Auth/CSV hiện có được kiểm chứng; các thao tác tài khoản/hồ sơ cần cho một đợt hoạt động trên dữ liệu thật.
- [ ] Quyền backend, nhật ký và trường hợp dữ liệu thiếu được test.
- [ ] PDR-036/037/043/044 được đối chiếu với quyền và giới hạn thật trước khi nghiệm thu.
