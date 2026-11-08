# PDR-052: Hợp đồng API quên mật khẩu và xem lịch sử tài khoản

## Trạng thái

Đã chấp nhận khi triển khai phần còn lại của P01-S02 ngày 2026-11-07. Quy tắc nghiệp vụ đã chốt tại [PDR-037](PDR-037-phan-hoi-trung-tinh-khi-quen-mat-khau.md), [PDR-044](PDR-044-gioi-han-yeu-cau-dat-lai-mat-khau.md) và [PDR-045](PDR-045-chi-tai-khoan-hoat-dong-da-kich-hoat-duoc-tu-dat-lai-mat-khau.md). PDR này chỉ ghi hợp đồng API, cách lưu và các mục "lựa chọn triển khai" do người làm task đề xuất; nhóm có thể đổi các mục đó trong PDR sau.

## Bối cảnh

Trang `/quen-mat-khau` mới là bản "đang xây dựng". Backend chưa có API phát liên kết, token 30 phút hay giới hạn tần suất. Tài khoản tạo bằng nhập CSV chưa được ghi lịch sử, và chưa có cách xem bảng `UserAuditEntries`.

## Quyết định

### Quên mật khẩu

Ba endpoint đều `[AllowAnonymous]`, lỗi dùng `ApiResponse`.

| Method + route | Body | Thành công | Lỗi |
| --- | --- | --- | --- |
| `POST /api/auth/forgot-password` | `{ email }` | 200 `data = true`, message trung tính | 400 `errors[]` khi email trống/sai định dạng |
| `POST /api/auth/reset-password/check` | `{ token }` | 200 `{ status, expiresAt }` | — |
| `POST /api/auth/reset-password` | `{ token, newPassword }` | 200 `{ status: "completed" }` | 400 `data = { status }` khi liên kết hỏng; 400 `errors[]` khi mật khẩu sai quy tắc |

- `status` thuộc `valid | expired | used | invalid`. `invalid` gồm token không tồn tại và token của tài khoản đã thay đổi sau khi phát (xem dưới).
- **Phản hồi trung tính:** mọi email đúng định dạng nhận cùng mã 200, cùng body và câu "Nếu email thuộc hệ thống, bạn sẽ nhận liên kết đặt lại mật khẩu.", gồm cả email không có tài khoản, tài khoản vô hiệu hóa, tài khoản chưa kích hoạt và yêu cầu bị giới hạn.
- **Giới hạn (PDR-044):** cùng email cách nhau ≥ 60 giây và tối đa 5 yêu cầu trong cửa sổ 1 giờ; cùng nguồn tối đa 20 yêu cầu/giờ. Chỉ yêu cầu được chấp nhận mới được đếm. Bảng `PasswordResetRequests` lưu SHA-256 của email chuẩn hóa (không lưu email thật), nguồn và thời điểm; bản ghi ngoài cửa sổ tự được xóa. Kiểm tra và ghi chạy dưới một khóa advisory PostgreSQL nên các yêu cầu đồng thời không vượt ngưỡng.
- **Liên kết:** `{FrontendOrigin}/quen-mat-khau#token=…`, token ngẫu nhiên 256 bit, DB chỉ lưu SHA-256 (`PasswordResetTokens`). Hiệu lực 30 phút, dùng một lần; đặt lại thành công thì mọi liên kết còn lại của tài khoản cũng thành `used`. Hai request dùng cùng liên kết đồng thời chỉ một thành công (cập nhật có điều kiện).
- **Kiểm tra lại khi dùng (PDR-045):** tài khoản phải còn hoạt động, đã kích hoạt và có `SecurityStamp` trùng lúc phát. Vì vậy liên kết hết hiệu lực khi tài khoản bị vô hiệu hóa, bị Giáo vụ đặt lại mật khẩu hoặc chủ tài khoản đổi mật khẩu bằng cách khác.
- **Sau khi đặt lại:** băm mật khẩu mới (quy tắc PDR-002, khác mã người dùng), xoay `SecurityStamp` nên mọi phiên cũ bị đăng xuất, không tự đăng nhập. Ghi lịch sử `PasswordResetByLink` với người thực hiện là chính chủ, không có chi tiết.
- **Lựa chọn triển khai:**
  - Token nằm sau `#` để không gửi lên máy chủ, không vào log truy cập hay `Referer`; trang đọc xong thì xóa khỏi thanh địa chỉ và đặt `referrer: no-referrer`.
  - Thư được gửi không chờ (fire-and-forget) để thời gian phản hồi không tiết lộ email có tài khoản. Lỗi SMTP chỉ ghi log, không ghi token.
  - **Nguồn** là IP kết nối tới API. API chỉ đọc `X-Forwarded-For` từ proxy khai trong `ForwardedHeaders__TrustedProxies` (danh sách IP hoặc CIDR, cách nhau dấu phẩy); mặc định để trống, không tin proxy nào. Next.js dev server giữ nguyên `X-Forwarded-For` do trình duyệt gửi nên **không** được khai là proxy tin cậy. Hệ quả khi chạy local hoặc Compose: mọi người dùng đi qua cùng proxy Next.js nên dùng chung giới hạn 20 yêu cầu/giờ. Khi triển khai thật cần một reverse proxy ghi đè `X-Forwarded-For`, rồi khai IP của nó ở biến trên.

### Lịch sử tài khoản

| Method + route | Thành công | Lỗi |
| --- | --- | --- |
| `GET /api/users/{id}/audit` | 200 `UserAuditEntryDto[]`, mới nhất trước | 401, 403 (chỉ `AcademicAffairs`) |

- `UserAuditEntryDto`: `{ id, action, actorUserId, actorName, details, createdAt }`. `actorName` là `null` khi người thực hiện đã bị xóa; `details` là JSON đã lưu, ví dụ `{ "fullName": { "from", "to" } }`. Không có mật khẩu hay token.
- Nhập CSV ghi một mục `Created` cho mỗi tài khoản được tạo, `details = { role, source: "csv" }`, người thực hiện là Giáo vụ nhập tệp, cùng transaction với việc tạo tài khoản. Xem trước không ghi lịch sử.
- **Lựa chọn triển khai (DESIGN chưa có artboard):** lịch sử nằm trong ngăn Sửa người dùng, ở mục "Lịch sử thao tác" thu gọn sẵn, chỉ tải khi mở. Mỗi mục hiện tên thao tác, người thực hiện, thời điểm và từng trường đổi.

## Hệ quả

- Migration `AddPasswordReset` chỉ thêm hai bảng `PasswordResetTokens` (khóa ngoại tới `Users`, xóa tài khoản thì xóa token) và `PasswordResetRequests`. Phải áp dụng trước khi chạy bản này; không tự chạy trên Neon/dữ liệu dùng chung.
- Token và yêu cầu quên mật khẩu không tính là "dữ liệu" chặn xóa tài khoản.
- Chưa có màn xem lịch sử của tài khoản đã bị xóa (API vẫn trả theo id).
