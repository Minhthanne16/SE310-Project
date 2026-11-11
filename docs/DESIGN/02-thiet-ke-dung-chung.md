# 02 · Thiết kế dùng chung

Các giá trị lấy trực tiếp từ mã canvas (đếm tần suất sử dụng). Mã canvas dùng style nội tuyến; trong repo các giá trị này là biến CSS ở `:root` của `app/frontend/src/index.css` (đã thay bộ token ngày 2026-11-09, xem mục "Điểm cần thống nhất").

## Token: phông, màu, bo góc, kích thước

Bảng token hiện hành nằm ở [../DESIGN.md](../DESIGN.md) (nguồn chuẩn là `:root` trong `app/frontend/src/index.css`). Tệp này không chép lại để hai nơi không lệch nhau; chỉ ghi những gì canvas có mà `DESIGN.md` chưa có.

- **Phông:** Be Vietnam Pro 400/500/600/700/800 cho toàn bộ giao diện (`next/font/google`, subset `vietnamese`); JetBrains Mono 400/500 chỉ cho nhãn phụ (mã, route, tên tệp, số hiệu).
- **Màu vai trò** (chấm nhận diện trên sơ đồ): Sinh viên `#5B8DEF`, Giảng viên `#9B7BE8`, Giáo vụ `#4FB286`. Avatar chữ viết tắt: Sinh viên cặp `info`, Giảng viên cặp `doing`, Giáo vụ cặp `ok`.
- **Màu nhấn đổi được** trong canvas: `--accent` `#D4F26A`, hoặc `#A7E3A0`, `#FFD66B`, `#9CC4FF`.
- **Chỉ có ở canvas, chưa là token:** bo góc 8px (mục menu, nút nhỏ) và 16px (khối ngoài); cỡ chữ 38px (tiêu đề sơ đồ, không dùng trong ứng dụng).
- **Biến thể màu lệch trong canvas** (nền cảnh báo `#FDF1D8` hoặc `#FEF4E2`, chữ `#6B3A06` hoặc `#8A4B08`, nền nguy hiểm `#FDECEA` hoặc `#FBE9E7`...) đã gộp về một giá trị cho mỗi ý nghĩa trong `:root`; xem mục "Điểm cần thống nhất".
- Chiều cao tối thiểu chạm: **40px** nút và ô nhập, **44px** mục menu và hàng bấm được, thanh trên 64px. Thẻ viền 1px, không bóng; chỉ menu nổi, popup, ngăn kéo có bóng. Nội dung trang `max-width: 1240px`, căn trái; khoảng cách theo bội 2, lề trang `32px 40px 56px`, giữa các khối 20px, giữa mục menu 2px.

## Khung trang (App shell)

```text
┌───────────┬────────────────────────────────────────────┐
│ sidebar   │ thanh trên (64px): ô lọc Đợt hoặc tiêu đề  │
│ 232px     │                         chuông + avatar    │
│ cố định   ├────────────────────────────────────────────┤
│ (sticky,  │ nội dung: padding 32/40/56, max-width 1240 │
│ 100vh)    │ h1 30px + mô tả 15px + chip trạng thái     │
│           │ khối nội dung ...                          │
│ thẻ tài   │                                            │
│ khoản ở   │                                            │
│ đáy       │                                            │
└───────────┴────────────────────────────────────────────┘
```

- **Cuộn:** chỉ phần nội dung cuộn; sidebar đứng yên (`position: sticky; top: 0; align-self: flex-start; height: 100vh; overflow-y: auto`). Thanh trên cuộn theo nội dung.
- **Sidebar:** logo "Q" nền `--accent` 36px + chữ QLKLTN; nhóm menu có nhãn chữ hoa 11px; mục cao 44px, biểu tượng 18px (nét 1.8, bo tròn) + chữ 15px; mục đang chọn nền `--surface-3` chữ đậm 600 và `aria-current="page"`; số đếm (ví dụ Đề xuất từ SV) là chip tròn nền `--accent`. Bốn màn cho thu gọn sidebar về chỉ còn biểu tượng (SV-DangKy, SV-DangKy-ChuaMo, GiaoVu-DeTai, GiaoVu-DotKhoaLuan), thẻ tài khoản thu gọn theo.
- **Thẻ tài khoản** ở đáy: avatar 34px + họ tên + vai trò; bấm mở menu nổi **Xem hồ sơ / Đăng xuất** (`role="menu"`).
- **Menu theo vai trò:**
  - Sinh viên: Trang chủ, Đăng ký đề tài, Đơn đăng ký của tôi, Đề tài của tôi.
  - Giảng viên: nhóm Đề tài (Trang chủ, Đề tài của tôi, Đề xuất từ SV có số đếm, Lịch sử đề tài), nhóm Đánh giá (Hướng dẫn, Phản biện, Hội đồng, Gửi thông báo).
  - Giáo vụ: nhóm Quản lý (Trang chủ, Đợt khóa luận, Phiếu đánh giá, Người dùng, Đề tài), nhóm Đánh giá (Giảng viên phản biện, Hội đồng bảo vệ, Kết quả, Thống kê, Gửi thông báo).

## Thành phần lặp lại

| Thành phần | Mô tả ngắn | Xuất hiện ở |
| --- | --- | --- |
| Chip trạng thái | bo tròn, 12.5px đậm 600, padding 4×10, cặp màu theo bảng trên | mọi bảng và thẻ |
| Nút chính / phụ / nguy hiểm | chính nền `--ink` chữ trắng; phụ nền trắng viền `--line-input`; nguy hiểm chữ `--danger-ink` viền `--danger-line`; cao ≥ 40px, bo 9px | khắp nơi |
| Dải lọc (segmented tabs) | nhóm nút trong khung `--surface-2` bo 12px, mục chọn nền trắng viền `--line`, `aria-pressed` | Hướng dẫn, Phản biện, Đề xuất... |
| Bảng dạng lưới | `grid-template-columns` tùy bảng, tiêu đề 13px xám, hàng cách nhau viền trên 1px, cuộn ngang khi hẹp (min-width ~960px) | danh sách đợt, đề tài, nhóm, người dùng |
| Thẻ đợt (Trang chủ) | chip chương trình + chip trạng thái, tên đợt, tuần hiện tại, mốc đang diễn ra + thanh tiến độ, vai trò, việc cần xử lý | Trang chủ |
| Gantt tuần | cột tuần T1..Tn, cột tuần hiện tại tô `--accent`, 9 mốc, nút thao tác theo vai trò (SV, GV chỉ mục đang diễn ra; giáo vụ mọi mục) | Trang chủ, chi tiết đợt |
| Bảng thông báo | danh sách kiểu forum: tiêu đề, nguồn (chip Giáo vụ / Bạn), thời gian, trích nội dung; lọc theo nguồn, tìm kiếm; không có trả lời, không có "đã xem" | Trang chủ |
| Chuông thông báo | menu nổi, thông báo tự động và thông báo được gửi, Đánh dấu đã đọc, lọc Chưa đọc | thanh trên |
| Popup xác nhận | `role="dialog"` + `aria-modal`, nền mờ, hộp trắng bo 12px, nút an toàn (Giữ / Hủy bỏ) bên trái, nút nguy hiểm bên phải; nhãn nút nói rõ hành động ("Hủy ghi danh", "Giữ ghi danh") | xóa, hủy, công bố |
| Ngăn kéo (drawer) | trượt từ phải, dùng cho form thêm/sửa người dùng, tạo hội đồng | Người dùng, Hội đồng |
| Trạng thái trống | khung viền đứt `--line-input`, tiêu đề đậm 17px + một câu giải thích + (nếu có) nút/đường dẫn đi tiếp | mọi danh sách |
| Thông báo thao tác (toast) | `react-hot-toast` góc trên phải, dải màu theo ý nghĩa (xanh thành công, đỏ lỗi cả thao tác), `role="status"`, tự tắt sau 5 giây (lỗi 8 giây) | sau khi thêm, sửa, xóa, gửi, công bố, đổi mật khẩu, tải tệp |
| Banner trong trang | dải màu nhạt, `role="note"`, không tự tắt | ghi chú cần ở lại: giai đoạn đợt, cảnh báo mức đề tài, lý do nút bị khóa ([PDR-056](../decisions/PDR-056-thong-bao-thao-tac-bang-toast.md)) |
| Lỗi theo ô | chữ `--danger-ink` dưới ô, ô đổi viền đỏ, có `aria-describedby`; thiếu thông tin hiện lỗi sau khi bấm gửi | mọi form |
| Chọn đợt | ô chọn có nhãn "Đợt" ở thanh trên (Đề tài của tôi, Đề xuất từ SV) | giảng viên |

## Truy cập (accessibility) đã làm trong canvas

- Popup có `role="dialog"`, `aria-modal`; lỗi có `role="alert"`, ô sai có `aria-invalid`; thông báo thao tác có `role="status"`.
- Mọi vùng điều hướng có `aria-label`; mục hiện tại có `aria-current="page"`; nút bật tắt dùng `aria-pressed`, menu dùng `aria-haspopup`, `aria-expanded`.
- Vùng bấm tối thiểu 40–44px; thông tin không chỉ dựa vào màu (chip luôn có chữ, trạng thái lỗi kèm câu mô tả).
- Ảnh/biểu tượng trang trí không có nhãn; biểu tượng có ý nghĩa có chữ đi kèm.

## Điểm cần thống nhất khi dựng

> Quy tắc làm việc và bảng token hiện hành nằm ở [../DESIGN.md](../DESIGN.md). Tệp này giữ giá trị gốc từ canvas.

1. **Bộ token.** Đã làm (2026-11-09): `:root` trong `app/frontend/src/index.css` có đủ token theo bảng ở `DESIGN.md` (tên đề xuất trước đây tương ứng `--ink`, `--line`, `--surface-2`...; trạng thái dùng cặp `--warn-*`, `--ok-*`, `--info-*`, `--doing-*`, `--confirmed-*`, `--danger-*`), phông nạp bằng `next/font`. Các biến thể màu lệch trong code cũ đã gộp về một giá trị cho mỗi ý nghĩa (nền cảnh báo `#fef4e2`, nền nguy hiểm `#fdecea`, viền nguy hiểm `#e8b4ae`, nền thành công `#ddf3d8` và `#f1faee` cho banner). Token cũ của Products giữ làm bí danh.
2. **Biểu tượng.** Canvas dùng bộ nét 1.8; repo có `lucide-react` cùng phong cách, dùng luôn thay vì chép SVG.
3. **Thông báo thao tác.** Đã chốt 2026-11-09 ([PDR-056](../decisions/PDR-056-thong-bao-thao-tac-bang-toast.md), đóng OQ-021): toast cho kết quả sau thao tác CRUD; banner chỉ cho ghi chú cần ở lại; lỗi theo ô và lỗi trong form/popup giữ tại chỗ.
