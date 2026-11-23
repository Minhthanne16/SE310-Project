# PDR-068: Giảng viên gửi đề tài kèm Sinh viên giữ chỗ

## Trạng thái

Đã chấp nhận theo xác nhận trực tiếp của người dùng ngày 2026-11-23. Bổ sung [PDR-053](PDR-053-de-tai-giang-vien-va-cong-bo-danh-sach.md) và [PDR-054](PDR-054-ghi-danh-nhom-de-tai-cong-bo.md). Một số chi tiết triển khai còn mở ở [OQ-033](../OPEN_QUESTIONS.md).

## Bối cảnh

Sinh viên thường liên hệ Giảng viên trước để nhận đề tài. Hiện đề tài GV gửi chỉ được ghi danh sau khi công bố, nên Sinh viên đã thỏa thuận vẫn phải tranh chỗ với người khác.

## Quyết định

1. Khi thêm/sửa đề tài trong mốc "GV gửi đề tài", Giảng viên có vai trò Hướng dẫn ([PDR-070](PDR-070-vai-tro-giang-vien-trong-dot.md)) được nhập **mã Sinh viên** đã liên hệ trước, không vượt số Sinh viên tối đa của đợt ([PDR-069](PDR-069-so-sinh-vien-toi-da-moi-nhom.md)). Hệ thống hiện họ tên ngay để GV kiểm tra và báo lỗi khi mã không thuộc đợt, Sinh viên đã có nhóm/ghi danh/đề xuất đang hoạt động, hoặc đang được giữ chỗ ở đề tài khác.
2. Sinh viên được ghi tên **phải xác nhận**, bằng liên kết trong email hoặc ngay trong ứng dụng, trong thời gian đăng ký (mốc "Công bố đề tài · SV đăng ký").
3. Xác nhận thì Sinh viên vào nhóm của đề tài và giữ chỗ; đề tài có ít nhất một Sinh viên xác nhận thì là `Đã đăng ký`.
4. Từ chối, hoặc hết thời gian đăng ký mà chưa xác nhận, thì chỗ đó trả lại thành chỗ trống cho Sinh viên khác ghi danh; Giảng viên nhận thông báo. Người đã xác nhận vẫn giữ chỗ, chỗ còn lại (nếu có) mở cho người khác. Không ai xác nhận thì đề tài như đề tài thường.
5. Khi công bố, danh sách đề tài hiện số chỗ đã giữ và số chỗ còn trống.

## Hệ quả

- Cần bản ghi lời mời giữ chỗ (đề tài, Sinh viên, trạng thái chờ/đã xác nhận/từ chối/hết hạn, thời điểm, tác nhân) và lịch sử; tác vụ đóng đăng ký (PDR-064) chuyển lời mời chưa xác nhận sang hết hạn.
- Liên kết trong email phải có token dùng một lần, có hạn, và vẫn yêu cầu Sinh viên đăng nhập đúng tài khoản trước khi xác nhận.
- Kiểm thử: mã sai/khác đợt/đã có nhóm, vượt số tối đa, xác nhận qua email và trong ứng dụng, từ chối, hết hạn, một người xác nhận một người không, ghi danh vào chỗ trống còn lại, hai thao tác đồng thời trên cùng chỗ.
