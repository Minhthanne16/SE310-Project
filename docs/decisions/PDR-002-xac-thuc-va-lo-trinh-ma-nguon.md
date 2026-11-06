# PDR-002: Xác thực tài khoản, phân quyền theo vai trò và lộ trình mã nguồn

## Trạng thái

Đã chấp nhận

## Ngày

2026-10-24

## Bối cảnh

Nhiệm vụ backend yêu cầu "API đăng nhập cục bộ (JWT/Session) và middleware phân quyền theo 3 vai trò User, Admin, Operator". Tên vai trò này khác PDR-001 (Sinh viên, Giảng viên, Giáo vụ), và OQ-008 (thay dần mã Products hay xây mô-đun mới) vẫn đang mở. Nhóm đã chốt các điểm dưới đây trước khi code.

## Quyết định

1. **Vai trò:** giữ đúng PDR-001. Ba vai trò tài khoản là `Student` (Sinh viên), `Lecturer` (Giảng viên), `AcademicAffairs` (Giáo vụ). Tên User/Admin/Operator trong thẻ công việc chỉ là cách gọi chung, **không** tạo vai trò Admin.
2. **Lộ trình mã (đóng OQ-008):** QLKLTN được xây thành mô-đun mới đặt cạnh mã mẫu Products. Products giữ nguyên cho tới khi có quyết định gỡ bỏ. Migration mới chỉ được thêm bảng, không sửa `InitialCreate`.
3. **Phiên đăng nhập:** đăng nhập bằng email + mật khẩu. Backend cấp JWT (HS256) và đặt vào cookie `qlkltn_access` với `HttpOnly`, `SameSite=Lax`, `Path=/`, cùng `Secure` ở mọi môi trường trừ Development qua http. Frontend không đọc hay lưu token. Thời gian sống mặc định là 60 phút (`Authentication:Jwt:AccessTokenMinutes`); đây là cấu hình kỹ thuật, không phải chỉ tiêu phi chức năng (OQ-007 vẫn mở). Chưa có refresh token.
4. **Khóa ký bắt buộc:** API không khởi động khi thiếu `Authentication:Jwt:SigningKey` (tối thiểu 32 byte), Issuer hoặc Audience.
5. **Đổi mật khẩu lần đầu:** tài khoản mới có `MustChangePassword = true`, mật khẩu ban đầu là mã người dùng. Token của tài khoản này không mang claim vai trò, nên chỉ gọi được `GET /api/auth/me` và `POST /api/auth/change-initial-password`. Mật khẩu mới phải có tối thiểu 8 ký tự, gồm cả chữ và số, và khác mật khẩu hiện tại lẫn mã người dùng (giống `passwordRules` ở frontend).
6. **Thu hồi phiên:** mỗi tài khoản có `SecurityStamp` được ghi vào token. Mỗi request đều đối chiếu với database: tài khoản bị vô hiệu hóa hoặc đã đổi mật khẩu thì token cũ hết hiệu lực ngay. Đăng xuất chỉ xóa cookie trên trình duyệt hiện tại.
7. **Lỗi đăng nhập:** sai email, sai mật khẩu hoặc tài khoản bị vô hiệu hóa đều trả cùng một thông báo (theo thiết kế màn Đăng nhập), HTTP 401.

## Hợp đồng API

| Method + route | Quyền | Thành công | Lỗi |
| --- | --- | --- | --- |
| `POST /api/auth/login` `{ email, password }` | Ẩn danh | 200 `ApiResponse<CurrentUserDto>` + Set-Cookie | 400 thiếu trường, 401 sai thông tin |
| `POST /api/auth/change-initial-password` `{ currentPassword, newPassword }` | Đã đăng nhập (kể cả token chờ đổi mật khẩu) | 200 `ApiResponse<CurrentUserDto>` + cookie mới | 400 vi phạm quy tắc/sai mật khẩu hiện tại, 401 |
| `GET /api/auth/me` | Đã đăng nhập (kể cả token chờ đổi mật khẩu) | 200 `ApiResponse<CurrentUserDto>` | 401 |
| `POST /api/auth/logout` | Ẩn danh | 200 `ApiResponse<bool>`, cookie hết hạn | — |

`CurrentUserDto` gồm `{ id, userCode, fullName, email, role, mustChangePassword, avatarUrl }`, với `role` thuộc `Student | Lecturer | AcademicAffairs`. Phản hồi 401/403 của toàn API dùng `ApiResponse` với `success=false`. Đổi mật khẩu thông thường `POST /api/auth/change-password` xem [PDR-051](PDR-051-ho-so-anh-dai-dien-va-chuong-thong-bao.md).

## Cách phân quyền endpoint mới

- `[Authorize(Roles = AppRoles.AcademicAffairs)]` (hoặc nhiều vai trò cách nhau bằng dấu phẩy) cho thao tác theo vai trò tài khoản.
- `[Authorize]` (không tham số) cho thao tác chỉ yêu cầu đã đăng nhập và đã đổi mật khẩu ban đầu.
- Quyền theo đề tài/hội đồng (hướng dẫn, phản biện, chủ tịch, thư ký) **không** nằm trong token. Phải kiểm tra trong handler bằng dữ liệu phân công, theo PDR-001.

## Hệ quả

- Tạo tài khoản (nhập CSV, gửi email kích hoạt) là tác vụ riêng và phải tuân theo vai trò, mật khẩu ban đầu và `MustChangePassword` ở trên.
- Products vẫn ẩn danh. Endpoint QLKLTN mới phải tự khai báo `[Authorize]`, vì chưa đặt fallback policy toàn cục để giữ nguyên mã mẫu.
- `SeedDevelopmentUsers=true` tạo ba tài khoản mẫu, chỉ dùng cho database local. Cả ba tài khoản seed được đánh dấu đã kích hoạt (`MustChangePassword = false`) để thử giao diện mà không phụ thuộc email/OTP; ngoại lệ này không áp dụng cho tài khoản nhập CSV, Neon hoặc dữ liệu thật. Không bật seed trên Neon hoặc dữ liệu thật.
