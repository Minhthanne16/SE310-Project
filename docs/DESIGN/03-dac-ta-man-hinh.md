# 03 · Đặc tả từng màn

Mỗi mục: route gợi ý, trạng thái cần dựng (lấy từ prop trên canvas, mỗi giá trị là một case nên dựng và kiểm thử), hành vi, quy tắc nghiệp vụ đã chốt. Mọi dữ liệu trên canvas là dữ liệu mẫu.

Quy ước chung: trạng thái đề tài là Chờ GV duyệt, Đã đăng ký, Bị từ chối (không có Chờ Khoa duyệt, Đã hủy, WITHDRAWN). Quyền kiểm tra ở backend.

## Mục lục

- [Đăng nhập](#đăng-nhập) (DangNhap)
- [Quên mật khẩu](#quên-mật-khẩu) (QuenMatKhau)
- [Trang chủ](#trang-chủ) (TrangChu)
- [Gantt tiến độ đợt (thành phần)](#gantt-tiến-độ-đợt-thành-phần) (GanttDot)
- [Menu thông báo (chuông)](#menu-thông-báo-chuông) (ThongBaoMenu)
- [Hồ sơ cá nhân](#hồ-sơ-cá-nhân) (HoSo)
- [Trang 404](#trang-404) (Trang404)
- [Tìm đề tài (đăng ký)](#tìm-đề-tài-đăng-ký) (SV-DangKy)
- [Tìm đề tài (chưa mở đăng ký)](#tìm-đề-tài-chưa-mở-đăng-ký) (SV-DangKy-ChuaMo)
- [Chi tiết đề tài và ghi danh](#chi-tiết-đề-tài-và-ghi-danh) (SV-ChiTietDeTai)
- [Đề xuất đề tài (overlay)](#đề-xuất-đề-tài-overlay) (DeXuatModal)
- [Đơn đăng ký của tôi](#đơn-đăng-ký-của-tôi) (DonDangKy)
- [Không gian đề tài (sinh viên)](#không-gian-đề-tài-sinh-viên) (KhongGianDeTai)
- [Đề tài của tôi](#đề-tài-của-tôi) (GV-DeTai)
- [Đề xuất từ sinh viên](#đề-xuất-từ-sinh-viên) (GV-DeXuat)
- [Lịch sử đề tài](#lịch-sử-đề-tài) (GV-LichSuDeTai)
- [Nhóm hướng dẫn](#nhóm-hướng-dẫn) (GV-HuongDan)
- [Đề tài phản biện](#đề-tài-phản-biện) (GV-PhanBien)
- [Hội đồng bảo vệ (giảng viên)](#hội-đồng-bảo-vệ-giảng-viên) (GV-HoiDong)
- [Gửi thông báo (giảng viên)](#gửi-thông-báo-giảng-viên) (GV-ThongBao)
- [Danh sách đợt khóa luận](#danh-sách-đợt-khóa-luận) (GiaoVu-DanhSachDot)
- [Chi tiết đợt khóa luận](#chi-tiết-đợt-khóa-luận) (GiaoVu-DotKhoaLuan)
- [Mẫu phiếu đánh giá](#mẫu-phiếu-đánh-giá) (GiaoVu-PhieuDanhGia)
- [Quản lý người dùng](#quản-lý-người-dùng) (GiaoVu-NguoiDung)
- [Quản lý đề tài](#quản-lý-đề-tài) (GiaoVu-DeTai)
- [Chi tiết đề tài (giáo vụ)](#chi-tiết-đề-tài-giáo-vụ) (GiaoVu-ChiTietDeTai)
- [Giảng viên phản biện](#giảng-viên-phản-biện) (GiaoVu-PhanBien)
- [Hội đồng bảo vệ](#hội-đồng-bảo-vệ) (GiaoVu-HoiDong)
- [Kết quả](#kết-quả) (GiaoVu-KetQua)
- [Thống kê](#thống-kê) (GiaoVu-ThongKe)
- [Gửi thông báo (giáo vụ)](#gửi-thông-báo-giáo-vụ) (GiaoVu-ThongBao)
- [Không gian đề tài (góc nhìn giảng viên)](#không-gian-đề-tài-góc-nhìn-giảng-viên) (KhongGianDeTai-GV)

## Đăng nhập
- **Vai trò:** Chung
- **Route gợi ý:** `/login (đã dựng)`
- **Artboard:** `project/DangNhap.dc.html`
- **Mục đích:** Vào hệ thống bằng email và mật khẩu.

**Trạng thái và prop trên canvas**

- `view` (mặc định "Đăng nhập"): Đăng nhập · Sai email hoặc mật khẩu · Đổi mật khẩu lần đầu

**Hành vi**

- Sai email hoặc mật khẩu: một dòng lỗi chung, không nói ô nào sai.
- Lần đăng nhập đầu: bắt buộc đổi mật khẩu trước khi vào hệ thống.
- Màn đổi mật khẩu lần đầu tự gửi mã xác thực 6 chữ số tới email của tài khoản; có ô "Mã xác thực" và nút "Gửi lại mã" đếm ngược 60 giây. Nút đổi mật khẩu chỉ bật khi mật khẩu đạt quy tắc và mã đủ 6 số. *(Bổ sung theo PDR-003, chưa có trên canvas.)*
- Liên kết "Quên mật khẩu" sang màn riêng.

**Quy tắc nghiệp vụ**

- Mật khẩu mới theo `passwordRules` đã có trong repo.
- Mã xác thực có hiệu lực 10 phút, dùng một lần, sai 5 lần thì bị hủy (xem [PDR-003](../decisions/PDR-003-otp-kich-hoat-qua-email.md)).

## Quên mật khẩu
- **Vai trò:** Chung
- **Route gợi ý:** `/quen-mat-khau`
- **Artboard:** `project/QuenMatKhau.dc.html`
- **Mục đích:** Nhập email để nhận liên kết đặt lại, rồi đặt mật khẩu mới từ liên kết.

**Trạng thái và prop trên canvas**

- `view` (mặc định "Nhập email"): Nhập email · Email không tồn tại · Đã gửi liên kết · Đặt mật khẩu mới · Liên kết hết hạn · Liên kết đã được dùng · Đã đổi mật khẩu

**Hành vi**

- Email không tồn tại: báo lỗi tại ô email.
- Đã gửi liên kết: hướng dẫn kiểm tra hộp thư.
- Liên kết hết hạn và liên kết đã được dùng là hai trạng thái riêng, đều có cách xin liên kết mới.

**Quy tắc nghiệp vụ**

- Liên kết có hiệu lực 30 phút, dùng một lần.
- Không dùng được email: giáo vụ đặt lại mật khẩu (xem Người dùng).

## Trang chủ
- **Vai trò:** Chung (3 vai trò)
- **Route gợi ý:** `/sv · /gv · /giao-vu (một component, nhận vai trò từ phiên đăng nhập)`
- **Artboard:** `project/TrangChu.dc.html`
- **Mục đích:** Điểm vào sau đăng nhập: các đợt khóa luận của người dùng và việc cần làm.

**Trạng thái và prop trên canvas**

- `viewAs` (mặc định "Giảng viên"): Sinh viên · Giảng viên · Giáo vụ
- `view` (mặc định "Danh sách đợt"): Danh sách đợt · Chi tiết đợt

**Hành vi**

- Mở ra danh sách thẻ đợt người dùng được phân công. Bấm thẻ mới vào chi tiết đợt (việc cần làm, Bảng thông báo, Gantt). "← Tất cả đợt" quay về danh sách.
- Bảng thông báo: lọc theo nguồn (Tất cả, Từ giáo vụ, Tôi đã gửi), tìm theo tiêu đề hoặc người gửi, bấm để mở, "Xem thêm"; giảng viên và giáo vụ có "Soạn thông báo".
- Gantt đợt có nút thao tác theo vai trò.

**Quy tắc nghiệp vụ**

- SV thấy các đợt mình được thêm vào; GV thấy các đợt có tên mình; giáo vụ thấy cả đợt Nháp.
- Đợt Nháp chỉ giáo vụ thấy, GV và SV thấy sau khi giáo vụ mở đợt.
- Bảng thông báo không có trả lời, không có số người đã xem.
- Đây là bản thử nghiệm của danh sách thẻ đợt, chưa chốt hẳn.

## Gantt tiến độ đợt (thành phần)
- **Vai trò:** Chung
- **Route gợi ý:** `(thành phần dùng trong Trang chủ và chi tiết đợt)`
- **Artboard:** `project/GanttDot.dc.html`
- **Mục đích:** Biểu đồ tuần của một đợt với 9 mốc.

**Trạng thái và prop trên canvas**

- `viewAs` (mặc định "Giáo vụ"): Giáo vụ · Giảng viên · Sinh viên
- `period` (mặc định "Văn bằng 1 · HK1 2026–2027"): Văn bằng 1 · HK1 2026–2027 · Văn bằng 2 · HK1 2026–2027 · Thạc sĩ · Đợt 1/2026
- `readOnly` (mặc định False)
- `periodLabel` (mặc định None)

**Hành vi**

- Cột tuần hiện tại tô màu nhấn; trạng thái mốc: Đã qua, Đang diễn ra, Sắp tới.
- Nút thao tác: SV và GV chỉ ở mục đang diễn ra; giáo vụ ở mọi mục.
- Props: viewAs, period, readOnly, periodLabel.

**Quy tắc nghiệp vụ**

- 9 mốc: GV gửi đề tài, Công bố đề tài · SV đăng ký, Đề cương, Báo cáo giữa kỳ, Báo cáo cuối kỳ, Lịch phản biện, Lịch bảo vệ, Thời gian cho điểm, Chốt bản cuối · công bố.
- Thời gian cho điểm chỉ để nhắc, không khóa phiếu chấm.

## Menu thông báo (chuông)
- **Vai trò:** Chung
- **Route gợi ý:** `(thành phần ở thanh trên)`
- **Artboard:** `project/ThongBaoMenu.dc.html`
- **Mục đích:** Thông báo tự động của hệ thống và thông báo được gửi tới người dùng.

**Trạng thái và prop trên canvas**

- `audience` (mặc định "sv"): sv · gv · giaovu

**Hành vi**

- Đánh dấu đã đọc, lọc Chưa đọc.
- Thông báo bài mới trên Bảng thông báo cũng hiện ở chuông.

**Quy tắc nghiệp vụ**

- Prop `audience`: sv, gv, giaovu (nội dung khác nhau theo vai trò).

## Hồ sơ cá nhân
- **Vai trò:** Chung (3 file theo vai trò)
- **Route gợi ý:** `/ho-so`
- **Artboard:** `project/HoSo.dc.html`
- **Mục đích:** Xem và sửa thông tin cá nhân, đổi mật khẩu.

**Trạng thái và prop trên canvas**

- `view` (mặc định "Xem hồ sơ"): Xem hồ sơ · Sửa hồ sơ · Sai số điện thoại, email phụ · Ảnh sai định dạng · Ảnh quá lớn
- `pwForm` (mặc định "Đóng"): Đóng · Mở · Sai mật khẩu hiện tại · Mật khẩu mới trùng mật khẩu hiện tại
- `viewAs` (mặc định "Sinh viên"): Sinh viên · Giảng viên · Giáo vụ

**Hành vi**

- Sửa họ tên, ngày sinh, SĐT, email phụ, ảnh đại diện; mã, email, vai trò, đơn vị chỉ xem (do giáo vụ quản lý).
- Đổi mật khẩu mở trong popup (nút "Đổi mật khẩu"); lỗi: sai mật khẩu hiện tại, mật khẩu mới trùng mật khẩu hiện tại.
- Lỗi ảnh: sai định dạng, quá lớn. Lỗi SĐT hoặc email phụ.
- Hoạt động đăng nhập.

**Quy tắc nghiệp vụ**

- Ba file HoSo, HoSo-GV, HoSo-GiaoVu cùng mã, chỉ khác vai trò mặc định; dựng thành một màn nhận vai trò từ phiên đăng nhập.
- Ghi chú triển khai frontend (`/ho-so`): theo yêu cầu mới, **họ tên không tự sửa được** (do Giáo vụ quản lý, hiển thị cùng mã, email, vai trò, đơn vị); người dùng chỉ sửa ngày sinh, SĐT, email phụ, ảnh đại diện. Điểm này khác dòng "Sửa họ tên, ..." ở trên. Backend chưa có API hồ sơ nên sửa hồ sơ, ảnh đại diện, hoạt động đăng nhập chạy trên kho demo trong bộ nhớ; đổi mật khẩu là stub (501). Endpoint đề xuất: `GET /api/profile`, `PUT /api/profile`, `PUT /api/profile/avatar`, `POST /api/auth/change-password`. Giới hạn ảnh JPG/PNG/WebP, tối đa 2 MB là tạm thời, chờ OQ-006.

## Trang 404
- **Vai trò:** Chung
- **Route gợi ý:** `app/not-found.tsx`
- **Artboard:** `project/Trang404.dc.html`
- **Mục đích:** Hai biến thể: "Đang xây dựng" (mục chưa làm) và "Không tìm thấy".

**Trạng thái và prop trên canvas**

- `variant` (mặc định "Đang xây dựng"): Đang xây dựng · Không tìm thấy

## Tìm đề tài (đăng ký)
- **Vai trò:** Sinh viên
- **Route gợi ý:** `/sv/dang-ky`
- **Artboard:** `project/SV-DangKy.dc.html`
- **Mục đích:** Xem danh sách đề tài đã công bố, tìm kiếm, vào chi tiết, đề xuất đề tài mới.

**Trạng thái và prop trên canvas**

- `registration` (mặc định "Đang mở"): Đang mở · Chưa có đợt đăng ký · Chưa có danh sách đề tài
- `view` (mặc định "Chưa có nhóm"): Chưa có nhóm · Đã có nhóm và đề tài · Đề xuất chờ GV duyệt
- `startCollapsed` (mặc định False)

**Hành vi**

- Sidebar thu gọn được.
- Ba tình trạng đợt đăng ký (prop `registration`): Đang mở, Chưa có đợt đăng ký, Chưa có danh sách đề tài.
- Ba tình trạng của sinh viên (prop `view`): Chưa có nhóm, Đã có nhóm và đề tài, Đề xuất chờ GV duyệt.

**Quy tắc nghiệp vụ**

- Đợt đã mở nhưng giáo vụ chưa công bố danh sách: KHÔNG cho Đề xuất (xem SV-DangKy-ChuaMo).
- Đã có nhóm hoặc có đề xuất đang chờ: khóa Ghi danh và Đề xuất.

## Tìm đề tài (chưa mở đăng ký)
- **Vai trò:** Sinh viên
- **Route gợi ý:** `/sv/dang-ky (cùng route, khác trạng thái)`
- **Artboard:** `project/SV-DangKy-ChuaMo.dc.html`
- **Mục đích:** Cùng màn với SV-DangKy nhưng mặc định ở tình trạng chưa mở đăng ký; tách file để xem trạng thái này trên canvas.

**Trạng thái và prop trên canvas**

- `registration` (mặc định "Chưa có đợt đăng ký"): Đang mở · Chưa có đợt đăng ký · Chưa có danh sách đề tài
- `view` (mặc định "Chưa có nhóm"): Chưa có nhóm · Đã có nhóm và đề tài · Đề xuất chờ GV duyệt
- `startCollapsed` (mặc định False)

**Hành vi**

- Dựng thành một màn, chọn trạng thái theo dữ liệu đợt.

**Quy tắc nghiệp vụ**

- Chưa công bố danh sách thì không Đề xuất.

## Chi tiết đề tài và ghi danh
- **Vai trò:** Sinh viên
- **Route gợi ý:** `/sv/dang-ky/[id]`
- **Artboard:** `project/SV-ChiTietDeTai.dc.html`
- **Mục đích:** Xem đề tài, ghi danh (đại diện nhóm), hủy ghi danh.

**Trạng thái và prop trên canvas**

- `view` (mặc định "Chưa đăng ký"): Chưa đăng ký · Đề tài đã có nhóm · Nhóm bạn đã ghi danh · Xác nhận hủy ghi danh · Bạn đã có nhóm · Đề xuất chờ GV duyệt · Lỗi: đề tài vừa có nhóm nhận · Lỗi: MSSV không hợp lệ · Lỗi: đợt đã đóng

**Hành vi**

- Ghi danh: nhập thành viên bằng MSSV (kiểm tra hợp lệ).
- Hủy ghi danh có hộp xác nhận với hai nút "Giữ ghi danh" và "Hủy ghi danh".
- Hiện trạng thái đề tài và mức tối đa của GV; ẩn Ghi danh khi đề tài đã có nhóm.

**Quy tắc nghiệp vụ**

- Lỗi cần có: đề tài vừa có nhóm khác nhận, MSSV không hợp lệ, đợt đã đóng.

## Đề xuất đề tài (overlay)
- **Vai trò:** Sinh viên
- **Route gợi ý:** `(popup mở từ Tìm đề tài)`
- **Artboard:** `project/DeXuatModal.dc.html`
- **Mục đích:** Sinh viên đề xuất đề tài và chọn giảng viên hướng dẫn; có chế độ sửa đơn.

**Trạng thái và prop trên canvas**

- `open` (mặc định True)
- `mode` (mặc định "Tạo mới"): Tạo mới · Sửa đơn
- `view` (mặc định "Mặc định"): Mặc định · Lỗi: MSSV không tồn tại · Lỗi: MSSV không thuộc đợt · Lỗi: MSSV đã có nhóm
- `presetGv` (mặc định None)
- `initialTitle` (mặc định None)
- `initialDesc` (mặc định None)
- `initialGv` (mặc định None)
- `initialMember` (mặc định None)

**Hành vi**

- Lỗi MSSV thành viên: không tồn tại, không thuộc đợt, đã có nhóm.
- Chọn GV đã đủ mức vẫn được, kèm cảnh báo.
- Props: mode (Tạo mới / Sửa đơn), presetGv, initialTitle, onSave, onClose.

**Quy tắc nghiệp vụ**

- Chỉ mở được khi đợt đã công bố danh sách đề tài.

## Đơn đăng ký của tôi
- **Vai trò:** Sinh viên
- **Route gợi ý:** `/sv/don-dang-ky`
- **Artboard:** `project/DonDangKy.dc.html`
- **Mục đích:** Danh sách ghi danh và đề xuất trong đợt.

**Trạng thái và prop trên canvas**

- `scenario` (mặc định "Chờ GV duyệt"): Chờ GV duyệt · Sửa đơn · Đã đăng ký · GV từ chối

**Hành vi**

- Bốn kịch bản (prop `scenario`): Chờ GV duyệt, Sửa đơn, Đã đăng ký, GV từ chối (nhóm thấy lý do).
- Hủy đơn đang chờ: đơn biến mất khỏi danh sách.

**Quy tắc nghiệp vụ**

- Trạng thái: Chờ GV duyệt, Đã đăng ký, Bị từ chối. Không có "Đã hủy" và không có "Chờ Khoa duyệt".

## Không gian đề tài (sinh viên)
- **Vai trò:** Sinh viên (dùng chung với giảng viên)
- **Route gợi ý:** `/de-tai/[id]`
- **Artboard:** `project/KhongGianDeTai.dc.html`
- **Mục đích:** Nơi nhóm làm việc: nộp đề cương, giữa kỳ, cuối kỳ, xem điểm và kết quả.

**Trạng thái và prop trên canvas**

- `view` (mặc định "Mặc định"): Mặc định · Mới ghi danh · Xác nhận hủy ghi danh · Chưa có đề tài · Lỗi file không phải PDF · Lỗi file quá 20 MB · Tự chốt bản cuối · Giữa kỳ hết hạn · Giữa kỳ cho nộp trễ · Chi tiết phiếu
- `phase` (mặc định "Sau bảo vệ"): Đề cương · Khóa luận · Sau bảo vệ
- `tab` (mặc định "Hoạt động"): Tổng quan đề tài · Thông báo · Hoạt động · Điểm số
- `gvRole` (mặc định "Chủ tịch hội đồng"): Hướng dẫn · Phản biện · Thư ký hội đồng · Chủ tịch hội đồng
- `defenseScheduled` (mặc định False)
- `resultPublished` (mặc định False)
- `groupSize` (mặc định "2 sinh viên"): 2 sinh viên · 1 sinh viên
- `progressOpen` (mặc định True)
- `viewAs` (mặc định "Sinh viên"): Sinh viên · Giảng viên

**Hành vi**

- Khung tiến độ 6 chặng (Đăng ký, Đề cương, Giữa kỳ, Cuối kỳ, Đánh giá, Kết quả), thu gọn được.
- Bốn tab: Tổng quan đề tài, Thông báo (GVHD và giáo vụ gửi nhóm), Hoạt động, Điểm số.
- Nộp bài PDF; lỗi: không phải PDF, quá 20 MB.
- Nộp báo cáo cuối kỳ nhiều lần, mỗi bản kèm ghi chú thay đổi bắt buộc; không xóa bản đã nộp.
- Chốt bản cuối có popup xác nhận.
- Props quan trọng: phase (Đề cương / Khóa luận / Sau bảo vệ), tab, groupSize (1 hoặc 2 SV, điểm chấm riêng từng SV), defenseScheduled, resultPublished.

**Quy tắc nghiệp vụ**

- Nộp sau hạn vẫn nhận, gắn nhãn Nộp trễ; giáo vụ bật/tắt "Cho nộp trễ" theo mốc.
- Hết hạn nộp bản cuối thì tự chốt; giữa kỳ khóa khi hết khung nếu không cho nộp trễ.
- Chốt bản cuối sau bảo vệ.
- Sinh viên chỉ thấy điểm sau khi giáo vụ công bố kết quả.
- Có nút Hủy ghi danh khi mới ghi danh.

## Đề tài của tôi
- **Vai trò:** Giảng viên
- **Route gợi ý:** `/gv/de-tai`
- **Artboard:** `project/GV-DeTai.dc.html`
- **Mục đích:** Gửi đề tài vào đợt, sửa, xóa.

**Trạng thái và prop trên canvas**

- `phase` (mặc định "Đã công bố danh sách"): Đang gửi đề tài · Đã công bố danh sách
- `formOpen` (mặc định False)

**Hành vi**

- Ô lọc Đợt ở thanh trên.
- Form thêm/sửa điền sẵn Yêu cầu và Lĩnh vực; thông báo thành công sau khi gửi.
- Xóa đề tài có xác nhận.
- Props: phase (Đang gửi đề tài / Đã công bố danh sách), formOpen.

**Quy tắc nghiệp vụ**

- Đến khi giáo vụ công bố danh sách: thêm, sửa, xóa tự do.
- Sau công bố: không thêm, không xóa; chỉ sửa mô tả và yêu cầu của đề tài chưa có nhóm; khóa Lĩnh vực.
- Số đề tài của GV = đề tài GV gửi + đề xuất SV đã chấp nhận; mức tối thiểu và tối đa của đợt chỉ cảnh báo, không chặn (giáo vụ thấy cờ "GV vượt mức").

## Đề xuất từ sinh viên
- **Vai trò:** Giảng viên
- **Route gợi ý:** `/gv/de-xuat`
- **Artboard:** `project/GV-DeXuat.dc.html`
- **Mục đích:** Duyệt các đề xuất sinh viên gửi cho mình.

**Trạng thái và prop trên canvas**

- `currentGroups` (mặc định 4)

**Hành vi**

- Ô lọc Đợt ở thanh trên (cùng bộ lọc với Đề tài của tôi).
- Hai tab: Chờ GV duyệt, Đã xử lý; chọn một đề xuất xem chi tiết và nhóm đề xuất.
- Chấp nhận: đề tài chuyển sang Đã đăng ký ngay. Từ chối: bắt buộc nhập lý do (bản canvas chưa có dòng lỗi khi bỏ trống).
- Cảnh báo khi đạt mức tối đa (prop currentGroups).

**Quy tắc nghiệp vụ**

- Chấp nhận thì tính vào số đề tài của GV.

## Lịch sử đề tài
- **Vai trò:** Giảng viên
- **Route gợi ý:** `/gv/lich-su`
- **Artboard:** `project/GV-LichSuDeTai.dc.html`
- **Mục đích:** Đề tài qua các đợt, kèm dòng thời gian xử lý.

**Trạng thái và prop trên canvas**

- `view` (mặc định "Tất cả đợt"): Tất cả đợt · Lọc Đã hoàn tất · Chưa có đề tài

**Hành vi**

- Lọc đợt, trạng thái; chọn đề tài xem dòng thời gian (người, thời điểm, nội dung).
- Ba trạng thái: Tất cả đợt, Lọc Đã hoàn tất, Chưa có đề tài.

## Nhóm hướng dẫn
- **Vai trò:** Giảng viên
- **Route gợi ý:** `/gv/huong-dan`
- **Artboard:** `project/GV-HuongDan.dc.html`
- **Mục đích:** Danh sách nhóm mình hướng dẫn.

**Trạng thái và prop trên canvas**

- `view` (mặc định "Có nhóm"): Có nhóm · Chưa có nhóm

**Hành vi**

- Lọc Tất cả, Cần xử lý; bảng có cột Khóa luận (Chưa nộp, Đã nộp n phiên bản, Chốt bản cuối) và Việc cần làm.
- "Mở" vào Không gian đề tài (góc nhìn giảng viên): duyệt đề cương theo danh sách yêu cầu, nhận xét, chấm điểm hướng dẫn.
- Trạng thái trống: Chưa có nhóm.

## Đề tài phản biện
- **Vai trò:** Giảng viên
- **Route gợi ý:** `/gv/phan-bien`
- **Artboard:** `project/GV-PhanBien.dc.html`
- **Mục đích:** Đề tài giáo vụ phân công mình phản biện.

**Trạng thái và prop trên canvas**

- `view` (mặc định "Có đề tài"): Có đề tài · Chưa được phân công

**Hành vi**

- Lọc Tất cả, Chưa chấm; nút "Mở · cho điểm" vào Không gian đề tài: xem đề cương, bản nộp, nhập phiếu chấm phản biện; nhận xét phản biện không bắt buộc, lưu riêng.
- Trạng thái trống: Chưa được phân công.

**Quy tắc nghiệp vụ**

- GV phản biện chỉ xem tài liệu và cho điểm, không duyệt đề cương hay sửa đề tài; sửa được điểm đến khi giáo vụ xác nhận kết quả.
- GVHD và hội đồng xem được nhận xét phản biện.

## Hội đồng bảo vệ (giảng viên)
- **Vai trò:** Giảng viên
- **Route gợi ý:** `/gv/hoi-dong`
- **Artboard:** `project/GV-HoiDong.dc.html`
- **Mục đích:** Xem hội đồng mình tham gia và chấm điểm.

**Trạng thái và prop trên canvas**

- `view` (mặc định "Thư ký"): Thư ký · Chủ tịch · Chưa thuộc hội đồng

**Hành vi**

- Ba góc nhìn (prop `view`): Thư ký, Chủ tịch, Chưa thuộc hội đồng.
- Thông tin hội đồng: vai trò, chủ tịch, lịch, phòng; đề tài theo giờ bảo vệ.

**Quy tắc nghiệp vụ**

- Hội đồng hai người: chủ tịch và thư ký. Thư ký nhập điểm hội đồng; chủ tịch chỉ xem.
- Cảnh báo khi điểm lệch từ 2 trở lên.

## Gửi thông báo (giảng viên)
- **Vai trò:** Giảng viên
- **Route gợi ý:** `/gv/thong-bao/gui`
- **Artboard:** `project/GV-ThongBao.dc.html`
- **Mục đích:** Gửi thông báo cho một, nhiều hoặc tất cả nhóm hướng dẫn.

**Trạng thái và prop trên canvas**

- `viewAs` (mặc định "Giảng viên"): Giảng viên · Giáo vụ
- `view` (mặc định "Soạn mới"): Soạn mới · Gửi cho một nhóm · Thiếu thông tin · Đã gửi · Xác nhận xóa

**Hành vi**

- Lỗi thiếu tiêu đề hoặc nội dung; Hủy; danh sách đã gửi; xác nhận xóa.
- Preset "Gửi cho một nhóm" (vào từ Không gian đề tài, cần truyền id nhóm khi dựng thật).

**Quy tắc nghiệp vụ**

- Đăng lên Bảng thông báo, tab Thông báo của đề tài và chuông.

## Danh sách đợt khóa luận
- **Vai trò:** Giáo vụ
- **Route gợi ý:** `/giao-vu/dot`
- **Artboard:** `project/GiaoVu-DanhSachDot.dc.html`
- **Mục đích:** Quản lý mọi đợt; lọc và mở chi tiết.

**Trạng thái và prop trên canvas**

- `status` (mặc định "Đang diễn ra"): Đang diễn ra · Nháp · Đã kết thúc · Tất cả
- `dialog` (mặc định "Không"): Không · Tạo đợt mới · Sao chép từ đợt cũ · Tạo đợt mới · thiếu thông tin · Tạo đợt mới · trùng tên đợt · Xóa đợt · xác nhận · Đã xóa đợt

**Hành vi**

- Lọc trạng thái (mặc định Đang diễn ra) và chương trình (Văn bằng 1, Văn bằng 2, Thạc sĩ); phân trang.
- Tạo đợt mới (lỗi thiếu thông tin, trùng tên đợt), Sao chép từ đợt cũ, Mở đợt (hộp xác nhận, gửi thông báo, cảnh báo việc chưa xong nhưng vẫn cho mở), Xóa đợt.
- Bấm một đợt mở chi tiết đợt.

**Quy tắc nghiệp vụ**

- Chỉ xóa được đợt Nháp.
- Đợt Nháp ẩn với GV và SV.
- Tên chương trình thạc sĩ ghi "Thạc sĩ · Đợt 1/2026".

## Chi tiết đợt khóa luận
- **Vai trò:** Giáo vụ
- **Route gợi ý:** `/giao-vu/dot/[id]`
- **Artboard:** `project/GiaoVu-DotKhoaLuan.dc.html`
- **Mục đích:** Một đợt: tiến độ, cấu hình mốc, người tham gia.

**Trạng thái và prop trên canvas**

- `period` (mặc định "ths"): vb1 · vb2 · ths · vb1o
- `tab` (mặc định "Tiến độ"): Tiến độ · Cấu hình · Giảng viên · Sinh viên
- `dialog` (mặc định "Không"): Không · Thêm sinh viên · chọn · Thêm sinh viên · nhập mã · Thêm sinh viên · kết quả kiểm tra · Thêm giảng viên · chọn · Đã thêm · Gỡ khỏi đợt · Kết thúc đợt · Kết thúc đợt · còn đề tài chưa công bố · Xóa đợt · xác nhận · Đã xóa đợt
- `config` (mặc định "Hợp lệ"): Hợp lệ · Có mốc sai thứ tự

**Hành vi**

- Bốn tab: Tiến độ (Gantt), Cấu hình, Giảng viên, Sinh viên. Prop `period` đổi giữa bốn đợt mẫu.
- Cấu hình: 9 mốc, kiểm tra thứ tự mốc (trạng thái "Có mốc sai thứ tự"); cột "Thông báo cho" chọn được; công tắc "Cho nộp trễ" theo mốc Đề cương, Giữa kỳ, Cuối kỳ.
- Thêm giảng viên và sinh viên (chọn trong danh sách hoặc nhập mã, có bước kiểm tra), gỡ khỏi đợt, Kết thúc đợt, Xóa đợt.

**Quy tắc nghiệp vụ**

- Một sinh viên chỉ thuộc một đợt đang diễn ra.
- CSDL: `period_milestones.allow_late` mặc định TRUE.
- Kết thúc đợt khi còn đề tài chưa công bố: cảnh báo.
- SV có dữ liệu chỉ không gỡ được khỏi đợt (không có trạng thái "Ngừng tham gia").

## Mẫu phiếu đánh giá
- **Vai trò:** Giáo vụ
- **Route gợi ý:** `/giao-vu/phieu-danh-gia`
- **Artboard:** `project/GiaoVu-PhieuDanhGia.dc.html`
- **Mục đích:** Tạo mẫu phiếu chấm và gán cho vai trò trong đợt.

**Trạng thái và prop trên canvas**

- `view` (mặc định "Mẫu đang dùng"): Mẫu đang dùng · Mẫu đã đóng · Mẫu nháp · Xác nhận xóa · Xóa mẫu đang gán · Đang sửa · có nút Hủy · Trùng tên mẫu · Trùng tên tiêu chí · Xác nhận xóa tiêu chí

**Hành vi**

- Tiêu chí chung gồm hạng mục con; mỗi vai trò (HD, PB, thành viên hội đồng) dùng mẫu riêng.
- Trạng thái mẫu: đang dùng, đã đóng, nháp. Lỗi: trùng tên mẫu, trùng tên tiêu chí; hỏi lại khi xóa mẫu và khi xóa tiêu chí; nút Hủy khi sửa; có ô mô tả.
- Xóa mẫu đang gán: có cảnh báo riêng.

**Quy tắc nghiệp vụ**

- Phiếu chấm luôn mở, điểm chấm riêng từng sinh viên (cột Điểm SV1, SV2).

## Quản lý người dùng
- **Vai trò:** Giáo vụ
- **Route gợi ý:** `/giao-vu/nguoi-dung`
- **Artboard:** `project/GiaoVu-NguoiDung.dc.html`
- **Mục đích:** Thêm, sửa, nhập CSV, đặt lại mật khẩu, xóa.

**Trạng thái và prop trên canvas**

- `view` (mặc định "Danh sách"): Danh sách · Thêm thủ công · Thêm · thiếu thông tin · Thêm · trùng mã · Thêm · trùng email · Sửa · trùng email · Nhập CSV · chọn file · Nhập CSV · sai định dạng · Nhập CSV · xem trước · Đã nhập CSV · Sửa · đặt lại mật khẩu · Sửa · xóa (chưa có dữ liệu) · Sửa · xóa (đã có dữ liệu) · Sửa · tài khoản của bạn · Sửa · kích hoạt lại

**Hành vi**

- Lọc vai trò, trạng thái, tìm kiếm.
- Form dạng ngăn kéo theo vai trò: SV có lớp; GV có bộ môn, học hàm. Lỗi: thiếu thông tin, trùng mã, trùng email.
- Nhập CSV hai bước (chọn tệp, xem trước), cột: user_code, full_name, email, role, date_of_birth, class_name, department, academic_title; bỏ dòng lỗi, tải báo cáo lỗi; lỗi tệp không phải CSV. Backend đã có (`/api/users/import/preview`, `/api/users/import`); quy tắc bắt buộc và giới hạn tệp xem [PDR-004](../decisions/PDR-004-nhap-tai-khoan-csv.md).
- Đặt lại mật khẩu: về mã người dùng hoặc nhập mật khẩu mới.

**Quy tắc nghiệp vụ**

- Xóa: chưa có dữ liệu thì xóa; có dữ liệu thì vô hiệu hóa (và có nút kích hoạt lại).
- Người dùng vẫn tự đổi mật khẩu ở Hồ sơ.

## Quản lý đề tài
- **Vai trò:** Giáo vụ
- **Route gợi ý:** `/giao-vu/de-tai`
- **Artboard:** `project/GiaoVu-DeTai.dc.html`
- **Mục đích:** Danh sách đề tài của đợt, công bố danh sách.

**Trạng thái và prop trên canvas**

- `view` (mặc định "Đã hết hạn gửi đề tài"): Đã hết hạn gửi đề tài · Chưa hết hạn gửi đề tài · Lọc không có kết quả · Chưa có đề tài · Xuất khi danh sách trống

**Hành vi**

- Lọc đợt, GVHD, trạng thái; phân trang; xuất danh sách (báo khi danh sách rỗng).
- Cột Khóa luận thay cột tiến độ; cờ cam "GV vượt mức".
- "Đóng & công bố danh sách" mở popup; khóa khi chưa hết hạn gửi đề tài.

**Quy tắc nghiệp vụ**

- Công bố xong thì GV không thêm hoặc xóa đề tài.

## Chi tiết đề tài (giáo vụ)
- **Vai trò:** Giáo vụ
- **Route gợi ý:** `/giao-vu/de-tai/[id]`
- **Artboard:** `project/GiaoVu-ChiTietDeTai.dc.html`
- **Mục đích:** Xem toàn bộ một đề tài.

**Trạng thái và prop trên canvas**

- `view` (mặc định "Tổng quan"): Tổng quan · Báo cáo · Điểm · Lịch sử · Lịch sử · lọc Điểm · Lịch sử trống

**Hành vi**

- Bốn tab: Tổng quan, Báo cáo (các phiên bản), Điểm, Lịch sử.
- Tab Lịch sử: lọc trạng thái, nhóm, bài nộp, phân công, điểm; có trạng thái trống.

## Giảng viên phản biện
- **Vai trò:** Giáo vụ
- **Route gợi ý:** `/giao-vu/phan-bien`
- **Artboard:** `project/GiaoVu-PhanBien.dc.html`
- **Mục đích:** Phân công GV phản biện cho từng đề tài.

**Trạng thái và prop trên canvas**

- `view` (mặc định "Chưa phân công"): Chưa phân công · Đã tự gợi ý · Đã lưu · GV phản biện đã nhập điểm

**Hành vi**

- Chọn GVPB từng dòng (khóa GVHD, hiện số đề tài đang nhận) hoặc gán hàng loạt; "Tự gợi ý" (bỏ GV từ 6 đề tài, ưu tiên cùng lĩnh vực rồi ít đề tài); thanh tải từng GV.
- "Lưu và gửi thông báo".

**Quy tắc nghiệp vụ**

- Chỉ phân công đề tài đủ 3 điều kiện: đề cương đã duyệt, đã nộp báo cáo giữa kỳ, đã nộp báo cáo cuối kỳ. Đề tài thiếu nằm ở khung "Chưa đủ điều kiện" kèm chip ✓/✕ từng điều kiện.
- GVPB không trùng GVHD.
- GV phản biện đã nhập điểm thì ô chọn bị khóa, hiện lý do.

## Hội đồng bảo vệ
- **Vai trò:** Giáo vụ
- **Route gợi ý:** `/giao-vu/hoi-dong`
- **Artboard:** `project/GiaoVu-HoiDong.dc.html`
- **Mục đích:** Lập hội đồng, xếp lịch, công bố.

**Trạng thái và prop trên canvas**

- `view` (mặc định "Không cảnh báo"): Có cảnh báo · Không cảnh báo · Đang sửa · chọn ngày · Hội đồng mới (chưa có đề tài) · Xác nhận xóa · Đã công bố

**Hành vi**

- Danh sách hội đồng; chi tiết mặc định chỉ xem, nút Sửa mở chế độ sửa (thành viên, ngày, giờ, phút từng đề tài, phòng, thêm/bớt/xếp đề tài) với Hủy/Lưu; Tạo hội đồng mở thẳng chế độ sửa.
- Ô Ngày bảo vệ mở lịch tháng (tô khoảng thời gian bảo vệ của đợt, chấm ngày đã có hội đồng khác).
- Kho đề tài chưa xếp; công bố lịch; xóa có xác nhận.

**Quy tắc nghiệp vụ**

- Hội đồng hai người (chủ tịch, thư ký).
- GVHD ngồi hội đồng chấm đề tài của mình: CHẶN. Trùng giờ hoặc phòng: chỉ cảnh báo. Còn cảnh báo thì không công bố.
- Chỉ xóa được hội đồng Nháp; hội đồng đã công bố khóa nút Xóa. Không công bố khi đang sửa.
- Tên hội đồng do giáo vụ tự đặt.

## Kết quả
- **Vai trò:** Giáo vụ
- **Route gợi ý:** `/giao-vu/ket-qua`
- **Artboard:** `project/GiaoVu-KetQua.dc.html`
- **Mục đích:** Xác nhận điểm, công bố, xuất bảng điểm.

**Trạng thái và prop trên canvas**

- `view` (mặc định "Chờ xác nhận"): Chờ xác nhận · Xem chi tiết điểm · Popup xác nhận · Chờ công bố · Popup công bố · Hủy xác nhận · Chưa đủ điểm · Xuất bảng điểm

**Hành vi**

- Các tab: Chờ xác nhận, Chờ công bố, Đã công bố, Chưa đủ điểm; xem chi tiết điểm từng người chấm (cờ lệch điểm); xác nhận theo lô, hủy xác nhận, công bố, xuất bảng điểm Excel theo đợt.

**Quy tắc nghiệp vụ**

- Điểm KLTN = (CT + TK + HD×2 + PB×2) / 6.
- Chỉ công bố khi nhóm đã chốt bản cuối hoặc đã hết hạn nộp bản cuối; đề tài chưa chốt bị bỏ qua khi công bố.
- Giáo vụ xác nhận và công bố là khóa luận chuyển Đã hoàn tất (không có bước "Đóng khóa luận" riêng).

## Thống kê
- **Vai trò:** Giáo vụ
- **Route gợi ý:** `/giao-vu/thong-ke`
- **Artboard:** `project/GiaoVu-ThongKe.dc.html`
- **Mục đích:** Số liệu một đợt.

**Trạng thái và prop trên canvas**

- `view` (mặc định "Văn bằng 1 (có dữ liệu)"): Văn bằng 1 (có dữ liệu) · Văn bằng 2 (đầu đợt) · Thạc sĩ (chưa có dữ liệu)

**Hành vi**

- Chọn đợt; đề tài theo trạng thái và theo 6 chặng; số đề tài từng GV so với mức tối thiểu, tối đa; phân bố điểm.
- Ba trạng thái: có dữ liệu, đầu đợt, chưa có dữ liệu.

## Gửi thông báo (giáo vụ)
- **Vai trò:** Giáo vụ
- **Route gợi ý:** `/giao-vu/thong-bao/gui`
- **Artboard:** `project/GiaoVu-ThongBao.dc.html`
- **Mục đích:** Gửi cho tất cả SV, tất cả GV hoặc tất cả người dùng, lọc theo đợt.

**Trạng thái và prop trên canvas**

- `viewAs` (mặc định "Giáo vụ"): Giảng viên · Giáo vụ
- `view` (mặc định "Soạn mới"): Soạn mới · Gửi cho một nhóm · Thiếu thông tin · Đã gửi · Xác nhận xóa

**Hành vi**

- Cùng bố cục với GV-ThongBao; lỗi thiếu tiêu đề hoặc nội dung; danh sách đã gửi; xác nhận xóa.

**Quy tắc nghiệp vụ**

- Đăng lên Bảng thông báo, tab Thông báo của đề tài và chuông.

## Không gian đề tài (góc nhìn giảng viên)
- **Vai trò:** Giảng viên
- **Route gợi ý:** `/de-tai/[id] (cùng route với bản sinh viên)`
- **Artboard:** `project/KhongGianDeTai-GV.dc.html`
- **Mục đích:** Cùng màn với KhongGianDeTai; khác quyền theo vai trò của người xem.

**Trạng thái và prop trên canvas**

- `phase` (mặc định "Khóa luận"): Đề cương · Khóa luận · Sau bảo vệ
- `tab` (mặc định "Điểm số"): Tổng quan đề tài · Thông báo · Hoạt động · Điểm số
- `gvRole` (mặc định "Hướng dẫn"): Hướng dẫn · Phản biện · Thư ký hội đồng · Chủ tịch hội đồng
- `defenseScheduled` (mặc định True)
- `resultPublished` (mặc định False)
- `groupSize` (mặc định "2 sinh viên"): 2 sinh viên · 1 sinh viên
- `progressOpen` (mặc định True)
- `view` (mặc định "Mặc định"): Mặc định · Thiếu điểm hạng mục · Kết quả đã xác nhận
- `viewAs` (mặc định "Giảng viên"): Sinh viên · Giảng viên

**Hành vi**

- Prop `gvRole`: Hướng dẫn, Phản biện, Thư ký hội đồng, Chủ tịch hội đồng; duyệt đề cương theo danh sách yêu cầu; nhận xét giữa kỳ có nút lưu.
- Chấm điểm: lỗi bỏ trống hạng mục; trạng thái "kết quả đã xác nhận, không sửa được".
- Tab Điểm số: GV thấy điểm đã lưu của các vai trò khác.

**Quy tắc nghiệp vụ**

- KhongGianDeTai-GV và KhongGianDeTai cùng mã trên canvas; dựng thành một màn, quyền lấy từ vai trò của người xem.
- Sinh viên chỉ thấy điểm sau khi công bố.
