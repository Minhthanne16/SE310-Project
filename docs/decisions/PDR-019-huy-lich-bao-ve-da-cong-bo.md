# PDR-019: Hủy lịch bảo vệ đã công bố trước khi có điểm

## Trạng thái

Đã chấp nhận theo xác nhận trực tiếp của người dùng ngày 2026-10-28.

## Bối cảnh

Lịch đã công bố có thể cần hủy vì buổi bảo vệ không thể diễn ra. Xóa lịch đã gửi cho Sinh viên/Giảng viên sẽ làm mất dấu vết; hủy sau khi hội đồng có phiếu điểm có thể khiến phiếu không còn ngữ cảnh.

## Quyết định

- Giáo vụ được **hủy lịch bảo vệ đã công bố trước khi hội đồng liên quan có bất kỳ phiếu điểm nào**. Bắt buộc ghi lý do, người/thời điểm hủy, giữ lịch sử lịch đã công bố và thông báo cho những người bị ảnh hưởng.
- Khi hội đồng liên quan **đã có phiếu điểm**, khóa hủy lịch bằng thao tác thông thường. Sai sót thông tin lịch được xử lý bằng đính chính theo [PDR-018](PDR-018-sua-lich-da-cong-bo-va-dinh-chinh.md); trường hợp cần xử lý khác phải có quyết định ngoại lệ riêng.
- Không xóa vật lý lịch hoặc hội đồng đã công bố. Lịch bị hủy không còn là lượt có hiệu lực hay lịch sắp diễn ra, nhưng vẫn xem được trong lịch sử theo quyền. Nếu xếp lại, chỉ được có một hội đồng/lượt có hiệu lực cho mỗi đề tài theo [PDR-016](PDR-016-mot-luot-bao-ve-co-hieu-luc-moi-de-tai.md).

## Hệ quả

- Backend phải kiểm tra trạng thái điểm tại thời điểm hủy; từ chối thao tác hủy lặp hoặc hủy khi điểm vừa phát sinh, không gửi thông báo hủy trùng.
- Kiểm thử hủy trước điểm có lý do/thông báo/lịch sử, hủy sau điểm bị chặn, xếp lại không tạo hai lượt có hiệu lực và quyền xem lịch đã hủy.
