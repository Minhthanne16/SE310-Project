# PDR-048: Công bố đề tài ở Chi tiết đợt

## Trạng thái

Đã chấp nhận theo xác nhận trực tiếp của người dùng ngày 2026-11-03; cập nhật điều kiện công bố và khóa thao tác theo quyết định ngày 2026-11-18 (OQ-025(c)).

## Bối cảnh

"Đóng & công bố danh sách" và "Xuất danh sách" nằm ở trang Đề tài, tách khỏi mốc và tiến độ của đợt. Việc công bố bị chặn theo hạn nộp đề tài, và danh sách chưa có trạng thái cho đề tài không được công bố hay không có nhóm.

## Quyết định

1. Công bố và xuất danh sách chuyển sang Chi tiết đợt, tab Đề tài. Trang Đề tài chỉ hiện dòng trạng thái công bố và liên kết `/giao-vu/dot/{id}?tab=de-tai`; không còn xuất ở đó.
2. Giảng viên được thêm/sửa/xóa đề tài từ ngày bắt đầu đến hết 23:59 ngày kết thúc mốc "GV gửi đề tài" (giờ Việt Nam). Hết mốc này, khóa cả ba thao tác ngay cả khi danh sách chưa công bố. Giáo vụ chỉ được **công bố thủ công sau khi hết mốc GV gửi đề tài**; không có công bố sớm. Điều kiện công bố còn lại: đợt Đang chạy, có ít nhất 1 đề tài, chưa công bố, chưa qua ngày kết thúc mốc "Công bố đề tài · SV đăng ký". Công bố không hoàn tác; sau công bố đề tài GV chỉ xem, không thêm/sửa/xóa, Sinh viên được đăng ký theo mốc riêng. Hộp thoại hiện số ngày còn lại đến 23:59 ngày kết thúc đăng ký; còn 0 ngày thì chặn và gợi ý mở tab Cấu hình. Cảnh báo thiếu giảng viên tối thiểu được giữ.
3. Đăng ký tự đóng khi hết mốc đăng ký đề tài; đề tài đã công bố nhưng chưa có nhóm chuyển sang `Không có nhóm`.
   Đóng hạn còn chặn GV gửi đề tài mới kể cả khi chưa công bố và tự hủy đề xuất `Chờ GV duyệt`; thay đổi trạng thái được lưu CSDL kèm lịch sử theo [PDR-064](PDR-064-dong-dang-ky-va-luu-trang-thai-het-han.md). Không tự kết thúc toàn bộ đợt khóa luận.
4. Thêm trạng thái đề tài `Không đủ điều kiện công bố` và `Không có nhóm` (chip, bộ lọc, dữ liệu mẫu).
5. Kết thúc đợt bị chặn khi còn đề tài chưa ở trạng thái kết thúc (`Đã hoàn tất`, `Không đủ điều kiện công bố`, `Không có nhóm`); `Bị từ chối` không tính là chưa kết thúc. Mở rộng PDR-031.
6. Tách `unpublishedCount` thành `Round.topicsPublishedAt` và `topicSummary.pendingResultCount`.
7. Đợt đang chạy hiện chip giai đoạn "Giai đoạn: …" suy ra từ mốc.
9. Xuất Excel bằng `exceljs` (nạp động), hai danh sách, chống chèn công thức.

## Hệ quả

- Backend lưu `TopicsPublishedAt` và có `POST /rounds/{id}/topics/publish`; API người tham gia nhận mã hoặc email và trả `email`, `accountStatus`.
- Kiểm thử chặn công bố trước/khi chưa hết hạn GV gửi đề tài; khóa thêm/sửa/xóa tại hạn GV gửi và sau công bố; cho công bố thủ công trong cửa sổ sau hạn GV gửi và trước hạn đăng ký; chặn công bố khi hết hạn đăng ký, đợt không có đề tài, công bố lặp và chặn kết thúc đợt.
