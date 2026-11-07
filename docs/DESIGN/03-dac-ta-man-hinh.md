# 03 · Đặc tả từng màn

Mỗi mục: route gợi ý, trạng thái cần dựng (lấy từ prop trên canvas, mỗi giá trị là một case nên dựng và kiểm thử), hành vi, quy tắc nghiệp vụ đã chốt. Mọi dữ liệu trên canvas là dữ liệu mẫu.

Quy ước chung: chuỗi trạng thái chính của đề tài gồm Chờ GV duyệt, Đã đăng ký, Bị từ chối; không có Chờ Khoa duyệt hoặc WITHDRAWN. Riêng **đề xuất** bị nhóm hủy khi còn Chờ GV duyệt được giữ với trạng thái Đã hủy trong lịch sử theo PDR-012. Quyền kiểm tra ở backend.

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
- Ghi chú triển khai frontend: panel trái chỉ hiện tên khoa (chưa có "Đợt hiện tại" vì chưa có API và đây là trang công khai). Giữ bước mã OTP khi đổi mật khẩu lần đầu (PDR-003) và lỗi theo từng ô, khác artboard.
- Ghi chú (2026-11-07, [PDR-055](../decisions/PDR-055-mat-khau-giang-vien-giao-vu-va-nhap-excel.md)): bước mã xác thực chỉ hiện với sinh viên; giảng viên, giáo vụ phải đổi mật khẩu lần đầu (ví dụ sau khi Giáo vụ đặt lại về mã) chỉ nhập mật khẩu mới.

## Quên mật khẩu
- **Vai trò:** Chung
- **Route gợi ý:** `/quen-mat-khau`
- **Artboard:** `project/QuenMatKhau.dc.html`
- **Mục đích:** Nhập email để nhận liên kết đặt lại, rồi đặt mật khẩu mới từ liên kết.

**Trạng thái và prop trên canvas**

- `view` (mặc định "Nhập email"): Nhập email · Email không tồn tại *(chỉ có trên canvas, không triển khai theo PDR-037)* · Đã gửi liên kết · Đặt mật khẩu mới · Liên kết hết hạn · Liên kết đã được dùng · Đã đổi mật khẩu

**Hành vi**

- Email đúng định dạng: luôn hiện cùng thông báo “Nếu email thuộc hệ thống, bạn sẽ nhận liên kết đặt lại mật khẩu”, kể cả khi không có tài khoản; chỉ gửi thư khi có tài khoản đủ điều kiện. Email sai định dạng được báo lỗi định dạng.
- Sau khi gửi yêu cầu: hướng dẫn kiểm tra hộp thư mà không xác nhận tài khoản có tồn tại.
- Liên kết hết hạn và liên kết đã được dùng là hai trạng thái riêng, đều có cách xin liên kết mới.

**Quy tắc nghiệp vụ**

- Liên kết có hiệu lực 30 phút, dùng một lần.
- Chỉ gửi liên kết cho tài khoản đang hoạt động và đã kích hoạt; tài khoản vô hiệu hóa/chưa kích hoạt cũng thấy phản hồi trung tính và được hướng dẫn liên hệ Giáo vụ theo [PDR-045](../decisions/PDR-045-chi-tai-khoan-hoat-dong-da-kich-hoat-duoc-tu-dat-lai-mat-khau.md).
- Phản hồi màn hình và API không phân biệt email có/không có tài khoản theo [PDR-037](../decisions/PDR-037-phan-hoi-trung-tinh-khi-quen-mat-khau.md); giới hạn 60 giây, 5/giờ/email và 20/giờ/nguồn theo [PDR-044](../decisions/PDR-044-gioi-han-yeu-cau-dat-lai-mat-khau.md) vẫn dùng phản hồi trung tính khi bị giới hạn.
- Không dùng được email: giáo vụ đặt lại mật khẩu (xem Người dùng).
- Ghi chú triển khai (2026-11-07): dùng API thật theo [PDR-052](../decisions/PDR-052-hop-dong-quen-mat-khau-va-lich-su-tai-khoan.md). Liên kết dạng `/quen-mat-khau#token=…`; trang đọc token rồi xóa khỏi thanh địa chỉ. Có đủ các màn Nhập email · Đã gửi liên kết (nút gửi lại đếm 60 giây) · Đặt mật khẩu mới · Liên kết hết hạn · Liên kết đã được dùng · Đã đổi mật khẩu; thêm màn "Liên kết không còn hiệu lực" cho token sai hoặc tài khoản đã thay đổi sau khi phát. Màn nhập email luôn có ghi chú liên hệ Giáo vụ khi không nhận được thư (PDR-045), giống nhau cho mọi email.

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
- Ghi chú triển khai frontend (`/giao-vu`): Trang chủ Giáo vụ đã dựng (thẻ mọi đợt kể cả Nháp, chi tiết đợt với việc cần xử lý suy ra từ dữ liệu, Bảng thông báo, Gantt; đợt đang xem giữ trong `?dot=id`). Backend chưa có API đợt, đề tài, thông báo nên chạy trên kho demo trong bộ nhớ (`frontend/src/features/rounds/`, mất khi tải lại trang; "hôm nay" cố định ở 2026-10-26). Endpoint đề xuất: `GET /api/rounds`, `GET /api/rounds/{id}`, `GET /api/notifications`. Trang chủ SV và GV chưa dựng.
- Cập nhật giao diện theo artboard TrangChu: thẻ đợt bấm được, thanh tiến độ, lưới "Việc sắp đến hạn", Bảng thông báo có avatar/chip nguồn và "Xem thêm". Bộ lọc Bảng thông báo giữ theo docs (Tất cả / Từ giáo vụ / Tôi đã gửi). Chưa có sidebar thu gọn chỉ còn biểu tượng và chip đếm "Đề xuất từ SV".

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
- Ghi chú triển khai frontend: thành phần `RoundGantt` (`frontend/src/features/rounds/components/RoundGantt.tsx`) mới có biến thể Giáo vụ (nút Cấu hình ở mọi mốc); tuần 1 tính từ thứ Hai của tuần chứa mốc sớm nhất.

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
- Ghi chú triển khai: chuông hiện ở thanh trên của cả ba vai trò, dùng API thật `GET /api/notifications/me`, `POST /api/notifications/read` theo [PDR-051](../decisions/PDR-051-ho-so-anh-dai-dien-va-chuong-thong-bao.md). Hiện chỉ sự kiện Mở đợt phát sinh thông báo; các sự kiện khác và thông báo gửi thủ công thuộc P08-S01.

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

- Chủ tài khoản được sửa họ tên, ngày sinh, SĐT, email phụ, ảnh đại diện; mã, email, vai trò, đơn vị chỉ xem tại hồ sơ. Giáo vụ cũng sửa họ tên tài khoản khác ở màn quản lý người dùng; thay đổi có lịch sử theo [PDR-036](../decisions/PDR-036-chu-tai-khoan-va-giao-vu-sua-ho-ten.md).
- Đổi mật khẩu mở trong popup (nút "Đổi mật khẩu"); lỗi: sai mật khẩu hiện tại, mật khẩu mới trùng mật khẩu hiện tại.
- Lỗi ảnh: sai định dạng, quá lớn. Lỗi SĐT hoặc email phụ.
- Hoạt động đăng nhập.

**Quy tắc nghiệp vụ**

- Ba file HoSo, HoSo-GV, HoSo-GiaoVu cùng mã, chỉ khác vai trò mặc định; dựng thành một màn nhận vai trò từ phiên đăng nhập.
- Ghi chú triển khai (`/ho-so`): dùng API thật theo [PDR-051](../decisions/PDR-051-ho-so-anh-dai-dien-va-chuong-thong-bao.md); họ tên tự sửa được theo PDR-036, giới hạn ảnh theo PDR-043. Hoạt động đăng nhập hiện chỉ có lần gần nhất.
- Cập nhật giao diện theo artboard HoSo/HoSo-GV/HoSo-GiaoVu: một component cho cả ba vai trò; thông báo lưu hồ sơ và đổi mật khẩu là banner trong trang (không còn toast); lỗi ảnh (sai định dạng, quá 2 MB) chặn lưu; cột phải chỉ có phần dữ liệu hiện có (hoạt động đăng nhập, quyền hạn của Giáo vụ). Chưa có card "Khóa luận" (SV), "Đợt" (GV), dòng Khoa/Đơn vị và "Lần đầu đăng nhập" vì chưa có dữ liệu/API.

## Trang 404
- **Vai trò:** Chung
- **Route gợi ý:** `app/not-found.tsx`
- **Artboard:** `project/Trang404.dc.html`
- **Mục đích:** Hai biến thể: "Đang xây dựng" (mục chưa làm) và "Không tìm thấy".

**Trạng thái và prop trên canvas**

- `variant` (mặc định "Đang xây dựng"): Đang xây dựng · Không tìm thấy
- Ghi chú triển khai frontend: bố cục cả trang theo artboard (chữ 404, ô biểu tượng, nhãn, tiêu đề, hai nút). Nút "Về trang chủ" của `not-found` dẫn về trang đăng nhập vì trang này không biết vai trò.

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
- Đã có nhóm gắn đề tài hoặc đề xuất đang chờ: khóa Ghi danh và Đề xuất. Riêng nhóm vừa hủy đề xuất vẫn được giữ nguyên và có thể Đề xuất lại bằng chính nhóm đó nếu đợt còn mở và không có đơn khác đang hoạt động (PDR-012).
- Đề xuất đã hủy không còn là đơn đang chờ; nếu đợt còn mở đăng ký và không có đơn/đề tài khác đang hoạt động, nhóm được đề xuất lại ngay với cùng thành viên và đại diện theo PDR-012.

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
- Ghi chú triển khai (2026-11-07, `/sv/dang-ky`): dùng `GET /api/topics/published` ([PDR-053](../decisions/PDR-053-de-tai-giang-vien-va-cong-bo-danh-sach.md)); dựng ba tình trạng đợt (chưa có đợt, chưa có danh sách, danh sách). Bảng có tìm kiếm, mỗi dòng mở xem mô tả/yêu cầu. Ghi danh (P03-S02), đề xuất (P03-S03) và tình trạng nhóm của sinh viên chưa làm; trang ghi rõ "đang được xây dựng".

## Chi tiết đề tài và ghi danh
- **Vai trò:** Sinh viên
- **Route gợi ý:** `/sv/dang-ky/[id]`
- **Artboard:** `project/SV-ChiTietDeTai.dc.html`
- **Mục đích:** Xem đề tài, ghi danh (đại diện nhóm), hủy ghi danh.

**Trạng thái và prop trên canvas**

- `view` (mặc định "Chưa đăng ký"): Chưa đăng ký · Đề tài đã có nhóm · Nhóm bạn đã ghi danh · Xác nhận hủy ghi danh · Bạn đã có nhóm · Đề xuất chờ GV duyệt · Lỗi: đề tài vừa có nhóm nhận · Lỗi: MSSV không hợp lệ · Lỗi: đợt đã đóng

**Hành vi**

- Ghi danh: nhập thành viên bằng MSSV (kiểm tra hợp lệ).
- Hủy ghi danh có hộp xác nhận với hai nút "Giữ ghi danh" và "Hủy ghi danh"; bất kỳ thành viên nhóm nào cũng thao tác được khi đợt còn mở đăng ký và nhóm chưa nộp đề cương. Hộp xác nhận nói rõ hủy cho cả nhóm; sau hủy giữ nguyên nhóm/đại diện và lịch sử theo [PDR-047](../decisions/PDR-047-huy-ghi-danh-de-tai-cong-bo.md).
- Hiện trạng thái đề tài và mức tối đa của GV; ẩn Ghi danh khi đề tài đã có nhóm.

**Quy tắc nghiệp vụ**

- Lỗi cần có: đề tài vừa có nhóm khác nhận, MSSV không hợp lệ, đợt đã đóng.
- Ghi chú triển khai (2026-11-07): backend ghi danh/hủy/tình trạng nhóm đã có theo [PDR-054](../decisions/PDR-054-ghi-danh-nhom-de-tai-cong-bo.md) (người bấm ghi danh là đại diện; thành viên thứ hai nhập mã vào nhóm ngay và nhận thông báo; nhóm cũ chỉ đại diện ghi danh lại). Màn `/sv/dang-ky/[id]` chưa dựng; nối vào hợp đồng PDR-054.

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
- Hủy đơn đang chờ: đơn rời danh sách đang hoạt động, vẫn tra cứu được trong lịch sử với trạng thái Đã hủy; chỉ hủy khi còn Chờ GV duyệt (PDR-012).
- Sau khi hủy, nút Đề xuất có thể bật lại ngay khi đợt vẫn mở và các thành viên không có đăng ký/đề xuất khác đang hoạt động (PDR-012).

**Quy tắc nghiệp vụ**

- Danh sách đang hoạt động: Chờ GV duyệt, Đã đăng ký, Bị từ chối. Đề xuất Đã hủy chỉ hiện ở lịch sử; không có Chờ Khoa duyệt (PDR-012).

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
- Nộp đề cương, báo cáo giữa/cuối kỳ và bản khóa luận chỉ bằng PDF theo [PDR-039](../decisions/PDR-039-chi-nhan-pdf-cho-ban-nop-hoc-thuat.md), tối đa 20 MB mỗi tệp theo [PDR-040](../decisions/PDR-040-gioi-han-pdf-hai-muoi-megabyte.md); lỗi không phải PDF hoặc quá 20 MB.
- Nộp báo cáo cuối kỳ nhiều lần, mỗi bản kèm ghi chú thay đổi bắt buộc; không xóa bản đã nộp.
- Chốt bản cuối có popup xác nhận.
- Props quan trọng: phase (Đề cương / Khóa luận / Sau bảo vệ), tab, groupSize (1 hoặc 2 SV, điểm chấm riêng từng SV), defenseScheduled, resultPublished.

**Quy tắc nghiệp vụ**

- Nộp sau hạn thường chỉ được nhận và gắn nhãn `Nộp trễ` khi Giáo vụ đã bật “Cho nộp trễ” và đặt hạn trễ riêng còn hiệu lực cho mốc đó theo [PDR-041](../decisions/PDR-041-han-nop-tre-rieng-tung-moc.md).
- Hết hạn nộp bản cuối thì tự chốt khi có bản đủ điều kiện; nếu không có bản thì xử lý ngoại lệ theo PDR-011. Mốc Giữa kỳ khóa sau hạn thường khi tắt nộp trễ, hoặc sau hạn trễ riêng khi bật.
- Với hạn bổ sung riêng do Giáo vụ cấp theo PDR-011, nhóm có thể tự chốt bản đã nộp; nếu hết hạn bổ sung mà có bản nhưng chưa chốt, hệ thống chốt bản mới nhất và ghi lịch sử. Không có bản thì không tự chốt.
- Hạn bổ sung riêng cho nhóm được ưu tiên kể cả khi đợt tắt “Cho nộp trễ”; các nhóm không được cấp hạn riêng vẫn theo cấu hình chung (PDR-011).
- Mỗi nhóm/đề tài chỉ được cấp hạn bổ sung một lần cho ngoại lệ không có bản nộp; Giáo vụ không thể cấp lần thứ hai sau khi hạn đầu đã hết (PDR-011).
- Chốt bản cuối sau bảo vệ.
- Mọi phiên bản đã nộp tiếp tục được giữ sau khi kết thúc đợt, không tự xóa khi có bản mới hoặc kết quả đã công bố theo [PDR-042](../decisions/PDR-042-giu-moi-phien-ban-tai-lieu-khong-tu-xoa.md).
- Sinh viên chỉ thấy điểm sau khi giáo vụ công bố kết quả.
- Có nút Hủy ghi danh cho mỗi thành viên khi còn mở đăng ký và chưa nộp đề cương; hủy xong nhóm vẫn tồn tại để ghi danh lại theo PDR-047.

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
- Ghi chú triển khai (2026-11-07, `/gv/de-tai`): dùng API thật `/api/topics/mine`, `POST|PUT|DELETE /api/topics` theo [PDR-053](../decisions/PDR-053-de-tai-giang-vien-va-cong-bo-danh-sach.md). Ô lọc Đợt chọn đợt GV tham gia (mặc định đợt Đang diễn ra). Form là hộp thoại: Tên đề tài, Lĩnh vực (gợi ý sẵn, nhập tự do), Mô tả, Yêu cầu; sau công bố tên và lĩnh vực bị khóa. Gửi được từ ngày bắt đầu mốc "GV gửi đề tài"; dòng giai đoạn và dải cảnh báo mức đề tài hiện trên bảng. Chưa có: lịch sử đề tài của GV (màn Lịch sử đề tài).

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
- "Mở" vào Không gian đề tài (góc nhìn giảng viên): GVHD tạo/kiểm tra và xác nhận hoàn tất từng yêu cầu chỉnh sửa; chỉ duyệt đề cương khi mọi yêu cầu đã hoàn tất, rồi nhận xét/chấm điểm hướng dẫn (PDR-013).
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

- Hội đồng hai người: chủ tịch và thư ký. Thư ký nhập điểm cho cả hai; Chủ tịch chỉ xem, không có bước xác nhận/trả lại (xem [PDR-050](../decisions/PDR-050-bo-buoc-chu-tich-xac-nhan-diem.md), thay PDR-006).
- Điểm CTHĐ bị trả lại không có hạn sửa riêng; mốc cho điểm chỉ nhắc, không tự khóa phiếu. Việc cần xử lý còn hiển thị đến khi Chủ tịch xác nhận.
- Cảnh báo khi bất kỳ cặp chéo nào giữa điểm CTHĐ/TKHĐ và CBHD/CBPB lệch từ 2 trở lên, theo [PDR-007](../decisions/PDR-007-canh-bao-lech-diem-bon-cap-cheo.md).

## Gửi thông báo (giảng viên)
- **Vai trò:** Giảng viên
- **Route gợi ý:** `/gv/thong-bao/gui`
- **Artboard:** `project/GV-ThongBao.dc.html`
- **Mục đích:** Gửi thông báo cho một, nhiều hoặc tất cả nhóm hướng dẫn.

**Trạng thái và prop trên canvas**

- `viewAs` (mặc định "Giảng viên"): Giảng viên · Giáo vụ
- `view` (mặc định "Soạn mới"): Soạn mới · Gửi cho một nhóm · Thiếu thông tin · Đã gửi · Xác nhận xóa

**Hành vi**

- Lỗi thiếu tiêu đề hoặc nội dung; Hủy; danh sách đã gửi; xác nhận “Ẩn khỏi danh sách đã gửi của bạn”. Thao tác “Xóa” trên canvas chỉ ẩn ở phía người gửi, không thu hồi ở phía người nhận.
- Preset "Gửi cho một nhóm" (vào từ Không gian đề tài, cần truyền id nhóm khi dựng thật).

**Quy tắc nghiệp vụ**

- Đăng lên Bảng thông báo, tab Thông báo của đề tài và chuông.
- Xóa khỏi danh sách đã gửi chỉ tác động tới người gửi; người nhận vẫn xem được và lịch sử gửi được giữ theo [PDR-038](../decisions/PDR-038-an-thong-bao-da-gui-chi-voi-nguoi-gui.md).

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
- Tạo đợt mới (lỗi thiếu thông tin, trùng tên đợt), Sao chép từ đợt cũ, Mở đợt (hộp xác nhận, gửi thông báo; chặn khi chín mốc chưa đủ ngày hợp lệ, cảnh báo thiếu giảng viên/sinh viên nhưng vẫn cho mở), Xóa đợt.
- Bấm một đợt mở chi tiết đợt.

**Quy tắc nghiệp vụ**

- Chỉ xóa được đợt Nháp.
- Đợt Nháp ẩn với GV và SV.
- Tên chương trình thạc sĩ ghi "Thạc sĩ · Đợt 1/2026".
- Ghi chú triển khai frontend (`/giao-vu/dot`): chạy trên kho demo trong bộ nhớ, chờ endpoint đề xuất `GET/POST /api/rounds`, `POST /api/rounds/{id}/open`, `DELETE /api/rounds/{id}`. "Sao chép từ đợt cũ" chỉ sao chép khung 9 mốc (Thông báo cho, Cho nộp trễ), không sao chép ngày, giảng viên và sinh viên (xem [PDR-034](../decisions/PDR-034-sao-chep-khung-cau-hinh-dot.md)). Hộp "Mở đợt" liệt kê từng mốc thiếu hoặc sai ngày (vai trò `alert`), khóa nút xác nhận và dẫn tới tab Cấu hình (xem [PDR-032](../decisions/PDR-032-du-chin-moc-hop-le-truoc-khi-mo-dot.md)); thiếu giảng viên/sinh viên chỉ cảnh báo (PDR-033). Khi chạy bằng Docker (`app/compose.yaml`) frontend được build với `NEXT_PUBLIC_ROUNDS_API=true` nên dữ liệu đợt lưu vào PostgreSQL; `npm run dev` và test mặc định vẫn chạy kho demo trừ khi đặt biến này (API thật (`frontend/src/features/rounds/services/roundApiService.ts`): `GET /api/rounds?status=&program=&search=`, `POST /api/rounds`, `DELETE /api/rounds/{id}`, `POST /api/rounds/{id}/open`. Các màn đề tài vẫn dùng mã đợt demo nên với đợt thật tab Đề tài còn trống. `GET /api/rounds` và `GET /api/rounds/{id}` mở cho cả ba vai trò: Giáo vụ thấy mọi đợt, Giảng viên/Sinh viên chỉ thấy đợt đã mở mà mình có tên (đợt khác trả 404); các thao tác ghi chỉ Giáo vụ.
- Cập nhật giao diện theo artboard: bỏ ô tìm kiếm; bộ lọc trạng thái dạng dải nút có số đếm kèm lọc Chương trình; mỗi đợt là một hàng (Đợt, Trạng thái, Tiến độ, Giảng viên, Sinh viên, Cần xử lý); 6 đợt/trang; "Sao chép từ đợt cũ" mở hộp thoại với đợt đã kết thúc gần nhất chọn sẵn; tên đợt lưu dạng "Chương trình · Tên đợt". Chưa có ô "Ngày bắt đầu tuần 1" vì service không nhận ngày.

## Chi tiết đợt khóa luận
- **Vai trò:** Giáo vụ
- **Route gợi ý:** `/giao-vu/dot/[id]`
- **Artboard:** `project/GiaoVu-DotKhoaLuan.dc.html`
- **Mục đích:** Một đợt: tiến độ, cấu hình mốc, người tham gia.

**Trạng thái và prop trên canvas**

- `period` (mặc định "ths"): vb1 · vb2 · ths · vb1o
- `tab` (mặc định "Tiến độ"): Tiến độ · Cấu hình · Giảng viên · Sinh viên · Đề tài · Đánh giá
- `dialog` (mặc định "Không"): Không · Thêm sinh viên · chọn · Thêm sinh viên · nhập mã · Thêm sinh viên · kết quả kiểm tra · Thêm giảng viên · chọn · Đã thêm · Gỡ khỏi đợt · Kết thúc đợt · Kết thúc đợt · còn đề tài chưa công bố · Xóa đợt · xác nhận · Đã xóa đợt
- `config` (mặc định "Hợp lệ"): Hợp lệ · Có mốc sai thứ tự

**Hành vi**

- Sáu tab: Tiến độ (Gantt), Cấu hình, Giảng viên, Sinh viên, Đề tài, Đánh giá. Prop `period` đổi giữa bốn đợt mẫu.
- **Chip "Giai đoạn: …"** cạnh chip trạng thái, chỉ với đợt Đang diễn ra, suy ra từ ngày và việc công bố: *GV gửi đề tài* (chưa công bố, chưa hết hạn mốc "GV gửi đề tài") → *Chờ công bố danh sách* (chưa công bố, đã hết hạn GV gửi) → *SV đăng ký* (đã công bố, mốc đăng ký chưa kết thúc) → *Thực hiện* → *Sẵn sàng kết thúc* (có đề tài và không còn đề tài chờ kết quả). Giảng viên gửi được đề tài từ **ngày bắt đầu** mốc "GV gửi đề tài".
- Tab Tiến độ: khi đợt Đang diễn ra, chưa công bố và đã hết hạn GV gửi đề tài hiện khung "Việc cần làm: đã hết hạn giảng viên gửi đề tài. Xem lại danh sách rồi đóng và công bố để sinh viên đăng ký." với nút "Xem và công bố" chuyển sang tab Đề tài; việc này cũng nằm trong "Cần xử lý" của danh sách đợt và Trang chủ (đích: tab Đề tài). Nút "Đề tài của đợt" ở đầu trang chuyển sang tab Đề tài (không rời trang).
- Tab Đề tài: giáo vụ xem đề tài của đợt ngay tại đây (tìm theo mã, tên đề tài, giảng viên; lọc theo trạng thái kèm số đề tài; cột Đề tài, GV hướng dẫn, GV phản biện, Hội đồng, Khóa luận, Trạng thái); nút "Mở trang Đề tài" mở trang đó với đợt đang xem. **"Đóng & công bố danh sách" và "Xuất danh sách" (Excel) làm ngay tại tab này** (người dùng chốt 2026-11-03, chuyển từ trang Đề tài; xem [PDR-048](../decisions/PDR-048-cong-bo-de-tai-o-chi-tiet-dot.md)). Phân công phản biện và hội đồng vẫn làm ở trang riêng.
  - **Dải trạng thái** phía trên bảng, theo giai đoạn: *Giảng viên đang gửi đề tài* (xám, đến 23:59 ngày kết thúc mốc "GV gửi đề tài"; có thể công bố sớm khi đã đủ đề tài); *Đã hết hạn giảng viên gửi đề tài* (vàng, chờ công bố); *Chưa công bố và hạn đăng ký đã qua* (đỏ, có nút "Mở tab Cấu hình"); *Đã công bố danh sách đề tài* (xanh, vừa công bố: SV đã nhận thông báo, đăng ký được đến 23:59 ngày kết thúc mốc đăng ký); *Đã công bố danh sách ngày dd/MM/yyyy* (xanh, công bố từ trước: đăng ký đã tự đóng, đề tài chưa có nhóm chuyển `Không có nhóm`). Chỉ hiện với đợt Đang diễn ra.
  - **Nút công bố** chỉ hiện với đợt Đang diễn ra (ẩn với Nháp, Đã kết thúc); tắt khi chưa có đề tài hoặc đã công bố ("Đã công bố danh sách"). **Xuất danh sách** vẫn dùng được ở mọi trạng thái đợt và tắt khi đợt chưa có đề tài.
  - **Popup công bố:** nêu số đề tài sẽ hiện cho sinh viên, không hoàn tác được; *Sinh viên còn n ngày để đăng ký, đến 23:59 ngày dd/MM/yyyy* (n tính cả hôm nay, theo mốc "Công bố đề tài · SV đăng ký"); cảnh báo **không chặn** khi công bố trước hạn GV gửi ("Chưa hết hạn giảng viên gửi đề tài (23:59 ngày dd/MM/yyyy). Công bố bây giờ thì giảng viên không gửi thêm được."); cảnh báo giảng viên chưa đạt số đề tài tối thiểu (không chặn). **Chặn** khi ngày kết thúc mốc đăng ký đã qua (còn 0 ngày): giải thích và nút "Mở tab Cấu hình" để lùi mốc; nút xác nhận bị khóa.
  - **Popup xuất Excel:** chọn một trong hai danh sách rồi "Tải tệp .xlsx": *Danh sách đề tài* (Mã, Tên đề tài, Lĩnh vực, GV hướng dẫn, Nhóm, Nguồn, Trạng thái, Tiến độ khóa luận; theo bộ lọc đang chọn của bảng) và *Danh sách đăng ký* (mỗi sinh viên của đợt một dòng: MSSV, Họ tên, Lớp, Mã đề tài, Tên đề tài, GV hướng dẫn, Trạng thái đăng ký: Đã đăng ký / Chờ GV duyệt / Bị từ chối / Chưa có đề tài; không phụ thuộc bộ lọc). Tên tệp có tên đợt (ví dụ `danh-sach-de-tai-van-bang-1-hk1-2026-2027.xlsx`). Ô bắt đầu bằng `=`, `+`, `-`, `@` được chặn công thức. Tải xong hiện banner thành công.
  - **Kết quả ngay trong tab Đề tài** (người dùng duyệt canvas 2026-11-03, [PDR-049](../decisions/PDR-049-vong-doi-ket-qua-theo-nhom-de-tai.md)): cột Trạng thái dùng vòng đời mới (`Đang thực hiện`, `Đang cho điểm`, `Đã cho điểm`, `Có lệch điểm`, `Đã xác nhận`, `Đã hoàn tất`, `Không có nhóm`…); không còn cột Kết quả riêng. Khi đợt đã có đề tài ở trạng thái chấm điểm, bảng có cột chọn (checkbox từng dòng và chọn tất cả) và cột Thao tác với nút "Chi tiết"/"Thu gọn".
  - **Mở rộng inline** dưới dòng (thay bảng trượt cũ): lưới điểm từng sinh viên (HD, PB, CT, TK, Điểm KL; ô thiếu là "—", ô thuộc cặp lệch tô đỏ), danh sách người chấm, hộp "Cờ lệch điểm hội đồng (≥ 2 điểm)" liệt kê từng cặp hoặc "Không có cặp điểm lệch.", tình trạng báo cáo cuối kỳ và liên kết sang Chi tiết đề tài. Theo trạng thái: `Đã cho điểm` có nút "Xác nhận kết quả"; `Có lệch điểm` khóa nút xác nhận kèm lý do "Còn cặp điểm lệch từ 2 điểm…" và có "Gửi thông báo" (soạn sẵn tiêu đề/nội dung, chỉ gửi cho giảng viên trong cặp lệch, không gửi sinh viên); `Đã xác nhận` có "Hủy xác nhận" (lý do bắt buộc, cả nhóm về `Đã cho điểm`) và "Công bố kết quả" (khóa khi nhóm chưa chốt bản cuối và chưa hết hạn chốt; hỏi xác nhận trước khi công bố); `Đã hoàn tất` chỉ xem.
  - **Thanh thao tác theo lô** khi chọn ≥ 1 đề tài: "Xác nhận (n)", "Công bố (n)", "Gửi nhắc lệch điểm (n)", "Bỏ chọn"; mỗi nút đếm số đề tài hợp lệ trong lựa chọn. Chạy xong hiện **báo cáo theo từng đề tài** (thành công / bị bỏ qua kèm lý do).
  - **Sau hạn đăng ký**, đề xuất `Bị từ chối` không hiện trong bảng và bộ lọc; ghi chú dưới bảng cho biết số đề xuất đã gỡ và vẫn xem được trong lịch sử đề tài. Đề tài còn `Đã đăng ký`/`Chờ GV duyệt` khi đó hiển thị là `Đang thực hiện`/không còn.
  - Ghi chú triển khai frontend (2026-11-03): tab Đề tài đã dựng cột chọn, thanh thao tác theo lô, báo cáo theo từng đề tài và phần mở rộng inline theo canvas (`RoundTopicsTab.tsx`, `TopicResultPanel.tsx`). Chỉ chạy trên kho demo trong bộ nhớ (`topicService`, mất khi tải lại trang): `TopicService` thêm `confirmResults`, `unconfirmResult`, `publishResults`, `remindDeviations`; trạng thái chấm điểm suy ra từ phiếu bằng `gradingStatus` (`topicUtils.ts`) và được kiểm tra lại ở phía service khi xác nhận/công bố; việc gửi nhắc lệch điểm chỉ ghi lịch sử đề tài, chưa tạo thông báo thật. "Hạn chốt bản cuối" tạm hiểu là hết ngày kết thúc mốc "Chốt bản cuối · công bố" (xem `finalLockClosed`). Sau hạn đăng ký, `Đã đăng ký`/`Chờ GV duyệt` còn lưu trong dữ liệu mẫu chỉ được hiển thị là `Đang thực hiện`. Dữ liệu mẫu VB1 có đủ các trạng thái chấm điểm dù mốc "Thời gian cho điểm" chưa tới (chỉ để minh họa). Endpoint đề xuất, chưa triển khai: `POST /api/topics/results/confirm`, `POST /api/topics/results/publish` (body `{ topicIds }`, trả kết quả từng đề tài), `POST /api/topics/{id}/results/unconfirm` (body `{ reason }`), `POST /api/topics/{id}/deviation-reminders`; backend phải tính lại trạng thái từ phiếu điểm, không tin trạng thái do giao diện gửi.
- Tab Đánh giá: chỉ tóm tắt ba thẻ (Phiếu đánh giá: đã gán n/3 vai trò; Phản biện: n/m đề tài đã có phản biện; Hội đồng bảo vệ: số hội đồng, số đề tài chưa xếp) và mở sang các trang riêng với bộ lọc đợt đang xem; thao tác chi tiết làm ở các trang đó.
- Khi đợt đã mở (không còn Nháp), "Thông tin đợt" và "Số đề tài mỗi giảng viên nhận hướng dẫn" chỉ xem, có ghi chú; giáo vụ chỉ tiếp tục cập nhật các mốc thời gian (người dùng chốt 2026-11-02). Nút "Kết thúc đợt" ở đầu trang là nút chính (nền đen).
- Cấu hình: 9 mốc, kiểm tra thứ tự mốc (trạng thái "Có mốc sai thứ tự"); cột "Thông báo cho" chọn được; công tắc "Cho nộp trễ" và hạn trễ riêng cho từng mốc Đề cương, Giữa kỳ, Cuối kỳ theo PDR-041.
- Thêm giảng viên và sinh viên (chọn trong danh sách hoặc dán **mã hoặc email**, không phân biệt hoa thường, có bước kiểm tra; cùng một người nhập bằng mã rồi email chỉ tính một lần; có nút "Chọn tệp Excel/CSV" đọc cột đầu tiên của tệp .xlsx/.csv, tự bỏ dòng tiêu đề), gỡ khỏi đợt, Kết thúc đợt, Xóa đợt. Danh sách người tham gia hiện email dưới tên và cột trạng thái tài khoản (Đang hoạt động, Chưa đăng nhập, Vô hiệu hóa).

**Quy tắc nghiệp vụ**

- Một Sinh viên chỉ thuộc một đợt `Đang diễn ra`; thêm vào đợt đang diễn ra hoặc mở đợt Nháp có người trùng phải bị chặn và chỉ rõ người/đợt xung đột (xem [PDR-029](../decisions/PDR-029-mot-sinh-vien-mot-dot-dang-dien-ra.md)).
- Mở đợt chỉ khi đủ chín mốc với thời gian đầu/cuối và thứ tự hợp lệ; thiếu hoặc sai mốc phải CHẶN, hiển thị mốc/lỗi để Giáo vụ sửa (xem [PDR-032](../decisions/PDR-032-du-chin-moc-hop-le-truoc-khi-mo-dot.md)).
- Nếu đã đủ mốc nhưng danh sách Sinh viên/Giảng viên còn trống, cảnh báo vai trò thiếu và vẫn cho Giáo vụ mở đợt; người tham gia có thể được thêm sau (xem [PDR-033](../decisions/PDR-033-mo-dot-duoc-khi-chua-co-nguoi-tham-gia.md)).
- CSDL: `period_milestones.allow_late` mặc định TRUE.
- Công bố danh sách đề tài: chỉ khi đợt Đang diễn ra, có ít nhất 1 đề tài, chưa công bố và mốc "Công bố đề tài · SV đăng ký" chưa kết thúc; **không còn bị chặn bởi hạn "GV gửi đề tài"** (công bố sớm chỉ cảnh báo); không hoàn tác (PDR-048).
- Đăng ký tự đóng cuối ngày kết thúc mốc "Công bố đề tài · SV đăng ký"; đề tài đã công bố mà chưa có nhóm khi đó chuyển `Không có nhóm`.
- **Kết thúc đợt bị chặn** khi còn đề tài chưa ở trạng thái kết thúc: `Đã hoàn tất`, `Không đủ điều kiện công bố` và `Không có nhóm` được chấp nhận, đề xuất `Bị từ chối` cũng không tính (PDR-031, PDR-048). Hộp xác nhận khóa nút và hiện "Còn n đề tài chưa công bố kết quả. Công bố hết ở trang Kết quả rồi mới kết thúc được đợt. Đề tài Không có nhóm không tính."; backend/dịch vụ demo từ chối kết thúc với cùng nội dung.
- SV có dữ liệu chỉ không gỡ được khỏi đợt (không có trạng thái "Ngừng tham gia").
- Ghi chú triển khai frontend (`/giao-vu/dot/[id]`): chạy trên kho demo, endpoint đã có `POST /api/rounds/{id}/finish`, `PUT /api/rounds/{id}/milestones`, `POST|DELETE /api/rounds/{id}/lecturers|students`, `POST /api/rounds/{id}/{lecturers|students}/check` (mã **hoặc email**; kết quả trả `code` đúng như nhập; `participant` có thêm `email`, `accountStatus`), và `POST /api/rounds/{id}/topics/publish` (chỉ Giáo vụ; trả `RoundDto` có `topicsPublishedAt` ISO; 404 không có đợt; 409 khi không Đang diễn ra, đã công bố hoặc mốc đăng ký đã kết thúc trước hôm nay giờ Việt Nam). `RoundDto.topicsPublishedAt` (null nếu chưa công bố) thay vai trò "đã công bố danh sách" của `topicSummary.unpublishedCount`, còn `topicSummary.pendingResultCount` (số đề tài chưa ở trạng thái kết thúc; backend hiện luôn 0 vì chưa có mô-đun đề tài, và khi có mô-đun đó phải bổ sung kiểm tra "có ít nhất 1 đề tài" khi công bố và chặn kết thúc đợt khi > 0) thay phần "kết quả chưa công bố". "Cho nộp trễ" chỉ là công tắc lưu `allow_late`; thời hạn nộp trễ chưa triển khai (OQ-006). Kiểm tra thứ tự mốc: mỗi mốc bắt đầu ≤ kết thúc và ngày bắt đầu không giảm theo thứ tự 9 mốc. Khóa gỡ "có dữ liệu" tính theo từng đợt và chỉ áp dụng cho sinh viên (đúng như quy tắc trên); giảng viên gỡ được khỏi đợt, và sao chép từ đợt cũ không mang theo khóa. Thêm sinh viên vào đợt Nháp không kiểm tra đợt khác; quy tắc "một đợt đang diễn ra" kiểm khi thêm vào đợt đang diễn ra và khi mở đợt (không mở được nếu sinh viên đang ở đợt đang diễn ra khác). Mở đợt bị chặn khi còn mốc thiếu hoặc sai ngày (PDR-032; demo và API cùng trả lỗi liệt kê từng mốc), còn thiếu người chỉ cảnh báo (PDR-033). Sao chép từ đợt cũ không mang theo giảng viên (PDR-034). Với API thật (`NEXT_PUBLIC_ROUNDS_API=true`) frontend gọi: `GET /api/rounds/{id}`, `PUT /api/rounds/{id}` (thông tin đợt, chỉ khi Nháp), `PUT /api/rounds/{id}/milestones`, `POST /api/rounds/{id}/open|finish`, `GET /api/rounds/people/lecturers|students`, `GET /api/rounds/{id}/lecturers|students/candidates`, `POST /api/rounds/{id}/lecturers|students/check`, `POST|DELETE /api/rounds/{id}/lecturers|students[/{userId}]`; lỗi 404 thành "Không tìm thấy đợt", lỗi 409 thành lỗi quy tắc hoặc trùng tên đợt. Thông báo của đợt và công bố đề tài vẫn chạy trên kho demo vì backend chưa có. Tab Giảng viên/Sinh viên và cấu hình chỉ xem được khi đợt đã kết thúc.
- Cập nhật giao diện theo artboard: breadcrumb + chip trạng thái, tab `role=tab` có điều hướng phím mũi tên và số đếm; đợt đã kết thúc ẩn nút thêm/gỡ và hiện dải "chỉ xem"; đợt Nháp xóa bằng thanh xác nhận ngay trên trang rồi về danh sách. Tab Đề tài và Đánh giá (2026-11-02) lấy dữ liệu từ kho demo đề tài và API gán mẫu phiếu; số đề tài mỗi giảng viên (tối thiểu/tối đa) lưu theo từng đợt, sửa được khi đợt còn Nháp với nút "Lưu số đề tài" (số nguyên 0–50, tối thiểu ≤ tối đa; 0 = chưa đặt mức, chưa cảnh báo; đợt mới mặc định 0, sao chép đợt thì lấy mức của đợt nguồn; người dùng chốt 2026-11-02, thay cho bản chỉ xem trước đó). Màn Đề tài cảnh báo theo mức của đợt; "Thông tin đợt" (Chương trình, Tên đợt) sửa được khi đợt còn Nháp với nút "Lưu thông tin đợt" (kiểm tra bắt buộc và trùng tên như khi tạo), sang trạng thái khác thì khóa kèm ghi chú; "Ngày bắt đầu tuần 1" chỉ xem vì suy ra từ các mốc. Chưa có: cột nhắc trước hạn, tải Excel, nhắc sinh viên chưa có đề tài (chưa có dữ liệu/API). Nghiệp vụ giữ theo docs khi khác artboard: kết thúc đợt chỉ cảnh báo đề tài chưa công bố (PDR-031, vì đề tài chưa có trong backend), giảng viên luôn gỡ được (PDR-030 cần dữ liệu đề tài mới chặn được).

## Mẫu phiếu đánh giá
- **Vai trò:** Giáo vụ
- **Route gợi ý:** `/giao-vu/phieu-danh-gia`
- **Artboard:** `project/GiaoVu-PhieuDanhGia.dc.html`
- **Mục đích:** Tạo mẫu phiếu chấm và gán cho vai trò trong đợt.

**Trạng thái và prop trên canvas**

- `view` (mặc định "Mẫu đang dùng"): Mẫu đang dùng · Mẫu đã đóng · Mẫu nháp · Xác nhận xóa · Xóa mẫu đang gán · Đang sửa · có nút Hủy · Trùng tên mẫu · Trùng tên tiêu chí · Xác nhận xóa tiêu chí

**Hành vi**

- Tiêu chí chung gồm hạng mục con; có mẫu cho HD, PB và hội đồng. Chủ tịch/Thư ký dùng chung cấu trúc mẫu hội đồng, nhưng tạo hai phiếu và hai điểm riêng cho từng Sinh viên theo [PDR-024](../decisions/PDR-024-mau-hoi-dong-chung-phieu-diem-rieng.md).
- Mỗi tiêu chí chấm cấp cuối có điểm tối đa; tổng các điểm tối đa phải đúng 10 trước khi mẫu được dùng. Điểm phiếu tính bằng tổng điểm cấp cuối, tiêu chí cha chỉ nhóm, không cho nhập tổng độc lập theo [PDR-035](../decisions/PDR-035-cong-diem-tieu-chi-cap-cuoi.md).
- Trạng thái mẫu: đang dùng, đã đóng, nháp. Mẫu Nháp chưa gán sửa trực tiếp; mẫu đã gán chỉ cho tạo phiên bản mới, hiển thị lịch sử phiên bản theo [PDR-025](../decisions/PDR-025-phien-ban-hoa-mau-phieu-da-gan.md). Lỗi: trùng tên mẫu, trùng tên tiêu chí; hỏi lại khi xóa mẫu và khi xóa tiêu chí; nút Hủy khi sửa; có ô mô tả.
- Trong từng đợt, khi đã có phiếu điểm đầu tiên dùng một loại mẫu HD/PB/Hội đồng, khóa thao tác chuyển sang phiên bản mẫu khác của cùng loại; hiển thị phiên bản đang dùng và lý do khóa theo [PDR-026](../decisions/PDR-026-khoa-phien-ban-mau-trong-dot-sau-diem.md).
- Chỉ cho xóa mẫu Nháp chưa từng gán; mẫu đã từng gán không hiện thao tác xóa có hiệu lực, kể cả chưa có phiếu, và có thể Đóng để ngừng gán mới theo [PDR-027](../decisions/PDR-027-chi-xoa-mau-nhap-chua-gan.md). Khi từ chối xóa phải hiện lý do. Đợt đang dùng mẫu đã đóng vẫn chấm tiếp bằng bản đã gán theo [PDR-028](../decisions/PDR-028-dong-mau-khong-chan-dot-dang-dung.md).

**Quy tắc nghiệp vụ**

- Phiếu chấm luôn mở, điểm chấm riêng từng sinh viên (cột Điểm SV1, SV2).
- Ghi chú triển khai (`/giao-vu/phieu-danh-gia`, API `api/evaluation-templates`, chỉ Giáo vụ). **Bố cục theo yêu cầu của người dùng 2026-10-31, khác artboard** (artboard để khối gán, danh sách thẻ và trình sửa chung một trang): trang chia hai mục.
  - **Mục trên — Gán mẫu theo đợt khóa luận:** bảng mỗi đợt một hàng, ba cột vai trò (HD, PB, Hội đồng) hiện tên mẫu đang gán hoặc "Chưa gán", kèm "n/3 vai trò đã gán". "Gán mẫu" mở panel bên phải chọn mẫu cho từng vai trò (chọn là gán ngay, "Chưa chọn mẫu" là gỡ); **đợt đã kết thúc không hiện trong danh sách; đợt nháp và đang diễn ra hiện và gán được** (người dùng chốt 2026-10-31); phần này chỉ lọc ở giao diện vì backend chưa có mô-đun Đợt. Chỉ mẫu đủ điều kiện gán được.
  - **Mục dưới — Danh sách mẫu phiếu:** bảng (tên, số tiêu chí, trạng thái, đang gán cho, cập nhật) với thao tác nhanh Xem chi tiết, Chỉnh sửa, Xóa (có cảnh báo). Bấm tên mẫu mở panel bên phải ở chế độ xem; "Tạo mẫu phiếu" mở panel tạo mới. Panel đóng được bằng nút X, Escape, bấm nền; đang sửa dở thì hỏi bỏ thay đổi.
  - **Trạng thái tự suy ra** (thay cho nút đổi trạng thái thủ công và trạng thái "Đã đóng" trên giao diện): tổng điểm các tiêu chí chung chưa đủ 10 hoặc hạng mục con chưa khớp → lưu là **Nháp** (khung cảnh báo vàng); đủ điều kiện → **Đủ điều kiện sử dụng**; đã gán cho vai trò chấm của một đợt → **Đang được sử dụng**. Thang điểm cố định 10, không cần thiết lập. Mẫu mới bắt đầu từ điểm 0 (lưu là Nháp), tên mặc định "Mẫu phiếu mới" tự thêm số "(2)" để không trùng. Mẫu đang được sử dụng phải giữ đủ điều kiện: sửa về Nháp bị chặn (backend trả 400) cho tới khi gỡ gán.
  - **Backend:** trạng thái lưu là `Draft` hoặc `Active` (`Closed` vẫn tồn tại ở API nhưng giao diện không dùng). Nháp cho điểm ≥ 0 và không cần khớp tổng; `Active` bắt buộc điểm > 0, có tiêu chí và hạng mục, tổng khớp. Chuyển Draft ⇄ Active tự do khi chưa gán; Closed không về Draft. Mẫu có `description` cho từng tiêu chí (≤ 500 ký tự).
  - Quy tắc dữ liệu: tên mẫu duy nhất (không phân biệt hoa thường/khoảng trắng); không trùng tên tiêu chí trong mẫu, tên hạng mục trong tiêu chí; điểm tối đa hai chữ số thập phân. Có phần xem trước cột Điểm SV1/SV2.
  - Xóa mẫu đang được sử dụng: hộp xác nhận nêu các (đợt, vai trò); xác nhận thì backend gỡ gán và xóa trong một lần lưu (`DELETE …/{id}?removeAssignments=true`); thiếu tham số thì 409.
  - Chưa làm: nút "Tải phiếu PDF" và "Tạo bản sao" của artboard.
  - Tạm thời: backend chưa có mô-đun Đợt nên mã đợt lưu dạng chuỗi (từ kho demo của màn Đợt), chưa là khóa ngoại. Chưa có phiếu điểm (thuộc không gian đề tài) nên chưa chặn sửa/đổi/xóa mẫu đã có điểm. Khi thang phiếu khác 10, điểm được quy về thang 10 (`ThesisScore.ToScale10`) trước khi vào công thức điểm khóa luận.

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
- Ghi chú giao diện (theo artboard): trạng thái chờ đổi mật khẩu hiển thị là "Chưa đăng nhập"; nhập CSV tự kiểm tra khi chọn tệp rồi hiện bước 2/2, đóng hộp thoại khi nhập xong; thông báo thao tác là dải trong trang (không toast); có "Lưu và thêm tiếp"; Giáo vụ không tự xóa/vô hiệu hóa mình. Chưa có API thông báo nên không có câu "đã gửi thông báo cho người dùng" sau khi đặt lại mật khẩu. Nhập theo PDR-004 là CSV (artboard ghi Excel).
- Ghi chú triển khai frontend (`/giao-vu/nguoi-dung`): mọi thao tác dùng API thật `/api/users` (hợp đồng tại [PDR-004](../decisions/PDR-004-nhap-tai-khoan-csv.md#hợp-đồng-api-quản-lý-tài-khoản)); không còn kho demo. Danh sách tải một lần, lọc/tìm/phân trang ở client. Lỗi trùng mã/email đến từ phản hồi 409 của máy chủ. Backend tự chặn Giáo vụ xóa hoặc vô hiệu hóa chính mình; nút trên giao diện chỉ là lớp ngoài. Đặt lại mật khẩu làm phiên đang mở của người đó hết hiệu lực và bắt đổi mật khẩu kèm OTP ở lần đăng nhập kế tiếp.
- Lịch sử thao tác (2026-11-07, chưa có artboard): mục "Lịch sử thao tác" thu gọn trong ngăn Sửa, chỉ tải khi mở; hiện tên thao tác, người thực hiện, thời điểm và giá trị trước/sau từng trường. Tài khoản tạo bằng nhập CSV ghi "Tạo tài khoản bằng nhập CSV" (xem [PDR-052](../decisions/PDR-052-hop-dong-quen-mat-khau-va-lich-su-tai-khoan.md)).
- Mật khẩu và nhập Excel (2026-11-07, [PDR-055](../decisions/PDR-055-mat-khau-giang-vien-giao-vu-va-nhap-excel.md)): khi thêm giảng viên/giáo vụ, form có ô Mật khẩu bắt buộc (tài khoản dùng ngay, không OTP); sinh viên không có ô này. Nút "Nhập Excel/CSV" mở hộp thoại cho chọn định dạng Excel (.xlsx) hoặc CSV (.csv) trước khi chọn tệp; danh sách cột có thêm `password` (GV, Giáo vụ).

## Quản lý đề tài
- **Vai trò:** Giáo vụ
- **Route gợi ý:** `/giao-vu/de-tai`
- **Artboard:** `project/GiaoVu-DeTai.dc.html`
- **Mục đích:** Danh sách đề tài của một đợt kèm bộ lọc. Tiêu đề trang là "Đề tài". **Đóng & công bố danh sách và xuất Excel đã chuyển sang Chi tiết đợt, tab Đề tài** (người dùng chốt 2026-11-03, [PDR-048](../decisions/PDR-048-cong-bo-de-tai-o-chi-tiet-dot.md)).

**Trạng thái và prop trên canvas**

- `view` (mặc định "Đã hết hạn gửi đề tài"): Đã hết hạn gửi đề tài · Chưa hết hạn gửi đề tài · Lọc không có kết quả · Chưa có đề tài · Xuất khi danh sách trống. Các trạng thái công bố/xuất trên artboard này nay thuộc artboard `GiaoVu-DotKhoaLuan` (tab Đề tài); trang `/giao-vu/de-tai` triển khai không còn nút, popup, banner công bố/xuất.

**Hành vi**

- Lọc đợt, GVHD, trạng thái (gồm `Không đủ điều kiện công bố`, `Không có nhóm`); phân trang. Dòng giới thiệu nói công bố và xuất Excel làm ở Chi tiết đợt, tab Đề tài; khi chọn một đợt hiện một dòng ngắn về tình trạng công bố ("đã công bố cho sinh viên ngày …" hoặc "chưa công bố") kèm liên kết "Mở tab Đề tài của đợt" tới `/giao-vu/dot/{id}?tab=de-tai`. Xuất danh sách ở trang này **tạm gỡ**. Chưa làm chế độ xem "mọi đợt".
- Cột Khóa luận thay cột tiến độ; cờ cam "GV vượt mức".

**Quy tắc nghiệp vụ**

- Công bố xong thì GV không thêm hoặc xóa đề tài.
- Trạng thái đề tài thêm hai giá trị: `Không đủ điều kiện công bố` (kết thúc riêng, PDR-011) và `Không có nhóm` (đề tài đã công bố nhưng hết hạn đăng ký mà chưa có nhóm; kết thúc, không chặn kết thúc đợt).

- Ghi chú triển khai (2026-11-07): khi `NEXT_PUBLIC_ROUNDS_API=true`, màn này, Chi tiết đề tài và tab Đề tài của Chi tiết đợt dùng `GET /api/topics?roundId=` và `GET /api/topics/{id}` ([PDR-053](../decisions/PDR-053-de-tai-giang-vien-va-cong-bo-danh-sach.md)); nhóm, phản biện, hội đồng, bài nộp, điểm còn trống tới các phase sau; lịch sử có thêm nhóm "Nội dung". Ghi chú cũ dưới đây mô tả kho demo.
- Ghi chú triển khai frontend (`/giao-vu/de-tai`): chạy trên kho demo trong bộ nhớ (`app/frontend/src/features/topics/`, mất khi tải lại trang; "hôm nay" cố định ở 2026-10-26), chờ endpoint đề xuất `GET /api/topics?roundId=…`, `GET /api/topics/{id}`. Việc công bố nay lưu ở `Round.topicsPublishedAt` (xem Chi tiết đợt); `TopicService` không còn `publish`, `exportCsv`, giai đoạn đề tài hay `canPublish`. Số đề tài của GV = đề tài GV gửi + đề xuất SV đã chấp nhận (không tính Chờ GV duyệt, Bị từ chối). **Mức tối thiểu và tối đa đề tài mỗi GV lấy theo từng đợt (Cấu hình), chỉ để cảnh báo, không chặn.** Bảng 6 cột (Đề tài, GV hướng dẫn, GV phản biện, Hội đồng, Khóa luận, Trạng thái), 8 dòng/trang, tìm kiếm cả tên/mã sinh viên và giảng viên.

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

- Ghi chú triển khai frontend (`/giao-vu/de-tai/[id]`): chỉ xem, dùng chung kho demo với màn danh sách; tab giữ trong `?tab=` (tong-quan, bao-cao, diem, lich-su). Tab Điểm chỉ hiện điểm từng phiếu (CTHĐ, TKHĐ, CBHD, CBPB) và điểm tổng `(CTHĐ + TKHĐ + 2×CBHD + 2×CBPB) / 6` làm tròn hai chữ số khi đủ bốn phiếu, nếu không hiện "Chưa đủ điểm". **Cờ lệch điểm** hiện ở cả màn này (quyết định của người dùng 2026-11-02) và màn Kết quả: chỉ bốn cặp chéo CTHĐ–CBHD, CTHĐ–CBPB, TKHĐ–CBHD, TKHĐ–CBPB, lệch từ 2 điểm trở lên (PDR-007); có chip "Lệch điểm ≥ 2" ở đầu trang, ô điểm đỏ và hộp "Cờ lệch điểm hội đồng" liệt kê từng cặp ở tab Điểm (`scoreDeviations` trong `topicUtils.ts`). Cờ này hiện chỉ được tính ở frontend demo; theo PDR-007, khi có API đề tài/điểm, backend phải tính và trả về cho giao diện và các bản xuất. Điểm tổng tính bằng số nguyên theo phần trăm điểm rồi làm tròn nửa lên (7,05 / 8 / 8,5 / 8,5 → 8,18); backend nên dùng decimal với `MidpointRounding.AwayFromZero` để cùng kết quả. Lịch sử mới nhất trước; đề tài chưa phát sinh sự kiện cần truy vết có lịch sử trống.
- Cập nhật giao diện theo artboard: tab đổi tên thành "Báo cáo và phiên bản", tiến độ 6 chặng, báo cáo nhóm theo Đề cương/Giữa kỳ/Cuối kỳ/Bản khóa luận. Đã bổ sung: nhóm sinh viên hiện mã · lớp; "Phân công và lịch bảo vệ" có Hướng dẫn, Phản biện, Hội đồng (đã/chưa công bố), Chủ tịch, Thư ký, Bảo vệ (thứ, ngày, giờ), Phòng và thứ tự (đề tài chưa xếp lịch hiện "Chưa phân công"/"Chưa xếp lịch"); tab Báo cáo và phiên bản có chip trạng thái từng nhóm (Đề cương "Đã duyệt dd/MM" hoặc "Chờ duyệt", Giữa kỳ "N phiên bản", Cuối kỳ "Đã chốt Bản k" hoặc "N phiên bản · chưa chốt bản cuối"), nhãn "Lần n" (Đề cương) / "Bản n" đánh số trong từng loại, ghi chú thay đổi, tên tệp, nhãn Mới nhất / Nộp trễ. Nút "Tải" tạm vô hiệu hóa vì chưa có endpoint tải tệp. Chip "chốt bản cuối" hiện ở nhóm Cuối kỳ như artboard; chip nhóm Giữa kỳ hiện "N phiên bản" thay cho "Đã nhận xét dd/MM" của artboard (chưa có dữ liệu nhận xét). 

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

- Chỉ phân công đề tài có đề cương đã được GVHD duyệt; không chờ báo cáo giữa kỳ/cuối kỳ để giao phản biện (xem [PDR-021](../decisions/PDR-021-phan-cong-phan-bien-sau-duyet-de-cuong.md)). Đề tài chưa duyệt đề cương nằm ở khung "Chưa đủ điều kiện" với lý do. Phản biện đã được phân công chỉ được nhập điểm sau khi nhóm nộp báo cáo cuối kỳ; không chờ báo cáo giữa kỳ hoặc chốt bản cuối (xem [PDR-022](../decisions/PDR-022-dieu-kien-nhap-diem-phan-bien.md)).
- GVPB không trùng GVHD.
- Từ phiếu phản biện đầu tiên của đề tài, ô thay Giảng viên phản biện bị khóa và backend chặn thay người; trước phiếu được đổi có lịch sử/thông báo, hiển thị lý do khóa theo [PDR-023](../decisions/PDR-023-khoa-thay-giang-vien-phan-bien-sau-phieu.md).

## Hội đồng bảo vệ
- **Vai trò:** Giáo vụ
- **Route gợi ý:** `/giao-vu/hoi-dong`
- **Artboard:** `project/GiaoVu-HoiDong.dc.html`
- **Mục đích:** Lập hội đồng, xếp lịch, công bố.

**Trạng thái và prop trên canvas**

- `view` (mặc định "Không cảnh báo"): Có cảnh báo · Không cảnh báo · Đang sửa · chọn ngày · Hội đồng mới (chưa có đề tài) · Xác nhận xóa · Đã công bố

**Hành vi**

- Danh sách hội đồng; chi tiết mặc định chỉ xem, nút Sửa mở chế độ sửa (thành viên, ngày, giờ bắt đầu/kết thúc từng đề tài, phòng, thêm/bớt/xếp đề tài) với Hủy/Lưu; Tạo hội đồng mở thẳng chế độ sửa. Quyền sửa sau công bố và đính chính theo PDR-018.
- Ô Ngày bảo vệ mở lịch tháng (tô khoảng thời gian bảo vệ của đợt, chấm ngày đã có hội đồng khác).
- Kho đề tài chưa xếp; công bố lịch; xóa hội đồng Nháp có xác nhận. Lịch đã công bố có thao tác Hủy riêng theo PDR-019, không xóa vật lý.

**Quy tắc nghiệp vụ**

- Hội đồng hai người (chủ tịch, thư ký).
- Mỗi đề tài chỉ thuộc một hội đồng và một lượt bảo vệ có hiệu lực; khi đổi lịch phải cập nhật lượt có hiệu lực và giữ lịch sử, không hiện hai lịch đồng thời cho Sinh viên/Giảng viên (xem [PDR-016](../decisions/PDR-016-mot-luot-bao-ve-co-hieu-luc-moi-de-tai.md)).
- Giáo vụ nhập giờ bắt đầu/kết thúc cho từng lượt; giờ kết thúc phải sau giờ bắt đầu; không áp thời lượng cố định (xem [PDR-017](../decisions/PDR-017-thoi-gian-tung-luot-bao-ve.md)).
- Lịch đã công bố được Giáo vụ sửa giờ/phòng/hội đồng trước khi có điểm hội đồng, bắt buộc lý do/lịch sử, kiểm tra lại xung đột và thông báo người bị ảnh hưởng. Khi đã có điểm, khóa sửa trực tiếp giờ/phòng; có thể ghi đính chính có lý do, giữ lịch gốc (xem [PDR-018](../decisions/PDR-018-sua-lich-da-cong-bo-va-dinh-chinh.md)).
- GVHD ngồi hội đồng chấm đề tài của mình: CHẶN. Hai hội đồng cùng phòng với thời gian chồng lấn: CHẶN lưu/công bố lịch theo [PDR-014](../decisions/PDR-014-chan-trung-phong-bao-ve.md). Một Giảng viên thuộc hai hội đồng chồng lấn giờ: CHẶN lưu/công bố theo [PDR-015](../decisions/PDR-015-chan-trung-lich-giang-vien-hoi-dong.md). Hủy lịch đã công bố theo [PDR-019](../decisions/PDR-019-huy-lich-bao-ve-da-cong-bo.md); thay Chủ tịch/Thư ký sau khi hội đồng có điểm bị chặn theo [PDR-020](../decisions/PDR-020-khoa-thay-thanh-vien-hoi-dong-sau-diem.md).
- Chỉ xóa được hội đồng Nháp; hội đồng đã công bố khóa nút Xóa. Giáo vụ được hủy lịch đã công bố trước điểm hội đồng, bắt buộc lý do/lịch sử/thông báo; sau điểm khóa Hủy thông thường (PDR-019). Không công bố khi đang sửa.
- Tên hội đồng do giáo vụ tự đặt.

## Kết quả
- **Vai trò:** Giáo vụ
- **Route gợi ý:** `/giao-vu/ket-qua`
- **Artboard:** `project/GiaoVu-KetQua.dc.html`
- **Mục đích:** Xác nhận điểm, công bố, xuất bảng điểm.

**Trạng thái và prop trên canvas**

- `view` (mặc định "Chờ xác nhận"): Chờ xác nhận · Xem chi tiết điểm · Popup xác nhận · Chờ công bố · Popup công bố · Hủy xác nhận · Chưa đủ điểm · Xuất bảng điểm

**Hành vi**

- Các tab theo trạng thái đề tài (2026-11-03, PDR-049): Đã cho điểm, Có lệch điểm, Đã xác nhận, Đã hoàn tất, Đang cho điểm. Xem điểm bằng **mở rộng inline** "Chi tiết/Thu gọn" giống tab Đề tài của Chi tiết đợt; đề tài Có lệch điểm không xác nhận được và có "Gửi thông báo" cho giảng viên trong cặp lệch; xác nhận, hủy xác nhận, công bố theo cả nhóm đề tài, từng đề tài hoặc theo lô; xuất bảng điểm Excel theo đợt.
- “Hủy xác nhận” là thao tác **Giáo vụ mở lại kết quả trước công bố** để sửa điểm: phải ghi lý do và lưu lịch sử; sau khi sửa phải xác nhận lại. Không mở lại bằng thao tác thông thường sau công bố (xem [PDR-005](../decisions/PDR-005-mo-lai-ket-qua-truoc-cong-bo.md)).

**Quy tắc nghiệp vụ**

- Điểm KLTN = (CT + TK + HD×2 + PB×2) / 6.
- Điểm tổng làm tròn số học lên hai chữ số tại mốc giữa, ví dụ `7,125 → 7,13` (xem [PDR-008](../decisions/PDR-008-lam-tron-diem-tong.md)).
- Nếu đến hạn mà nhóm chưa nộp bất kỳ bản khóa luận nào, kết quả chờ xử lý ngoại lệ và không tự động công bố hoặc đánh không đạt. Giáo vụ có thể mở hạn nộp bổ sung riêng cho nhóm, đặt hạn và ghi lý do/lịch sử theo [PDR-011](../decisions/PDR-011-tham-quyen-xu-ly-nhom-chua-nop-ban-khoa-luan.md). Nếu hết hạn bổ sung vẫn không nộp, Giáo vụ có thể kết thúc đề tài ở trạng thái riêng `Không đủ điều kiện công bố` kèm lý do; không hiển thị như điểm không đạt hoặc `Đã hoàn tất`.
- Đề tài đã kết thúc `Không đủ điều kiện công bố` không có nút mở lại/nộp/chấm tiếp thông thường; cách xử lý sai sót đặc biệt cần quyết định riêng theo PDR-011.
- Với nhóm có bản trong hạn bổ sung, nhóm tự chốt hoặc hệ thống chốt bản mới nhất khi hết hạn bổ sung; bản cuối đó được xét cùng các điều kiện xác nhận/công bố khác theo PDR-011.
- Giáo vụ xác nhận/công bố **theo cả nhóm đề tài**; công bố là đề tài Đã hoàn tất, không có bước "Đóng khóa luận" riêng (xem [PDR-049](../decisions/PDR-049-vong-doi-ket-qua-theo-nhom-de-tai.md), thay PDR-009).
- Với thao tác theo lô, xử lý các đề tài hợp lệ và hiển thị báo cáo từng đề tài thành công/bị bỏ qua kèm lý do; không báo toàn bộ thành công khi có đề tài bị bỏ qua (PDR-049, thay PDR-010).

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

- Cùng bố cục với GV-ThongBao; lỗi thiếu tiêu đề hoặc nội dung; danh sách đã gửi; xác nhận “Ẩn khỏi danh sách đã gửi của bạn”.

**Quy tắc nghiệp vụ**

- Đăng lên Bảng thông báo, tab Thông báo của đề tài và chuông.
- Xóa khỏi danh sách đã gửi chỉ tác động tới người gửi; người nhận vẫn xem được và lịch sử gửi được giữ theo [PDR-038](../decisions/PDR-038-an-thong-bao-da-gui-chi-voi-nguoi-gui.md).

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
- Nhóm nộp một phiên bản đề cương mới cho cả lần sửa, liên kết các yêu cầu đang mở; GVHD đóng từng yêu cầu riêng và chỉ duyệt khi không còn yêu cầu mở. Hạn nộp lại theo mốc Đề cương chung, không theo hạn riêng từng yêu cầu (xem [PDR-013](../decisions/PDR-013-yeu-cau-chinh-sua-de-cuong.md)).
- Chấm điểm: lỗi bỏ trống hạng mục; trạng thái "kết quả đã xác nhận, không sửa được".
- Với `gvRole` Chủ tịch hội đồng, hiện điểm CTHĐ và TKHĐ Thư ký đã nhập ở chế độ chỉ xem (PDR-050).
- Tab Điểm số: GV thấy điểm đã lưu của các vai trò khác.

**Quy tắc nghiệp vụ**

- KhongGianDeTai-GV và KhongGianDeTai cùng mã trên canvas; dựng thành một màn, quyền lấy từ vai trò của người xem.
- Sinh viên chỉ thấy điểm sau khi công bố.
