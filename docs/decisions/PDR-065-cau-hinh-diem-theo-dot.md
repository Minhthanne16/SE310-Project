# PDR-065: Cấu hình điểm theo đợt (hệ số, ngưỡng lệch, xếp loại)

## Trạng thái

Đã chấp nhận theo xác nhận trực tiếp của người dùng ngày 2026-11-23. Thay công thức cố định `(CTHĐ + TKHĐ + 2 × CBHD + 2 × CBPB) / 6` (quyết định 07/10, BUSINESS_RULES, [PDR-008](PDR-008-lam-tron-diem-tong.md) phần bối cảnh). Quy tắc làm tròn của PDR-008 giữ nguyên.

## Bối cảnh

Công thức điểm khóa luận đang cố định cho mọi đợt và mọi chương trình (VB1, VB2, Thạc sĩ). Quy định của khoa có thể thay đổi theo chương trình hoặc theo năm, nên Giáo vụ cần đặt hệ số, ngưỡng lệch và bảng xếp loại cho từng đợt.

## Quyết định

1. **Nơi cấu hình:** tab Đánh giá của Chi tiết đợt. Cấu hình gồm:
   - bốn hệ số `hCT`, `hTK`, `hHD`, `hPB`: số nguyên từ 0 trở lên, tổng lớn hơn 0;
   - ngưỡng lệch điểm (thang 10, dùng ở [PDR-066](PDR-066-lech-diem-so-voi-diem-khoa-luan.md));
   - bảng xếp loại theo cận dưới.
   Màn hình hiện công thức xem trước, ví dụ `(CTHĐ + TKHĐ + CBHD×2 + CBPB×2) / 6`.
2. **Giá trị điền sẵn khi tạo đợt:** nếu chương trình của đợt đã có cấu hình mặc định (mục 5) thì dùng cấu hình đó; nếu chưa, dùng mặc định hệ thống: hệ số 1 : 1 : 2 : 2, ngưỡng lệch 2,00, xếp loại ở mục 4.
3. **Công thức:** `Điểm KL = (hCT×CTHĐ + hTK×TKHĐ + hHD×CBHD + hPB×CBPB) / (hCT + hTK + hHD + hPB)`, tính từ điểm thành phần gốc rồi làm tròn hai chữ số theo PDR-008 (không cấu hình). Chỉ tính khi đủ bốn điểm.
4. **Xếp loại** so với Điểm KL đã làm tròn, mỗi mức từ cận dưới của nó đến dưới cận dưới của mức kế tiếp:

   | Mức | Mặc định |
   | --- | --- |
   | Xuất sắc | 9,00 – 10,00 |
   | Giỏi | 8,00 – dưới 9,00 |
   | Khá | 7,00 – dưới 8,00 |
   | Trung bình | 5,00 – dưới 7,00 |
   | Không đạt | dưới 5,00 (phải bảo vệ lại hoặc làm lại đề tài) |

   Điểm đạt là từ 5,00 trở lên; ví dụ 6,95 là Trung bình. Các cận phải tăng dần và nằm trong 0–10.
5. **Khóa và mặc định theo chương trình:** chỉ sửa được khi đợt còn `Nháp`; mở đợt thì khóa toàn bộ cấu hình điểm. Khi Giáo vụ lưu cấu hình, hệ thống hỏi có lưu làm mặc định cho chương trình của đợt không. Mặc định chương trình chỉ áp cho đợt tạo sau, không đổi đợt đã có.

## Hệ quả

- Đợt lưu bản sao cấu hình riêng; điểm, kết quả và file xuất của đợt luôn dùng cấu hình của đợt đó. Không có tính lại điểm vì cấu hình bị khóa trước khi có phiếu.
- Kiểm thử: tổng hệ số bằng 0, hệ số âm hoặc lẻ, cận xếp loại không tăng dần, sửa sau khi mở đợt (409), lưu và không lưu mặc định chương trình, đợt mới của chương trình có và chưa có mặc định, biên 4,99/5,00/6,95/7,00/8,99/9,00.
- Quy trình "bảo vệ lại hoặc làm lại đề tài" khi Không đạt chưa được đặc tả; xem [OQ-033](../OPEN_QUESTIONS.md).

## Trạng thái triển khai

- **2026-11-23:** Đã triển khai backend trên nhánh `feat/giao-vu-23-11` (bước A1): entity `RoundGradingConfig`, `ProgramRoundDefaults`, `ThesisScore.Calculate` có hệ số, `ThesisGrade.Classify`, API cấu hình điểm và mặc định chương trình, migration `AddRoundGradingConfigAndGroupSize`, 14 tests đạt.
