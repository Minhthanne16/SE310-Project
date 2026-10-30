# PDR-018: Sửa lịch đã công bố và đính chính sau khi có điểm

## Trạng thái

Đã chấp nhận theo xác nhận trực tiếp của người dùng ngày 2026-10-28.

## Bối cảnh

Lịch đã công bố có thể cần điều chỉnh để buổi bảo vệ diễn ra được. Khi đã phát sinh phiếu điểm, lịch gốc là một phần chứng cứ của quá trình chấm.

## Quyết định

- Sau công bố nhưng **trước khi có bất kỳ phiếu điểm nào của hội đồng liên quan**, Giáo vụ được sửa giờ, phòng hoặc hội đồng của lượt bảo vệ. Mỗi lần sửa phải có lý do, lưu lịch sử trước/sau, kiểm tra lại các xung đột và thông báo cho người bị ảnh hưởng. Lịch mới chỉ có hiệu lực khi vượt qua các kiểm tra.
- Từ khi **đã có phiếu điểm của hội đồng liên quan**, khóa sửa trực tiếp giờ và phòng của lịch đã công bố. Nếu thông tin lịch sai, Giáo vụ ghi **đính chính** kèm lý do; giữ lịch gốc và lịch sử, hiển thị rõ thông tin đính chính cho người có quyền xem. Đính chính không âm thầm thay lịch gốc.
- Khi đã có phiếu điểm, khóa thay Chủ tịch/Thư ký theo [PDR-020](PDR-020-khoa-thay-thanh-vien-hoi-dong-sau-diem.md). Hủy lịch đã công bố theo [PDR-019](PDR-019-huy-lich-bao-ve-da-cong-bo.md).

## Hệ quả

- Thao tác sửa trước khi có điểm cần kiểm tra đồng thời ở backend để không lọt lịch trùng khi nhiều Giáo vụ cùng sửa.
- Kiểm thử sửa trước điểm có lý do/thông báo, sửa gây xung đột bị từ chối, sửa sau điểm bị chặn, đính chính giữ nguyên lịch gốc và ghi người thực hiện/thời điểm/lý do.
