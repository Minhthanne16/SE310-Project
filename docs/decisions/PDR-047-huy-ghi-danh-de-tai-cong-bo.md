# PDR-047: Hủy ghi danh đề tài công bố và giữ nguyên nhóm

## Trạng thái

Đã chấp nhận theo các xác nhận trực tiếp của người dùng ngày 2026-10-28; đóng OQ-018.

## Bối cảnh

BUSINESS_RULES nêu đề tài công bố quay lại `Chưa đăng ký` khi nhóm hủy ghi danh; DESIGN có nút hủy khi “mới ghi danh”, nhưng chưa xác định điều kiện, người thao tác và số phận nhóm sau hủy.

## Quyết định

- Một nhóm đã ghi danh đề tài công bố chỉ được hủy khi **đợt còn mở đăng ký và nhóm chưa nộp đề cương**. Khi điều kiện không còn đúng, thao tác hủy thông thường bị chặn với lý do rõ.
- **Bất kỳ thành viên nào** trong nhóm 1–2 Sinh viên đều được thực hiện hủy ghi danh. Hộp xác nhận phải cho biết việc hủy áp dụng cho cả nhóm và trả đề tài về danh sách chưa đăng ký.
- Sau hủy, đề tài công bố trở lại `Chưa đăng ký`; nhóm giữ nguyên thành viên và đại diện, không bị giải tán. Nhóm có thể ghi danh lại đề tài còn trống trong đợt khi cửa sổ đăng ký vẫn mở và đáp ứng quy tắc hiện hành.
- Lần ghi danh đã hủy được giữ trong lịch sử với nhóm, đề tài, thành viên thực hiện và thời điểm; không xóa bản ghi để “giải phóng” nhóm. Hai thao tác hủy/ghi danh tranh chấp phải giữ bất biến một nhóm không nhận hai đề tài và một đề tài không có hai nhóm.

## Hệ quả

- Màn hình của cả hai thành viên cùng phản ánh trạng thái nhóm và đề tài sau khi hủy; lịch sử vẫn cho người có quyền tra cứu được lần ghi danh cũ.
- Kiểm thử nhóm 1/2 Sinh viên, thành viên không phải đại diện hủy, đúng/sau hạn đăng ký, trước/sau khi nộp đề cương, hai thao tác hủy đồng thời và ghi danh lại bằng cùng nhóm.
