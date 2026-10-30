# PDR-011: Giáo vụ xử lý ngoại lệ nhóm chưa nộp bản khóa luận

## Trạng thái

Đã chấp nhận theo các xác nhận trực tiếp của người dùng ngày 2026-10-28; đóng OQ-002.

## Bối cảnh

Khi đến hạn chốt bản cuối mà nhóm chưa nộp bất kỳ bản khóa luận nào, hệ thống không thể tự chốt một bản không tồn tại. Tài liệu trước đây chưa nêu người chịu trách nhiệm xử lý ngoại lệ.

## Quyết định

- Kết quả của nhóm ở trạng thái **chờ xử lý ngoại lệ**; hệ thống không tự công bố hoặc tự đánh không đạt.
- **Giáo vụ** là người có quyền quyết định đường xử lý ngoại lệ cho nhóm này. Quyết định phải ghi lý do và lịch sử người thực hiện, thời điểm.
- Giáo vụ được **mở cơ hội nộp bổ sung riêng cho nhóm**, đặt hạn kết thúc cụ thể và ghi lý do. Nhóm nhìn thấy hạn được cấp và có thể nộp trong hạn đó; không tự mở nộp bổ sung cho nhóm khác.
- Mỗi nhóm/đề tài chỉ được **cấp hạn nộp bổ sung một lần** cho ngoại lệ không có bản khóa luận khi hết hạn gốc. Hệ thống từ chối thao tác cấp thêm lần thứ hai; lịch sử lần cấp đầu được giữ.
- Hạn bổ sung riêng **được ưu tiên cho đúng nhóm** dù công tắc “Cho nộp trễ” chung của đợt đang tắt. Các nhóm không được cấp hạn riêng vẫn theo cấu hình chung; không mở nộp trễ cho cả đợt chỉ để xử lý một nhóm.
- Nếu nhóm nộp trong hạn bổ sung, nhóm có thể **tự chốt một bản** làm bản cuối. Nếu đã có bản nộp mà chưa tự chốt khi hết hạn bổ sung, hệ thống **tự chốt bản nộp mới nhất** và ghi lịch sử bản được chốt, thời điểm và tác nhân hệ thống. Không tự chốt khi chưa có bản nào. Sau khi có bản cuối, các điều kiện xác nhận/công bố khác vẫn áp dụng.
- Nếu hết hạn bổ sung mà nhóm **vẫn không nộp bản nào**, hồ sơ giữ ở hàng chờ để **Giáo vụ quyết định kết thúc với kết quả “Không đủ điều kiện công bố”**, bắt buộc ghi lý do và lịch sử. Khi Giáo vụ ra quyết định này, **đề tài chuyển sang trạng thái kết thúc riêng `Không đủ điều kiện công bố`**. Hệ thống không tự kết thúc hoặc tự cho điểm không đạt. Kết quả này không được công bố như điểm khóa luận; đề tài không chuyển `Đã hoàn tất`.
- Đề tài đã kết thúc `Không đủ điều kiện công bố` **không được mở lại bằng thao tác thông thường** để nộp hoặc chấm tiếp. Nếu có sai sót cần xử lý khác, phải có quyết định ngoại lệ riêng trước khi thiết kế thao tác tương ứng.

## Hệ quả

- Màn Giáo vụ cần hiển thị danh sách nhóm chờ ngoại lệ, lý do thiếu bản nộp và hạn bổ sung đã cấp; SV/GV nhìn thấy trạng thái/hạn phù hợp quyền của mình.
- Test trường hợp không có bản nào lúc hạn gốc và hạn bổ sung: không tự chốt/công bố/đánh không đạt; chỉ Giáo vụ được kết thúc “Không đủ điều kiện công bố” với lý do sau hạn bổ sung.
- Test có một/nhiều bản trong hạn bổ sung, nhóm tự chốt, hệ thống tự chốt bản mới nhất khi hết hạn và job chạy lặp không đổi bản cuối.
- Test cấu hình “Cho nộp trễ” tắt: đúng nhóm có hạn riêng vẫn nộp được trước hạn; nhóm khác bị chặn; quyết định kết thúc chuyển đề tài sang trạng thái riêng, không thành `Đã hoàn tất`.
- Test cấp hạn lần đầu thành công và lần thứ hai cho cùng nhóm/đề tài bị từ chối, kể cả khi hạn đầu đã hết.
- Test đề tài đã kết thúc `Không đủ điều kiện công bố` không thể nộp, chấm hoặc mở lại bằng thao tác thông thường.
