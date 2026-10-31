# PDR-006: Chủ tịch xác nhận điểm do Thư ký nhập hộ

## Trạng thái

Đã chấp nhận theo xác nhận trực tiếp của người dùng ngày 2026-10-28.

## Bối cảnh

Hội đồng có Chủ tịch và Thư ký. Thiết kế trước đây để Thư ký nhập cả hai điểm, Chủ tịch chỉ xem; trong khi kết quả của mỗi Sinh viên có một thành phần mang tên Chủ tịch. Cần bằng chứng Chủ tịch chấp thuận điểm gắn với mình trước khi Giáo vụ xác nhận kết quả.

## Quyết định

- Thư ký nhập điểm CTHĐ và TKHĐ cho **từng Sinh viên** trong các đề tài thuộc hội đồng được phân công.
- Chủ tịch xem và **xác nhận điểm CTHĐ của mình** do Thư ký nhập. Chủ tịch không trực tiếp nhập/sửa điểm qua thao tác này.
- Giáo vụ chỉ xác nhận kết quả của Sinh viên sau khi điểm CTHĐ của Sinh viên đó đã được Chủ tịch xác nhận, ngoài các điều kiện điểm khác. Kết quả được xử lý theo từng Sinh viên theo [PDR-009](PDR-009-ket-qua-theo-tung-sinh-vien.md).
- Xác nhận của Chủ tịch gắn với đúng phiên bản điểm CTHĐ; nếu điểm CTHĐ được sửa, xác nhận cũ không còn giá trị và Chủ tịch phải xác nhận lại. Lưu người nhập, người xác nhận và thời điểm để truy vết.
- Nếu không đồng ý, Chủ tịch **trả lại điểm CTHĐ kèm lý do**; Thư ký sửa và trình lại để Chủ tịch xác nhận. Khi đang bị trả lại, điểm CTHĐ chưa được coi là đã xác nhận và Giáo vụ không thể xác nhận kết quả của Sinh viên đó. Lưu người trả lại, lý do và các lần trình lại trong lịch sử.
- Điểm bị trả lại **không có hạn sửa riêng**. Mốc “Thời gian cho điểm” của đợt chỉ dùng để nhắc, không tự khóa phiếu; việc cần xử lý tiếp tục hiển thị cho đến khi Chủ tịch xác nhận. Giáo vụ vẫn chưa thể xác nhận kết quả khi điểm CTHĐ còn chờ.

Không tự coi việc Chủ tịch im lặng là đã xác nhận.

## Hệ quả

- Màn hội đồng của Chủ tịch cần trạng thái Chờ xác nhận/Đã trả lại/Đã xác nhận cho từng Sinh viên, thao tác trả lại có lý do và xác nhận điểm CTHĐ; quyền này được kiểm tra ở backend theo phân công hội đồng.
- Màn Giáo vụ phải hiển thị rõ trường hợp đủ bốn giá trị nhưng điểm CTHĐ còn chờ Chủ tịch xác nhận.
- Kiểm thử phải bao gồm Chủ tịch không đúng hội đồng, điểm bị sửa sau xác nhận, và kết quả Giáo vụ xác nhận khi còn thiếu xác nhận CTHĐ.
