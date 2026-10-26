# 01 · Sitemap phân tầng

Canvas: artboard "Sitemap phân tầng" (`project/Main.dc.html`). Route là gợi ý theo Next.js App Router; đổi được nếu nhóm thống nhất khác. Tên artboard là tên file trên canvas.

```text
Tầng 0  QLKLTN
  └─ Đăng nhập (/login) ──► Điều hướng theo vai trò
Tầng 1  Chung · Sinh viên · Giảng viên · Giáo vụ
Tầng 2  Màn chính (mục trong sidebar)
Tầng 3  Màn con, tab, popup, trạng thái
```

Ký hiệu tầng 3: **trang riêng** (một màn trên canvas) · *tab / khối* (nằm trong trang) · popup / ngăn kéo / trạng thái (không có URL riêng).

## Khung chung

- Mọi trang sau đăng nhập có sidebar cố định theo vai trò (rộng 232px, thu gọn được ở một số màn), thẻ tài khoản ở đáy mở menu **Xem hồ sơ / Đăng xuất**, thanh trên có **chuông thông báo** và avatar. Chi tiết ở file 02.
- Trang chủ, Hồ sơ cá nhân, Chuông thông báo, Không gian đề tài dùng chung giữa các vai trò, chỉ khác dữ liệu và quyền.
- Đăng nhập, Quên mật khẩu không có sidebar.
- **Đã dựng trong repo (frontend):** khung sidebar theo vai trò cho `/sv`, `/gv`, `/giao-vu` và `/ho-so` (`app/frontend/src/features/navigation/`). Mục menu chưa có trang thật hiển thị biến thể "Đang xây dựng" của Trang404 qua route `app/frontend/app/(protected)/<vai-trò>/[...slug]`; trang thật đặt tại `app/frontend/app/(protected)/<vai-trò>/<mục>/page.tsx` được ưu tiên. `/quen-mat-khau` hiện chỉ là trang "Đang xây dựng". Chuông thông báo trên thanh trên chưa dựng.

## Tầng 1 · Chung

### Đăng nhập
- Route gợi ý: `/login` (đã dựng trong repo)
- Artboard: `DangNhap`
  - Quên mật khẩu, route `/quen-mat-khau` _(trang riêng)_
  - Đặt mật khẩu mới từ liên kết _(popup / trạng thái)_
  - Liên kết hết hạn hoặc đã dùng _(popup / trạng thái)_
  - Sai email hoặc mật khẩu _(popup / trạng thái)_
  - Bắt buộc đổi mật khẩu lần đầu _(popup / trạng thái)_

### Trang chủ
- Route gợi ý: `/sv · /gv · /giao-vu`
- Artboard: `TrangChu`
  - Danh sách thẻ đợt của tôi _(tab / khối)_
  - Chi tiết đợt: việc cần làm _(tab / khối)_
  - Bảng thông báo (lọc, tìm, mở) _(tab / khối)_
  - Gantt đợt (GanttDot) _(tab / khối)_

### Hồ sơ cá nhân
- Route gợi ý: `/ho-so`
- Artboard: `HoSo · HoSo-GV · HoSo-GiaoVu`
  - Sửa ngày sinh, SĐT, email phụ, ảnh _(tab / khối)_
  - Đổi mật khẩu _(popup / trạng thái)_ (đã dựng giao diện; backend chưa có API đổi mật khẩu thông thường, đề xuất `POST /api/auth/change-password { currentPassword, newPassword }`)
  - Hoạt động đăng nhập _(tab / khối)_

### Chuông thông báo
- Route gợi ý: `(menu ở thanh trên)`
- Artboard: `ThongBaoMenu`
  - Thông báo tự động và được gửi _(tab / khối)_
  - Đánh dấu đã đọc · lọc Chưa đọc _(tab / khối)_

### Trang 404
- Route gợi ý: `/404`
- Artboard: `Trang404`
  - Mục chưa làm, không tìm thấy trang _(popup / trạng thái)_

## Tầng 1 · Sinh viên

### Trang chủ
- Route gợi ý: `/sv`
- Artboard: `TrangChu`
  - Thẻ các đợt SV tham gia _(tab / khối)_
  - Việc cần làm, Bảng thông báo, Gantt _(tab / khối)_

### Đăng ký đề tài
- Route gợi ý: `/sv/dang-ky`
- Artboard: `SV-DangKy · SV-DangKy-ChuaMo`
  - Chưa mở đăng ký (danh sách chưa công bố) _(popup / trạng thái)_
  - Chi tiết đề tài _(trang riêng)_
  - Ghi danh (đại diện nhóm) _(popup / trạng thái)_
  - Đề xuất đề tài mới _(popup / trạng thái)_
  - Hủy ghi danh _(popup / trạng thái)_

### Đơn đăng ký của tôi
- Route gợi ý: `/sv/don-dang-ky`
- Artboard: `DonDangKy`
  - Chờ GV duyệt · Đã đăng ký · Bị từ chối _(tab / khối)_
  - Hủy đơn đang chờ _(popup / trạng thái)_

### Đề tài của tôi
- Route gợi ý: `/sv/de-tai`
- Artboard: `KhongGianDeTai`
  - Khung tiến độ 6 chặng _(tab / khối)_
  - Tổng quan đề tài _(tab / khối)_
  - Thông báo của nhóm _(tab / khối)_
  - Hoạt động: đề cương, giữa kỳ, cuối kỳ _(tab / khối)_
  - Nộp bài (PDF, nộp trễ) _(popup / trạng thái)_
  - Chốt bản cuối _(popup / trạng thái)_
  - Điểm số và kết quả _(tab / khối)_

## Tầng 1 · Giảng viên

**Nhóm menu: Đề tài**

### Trang chủ
- Route gợi ý: `/gv`
- Artboard: `TrangChu`
  - Thẻ các đợt GV tham gia _(tab / khối)_
  - Việc cần xử lý, Bảng thông báo, Gantt _(tab / khối)_
  - Soạn thông báo _(popup / trạng thái)_

### Đề tài của tôi
- Route gợi ý: `/gv/de-tai`
- Artboard: `GV-DeTai`
  - Lọc đợt _(tab / khối)_
  - Thêm / sửa đề tài _(popup / trạng thái)_
  - Xóa đề tài (xác nhận) _(popup / trạng thái)_
  - Mức số đề tài của đợt _(tab / khối)_

### Đề xuất từ SV
- Route gợi ý: `/gv/de-xuat`
- Artboard: `GV-DeXuat`
  - Lọc đợt _(tab / khối)_
  - Chờ duyệt · Đã xử lý _(tab / khối)_
  - Chấp nhận _(popup / trạng thái)_
  - Từ chối kèm lý do _(popup / trạng thái)_

### Lịch sử đề tài
- Route gợi ý: `/gv/lich-su`
- Artboard: `GV-LichSuDeTai`
  - Lọc đợt, trạng thái _(tab / khối)_
  - Dòng thời gian xử lý _(tab / khối)_

**Nhóm menu: Đánh giá**

### Hướng dẫn
- Route gợi ý: `/gv/huong-dan`
- Artboard: `GV-HuongDan`
  - Lọc Cần xử lý _(tab / khối)_
  - Không gian đề tài (GV): duyệt đề cương, nhận xét, chấm HD _(trang riêng)_

### Phản biện
- Route gợi ý: `/gv/phan-bien`
- Artboard: `GV-PhanBien`
  - Lọc Chưa chấm _(tab / khối)_
  - Không gian đề tài (GV): chấm PB, nhận xét PB _(trang riêng)_

### Hội đồng
- Route gợi ý: `/gv/hoi-dong`
- Artboard: `GV-HoiDong`
  - Thông tin hội đồng, lịch, phòng _(tab / khối)_
  - Không gian đề tài (GV): chấm hội đồng _(trang riêng)_
  - Thư ký nhập điểm; chủ tịch chỉ xem _(tab / khối)_

### Gửi thông báo
- Route gợi ý: `/gv/thong-bao/gui`
- Artboard: `GV-ThongBao`
  - Chọn nhóm hướng dẫn _(tab / khối)_
  - Soạn tiêu đề, nội dung _(tab / khối)_
  - Danh sách đã gửi _(tab / khối)_

## Tầng 1 · Giáo vụ

**Nhóm menu: Quản lý**

### Trang chủ
- Route gợi ý: `/giao-vu`
- Artboard: `TrangChu`
  - Thẻ các đợt (cả đợt Nháp) _(tab / khối)_
  - Việc cần xử lý, Bảng thông báo, Gantt _(tab / khối)_

### Đợt khóa luận
- Route gợi ý: `/giao-vu/dot`
- Artboard: `GiaoVu-DanhSachDot`
  - Tạo đợt · Sao chép từ đợt cũ _(popup / trạng thái)_
  - Mở đợt (gửi thông báo) _(popup / trạng thái)_
  - Chi tiết đợt _(trang riêng)_
  - Tab Tiến độ (Gantt) _(tab / khối)_
  - Tab Cấu hình mốc, Cho nộp trễ _(tab / khối)_
  - Tab Giảng viên · Sinh viên _(tab / khối)_
  - Xóa đợt Nháp _(popup / trạng thái)_

### Phiếu đánh giá
- Route gợi ý: `/giao-vu/phieu-danh-gia`
- Artboard: `GiaoVu-PhieuDanhGia`
  - Tạo / sửa mẫu phiếu _(popup / trạng thái)_
  - Gán mẫu cho HD, PB, hội đồng theo đợt _(tab / khối)_

### Người dùng
- Route gợi ý: `/giao-vu/nguoi-dung`
- Artboard: `GiaoVu-NguoiDung`
  - Thêm / sửa theo vai trò _(popup / trạng thái)_
  - Nhập CSV (kiểm tra, bỏ dòng lỗi) _(popup / trạng thái)_
  - Đặt lại mật khẩu _(popup / trạng thái)_
  - Xóa · vô hiệu hóa _(popup / trạng thái)_

### Đề tài
- Route gợi ý: `/giao-vu/de-tai`
- Artboard: `GiaoVu-DeTai`
  - Lọc đợt, GVHD, trạng thái _(tab / khối)_
  - Chi tiết đề tài _(trang riêng)_
  - Tab Tổng quan · Báo cáo · Điểm · Lịch sử _(tab / khối)_
  - Đóng & công bố danh sách _(popup / trạng thái)_
  - Xuất danh sách _(popup / trạng thái)_

**Nhóm menu: Đánh giá**

### Giảng viên phản biện
- Route gợi ý: `/giao-vu/phan-bien`
- Artboard: `GiaoVu-PhanBien`
  - Phân công từng đề tài, hàng loạt _(tab / khối)_
  - Tự gợi ý _(popup / trạng thái)_
  - Chưa đủ điều kiện _(tab / khối)_
  - Lưu và gửi thông báo _(popup / trạng thái)_

### Hội đồng bảo vệ
- Route gợi ý: `/giao-vu/hoi-dong`
- Artboard: `GiaoVu-HoiDong`
  - Danh sách hội đồng _(tab / khối)_
  - Tạo / sửa hội đồng _(popup / trạng thái)_
  - Chọn ngày bảo vệ (lịch tháng) _(popup / trạng thái)_
  - Xếp thứ tự đề tài _(tab / khối)_
  - Công bố lịch · Xóa hội đồng Nháp _(popup / trạng thái)_

### Kết quả
- Route gợi ý: `/giao-vu/ket-qua`
- Artboard: `GiaoVu-KetQua`
  - Chờ xác nhận · Chờ công bố · Đã công bố _(tab / khối)_
  - Chi tiết người chấm (cờ lệch điểm) _(popup / trạng thái)_
  - Xác nhận theo lô, công bố _(popup / trạng thái)_
  - Xuất bảng điểm (Excel) _(popup / trạng thái)_

### Thống kê
- Route gợi ý: `/giao-vu/thong-ke`
- Artboard: `GiaoVu-ThongKe`
  - Đề tài theo trạng thái, 6 chặng _(tab / khối)_
  - Số đề tài từng GV _(tab / khối)_
  - Phân bố điểm _(tab / khối)_

### Gửi thông báo
- Route gợi ý: `/giao-vu/thong-bao/gui`
- Artboard: `GiaoVu-ThongBao`
  - Chọn đối tượng, lọc theo đợt _(tab / khối)_
  - Soạn tiêu đề, nội dung _(tab / khối)_
  - Danh sách đã gửi _(tab / khối)_
