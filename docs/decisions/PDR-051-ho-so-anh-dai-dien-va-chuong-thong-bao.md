# PDR-051: Hợp đồng API hồ sơ, ảnh đại diện và chuông thông báo

## Trạng thái

Đã chấp nhận khi triển khai P01-S03 ngày 2026-11-06. Các mục ghi "lựa chọn triển khai" do người làm task đề xuất, nhóm có thể đổi trong PDR sau.

## Bối cảnh

Hồ sơ và chuông ở frontend chạy trên kho demo trong bộ nhớ, đổi mật khẩu thường là stub 501, backend chỉ có `GET /api/profile` và thực thể `User` đã có `Phone`, `SecondaryEmail`, `AvatarObjectKey` nhưng chưa có migration. Quyền và giới hạn đã chốt tại [PDR-036](PDR-036-chu-tai-khoan-va-giao-vu-sua-ho-ten.md) và [PDR-043](PDR-043-gioi-han-anh-dai-dien.md); PDR này ghi hợp đồng API và cách lưu.

## Quyết định

### Hồ sơ

Mọi endpoint yêu cầu `[Authorize]` và chỉ thao tác trên tài khoản đang đăng nhập, không nhận id người dùng từ client. Lỗi dùng `ApiResponse`; token chờ đổi mật khẩu lần đầu nhận 403.

| Method + route | Body | Thành công | Lỗi |
| --- | --- | --- | --- |
| `GET /api/profile` | — | 200 `ProfileDto` | 401 |
| `PUT /api/profile` | `{ fullName, dateOfBirth, phone, secondaryEmail }` | 200 `ProfileDto` | 400 `errors[]`, 401 |
| `PUT /api/profile/avatar` | `multipart/form-data`, trường `file` | 200 `ProfileDto` | 400 sai định dạng/quá 2 MB, 401, 503 |
| `DELETE /api/profile/avatar` | — | 200 `ProfileDto`; lặp lại vẫn 200 | 401, 503 |
| `GET /api/profile/avatar` | — | 200 ảnh | 401, 404 chưa có ảnh, 503 |
| `POST /api/auth/change-password` | `{ currentPassword, newPassword }` | 200 `CurrentUserDto` + cookie mới | 400 `message` hoặc `errors[]`, 401 |

- `ProfileDto`: `{ id, userCode, fullName, email, role, dateOfBirth, phone, secondaryEmail, avatarUrl, className, department, academicTitle, lastLogins[] }`. `dateOfBirth` dạng `yyyy-MM-dd`; trường trống là `null`.
- `CurrentUserDto` có thêm `avatarUrl` (thanh bên hiển thị ảnh).
- **Trường được sửa:** họ tên ≤ 200 ký tự, bắt buộc; ngày sinh không ở tương lai theo giờ Việt Nam; SĐT 10 chữ số bắt đầu bằng 0, bỏ khoảng trắng và dấu chấm trước khi lưu; email phụ hợp lệ, lưu chữ thường, khác email đăng nhập. Mã, email đăng nhập, vai trò, đơn vị gửi thừa bị bỏ qua. Gửi chuỗi rỗng là xóa trường không bắt buộc.
- **Đổi mật khẩu thường:** cùng quy tắc PDR-002, khác mật khẩu hiện tại và mã người dùng. Xoay `SecurityStamp` nên mọi token cũ hết hiệu lực; phiên đang dùng nhận cookie mới.
- **Lịch sử:** mọi thay đổi hồ sơ ghi `UserAuditEntries` với người thực hiện là chính chủ và giá trị trước/sau; ảnh chỉ ghi `uploaded`/`removed`; đổi mật khẩu ghi hành động `PasswordChanged`, không có chi tiết. Không đổi gì thì không ghi.

### Ảnh đại diện

- Xét chữ ký đầu tệp (JPG, PNG, WebP), không tin phần mở rộng hay `Content-Type` của trình duyệt.
- Lưu trong MinIO, bucket `Storage:Bucket` (Compose: `qlkltn`, tự tạo khi cần), khóa ngẫu nhiên `avatars/{userId}/{guid}.{đuôi}`. DB chỉ lưu khóa. Bucket riêng tư, ảnh chỉ đọc qua API và chỉ chính chủ đọc được (`nosniff`, CSP `sandbox`, `Cache-Control: private, no-cache`). `avatarUrl` có tham số `v` đổi theo từng ảnh.
- **Thứ tự lưu:** ghi object mới → cập nhật DB → xóa object cũ. Storage lỗi thì trả 503, ảnh cũ giữ nguyên; DB lỗi thì xóa object mới. Không xóa được object cũ chỉ ghi log.
- Thiếu cấu hình `Storage` (ví dụ `compose.neon.yaml`) thì hồ sơ vẫn chạy, riêng thao tác ảnh trả 503.
- **Lựa chọn triển khai:** không mã hóa lại ảnh vì cần thêm thư viện xử lý ảnh; tệp đúng chữ ký nhưng ruột hỏng vẫn được nhận và chỉ hiển thị lỗi ở trình duyệt.

### Chuông thông báo

Mọi endpoint yêu cầu `[Authorize]`, người nhận lấy từ phiên.

| Method + route | Body | Thành công | Lỗi |
| --- | --- | --- | --- |
| `GET /api/notifications/me` | — | 200 `NotificationDto[]`, mới nhất trước, tối đa 50 | 401 |
| `POST /api/notifications/read` | `{ ids: Guid[] }`, 1–200 phần tử | 200 số dòng vừa đổi | 400, 401 |

- `NotificationDto`: `{ id, kind, text, from, href, createdAt, isRead }`. `from` là họ tên người gửi hoặc `Hệ thống`. `kind` thuộc `assign | success | reject | schedule | comment | deadline | result | inbox | post`.
- Bảng `Notifications`: một dòng cho mỗi người nhận, chung `BatchId` trong một lần gửi, trạng thái đọc riêng từng người. Id của người khác bị bỏ qua, không báo lỗi để không lộ sự tồn tại.
- Tài khoản đã nhận hoặc gửi thông báo tính là "đã có dữ liệu" nên chỉ bị vô hiệu hóa, không xóa (`BUSINESS_RULES`).
- **Sự kiện đang phát sinh:** chỉ Mở đợt, gửi tới Sinh viên và Giảng viên đang thuộc đợt, ghi cùng transaction với đổi trạng thái. Các sự kiện khác, gửi thủ công, Bảng thông báo và thao tác ẩn theo PDR-038 thuộc P08-S01.

## Hệ quả

- Migration `AddProfileContactAndNotifications` phải áp dụng trước khi chạy bản này; nó chỉ thêm ba cột vào `Users` và bảng `Notifications`. Không tự chạy trên Neon/dữ liệu dùng chung.
- `lastLogins` hiện có tối đa một mốc vì hệ thống chỉ lưu `LastLoginAt`; lịch sử nhiều lần đăng nhập cần bảng riêng.
- Chưa giới hạn số lần nhập sai mật khẩu hiện tại khi đổi mật khẩu; chưa có quyết định cho việc này.
