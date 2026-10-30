# Đặc tả cấp dự án — QLKLTN

## Mục tiêu

QLKLTN là hệ thống web quản lý quy trình khóa luận tốt nghiệp trong phạm vi một Khoa: từ mở đợt và đăng ký đề tài đến nộp tài liệu, tổ chức bảo vệ, chấm điểm và công bố kết quả. Hệ thống thay thế việc theo dõi phân tán bằng email và bảng tính bằng dữ liệu tập trung, có lịch sử xử lý.

## Người dùng

- **Sinh viên:** đăng ký hoặc đề xuất đề tài, thực hiện và nộp khóa luận, theo dõi nhận xét, lịch bảo vệ và kết quả cá nhân.
- **Giảng viên:** công bố đề tài, hướng dẫn, duyệt đề cương, phản biện hoặc tham gia hội đồng theo phân công, chấm điểm và gửi thông báo.
- **Giáo vụ:** đại diện Khoa vận hành đợt khóa luận, quản lý người dùng/mẫu phiếu, phân công, tổ chức hội đồng, xác nhận và công bố kết quả.

Quyền và trách nhiệm chi tiết nằm trong [product/ROLES.md](product/ROLES.md).

## Phạm vi hiện tại

1. Quản lý đợt khóa luận, đề tài, nhóm sinh viên và lịch sử thay đổi.
2. Quản lý đề cương, bản khóa luận, nhận xét và các phiên bản nộp.
3. Phân công phản biện, hội đồng, lịch bảo vệ và mẫu đánh giá.
4. Nhập, kiểm tra, xác nhận và công bố kết quả theo từng sinh viên.
5. Thông báo và truy vết các thay đổi nghiệp vụ quan trọng.

Không thuộc phạm vi hiện tại: triển khai lại giao diện, API, cơ sở dữ liệu hay chuyển dữ liệu từ sản phẩm mẫu. Những việc đó chỉ bắt đầu sau khi từng phần yêu cầu đã đủ rõ.

## Vòng đời đề tài

`Chưa đăng ký` hoặc `Chờ GV duyệt` → `Đã đăng ký` → `Đang thực hiện` → `Đã cho điểm` → `Đã hoàn tất`.

Nhánh ngoại lệ: từ `Đang thực hiện` hoặc `Đã cho điểm`, nếu không có bản khóa luận nào sau hạn bổ sung và Giáo vụ quyết định kết thúc có lý do, đề tài chuyển sang trạng thái kết thúc riêng `Không đủ điều kiện công bố`; nhánh này không phải `Đã hoàn tất` sau công bố điểm (xem [PDR-011](decisions/PDR-011-tham-quyen-xu-ly-nhom-chua-nop-ban-khoa-luan.md)).
Trạng thái `Không đủ điều kiện công bố` không mở lại bằng thao tác thông thường; sai sót đặc biệt cần quyết định riêng trước khi có chức năng xử lý.

`Bị từ chối` là kết quả của đề tài do sinh viên đề xuất. Các quy tắc chuyển trạng thái, bao gồm hủy đăng ký/đề xuất, nằm trong [requirements/BUSINESS_RULES.md](requirements/BUSINESS_RULES.md); điểm chưa đủ căn cứ nằm trong `OPEN_QUESTIONS.md`.

Riêng **đề xuất** đang `Chờ GV duyệt` có thể được nhóm hủy; bản ghi đề xuất chuyển `Đã hủy` và còn trong lịch sử, không được tính là trạng thái đề tài đã đăng ký (xem [PDR-012](decisions/PDR-012-huy-de-xuat-dang-cho-giang-vien.md)).

## Nguyên tắc làm việc

- Tài liệu trong `docs/` là cơ sở sản phẩm trước khi phát triển; không tự suy ra nghiệp vụ từ tên file, giao diện mẫu hoặc mã CRUD sản phẩm cũ.
- Thay đổi yêu cầu rõ ràng phải cập nhật tài liệu liên quan cùng thay đổi mã.
- Nội dung chưa chốt không được hiện thực như một quy tắc ngầm; phải được trả lời hoặc có quyết định ghi nhận trước.
- Không coi kiến trúc hoặc công nghệ mô tả trong báo cáo là quyết định triển khai mới nếu chưa đối chiếu mã nguồn và quyết định hiện hành của repo.
