# PDR-004: Giáo vụ tạo tài khoản hàng loạt từ tệp CSV

## Trạng thái

Đã chấp nhận

## Ngày

2026-10-24

## Bối cảnh

Thẻ công việc backend yêu cầu "tạo email hàng loạt cho sinh viên dựa trên CSV; Giáo vụ tạo, sau đó sinh viên đăng nhập và đổi mật khẩu". Thiết kế màn Quản lý người dùng (`GiaoVu-NguoiDung`) đã mô tả bước nhập CSV hai bước, danh sách cột và các lỗi cần báo. Các điểm thẻ công việc và thiết kế chưa nói rõ đã được nhóm chốt như dưới đây.

## Quyết định

1. **"Tạo email" nghĩa là tạo tài khoản đăng nhập bằng email lấy từ cột `email` trong CSV.** Hệ thống không tự sinh địa chỉ email.
2. **Không gửi email khi tạo tài khoản.** Người dùng đăng nhập bằng email cùng mật khẩu ban đầu là mã người dùng, rồi kích hoạt bằng OTP (PDR-003).
3. **Vai trò:** cột `role` nhận cả ba vai trò. Giá trị được chấp nhận (không phân biệt hoa thường): `Student`/`Sinh viên`/`sv`, `Lecturer`/`Giảng viên`/`gv`, `AcademicAffairs`/`Giáo vụ`/`giaovu`.
4. **Cột:** `user_code, full_name, email, role, date_of_birth, class_name, department, academic_title` (theo thiết kế); thứ tự cột tùy ý.
   - Bắt buộc với mọi dòng: `user_code`, `full_name`, `email`, `role`.
   - `class_name` bắt buộc với Sinh viên; `department` bắt buộc với Giảng viên.
   - `date_of_birth` không bắt buộc, nhận dạng `yyyy-MM-dd` hoặc `dd/MM/yyyy`.
5. **Hai bước:** xem trước chỉ kiểm tra, không ghi DB. Bước nhập gửi lại tệp, kiểm tra lại toàn bộ rồi tạo **mọi dòng hợp lệ trong một transaction**; dòng lỗi bị bỏ qua và được trả về trong báo cáo.
6. **Lỗi theo dòng:** thiếu trường bắt buộc, sai định dạng email/ngày/mã người dùng, vai trò không hợp lệ, trùng mã/email với dòng khác trong tệp, mã/email đã tồn tại.
7. **Tài khoản tạo ra:** `MustChangePassword = true`, `IsActive = true`, mật khẩu ban đầu là `user_code`.
8. **Giới hạn kỹ thuật** (không phải chỉ tiêu phi chức năng; OQ-007 vẫn mở): tệp `.csv` mã hóa UTF-8, tối đa 2 MB và 2000 dòng dữ liệu. Mã người dùng chỉ gồm chữ, số, `.`, `-`, `_`, tối đa 50 ký tự.
9. **Băm mật khẩu ban đầu:** BCrypt work factor 10 (mật khẩu tự đặt dùng 12). Mật khẩu ban đầu chính là mã người dùng, không bí mật, nên bảo vệ thật nằm ở OTP và bước bắt buộc đổi. Đo được 2000 tài khoản mất khoảng 15 giây trên máy 12 nhân.

## Hợp đồng API

Cả hai endpoint chỉ dành cho vai trò `AcademicAffairs`. Request gửi dạng `multipart/form-data` với trường `file`.

| Method + route | Thành công | Lỗi |
| --- | --- | --- |
| `POST /api/users/import/preview` | 200 `ApiResponse<UserImportReportDto>`, `importedRows = 0` | 400 lỗi cấp tệp, 401, 403 |
| `POST /api/users/import` | 200 `ApiResponse<UserImportReportDto>` | 400 lỗi cấp tệp, 401, 403, 409 khi mã/email vừa bị thao tác khác tạo trùng (không dòng nào được lưu; xem trước lại) |

`UserImportReportDto` gồm `{ totalRows, validRows, errorRows, importedRows, rows[] }`. Mỗi phần tử của `rows` gồm `{ rowNumber, userCode, fullName, email, role, dateOfBirth, className, department, academicTitle, errors[] }`; `rowNumber` tính cả dòng tiêu đề (dòng dữ liệu đầu tiên là 2). Lỗi cấp tệp gồm: không phải `.csv`, không phải UTF-8, rỗng, sai định dạng, thiếu cột bắt buộc, không có dòng dữ liệu, vượt giới hạn.

## Hệ quả

- Màn Quản lý người dùng ở frontend (`/giao-vu/nguoi-dung`) dùng đúng hợp đồng trên cho hai bước nhập CSV, và dùng API thật cho các thao tác còn lại (bảng dưới, triển khai 2026-10-31). Báo cáo lỗi xuất ra CSV phải chặn CSV formula injection (giá trị bắt đầu bằng `=`, `+`, `-`, `@`).

## Hợp đồng API quản lý tài khoản

Mọi endpoint chỉ dành cho vai trò `AcademicAffairs` (401 khi chưa đăng nhập, 403 với vai trò khác, cùng dạng `ApiResponse`). `UserDto` gồm `{ id, userCode, fullName, email, role, dateOfBirth, className, department, academicTitle, isActive, mustChangePassword, hasData }`, `dateOfBirth` dạng `yyyy-MM-dd` hoặc `null`.

| Method + route | Body | Thành công | Lỗi |
| --- | --- | --- | --- |
| `GET /api/users` | — | 200 `UserDto[]` (theo mã); lọc, tìm, phân trang ở client | 401, 403 |
| `POST /api/users` | `{ userCode, fullName, email, role, dateOfBirth, className, department, academicTitle }` | 201 `UserDto` | 400 lỗi trường (`errors[]`), 409 trùng |
| `PUT /api/users/{id}` | `{ fullName, email, dateOfBirth, className, department, academicTitle }` | 200 `UserDto` | 400, 404, 409 trùng email |
| `PATCH /api/users/{id}/status` | `{ isActive }` | 200 `UserDto` | 400 tự vô hiệu hóa chính mình, 404 |
| `DELETE /api/users/{id}` | — | 200 `{ result: "deleted" \| "disabled" }` | 400 tự xóa chính mình, 404 |
| `POST /api/users/{id}/reset-password` | `{ newPassword }` (`null` = về mã người dùng) | 200 `UserDto` | 400 mật khẩu không đạt quy tắc hoặc trùng mã, 404 |

- Kiểm tra trường giống nhập CSV: mã ≤ 50 ký tự gồm chữ, số, `.`, `-`, `_`; họ tên ≤ 200; email hợp lệ, lưu chữ thường; lớp bắt buộc với Sinh viên, bộ môn bắt buộc với Giảng viên; lớp/bộ môn/học hàm ≤ 100. Trường không thuộc vai trò bị bỏ khi lưu. `role` chỉ nhận `Student`, `Lecturer`, `AcademicAffairs`.
- Tạo thủ công giống dòng CSV hợp lệ: mật khẩu ban đầu là mã, `MustChangePassword = true`, không gửi email.
- **Mã và vai trò không đổi:** `PUT` không có hai trường này; giá trị gửi thừa bị bỏ qua.
- **409** có `data = { field: "userCode" | "email" }` để form báo đúng ô. Mã so khớp phân biệt hoa thường; email không phân biệt (đã chuẩn hóa chữ thường).
- **Xóa:** tài khoản có bản ghi nghiệp vụ tham chiếu (`hasData`) chỉ bị vô hiệu hóa, kết quả `disabled`; không có thì xóa hẳn, kết quả `deleted`. Hiện chưa có bảng nghiệp vụ nào tham chiếu tới tài khoản nên `hasData` luôn `false`; khi thêm bảng đề tài, phân công, phiếu điểm, thông báo… phải bổ sung kiểm tra trong `UserRepository.GetUserIdsWithRelatedDataAsync`.
- **Thu hồi phiên:** vô hiệu hóa và đặt lại mật khẩu đổi `SecurityStamp`, nên token đã cấp hết hiệu lực ngay và không dùng lại được sau khi kích hoạt lại. Kích hoạt lại giữ mật khẩu hiện có.
- **Đặt lại mật khẩu** (về mã hoặc mật khẩu mới theo quy tắc PDR-002, khác mã người dùng) luôn đặt `MustChangePassword = true` và xóa OTP đang chờ; lần đăng nhập kế tiếp người dùng phải kích hoạt lại bằng OTP (PDR-003).
- **Lịch sử:** mọi thao tác tạo, sửa (giá trị trước/sau từng trường, theo PDR-036), vô hiệu hóa, kích hoạt lại, đặt lại mật khẩu (chỉ ghi cách đặt, không ghi mật khẩu) và xóa được lưu trong bảng `UserAuditEntries` cùng transaction với thay đổi, kèm người thực hiện và thời điểm. Bảng không có khóa ngoại tới `Users` để lịch sử còn sau khi xóa; lịch sử quản trị này **không** tính là "dữ liệu" chặn xóa tài khoản. Chưa có màn hình xem lịch sử này.
- Upload dùng cookie xác thực; `SameSite=Lax` chặn form POST chéo site gửi kèm cookie.
- Nếu máy chủ ít nhân và tệp lớn, request nhập có thể chạm timeout của proxy. Khi đó cần chia tệp hoặc chuyển sang xử lý nền.
