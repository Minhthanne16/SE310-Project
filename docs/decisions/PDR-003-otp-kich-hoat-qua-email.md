# PDR-003: OTP kích hoạt tài khoản qua email ở lần đăng nhập đầu

## Trạng thái

Đã chấp nhận

## Ngày

2026-10-24

## Bối cảnh

Thẻ công việc backend yêu cầu "mã hóa mật khẩu BCrypt/Argon2 và tích hợp gửi OTP kích hoạt qua email". Thiết kế hiện hành quy định mật khẩu ban đầu là mã người dùng và phải đổi ở lần đăng nhập đầu, nhưng chưa có bước xác minh người dùng sở hữu email. Nhóm đã chọn cách bổ sung OTP vào bước đổi mật khẩu lần đầu, thay vì thay thế mật khẩu ban đầu hay đổi luồng Quên mật khẩu.

## Quyết định

1. **Băm mật khẩu:** dùng BCrypt (work factor 12), đã có từ PDR-002. Không thêm Argon2.
2. **Vị trí OTP:** sau khi đăng nhập bằng mật khẩu ban đầu, màn "Đổi mật khẩu để tiếp tục" tự gửi OTP tới email của tài khoản. Người dùng phải nhập đúng OTP cùng mật khẩu mới thì tài khoản mới được kích hoạt (`MustChangePassword = false`).
3. **Thông số:** OTP gồm 6 chữ số, sinh bằng bộ sinh số ngẫu nhiên mật mã. Mã có hiệu lực 10 phút và chỉ dùng một lần; nhập sai 5 lần thì mã bị hủy; mỗi lần gửi lại phải cách nhau ít nhất 60 giây. Chỉ lưu bản băm BCrypt của mã, không ghi mã ra log.
4. **Gửi lỗi:** nếu SMTP lỗi, mã vừa tạo bị hủy và API trả 503, người dùng có thể gửi lại ngay.
5. **Môi trường gửi mail:** khi dev bằng Compose, mail mặc định đi vào Mailpit local (`http://localhost:8025`), không gửi ra Internet. Muốn gửi thật thì đặt `SMTP_*` trong `.env` theo Gmail App Password (`smtp.gmail.com:587`, STARTTLS). Không commit App Password.
6. **Ngoài phạm vi:** luồng Quên mật khẩu vẫn dùng liên kết 30 phút theo thiết kế, chưa hiện thực.

## Hợp đồng API

| Method + route | Quyền | Thành công | Lỗi |
| --- | --- | --- | --- |
| `POST /api/auth/activation-code` | Token chờ đổi mật khẩu | 200 `ApiResponse<{ expiresAt, resendAvailableAt }>` | 400 tài khoản không cần kích hoạt, 429 gửi lại quá sớm, 503 không gửi được email |
| `POST /api/auth/change-initial-password` `{ currentPassword, newPassword, activationCode }` | Token chờ đổi mật khẩu | 200 như PDR-002 | 400 khi mã sai, hết hạn hoặc chưa gửi, hoặc vi phạm quy tắc mật khẩu |

`activationCode` phải đúng 6 chữ số. Sai mật khẩu hiện tại không bị tính vào số lần nhập sai mã.

## Hệ quả

- Tài khoản phải có email nhận được thư thì mới kích hoạt được. Khi người dùng không dùng được email, Giáo vụ xử lý qua chức năng Người dùng (theo thiết kế màn Quên mật khẩu).
- Gmail cá nhân giới hạn khoảng 500 người nhận/ngày. Tạo tài khoản hàng loạt (nhập CSV) cần tính tới giới hạn này hoặc dùng dịch vụ SMTP khác.
- Ngoại lệ chỉ cho môi trường development: tài khoản Giáo vụ seed `GVU0001` được tạo trực tiếp ở trạng thái đã kích hoạt (`MustChangePassword = false`), không gửi/không cần OTP. Ngoại lệ này không áp dụng cho tài khoản nhập CSV, Neon hoặc dữ liệu thật.
