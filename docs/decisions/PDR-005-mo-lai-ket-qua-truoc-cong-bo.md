# PDR-005: Mở lại kết quả đã xác nhận trước khi công bố

## Trạng thái

Đã chấp nhận theo xác nhận trực tiếp của người dùng ngày 2026-10-28.

## Bối cảnh

`requirements/BUSINESS_RULES.md` trước đây ghi kết quả đã xác nhận không được sửa, trong khi `DESIGN/03-dac-ta-man-hinh.md` có thao tác “Hủy xác nhận”. Cần có đường sửa sai trước công bố mà vẫn bảo toàn trách nhiệm và lịch sử điểm.

## Quyết định

- Giáo vụ được **mở lại kết quả đã xác nhận khi chưa công bố** để sửa điểm. Thao tác mở lại bắt buộc ghi lý do và lịch sử người thực hiện, thời điểm, trạng thái trước/sau.
- Không sửa trực tiếp điểm của kết quả còn ở trạng thái đã xác nhận. Sau khi mở lại, điểm được sửa theo quyền chấm/nhập đã chốt; Giáo vụ xác nhận lại kết quả trước khi công bố.
- Sau công bố không có thao tác mở lại thông thường. Quy trình sửa sai đặc biệt sau công bố chưa được quyết định; không tự suy ra từ PDR này.

## Hệ quả

- API/UI phải phân biệt “mở lại” với sửa điểm; kiểm tra quyền và trạng thái ở backend.
- Lịch sử điểm và lần xác nhận trước được giữ để giải thích thay đổi; mọi công bố phải dựa trên lần xác nhận mới nhất còn hiệu lực.
- Kịch bản mở lại trước công bố và từ chối mở lại sau công bố cần được kiểm thử.
