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
- Ghi chú triển khai frontend (`/ho-so`): quyền tự sửa họ tên đã chốt tại PDR-036, áp dụng cùng các trường ngày sinh, SĐT, email phụ, ảnh đại diện; mã, email, vai trò, đơn vị vẫn chỉ xem tại hồ sơ. Backend chưa có API hồ sơ nên sửa hồ sơ, ảnh đại diện, hoạt động đăng nhập chạy trên kho demo trong bộ nhớ; đổi mật khẩu là stub (501). Endpoint đề xuất: `GET /api/profile`, `PUT /api/profile`, `PUT /api/profile/avatar`, `POST /api/auth/change-password`. Ảnh JPG/PNG/WebP tối đa 2 MB đã chốt theo [PDR-043](../decisions/PDR-043-gioi-han-anh-dai-dien.md).

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

- Hội đồng hai người: chủ tịch và thư ký. Thư ký nhập điểm hội đồng; Chủ tịch xem và xác nhận điểm CTHĐ của từng Sinh viên trước khi Giáo vụ xác nhận kết quả. Chủ tịch có thể trả lại kèm lý do để Thư ký sửa và trình lại. Cần bổ sung trạng thái Chờ xác nhận/Đã trả lại/Đã xác nhận vào màn này theo [PDR-006](../decisions/PDR-006-xac-nhan-diem-chu-tich-hoi-dong.md).
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
- Tạo đợt mới (lỗi thiếu thông tin, trùng tên đợt), Sao chép từ đợt cũ, Mở đợt (hộp xác nhận, gửi thông báo, cảnh báo việc chưa xong nhưng vẫn cho mở), Xóa đợt.
- Bấm một đợt mở chi tiết đợt.

**Quy tắc nghiệp vụ**

- Chỉ xóa được đợt Nháp.
- Đợt Nháp ẩn với GV và SV.
- Tên chương trình thạc sĩ ghi "Thạc sĩ · Đợt 1/2026".
- Ghi chú triển khai frontend (`/giao-vu/dot`): chạy trên kho demo trong bộ nhớ, chờ endpoint đề xuất `GET/POST /api/rounds`, `POST /api/rounds/{id}/open`, `DELETE /api/rounds/{id}`. "Sao chép từ đợt cũ" phải theo [PDR-034](../decisions/PDR-034-sao-chep-khung-cau-hinh-dot.md): tạo đợt Nháp chỉ có khung chín mốc và cờ "Cho nộp trễ"; không mang ngày/giờ, danh sách người, mẫu phiếu hay dữ liệu nghiệp vụ của đợt nguồn.

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
- Cấu hình: 9 mốc, kiểm tra thứ tự mốc (trạng thái "Có mốc sai thứ tự"); cột "Thông báo cho" chọn được; công tắc "Cho nộp trễ" và hạn trễ riêng cho từng mốc Đề cương, Giữa kỳ, Cuối kỳ theo PDR-041.
- Thêm giảng viên và sinh viên (chọn trong danh sách hoặc nhập mã, có bước kiểm tra), gỡ khỏi đợt, Kết thúc đợt, Xóa đợt.

**Quy tắc nghiệp vụ**

- Một Sinh viên chỉ thuộc một đợt `Đang diễn ra`; thêm vào đợt đang diễn ra hoặc mở đợt Nháp có người trùng phải bị chặn và chỉ rõ người/đợt xung đột (xem [PDR-029](../decisions/PDR-029-mot-sinh-vien-mot-dot-dang-dien-ra.md)).
- Mở đợt chỉ khi đủ chín mốc với thời gian đầu/cuối và thứ tự hợp lệ; thiếu hoặc sai mốc phải CHẶN, hiển thị mốc/lỗi để Giáo vụ sửa (xem [PDR-032](../decisions/PDR-032-du-chin-moc-hop-le-truoc-khi-mo-dot.md)).
- Nếu đã đủ mốc nhưng danh sách Sinh viên/Giảng viên còn trống, cảnh báo vai trò thiếu và vẫn cho Giáo vụ mở đợt; người tham gia có thể được thêm sau (xem [PDR-033](../decisions/PDR-033-mo-dot-duoc-khi-chua-co-nguoi-tham-gia.md)).
- CSDL: `period_milestones.allow_late` mặc định TRUE.
- Kết thúc đợt khi còn bất kỳ đề tài nào chưa ở `Đã hoàn tất` hoặc `Không đủ điều kiện công bố`: CHẶN và hiển thị đề tài/trạng thái cần xử lý, không chỉ cảnh báo (xem [PDR-031](../decisions/PDR-031-chi-ket-thuc-dot-khi-moi-de-tai-ket-thuc.md)).
- Sinh viên hoặc Giảng viên đã có dữ liệu nghiệp vụ liên quan trong đợt đều không gỡ được bằng thao tác thông thường; người chưa có dữ liệu được gỡ có lịch sử. Thông báo đơn thuần không khóa gỡ (xem [PDR-030](../decisions/PDR-030-khoa-go-nguoi-tham-gia-da-co-du-lieu.md)).
- Ghi chú triển khai frontend (`/giao-vu/dot/[id]`): chạy trên kho demo, chờ endpoint đề xuất `POST /api/rounds/{id}/finish`, `PUT /api/rounds/{id}/milestones`, `POST|DELETE /api/rounds/{id}/lecturers|students`. "Cho nộp trễ" hiện chỉ lưu công tắc `allow_late`; cần bổ sung hạn trễ riêng từng mốc theo PDR-041 trước khi dùng thật. Kiểm tra thứ tự mốc: mỗi mốc bắt đầu ≤ kết thúc và ngày bắt đầu không giảm theo thứ tự 9 mốc. Khóa gỡ "có dữ liệu nghiệp vụ" tính theo từng đợt và áp dụng cho cả Sinh viên lẫn Giảng viên theo PDR-030; đợt sao chép không mang theo người/dữ liệu nên không có trạng thái khóa gỡ của đợt nguồn theo PDR-034. Thêm Sinh viên vào đợt Nháp được phép chuẩn bị danh sách; quy tắc "một đợt đang diễn ra" kiểm khi thêm vào đợt đang diễn ra và khi mở đợt (không mở được nếu Sinh viên đang ở đợt đang diễn ra khác) theo PDR-029. Mở đợt phải đủ chín mốc hợp lệ theo PDR-032 và hạn trễ hợp lệ cho mốc bật nộp trễ theo PDR-041; thiếu người chỉ cảnh báo và vẫn cho mở theo PDR-033. Tab Giảng viên/Sinh viên và cấu hình chỉ xem được khi đợt đã kết thúc.

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

- Mốc “Thời gian cho điểm” chỉ nhắc, không tự khóa phiếu; điểm chấm riêng từng Sinh viên (cột Điểm SV1, SV2). Sau khi Giáo vụ xác nhận kết quả của Sinh viên, điểm của Sinh viên đó bị khóa; trước công bố chỉ sửa qua luồng mở lại có lý do theo [PDR-005](../decisions/PDR-005-mo-lai-ket-qua-truoc-cong-bo.md).

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

- Các tab: Chờ xác nhận, Chờ công bố, Đã công bố, Chưa đủ điểm; xem chi tiết điểm từng người chấm (cờ lệch điểm); xác nhận theo lô, hủy xác nhận, công bố, xuất bảng điểm Excel theo đợt.
- “Hủy xác nhận” là thao tác **Giáo vụ mở lại kết quả trước công bố** để sửa điểm: phải ghi lý do và lưu lịch sử; sau khi sửa phải xác nhận lại. Không mở lại bằng thao tác thông thường sau công bố (xem [PDR-005](../decisions/PDR-005-mo-lai-ket-qua-truoc-cong-bo.md)).

**Quy tắc nghiệp vụ**

- Điểm KLTN = (CT + TK + HD×2 + PB×2) / 6.
- Điểm tổng làm tròn số học lên hai chữ số tại mốc giữa, ví dụ `7,125 → 7,13` (xem [PDR-008](../decisions/PDR-008-lam-tron-diem-tong.md)).
- Nếu đến hạn mà nhóm chưa nộp bất kỳ bản khóa luận nào, kết quả chờ xử lý ngoại lệ và không tự động công bố hoặc đánh không đạt. Giáo vụ có thể mở hạn nộp bổ sung riêng cho nhóm, đặt hạn và ghi lý do/lịch sử theo [PDR-011](../decisions/PDR-011-tham-quyen-xu-ly-nhom-chua-nop-ban-khoa-luan.md). Nếu hết hạn bổ sung vẫn không nộp, Giáo vụ có thể kết thúc đề tài ở trạng thái riêng `Không đủ điều kiện công bố` kèm lý do; không hiển thị như điểm không đạt hoặc `Đã hoàn tất`.
- Đề tài đã kết thúc `Không đủ điều kiện công bố` không có nút mở lại/nộp/chấm tiếp thông thường; cách xử lý sai sót đặc biệt cần quyết định riêng theo PDR-011.
- Với nhóm có bản trong hạn bổ sung, nhóm tự chốt hoặc hệ thống chốt bản mới nhất khi hết hạn bổ sung; bản cuối đó được xét cùng các điều kiện xác nhận/công bố khác theo PDR-011.
- Giáo vụ xác nhận/công bố **theo từng Sinh viên**; đề tài chỉ Đã hoàn tất khi mọi thành viên đã công bố và điều kiện bản cuối được đáp ứng. Không có bước "Đóng khóa luận" riêng (xem [PDR-009](../decisions/PDR-009-ket-qua-theo-tung-sinh-vien.md)).
- Với thao tác theo lô, xử lý các Sinh viên đủ điều kiện và hiển thị báo cáo từng người thành công/bị bỏ qua kèm lý do; không báo toàn bộ thành công khi có người bị bỏ qua (xem [PDR-010](../decisions/PDR-010-xu-ly-ket-qua-theo-lo.md)).

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
- Với `gvRole` Chủ tịch hội đồng, hiện điểm CTHĐ Thư ký đã nhập và thao tác xác nhận hoặc trả lại kèm lý do cho từng Sinh viên; Thư ký sửa điểm bị trả lại rồi trình lại, nếu điểm bị sửa thì yêu cầu xác nhận lại theo PDR-006.
- Tab Điểm số: GV thấy điểm đã lưu của các vai trò khác.

**Quy tắc nghiệp vụ**

- KhongGianDeTai-GV và KhongGianDeTai cùng mã trên canvas; dựng thành một màn, quyền lấy từ vai trò của người xem.
- Sinh viên chỉ thấy điểm sau khi công bố.
