# PDR-066: Lệch điểm so với điểm khóa luận có hệ số

## Trạng thái

Đã chấp nhận theo xác nhận trực tiếp của người dùng ngày 2026-11-23. Thay [PDR-007](PDR-007-canh-bao-lech-diem-bon-cap-cheo.md) (bốn cặp chéo, không chặn lưu). Sửa phần lệch điểm của [PDR-049](PDR-049-vong-doi-ket-qua-theo-nhom-de-tai.md) và quyền sửa điểm hội đồng của [PDR-050](PDR-050-bo-buoc-chu-tich-xac-nhan-diem.md).

## Bối cảnh

So bốn cặp chéo CTHĐ/TKHĐ với CBHD/CBPB không phản ánh đúng cách khoa xét lệch. Khoa xét từng điểm so với điểm khóa luận chung.

## Quyết định

1. **Cách tính:** với từng Sinh viên, khi đủ bốn điểm, lấy trung bình có hệ số của đợt (chính là Điểm KL theo [PDR-065](PDR-065-cau-hinh-diem-theo-dot.md), dùng giá trị chưa làm tròn). Một điểm thành phần bị **lệch** nếu `|điểm − Điểm KL| ≥ ngưỡng lệch` của đợt (mặc định 2,00). Cả bốn điểm CTHĐ, TKHĐ, CBHD, CBPB đều được so. Chưa đủ bốn điểm thì không xét lệch.

   Ví dụ hệ số 1 : 1 : 2 : 2, CBHD 8, CBPB 8, CTHĐ 5, TKHĐ 7: Điểm KL = 44/6 = 7,33. CTHĐ cách 2,33 nên lệch; TKHĐ cách 0,33, CBHD và CBPB cách 0,67, không lệch.
2. **Báo ngay trên phiếu trước khi lưu:** khi giá trị đang nhập làm Sinh viên đủ bốn điểm (hoặc sửa một phiếu khi đã đủ bốn điểm), phiếu hiện trước khi lưu điểm nào lệch và cách Điểm KL bao nhiêu. Luồng lý tưởng là HD, PB nhập trước rồi đến hội đồng, nên người thấy cảnh báo thường là Chủ tịch/Thư ký.
3. **Chặn lưu khi điểm đang nhập bị lệch:** nếu điểm của chính phiếu đang lưu bị lệch thì không lưu được, người nhập phải sửa. Backend kiểm tra lại khi lưu, không chỉ dựa vào giao diện.
4. **Điểm lệch của người khác:** nếu phiếu đang lưu không lệch nhưng làm lộ ra điểm lệch của người chấm khác (ví dụ GVHD nhập sau và CTHĐ lệch), phiếu vẫn lưu. Hệ thống gắn cờ lệch và tự gửi thông báo cho người có điểm lệch; lệch ở điểm hội đồng thì gửi **cả Chủ tịch và Thư ký**, và ai trong hai người cũng được sửa phiếu hội đồng.
5. **Trạng thái và xác nhận:** giữ PDR-049: đủ bốn điểm mà còn điểm lệch thì đề tài ở `Có lệch điểm`; Giáo vụ không xác nhận được nhóm cho đến khi hết lệch. Hết lệch thì về `Đã cho điểm`. Giáo vụ vẫn gửi nhắc thủ công được; người nhận là người có điểm lệch, không gửi Sinh viên.
6. **Quyền nhập điểm hội đồng:** Thư ký vẫn nhập CTHĐ và TKHĐ như PDR-050. Bổ sung: Chủ tịch được sửa phiếu hội đồng (CTHĐ và TKHĐ) của đề tài trong hội đồng mình; lịch sử ghi người sửa.

## Hệ quả

- Backend tính lệch từ điểm gốc và cấu hình của đợt, trả cùng kết quả cho phiếu, tab Đánh giá, trang Kết quả và Trang chủ.
- Kiểm thử: biên đúng bằng ngưỡng và dưới ngưỡng, hệ số khác mặc định, điểm đang nhập lệch (chặn), điểm người khác lệch (lưu, gắn cờ, thông báo đúng người), lệch ở hội đồng (thông báo cả CT và TK, cả hai sửa được), hết lệch sau khi sửa, lưu đồng thời hai phiếu.
