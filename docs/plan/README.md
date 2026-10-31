# Kế hoạch hoàn thiện QLKLTN

## Cách dùng

Đây là lộ trình **đề xuất**, không phải quyết định thay thế yêu cầu. Mỗi phase có bước, công việc, tiêu chí nghiệm thu, cách kiểm chứng và phụ thuộc theo cấu trúc tham khảo. `REVIEW.md` ghi các điểm cần thảo luận; kết luận trong đó chưa tự trở thành quy tắc nghiệp vụ. Trước khi làm một bước, đọc lại `docs/CONTENT.md`, `docs/OPEN_QUESTIONS.md` và nguồn được dẫn ở bước đó. Câu hỏi mở liên quan phải được chốt, cập nhật tài liệu yêu cầu/quyết định, rồi mới code hành vi phụ thuộc.

Ký hiệu: `Pxx-Syy` là bước; `CPxx` là điểm kiểm tra cuối phase; `Rxx` là phát hiện trong [REVIEW.md](REVIEW.md). Ô `[ ]` là việc chưa được xác nhận hoàn tất. Các chức năng đã có trong repo vẫn cần đối chiếu và kiểm chứng; không đánh dấu xong chỉ vì đã có màn hình hoặc API mẫu.

## Vì sao chia theo luồng nghiệp vụ

Đã cân nhắc các cách chia theo từng màn hình, theo từng vai trò, làm toàn bộ backend trước, làm phần dễ trước, và làm từng luồng hoàn chỉnh từ dữ liệu đến giao diện. Ba cách đầu dễ tạo màn hình/API rời rạc; cách “dễ trước” để lại các xung đột điểm số đến cuối. Lộ trình này chọn **chốt quy tắc có rủi ro cao trước, rồi làm từng luồng nghiệp vụ có thể nghiệm thu**. Những phần độc lập như xác thực đã có vẫn được kiểm chứng sớm. Mỗi Step là một nhóm việc có thể tách tiếp thành các thay đổi nhỏ khi triển khai; phase là mốc bàn giao sản phẩm, không phải một lần sửa code.

**Giả định cần xác nhận khi triển khai:** có một Khoa và ba vai trò như PDR-001; backend hiện chưa có API đợt/đề tài/điểm (chỉ kiểm kê controller tại thời điểm lập plan); các kho demo frontend sẽ được thay bằng API thật. Nếu repo thay đổi, kiểm kê lại trước khi lấy một bước vào thực hiện. Báo cáo gốc không nằm trong `docs/`, nên các quyết định nghiệp vụ mới cần người phụ trách sản phẩm xác nhận.

## Thứ tự phase

| Phase | Kết quả cần có | Phụ thuộc chính |
| --- | --- | --- |
| [00 — Chốt nghiệp vụ](phase-00-chot-nghiep-vu.md) | Quy tắc, trạng thái, quyền và ngoại lệ được chốt có truy vết | `OPEN_QUESTIONS.md`, `REVIEW.md` |
| [01 — Tài khoản và nền dùng chung](phase-01-tai-khoan-va-nen-dung-chung.md) | Tài khoản, hồ sơ, khôi phục truy cập và khung dùng chung nối dữ liệu thật | PDR-001–004/036/037/043–045 |
| [02 — Đợt khóa luận](phase-02-dot-khoa-luan.md) | Đợt, mốc, người tham gia và quyền nhìn thấy | P00; PDR-029–034/041 |
| [03 — Đề tài và đăng ký](phase-03-de-tai-va-dang-ky.md) | Công bố, ghi danh, đề xuất, duyệt và lịch sử nhất quán | P02; PDR-012/047 |
| [04 — Đề cương và tài liệu](phase-04-de-cuong-va-tai-lieu.md) | Phiên bản nộp, nhận xét, duyệt, bản cuối | P03; PDR-011/013/039–042 |
| [05 — Phiếu và phản biện](phase-05-phieu-va-phan-bien.md) | Mẫu đánh giá và phân công phản biện hợp lệ | P04-S01/S02; PDR-021–028/035 |
| [06 — Hội đồng và lịch bảo vệ](phase-06-hoi-dong-va-lich-bao-ve.md) | Hội đồng, lịch, công bố có kiểm soát | P05; PDR-014–020 |
| [07 — Chấm điểm và kết quả](phase-07-cham-diem-va-ket-qua.md) | Bốn điểm mỗi sinh viên, xác nhận, công bố đúng điều kiện | P04–06; PDR-005–010/022/023; R01–R04, R09 |
| [08 — Thông báo, báo cáo và hoàn thiện](phase-08-thong-bao-bao-cao-va-hoan-thien.md) | Luồng xuyên suốt, truy vết, xuất dữ liệu và nghiệm thu chức năng | P01–07 |

Các phase là **thứ tự phụ thuộc**, không phải cam kết lịch hay ước lượng. Có thể làm các bước độc lập song song sau khi đầu vào đã chốt. Mỗi lát cắt phải gồm backend, frontend và kiểm thử hành vi thực tế. API QLKLTN phải kiểm tra quyền ở backend theo PDR-002; không dùng dữ liệu demo làm nguồn chính khi nghiệm thu.

**Rủi ro cần xử lý sớm:** điều kiện công bố và mở lại xác nhận đã được chốt tại PDR-005/009/011; định dạng/dung lượng tài liệu, hạn trễ, lưu trữ và ảnh đại diện đã chốt tại PDR-039–043. Lịch/hội đồng sau điểm đã chốt tại PDR-018–020; mẫu phiếu và cách cộng điểm đã chốt tại PDR-024–028/035. Phản hồi, giới hạn và điều kiện nhận liên kết quên mật khẩu đã chốt tại PDR-037/044/045; hủy ghi danh/giữ nhóm đã chốt tại PDR-047.

**Sau khi hoàn thiện ứng dụng:** xem lại OQ-007, dùng mốc 100 người đồng thời trong PDR-046 để thiết kế bài kiểm thử chịu tải, rồi chốt chỉ tiêu thời gian đáp ứng, lưu trữ tổng và khôi phục. Các việc này không là phụ thuộc hoặc cổng nghiệm thu của Phase 00–08.

## Cổng nghiệm thu chung

- [ ] Mỗi tiêu chí có bằng chứng kiểm thử hoặc thao tác thực tế; dữ liệu test tách biệt database dùng chung.
- [ ] Thay đổi API được đối chiếu hai phía trước khi sửa, rồi kiểm tra request/response, lỗi, 401/403 và trường hợp thiếu dữ liệu.
- [ ] Migration mới được review SQL; không sửa migration đã áp dụng hoặc tự chạy migration/seed trên Neon hay production.
- [ ] Các lệnh phù hợp trong `README.md`/`AGENTS.md` đạt; lỗi còn lại được ghi cùng mức ảnh hưởng.
- [ ] Tài liệu nghiệp vụ và quyết định liên quan được cập nhật khi đã chốt quy tắc; mọi phase phụ thuộc câu hỏi mở chỉ được nghiệm thu sau khi câu hỏi đó đóng.

## Phạm vi không tự đưa vào kế hoạch

- Không thay ba vai trò tài khoản bằng User/Admin/Operator hoặc thêm Trưởng khoa; xem PDR-001/002.
- Không gỡ Products hay sửa `InitialCreate` khi chưa có quyết định mới; xem PDR-002.
- Không coi route gợi ý, dữ liệu mẫu hoặc ngưỡng tạm trong `DESIGN/` là yêu cầu đã chốt; sao chép đợt theo PDR-034.
- Không hứa SLA, dung lượng, định dạng tài liệu hoặc cách xử lý ngoại lệ mà nguồn chưa quyết định.
