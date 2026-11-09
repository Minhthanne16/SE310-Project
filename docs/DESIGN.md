# DESIGN.md · Quy tắc giao diện cho người và AI

Đây là **điểm vào duy nhất** khi viết hoặc sửa giao diện QLKLTN. Đọc tệp này trước, rồi mới mở [DESIGN/02-thiet-ke-dung-chung.md](DESIGN/02-thiet-ke-dung-chung.md) (giá trị gốc lấy từ canvas) và [DESIGN/03-dac-ta-man-hinh.md](DESIGN/03-dac-ta-man-hinh.md) (đặc tả từng màn). Tệp này không thay đặc tả nghiệp vụ; nếu mâu thuẫn với `DESIGN/` hoặc `OPEN_QUESTIONS.md`, ghi nhận và làm rõ trước khi code (xem [CONTENT.md](CONTENT.md)).

Nguồn chuẩn của giá trị là `:root` trong [app/frontend/src/index.css](../app/frontend/src/index.css). Bảng dưới chỉ là bản đọc nhanh; khi lệch, `index.css` đúng.

## Quy tắc bắt buộc

1. **Không viết mã hex hay `rgb()` trong CSS mới.** Dùng `var(--…)` ở bảng token. Thiếu màu thì thêm token vào `:root` kèm lý do, không rải màu mới vào từng tệp.
2. **Không dùng `style={{ color… }}` cho màu, cỡ chữ, bo góc.** Dùng class. Ngoại lệ duy nhất: giá trị tính được lúc chạy (vị trí, độ rộng thanh Gantt, thanh tiến độ).
3. **Phông:** Be Vietnam Pro cho toàn giao diện (`var(--font-sans)`, đã nạp bằng `next/font` ở `app/layout.tsx`); JetBrains Mono (`var(--font-mono)`) chỉ cho mã, route, tên tệp, số hiệu ở nhãn phụ. Không khai báo `font-family` mới.
4. **Biểu tượng:** `lucide-react`, nét 1.8, cỡ 18 trong menu. Không chép SVG từ canvas.
5. **Mọi trạng thái phải có chữ.** Chip luôn có nhãn chữ; lỗi luôn kèm câu mô tả; không chỉ dựa vào màu.
6. **Vùng bấm tối thiểu 40px** (nút, ô nhập, tab, nút phân trang); hàng bấm được và mục menu 44px. Chỉ avatar, logo, spinner, thanh Gantt được nhỏ hơn.
7. **Truy cập:** popup `role="dialog"` + `aria-modal`; lỗi theo ô `role="alert"` + `aria-invalid` + `aria-describedby`; thông báo thao tác `role="status"`; mục hiện tại `aria-current="page"`; nút bật tắt `aria-pressed`.
8. **Trước khi dựng màn mới:** đọc mục của màn đó trong `DESIGN/03`, mở artboard hoặc sitemap nếu có, dùng lại thành phần ở "Thành phần dùng chung" thay vì viết lại.

## Token

### Trung tính

| Token | Hex | Dùng |
| --- | --- | --- |
| `--ink` | `#1a1a1a` | chữ chính, nút chính, viền nhấn |
| `--ink-2` | `#3d3d3d` | chữ phụ đậm, hover nút chính |
| `--muted` | `#5c5c5c` | chữ phụ, mô tả |
| `--muted-2` | `#737373` | nhãn nhóm menu, placeholder |
| `--muted-3` | `#a3a3a3` | nút tắt, chữ rất nhạt |
| `--line` | `#e5e5e5` | viền thẻ, đường kẻ |
| `--line-soft` | `#f0f0ef` | đường kẻ rất nhạt trong danh sách |
| `--line-input` | `#d4d4d4` | viền ô nhập, nút phụ |
| `--surface` | `#ffffff` | nền thẻ, nền trang |
| `--surface-2` | `#f2f2f1` | nền chip, tab chưa chọn, hover |
| `--surface-3` | `#ebebea` | mục sidebar đang chọn |
| `--canvas` | `#fafaf9` | nền ngoài, hàng tiêu đề bảng |

### Nhấn, liên kết

`--accent #d4f26a` (logo, số đếm, tuần hiện tại trên Gantt), `--link #1f5fbf`, `--link-hover #174a94`.

### Trạng thái (nền / chữ)

| Ý nghĩa | Token | Ghi chú |
| --- | --- | --- |
| Chờ xử lý, cần chú ý, Nháp | `--warn-bg`, `--warn-ink`, `--warn-ink-strong`, `--warn-line` | |
| Thành công, Đã công bố, Đã cho điểm | `--ok-bg`, `--ok-ink`, `--ok-bg-soft`, `--ok-line` | `-soft` cho khối banner |
| Thông tin, Đã đăng ký | `--info-bg`, `--info-ink` | |
| Đang thực hiện | `--doing-bg`, `--doing-ink` | |
| Đã xác nhận | `--confirmed-bg`, `--confirmed-ink` | |
| Nguy hiểm, lỗi, từ chối, lệch điểm | `--danger-bg`, `--danger-bg-soft`, `--danger-line`, `--danger-ink` | `-soft` cho hover |
| Trung tính, chưa có | `--surface-2` + `--ink-2` hoặc `--muted` | |

Màu vai trò: `--role-student`, `--role-lecturer`, `--role-affairs`. Avatar chữ viết tắt dùng cặp `info`, `doing`, `ok`.

### Hình khối và kích thước

| Token | Giá trị | Dùng |
| --- | --- | --- |
| `--radius-control-sm` / `--radius-control` | 9 / 10px | nút, ô nhập, chip chữ nhật |
| `--radius-block` | 12px | khối, popup, dải lọc |
| `--radius-card` | 14px | thẻ lớn |
| `--radius-pill` | 999px | chip tròn, nhãn trạng thái |
| `--btn-h-sm` / `--btn-h` / `--btn-h-lg` | 40 / 44 / 46px | chiều cao nút |
| `--field-h-sm` / `--field-h` | 40 / 44px | chiều cao ô nhập, select |
| `--dialog-w` / `-md` / `-wide` | 480 / 560 / 880px | độ rộng popup |
| `--page-max` | 1240px | độ rộng nội dung trang |
| `--shadow-menu` / `--shadow-popup` / `--shadow-drawer` | | chỉ menu nổi, popup, ngăn kéo |
| `--focus-ring`, `--overlay` | | vòng focus ô nhập, nền mờ popup |

Thẻ: viền 1px `--line`, nền `--surface`, **không bóng**. Khoảng cách theo bội 2; lề trang `32px 40px 56px`; khoảng giữa các khối 20px.

### Cỡ chữ

Chỉ dùng thang: 11 (nhãn nhóm menu, chữ hoa cách 0.08em), 12 và 12.5 (chip, nhãn), 13 và 13.5 (chú thích), 14 và 14.5 (bảng, nút, ô nhập), 15 (nội dung, menu), 16 đến 20 (tên đối tượng), 30 đậm 700 (h1 trang). Không thêm cỡ lẻ như 10.5, 15.5, 16.5, 19.

## Thành phần dùng chung

Đang có sẵn trong `index.css`; **dùng lại, không viết bản thứ tư.**

| Thành phần | Class | Ghi chú |
| --- | --- | --- |
| Nút | `app-button`, `-primary`, `-danger`, `-small` | chính: nền `--ink`; phụ: nền trắng viền `--line-input`; nguy hiểm: chữ `--danger-ink` viền `--danger-line` |
| Chip trạng thái | `app-chip` + `-info`, `-error`, `-active`, `-pending`... | 12.5px, đậm 600, padding 4×10, bo tròn |
| Dải lọc | `app-segmented` (`aria-pressed`) | |
| Bảng | `app-table-scroll` + `app-table` | tiêu đề 13px `--muted`, cuộn ngang khi hẹp |
| Popup xác nhận | `dialog-backdrop` + `dialog` (`dialog-medium`, `dialog-wide`, `dialog-actions-split`) | nút an toàn bên trái, nút nguy hiểm bên phải, nhãn nút nói rõ hành động |
| Ngăn kéo | `app-drawer-backdrop` + `app-drawer` | form thêm/sửa |
| Thông báo kết quả thao tác | `toast.success(...)` / `toast.error(...)` từ `react-hot-toast`; nơi hiện là `AppToaster` (đã gắn trong `AppShell`) | xem mục "Thông báo" bên dưới |
| Trạng thái trống | `status-state` / `app-empty` | viền đứt `--line-input`, tiêu đề đậm 17px + một câu giải thích |
| Thẻ | `app-card` | |
| Khung trang | `app-shell`, `app-sidebar`, `app-topbar`, `app-content`, `app-page-heading` | |

Mỗi tính năng còn có bộ lớp riêng (`rnd-` đợt, `tpc-` đề tài, `usr-` người dùng, `prf-` hồ sơ). Chúng đã dùng chung token và kích thước ở trên, nên nhìn đồng nhất. Khi thêm nút, chip, banner, popup mới ở tính năng nào, **ưu tiên lớp `app-*`**; chỉ thêm lớp riêng khi bố cục thực sự đặc thù, và vẫn chỉ dùng token.

## Thông báo: toast, banner hay tại chỗ

Theo [PDR-056](decisions/PDR-056-thong-bao-thao-tac-bang-toast.md):

| Tình huống | Dùng | Ví dụ |
| --- | --- | --- |
| Kết quả sau thao tác thêm, sửa, xóa, gửi, công bố, tải tệp (thành công, hoặc cả thao tác thất bại) | **toast** | "Đã lưu đề tài.", "Đã xóa tài khoản GV0001." |
| Ghi chú cần ở lại khi người dùng làm việc | **banner** `role="note"` | dải giai đoạn của đợt, cảnh báo GV vượt mức, lý do nút bị khóa |
| Lỗi theo ô, lỗi chặn trong form, popup, ngăn kéo | **tại chỗ** `role="alert"`, `aria-invalid`, `aria-describedby` | "Mã sinh viên không hợp lệ" |

Toast tự tắt sau 5 giây (lỗi 8 giây). Cần nút đi kèm thì dùng lớp `app-toast-action` (xem nhập người dùng). Không tự dựng kiểu báo thứ ba. Khi viết test, tìm nội dung toast bằng `screen`; `vitest.setup.ts` đã gắn sẵn `AppToaster`.

## Điều chưa dựng

- Sidebar thu gọn chỉ còn biểu tượng và chip đếm "Đề xuất từ SV" chưa dựng (đã ghi ở `DESIGN/03`).

## Phần cũ không dùng làm mẫu

Route `(legacy-products)`, các class `btn-*`, `container`, `product-grid`, `error-banner`, `search-box` và màu inline trong `features/products/` là mã mẫu Products. Không sao chép sang màn QLKLTN. Các token `--primary`, `--danger`, `--bg-main`... trong `:root` chỉ là bí danh cho phần này.

## Kiểm tra trước khi xong việc giao diện

```bash
# từ app/frontend/ — không được có mã hex mới ngoài :root và khối Products cũ (dưới dòng 300 của index.css)
grep -rnE "#[0-9a-fA-F]{3,6}\b" src --include=*.css | grep -vE "src/index.css:[0-9]{1,2}:|src/index.css:[12][0-9]{2}:"
# cỡ chữ ngoài thang, chiều cao nhỏ hơn 40px
grep -rnE "font-size: *(10\.5|11\.5|15\.5|16\.5|19)px" src --include=*.css
grep -rnE "(min-)?height: *(3[0-9]|2[0-9])px" src --include=*.css
npm run typecheck && npm run lint && npm test
```

Kết quả mong đợi: lệnh đầu và lệnh thứ hai không in gì. Lệnh thứ ba hiện còn khoảng 10 dòng, đều là avatar, logo, spinner, thanh Gantt (không phải vùng bấm); dòng mới nào là nút hay ô nhập thì phải nâng lên 40px. Với thay đổi nhìn thấy được, mở trang bằng `chay-du-an.bat` hoặc `npm run dev` và xem ở bề rộng điện thoại (lề 16px, không cuộn ngang trang) lẫn máy tính.

## Khi cần thêm hoặc đổi giá trị thiết kế

1. Sửa `:root` trong `index.css`.
2. Sửa bảng trong tệp này và `DESIGN/02-thiet-ke-dung-chung.md` trong cùng thay đổi.
3. Nếu giá trị lấy từ canvas mới, ghi rõ nguồn trong `DESIGN/02`.
