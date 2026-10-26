# 02 · Thiết kế dùng chung

Các giá trị lấy trực tiếp từ mã canvas (đếm tần suất sử dụng). Mã canvas dùng style nội tuyến; khi dựng trong repo nên đưa thành biến CSS ở `app/frontend/src/index.css` (hiện đang là bộ màu xanh dương/slate của mẫu Products, khác với thiết kế QLKLTN: cần quyết định thay bộ token, xem mục "Điểm cần thống nhất").

## Phông chữ

| Dùng cho | Phông | Ghi chú |
| --- | --- | --- |
| Toàn bộ giao diện | Be Vietnam Pro 400/500/600/700/800 | Google Fonts; dùng `next/font/google` với subset `vietnamese` |
| Mã, route, tên tệp, số hiệu | JetBrains Mono 400/500 | chỉ ở nhãn phụ |

Cỡ chữ hay dùng: 15px (nội dung, mục menu), 14 và 14.5px (bảng, nút, ô nhập), 13 và 13.5px (chú thích), 12 và 12.5px (chip, nhãn), 11px (nhãn nhóm menu, chữ hoa cách chữ 0.08em), 16 đến 20px (tên đối tượng), 30px đậm 700 (tiêu đề trang h1), 38px (tiêu đề sơ đồ).

## Màu

**Trung tính**

| Token đề xuất | Hex | Dùng |
| --- | --- | --- |
| `--ink` | `#1A1A1A` | chữ chính, nút chính (nền đen) |
| `--ink-2` | `#3D3D3D` | chữ phụ đậm |
| `--muted` | `#5C5C5C` | chữ phụ, mô tả |
| `--muted-2` | `#737373` | nhãn nhóm menu, placeholder |
| `--line` | `#E5E5E5` | viền thẻ, đường kẻ, viền sidebar |
| `--line-input` | `#D4D4D4` | viền ô nhập, nút phụ |
| `--surface` | `#FFFFFF` | nền thẻ, nền trang |
| `--surface-2` | `#F2F2F1` | nền chip, nền tab chưa chọn, nền hàng nhấn nhẹ |
| `--surface-3` | `#EBEBEA` | mục sidebar đang chọn |
| `--canvas` | `#FAFAF9` | nền ngoài sơ đồ |

**Nhấn và liên kết**

| Token | Hex | Dùng |
| --- | --- | --- |
| `--accent` | `#D4F26A` | logo "Q", số đếm trên menu, tuần hiện tại trên Gantt (đổi được: `#A7E3A0`, `#FFD66B`, `#9CC4FF`) |
| `--link` | `#1F5FBF` (hover `#174A94`) | liên kết, nút "Xem đợt" |

**Trạng thái** (cặp nền / chữ)

| Ý nghĩa | Nền | Chữ |
| --- | --- | --- |
| Chờ xử lý, cần chú ý, Nháp | `#FDF1D8` hoặc `#FEF4E2` | `#6B3A06` hoặc `#8A4B08` |
| Thành công, Đã công bố, Chốt bản cuối, Đã cho điểm | `#DDF3D8` | `#2B6A1F` |
| Thông tin, Đã đăng ký | `#E3ECFB` | `#1F4FA0` |
| Đang thực hiện | `#EDE7FB` | `#5B3BA8` |
| Nguy hiểm, lỗi, từ chối | nền `#FDECEA` hoặc `#FBE9E7`, viền `#E8B4AE` | `#A8281C` |
| Trung tính, chưa có | `#F2F2F1` | `#3D3D3D` hoặc `#5C5C5C` |

**Màu vai trò** (chấm nhận diện trên sơ đồ): Sinh viên `#5B8DEF`, Giảng viên `#9B7BE8`, Giáo vụ `#4FB286`. Avatar chữ viết tắt: SV nền `#E3ECFB` chữ `#1F4FA0`; GV nền `#EDE7FB` chữ `#5B3BA8`; Giáo vụ nền xanh lá nhạt chữ xanh đậm.

## Bo góc, khoảng cách, cao độ

- Bo góc: 8px (mục menu, nút nhỏ), 9 và 10px (nút, ô nhập, chip chữ nhật), 12px (khối, popup), 14px (thẻ lớn), 16px (khối ngoài), `999px` (chip tròn, nhãn trạng thái).
- Khoảng cách theo bội 2: lề trang `32px 40px 56px` (trên, hai bên, dưới), khoảng giữa các khối 20px, giữa mục menu 2px.
- Chiều cao tối thiểu chạm: **40px** nút và ô nhập, **44px** mục menu và hàng bấm được, thanh trên 64px.
- Thẻ: viền 1px `--line`, nền trắng, không bóng. Chỉ menu nổi dùng bóng `0 10px 28px rgba(26,26,26,.10)` và popup dùng `0 20px 48px rgba(26,26,26,.18)`.
- Nội dung trang giới hạn `max-width: 1240px`, căn trái.

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
| Nút chính / phụ / nguy hiểm | chính nền `--ink` chữ trắng; phụ nền trắng viền `--line-input`; nguy hiểm chữ `#A8281C` viền `#E8B4AE`; cao ≥ 40px, bo 9px | khắp nơi |
| Dải lọc (segmented tabs) | nhóm nút trong khung `--surface-2` bo 12px, mục chọn nền trắng viền `--line`, `aria-pressed` | Hướng dẫn, Phản biện, Đề xuất... |
| Bảng dạng lưới | `grid-template-columns` tùy bảng, tiêu đề 13px xám, hàng cách nhau viền trên 1px, cuộn ngang khi hẹp (min-width ~960px) | danh sách đợt, đề tài, nhóm, người dùng |
| Thẻ đợt (Trang chủ) | chip chương trình + chip trạng thái, tên đợt, tuần hiện tại, mốc đang diễn ra + thanh tiến độ, vai trò, việc cần xử lý | Trang chủ |
| Gantt tuần | cột tuần T1..Tn, cột tuần hiện tại tô `--accent`, 9 mốc, nút thao tác theo vai trò (SV, GV chỉ mục đang diễn ra; giáo vụ mọi mục) | Trang chủ, chi tiết đợt |
| Bảng thông báo | danh sách kiểu forum: tiêu đề, nguồn (chip Giáo vụ / Bạn), thời gian, trích nội dung; lọc theo nguồn, tìm kiếm; không có trả lời, không có "đã xem" | Trang chủ |
| Chuông thông báo | menu nổi, thông báo tự động và thông báo được gửi, Đánh dấu đã đọc, lọc Chưa đọc | thanh trên |
| Popup xác nhận | `role="dialog"` + `aria-modal`, nền mờ, hộp trắng bo 12px, nút an toàn (Giữ / Hủy bỏ) bên trái, nút nguy hiểm bên phải; nhãn nút nói rõ hành động ("Hủy ghi danh", "Giữ ghi danh") | xóa, hủy, công bố |
| Ngăn kéo (drawer) | trượt từ phải, dùng cho form thêm/sửa người dùng, tạo hội đồng | Người dùng, Hội đồng |
| Trạng thái trống | khung viền đứt `#D4D4D4`, tiêu đề đậm 17px + một câu giải thích + (nếu có) nút/đường dẫn đi tiếp | mọi danh sách |
| Thông báo thao tác (toast) | dải màu theo ý nghĩa, có `role="status"` | sau khi lưu, gửi, xóa |
| Lỗi theo ô | chữ `#A8281C` dưới ô, ô đổi viền đỏ, có `aria-describedby`; thiếu thông tin hiện lỗi sau khi bấm gửi | mọi form |
| Chọn đợt | ô chọn có nhãn "Đợt" ở thanh trên (Đề tài của tôi, Đề xuất từ SV) | giảng viên |

## Truy cập (accessibility) đã làm trong canvas

- Popup có `role="dialog"`, `aria-modal`; lỗi có `role="alert"`, ô sai có `aria-invalid`; thông báo thao tác có `role="status"`.
- Mọi vùng điều hướng có `aria-label`; mục hiện tại có `aria-current="page"`; nút bật tắt dùng `aria-pressed`, menu dùng `aria-haspopup`, `aria-expanded`.
- Vùng bấm tối thiểu 40–44px; thông tin không chỉ dựa vào màu (chip luôn có chữ, trạng thái lỗi kèm câu mô tả).
- Ảnh/biểu tượng trang trí không có nhãn; biểu tượng có ý nghĩa có chữ đi kèm.

## Điểm cần thống nhất khi dựng

1. **Bộ token.** `index.css` hiện dùng `--primary: #2563eb` và nền slate từ mẫu Products; thiết kế QLKLTN là trung tính đen/trắng với màu nhấn lime. Đề xuất: thay token theo bảng trên (một lần, ở `:root`), không sửa từng component. Màn `/login` đã dựng nên rà lại sau khi đổi.
2. **Biểu tượng.** Canvas dùng bộ nét 1.8; repo có `lucide-react` cùng phong cách, dùng luôn thay vì chép SVG.
3. **Toast.** Repo có `react-hot-toast`; dùng cho thông báo thao tác.
