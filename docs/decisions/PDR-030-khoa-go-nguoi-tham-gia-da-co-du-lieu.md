# PDR-030: Khóa gỡ người tham gia đã có dữ liệu nghiệp vụ trong đợt

## Trạng thái

Đã chấp nhận theo xác nhận trực tiếp của người dùng ngày 2026-10-28.

## Bối cảnh

DESIGN từng khóa gỡ Sinh viên có dữ liệu nhưng vẫn cho gỡ Giảng viên. Nếu Giảng viên đã gắn đề tài, phân công hoặc phiếu điểm mà bị gỡ khỏi đợt, quyền và lịch sử chấm có thể không còn nhất quán.

## Quyết định

- Giáo vụ **không được gỡ Sinh viên hoặc Giảng viên khỏi đợt bằng thao tác thông thường** khi người đó đã có dữ liệu nghiệp vụ liên quan trong đợt.
- Dữ liệu liên quan gồm, theo vai trò, nhóm/đăng ký/đề tài/bài nộp/kết quả của Sinh viên hoặc đề tài hướng dẫn, phân công phản biện, thành viên hội đồng, nhận xét/phiếu điểm của Giảng viên. Backend kiểm tra các tham chiếu này tại thời điểm gỡ; thông báo đơn thuần không phải căn cứ duy nhất để khóa gỡ.
- Người chưa có dữ liệu nghiệp vụ liên quan có thể được gỡ theo quyền Giáo vụ; ghi lịch sử người/thời điểm gỡ. Gỡ người khỏi danh sách tham gia không xóa tài khoản hoặc lịch sử các đợt khác.
- Nếu người đã có dữ liệu không thể tiếp tục tham gia, cần xử lý bằng luồng nghiệp vụ phù hợp với đề tài/phân công/điểm và quyết định riêng, không vượt qua ràng buộc bằng cách xóa liên kết tham gia.

## Hệ quả

- UI hiển thị lý do khóa gỡ cho cả hai vai trò; backend kiểm tra cả thao tác đơn lẻ, hàng loạt và thao tác đồng thời với phát sinh dữ liệu.
- Kiểm thử gỡ người chưa có dữ liệu, Sinh viên đã có nhóm/đề tài, Giảng viên đã hướng dẫn/phản biện/ngồi hội đồng/chấm điểm và trường hợp chỉ có thông báo.
