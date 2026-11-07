# PDR-055: Giảng viên, giáo vụ dùng mật khẩu Giáo vụ đặt, bỏ OTP; nhập người dùng bằng Excel

## Trạng thái

Đã chấp nhận theo yêu cầu trực tiếp của người dùng ngày 2026-11-07. Thay một phần [PDR-003](PDR-003-otp-kich-hoat-qua-email.md) (OTP chỉ còn cho sinh viên) và [PDR-004](PDR-004-nhap-tai-khoan-csv.md) (thêm cột mật khẩu, nhận tệp Excel).

## Bối cảnh

Người dùng yêu cầu bỏ bước xác nhận lần đầu bằng mã gửi qua email cho Giáo vụ và Giảng viên. Khi tạo tài khoản, thủ công hoặc nhập hàng loạt, Giáo vụ đặt luôn mật khẩu cho hai vai trò này. Nhập hàng loạt có thêm lựa chọn Excel bên cạnh CSV; không cần tệp mẫu riêng.

## Quyết định

1. **Sinh viên giữ nguyên PDR-003/004.** Mật khẩu ban đầu là MSSV; lần đăng nhập đầu phải đổi mật khẩu kèm mã OTP gửi qua email.
2. **Giảng viên và Giáo vụ:**
   - Giáo vụ bắt buộc đặt mật khẩu khi tạo tài khoản: trường `password` của `POST /api/users` và cột `password` khi nhập.
   - Mật khẩu theo quy tắc PDR-002: 8–64 ký tự, có cả chữ và số, khác mã người dùng (không phân biệt hoa thường).
   - Tài khoản tạo ra đã kích hoạt (`MustChangePassword = false`), đăng nhập ngay, không cần OTP và không bị bắt đổi mật khẩu.
   - Người dùng tự đổi mật khẩu ở Hồ sơ.
   - Mật khẩu được băm BCrypt cost 12 như mật khẩu tự đặt.
3. **Gửi mật khẩu cho sinh viên** (trường hoặc cột `password` có giá trị) bị từ chối với lỗi rõ ràng, thay vì bỏ qua âm thầm.
4. **GV/Giáo vụ đang ở trạng thái phải đổi mật khẩu** (tài khoản cũ, hoặc bị Giáo vụ đặt lại mật khẩu): vẫn đổi mật khẩu lần đầu nhưng không cần mã.
   - `POST /api/auth/activation-code` trả 400 "Tài khoản không cần kích hoạt bằng mã xác thực".
   - `change-initial-password` nhận `activationCode` rỗng.
   - Sinh viên gửi mã rỗng vẫn bị từ chối.
5. **Nhập bằng Excel:**
   - Hộp thoại nhập cho chọn định dạng Excel (.xlsx) hoặc CSV (.csv).
   - Tệp Excel được đọc ở trình duyệt: trang tính đầu tiên, dòng đầu là tên cột (cùng các cột như CSV), giữ dòng trống để số dòng báo lỗi khớp số dòng trong Excel. Ô ngày ghi `yyyy-MM-dd`, ô số giữ nguyên chữ số, ô công thức lấy kết quả.
   - Tệp sau khi đổi sang CSV UTF-8 được gửi qua đúng `POST /api/users/import/preview` và `/api/users/import`, nên quy tắc, giới hạn 2 MB và 2000 dòng, và báo cáo giống hệt CSV.
6. **Bảo mật mật khẩu trong tệp:**
   - Báo cáo xem trước/nhập và bản tải báo cáo lỗi không bao giờ chứa mật khẩu.
   - Lịch sử thao tác không ghi mật khẩu.
   - Hướng dẫn cột nhắc Giáo vụ xóa tệp sau khi nhập.
   - Khi đổi Excel sang CSV, giá trị được giữ nguyên, không thêm dấu `'` chống công thức (để mật khẩu như `-abc12345` không bị sửa). Tệp CSV này chỉ dùng để gửi lên máy chủ, không mở bằng Excel.

## Hệ quả

- Ba tài khoản seed local không đổi: đã kích hoạt sẵn theo PDR-002/003.
- **Không có migration.** Tài khoản GV/Giáo vụ đang chờ kích hoạt không bị tự đổi trạng thái; lần đăng nhập sau họ đổi mật khẩu mà không cần mã.
- **Rủi ro chấp nhận:** Giáo vụ biết mật khẩu ban đầu của GV/Giáo vụ và phải chuyển cho họ qua kênh an toàn; hệ thống không bắt đổi mật khẩu. Nếu cần bắt đổi, Giáo vụ dùng "Đặt lại mật khẩu" (người dùng sẽ phải đổi ở lần đăng nhập kế tiếp, không cần mã).
