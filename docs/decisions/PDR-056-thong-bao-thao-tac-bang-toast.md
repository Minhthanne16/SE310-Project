# PDR-056: Kết quả thao tác hiện bằng toast, ghi chú cần ở lại dùng banner

## Trạng thái

Đã chấp nhận theo yêu cầu trực tiếp của người dùng ngày 2026-11-09. Đóng [OQ-021](../OPEN_QUESTIONS.md).

## Bối cảnh

[DESIGN/02](../DESIGN/02-thiet-ke-dung-chung.md) mô tả "thông báo thao tác (toast)", còn [DESIGN/03](../DESIGN/03-dac-ta-man-hinh.md) ghi Hồ sơ và Quản lý người dùng dùng dải trong trang, "không còn toast". Mã nguồn trộn cả hai kiểu giữa các màn.

## Quyết định

1. **Toast** (`react-hot-toast`, gắn một lần ở `AppToaster` trong `AppShell`) cho **kết quả sau thao tác thêm, sửa, xóa, gửi, công bố, đổi mật khẩu, tải tệp**: thành công và lỗi của cả thao tác (máy chủ từ chối, mất kết nối).
   - Thành công: dải xanh, tự tắt sau 5 giây. Lỗi: dải đỏ, tự tắt sau 8 giây.
   - Toast có `role="status"`. Toast cần hành động đi kèm (ví dụ "Tải báo cáo dòng lỗi (.csv)" sau nhập người dùng) dùng nút lớp `app-toast-action` và ở lại 15 giây.
2. **Banner trong trang** (`role="note"`) chỉ cho **ghi chú cần ở lại** khi người dùng làm việc: giai đoạn của đợt, cảnh báo mức đề tài, giải thích vì sao một nút bị khóa, lỗi tải trang khiến không có dữ liệu để hiện.
3. **Lỗi theo ô và lỗi chặn trong form, hộp thoại, ngăn kéo** vẫn hiện tại chỗ (`role="alert"`, `aria-invalid`, `aria-describedby`) vì người dùng phải sửa ngay; không chuyển thành toast. Sau khi form lưu được thì kết quả mới hiện bằng toast.
4. Màn mới không tự tạo kiểu báo thứ ba (dải màu tự dựng, `alert()`).

## Hệ quả

- Đã chuyển sang toast: lưu hồ sơ, đổi mật khẩu (Hồ sơ); thêm, sửa, xóa, vô hiệu hóa, kích hoạt lại, đặt lại mật khẩu, nhập tệp (Người dùng); gửi, sửa, xóa đề tài (Đề tài của tôi); ghi danh, hủy ghi danh (Chi tiết đề tài, sinh viên); tải Excel, xác nhận, công bố, gửi nhắc lệch điểm (tab Đề tài của đợt).
- Test của từng trang tìm nội dung toast trên toàn trang (`screen`), không trong phạm vi từng panel; `vitest.setup.ts` gắn sẵn `AppToaster`.
- Trang công khai (đăng nhập, quên mật khẩu) chưa có `AppToaster` vì không dùng thông báo kết quả thao tác kiểu này; nếu cần, gắn `AppToaster` vào trang đó.
