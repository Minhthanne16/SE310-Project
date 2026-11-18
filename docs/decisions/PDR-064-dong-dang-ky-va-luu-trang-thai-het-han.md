# PDR-064: Đóng đăng ký, hủy đề xuất chờ và lưu trạng thái khi hết hạn

## Trạng thái

Đã chấp nhận theo xác nhận trực tiếp của người dùng ngày 2026-11-18; đóng OQ-028, OQ-029 và OQ-030. Bổ sung [PDR-012](PDR-012-huy-de-xuat-dang-cho-giang-vien.md), [PDR-048](PDR-048-cong-bo-de-tai-o-chi-tiet-dot.md), [PDR-049](PDR-049-vong-doi-ket-qua-theo-nhom-de-tai.md) và thay quy tắc tương ứng trong [PDR-053](PDR-053-de-tai-giang-vien-va-cong-bo-danh-sach.md).

## Quyết định

1. **Hết hạn đăng ký là đóng cửa sổ đăng ký đề tài**, tại cuối ngày kết thúc mốc "Công bố đề tài · SV đăng ký" (23:59 theo giờ Việt Nam, theo PDR-054). Từ thời điểm đóng, không nhận ghi danh hay đề xuất mới của Sinh viên. Giảng viên đã bị khóa thêm/sửa/xóa ngay khi hết mốc "GV gửi đề tài", kể cả khi Giáo vụ chưa công bố danh sách (PDR-048/053). Hết cửa sổ đăng ký không tự kết thúc toàn bộ đợt khóa luận; việc kết thúc đợt vẫn theo PDR-031/048.
2. **Đề xuất còn `Chờ GV duyệt` được hệ thống tự hủy thành `Đã hủy` khi đóng đăng ký**, không chờ Giảng viên quyết định. Đề xuất rời danh sách đang chờ và không thể được duyệt/từ chối sau khi đóng. Giữ bản ghi, nhóm, thành viên, đại diện và lịch sử. Sự kiện hủy ghi tác nhân `Hệ thống`, thời điểm và lý do `Hết hạn đăng ký đề tài`. Trong thời gian đăng ký, hủy thủ công vẫn theo PDR-012.
3. **Lưu chuyển trạng thái thực tế trong CSDL và lịch sử thay đổi** khi hết hạn. Đề tài có nhóm đăng ký hợp lệ ở `Đã đăng ký` chuyển thành `Đang thực hiện` dù chưa nộp hoặc chưa được duyệt đề cương (OQ-025(d)); đề tài không có nhóm ở `Chưa đăng ký` chuyển thành `Không có nhóm` theo PDR-049. Việc nộp/duyệt đề cương không gây chuyển trạng thái đề tài. Mỗi chuyển trạng thái ghi giá trị cũ/mới, thời điểm, tác nhân `Hệ thống` và lý do hết hạn. Đề xuất chờ được hủy theo mục 2. Không thay đổi trạng thái do việc đọc danh sách/chi tiết.
4. **Thực thi tự động và chống đua:** tác vụ nền kiểm tra các đợt đã đến hạn, kể cả khi không có người truy cập. Tại ranh giới hết hạn, backend đồng thời kiểm tra hạn và trạng thái hiện tại trước mọi thao tác tạo/gửi, ghi danh, đề xuất, duyệt/từ chối/hủy để không phát sinh kết quả quá hạn trong lúc tác vụ đang chạy. Các cập nhật trạng thái và lịch sử liên quan phải nhất quán trong transaction. Chạy lại tác vụ hoặc nhiều worker đồng thời không tạo chuyển trạng thái/lịch sử trùng. Nếu thao tác của người dùng và tác vụ đóng hạn cạnh tranh, chỉ thao tác hợp lệ hoàn tất trước ranh giới hạn mới có thể thành công.
5. **Đợt chưa công bố khi hết hạn:** không được thêm/sửa/xóa đề tài kể từ khi hết mốc GV gửi và không được công bố muộn sau hạn đăng ký theo PDR-048. Giáo vụ có thể công bố thủ công trong khoảng giữa hai hạn này. Đợt tiếp tục chịu các điều kiện vận hành/kết thúc đã chốt. Cách xử lý nghiệp vụ đặc biệt để mở lại mốc hoặc khắc phục đợt lỡ công bố chưa được người dùng quyết định trong PDR này.

## Hệ quả và kiểm thử cần bổ sung

- Backend phải có cơ chế chạy đóng hạn độc lập với truy vấn và lưu bản ghi/lịch sử trong CSDL. Các endpoint phải trả lỗi xung đột khi có thao tác không hợp lệ do quá hạn, kể cả khi client giữ dữ liệu cũ.
- Kiểm thử ranh giới 23:59 giờ Việt Nam cho cả hạn GV gửi và hạn đăng ký, không người truy cập, tác vụ lặp, nhiều worker, duyệt/hủy cạnh tranh với tác vụ, khóa thêm/sửa/xóa đề tài khi chưa công bố nhưng đã hết hạn GV gửi, và lịch sử sau khi tải lại.
- Đây là quyết định nghiệp vụ và yêu cầu triển khai; **chưa xác nhận code hiện tại đã thực thi đúng**. Nghiệm thu G2/G3 và CP00 cần kiểm tra bằng test API/DB riêng.
