# PDR-012: Hủy đề xuất khi còn chờ Giảng viên duyệt

## Trạng thái

Đã chấp nhận theo các xác nhận trực tiếp của người dùng ngày 2026-10-28; đóng OQ-001.

## Bối cảnh

Thiết kế trước đây nói đơn chờ bị hủy sẽ biến khỏi danh sách và không có trạng thái `Đã hủy`, trong khi yêu cầu truy vết cần giữ thay đổi quan trọng. Cần tách việc ẩn khỏi danh sách chờ với việc lưu bản ghi nghiệp vụ.

## Quyết định

- Nhóm chỉ được hủy **đề xuất đang ở trạng thái `Chờ GV duyệt`**. Sau khi Giảng viên đã chấp nhận hoặc từ chối, thao tác hủy đề xuất này không còn áp dụng.
- Đề xuất bị hủy được **giữ bản ghi với trạng thái `Đã hủy`** trong lịch sử, gồm người hủy và thời điểm. Trạng thái này thuộc vòng đời **đề xuất**, không tự thêm nhánh vào chuỗi trạng thái chính của đề tài đã đăng ký.
- Đề xuất `Đã hủy` rời danh sách chờ xử lý của Giảng viên và danh sách đơn đang hoạt động của nhóm; người có quyền vẫn tra cứu được trong lịch sử. Không xóa vật lý để làm đơn “biến mất”.
- Sau khi hủy, nhóm được **tạo đề xuất mới ngay nếu đợt còn mở đăng ký** và các thành viên không có đăng ký/đề xuất khác đang hoạt động trong đợt. Đề xuất cũ `Đã hủy` không tự biến thành đề xuất mới; hai lần gửi có lịch sử riêng.
- **Giữ nguyên nhóm** sau khi hủy đề xuất, gồm thành viên và đại diện. Khi đề xuất lại, nhóm dùng chính nhóm đó; không tự tạo một nhóm hoạt động thứ hai. Đề xuất cũ vẫn giữ ảnh chụp thành viên trong lịch sử.

## Hệ quả

- Hành vi hủy phải kiểm tra trạng thái hiện tại ở backend để tránh cuộc đua giữa thao tác hủy của nhóm và thao tác chấp nhận/từ chối của Giảng viên.
- Test hủy khi đang chờ, hủy lặp, hủy sau quyết định của Giảng viên và đọc lịch sử theo quyền.
- Test nhóm vẫn có cùng thành viên/đại diện sau khi hủy, đề xuất lại dùng đúng nhóm và không sinh nhóm trùng trong cùng đợt.
