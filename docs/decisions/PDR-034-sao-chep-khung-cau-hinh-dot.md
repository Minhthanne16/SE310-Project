# PDR-034: Sao chép chỉ khung cấu hình để tạo đợt mới

## Trạng thái

Đã chấp nhận theo xác nhận trực tiếp của người dùng ngày 2026-10-28.

## Bối cảnh

Sao chép nguyên đợt cũ có thể mang theo ngày đã qua, người tham gia, đề tài, phân công, điểm và lịch sử sang kỳ mới, làm sai dữ liệu và quyền của đợt mới.

## Quyết định

- Sao chép đợt tạo **một đợt `Nháp` mới** với **khung chín mốc** và các giá trị cấu hình **“Cho nộp trễ”** của từng mốc từ đợt nguồn.
- Không sao chép ngày/giờ cụ thể của các mốc hoặc hạn nộp trễ. Giáo vụ phải nhập lại thời gian hợp lệ trước khi mở đợt theo [PDR-032](PDR-032-du-chin-moc-hop-le-truoc-khi-mo-dot.md) và [PDR-041](PDR-041-han-nop-tre-rieng-tung-moc.md).
- Không sao chép Sinh viên, Giảng viên, gán mẫu phiếu, đề tài, nhóm, phân công, hội đồng/lịch, bài nộp, phiếu điểm, kết quả, thông báo hoặc lịch sử nghiệp vụ của đợt nguồn. Các dữ liệu này được tạo/gán riêng ở đợt mới theo quy tắc hiện hành.
- Đợt nguồn và lịch sử của nó không đổi. Đợt mới lưu liên kết nguồn sao chép để Giáo vụ truy vết thao tác tạo đợt.

## Hệ quả

- UI xem trước rõ trường được sao chép và trường cần nhập mới; đợt mới không tự mở.
- Kiểm thử nguồn Nháp/Đang diễn ra/Đã kết thúc, ngày nguồn đã qua, người/đề tài/điểm có sẵn, và kiểm tra không rò dữ liệu sang đợt mới.
