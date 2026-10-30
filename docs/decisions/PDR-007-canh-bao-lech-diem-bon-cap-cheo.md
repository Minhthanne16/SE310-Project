# PDR-007: Cảnh báo lệch điểm theo bốn cặp chéo

## Trạng thái

Đã chấp nhận theo xác nhận trực tiếp của người dùng ngày 2026-10-28.

## Bối cảnh

Quy tắc cũ nêu chênh lệch giữa điểm hội đồng và điểm hướng dẫn/phản biện từ 2 điểm trở lên nhưng chưa chỉ rõ cặp nào. Các cách so sánh khác nhau có thể cho cảnh báo khác nhau trên cùng một bộ điểm.

## Quyết định

Với từng Sinh viên, so bốn chênh lệch tuyệt đối: `|CTHĐ − CBHD|`, `|CTHĐ − CBPB|`, `|TKHĐ − CBHD|`, `|TKHĐ − CBPB|`. Hiển thị cảnh báo nếu **ít nhất một** chênh lệch `≥ 2,00`. Cảnh báo không chặn lưu điểm nhưng phải hiện khi Giáo vụ xác nhận kết quả. Không so riêng CTHĐ–TKHĐ hoặc CBHD–CBPB theo quy tắc cảnh báo này.

Ví dụ biên: `CTHĐ=TKHĐ=CBPB=7,99`, `CBHD=6,00` → lớn nhất `1,99`, không cảnh báo; đổi `CTHĐ=8,00` → cặp CTHĐ–CBHD bằng `2,00`, có cảnh báo.

## Hệ quả

- Backend phải tính cảnh báo từ các giá trị điểm gốc theo từng Sinh viên và trả cùng kết quả cho UI/xuất dữ liệu.
- Test các cặp chéo riêng lẻ, trường hợp đồng thời nhiều cặp, `1,99` và `2,00`.
- Quy tắc làm tròn điểm tổng được quyết định riêng tại [PDR-008](PDR-008-lam-tron-diem-tong.md); PDR này chỉ quyết định **cảnh báo lệch**.
