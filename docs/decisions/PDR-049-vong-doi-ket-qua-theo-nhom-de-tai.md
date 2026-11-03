# PDR-049: Vòng đời đề tài mới, lệch điểm chặn xác nhận, kết quả theo nhóm đề tài

## Trạng thái

Đã chấp nhận theo xác nhận trực tiếp của người dùng ngày 2026-11-03 (duyệt canvas `GiaoVu-DotKhoaLuan` và `GiaoVu-KetQua`); đóng OQ-019. Thay thế một phần [PDR-007](PDR-007-canh-bao-lech-diem-bon-cap-cheo.md), thay thế [PDR-009](PDR-009-ket-qua-theo-tung-sinh-vien.md) và [PDR-010](PDR-010-xu-ly-ket-qua-theo-lo.md).

## Bối cảnh

Báo cáo cuối kỳ bản 03-11 ([REPORT_SPEC.md](../REPORT_SPEC.md)) và canvas mới dùng một vòng đời đề tài chi tiết hơn tài liệu hiện hành: thêm các trạng thái chấm điểm, xác nhận/công bố theo cả nhóm đề tài, và coi lệch điểm là điều kiện chặn xác nhận chứ không chỉ cảnh báo. Danh sách đề tài của đợt cũng còn đề xuất bị từ chối sau khi đăng ký đã đóng.

## Quyết định

1. **Vòng đời đề tài:** `Chưa đăng ký` / `Chờ GV duyệt` (→ `Bị từ chối`) → `Đã đăng ký` → `Đang thực hiện` → `Đang cho điểm` → `Đã cho điểm` hoặc `Có lệch điểm` → `Đã xác nhận` → `Đã hoàn tất`. Trạng thái kết thúc khác: `Không có nhóm`, `Không đủ điều kiện công bố` (PDR-011).
2. **`Đang thực hiện` bắt đầu khi hết thời gian đăng ký** (cuối mốc "Công bố đề tài · SV đăng ký"): đề tài đã có nhóm tự chuyển `Đang thực hiện`, đề tài chưa có nhóm chuyển `Không có nhóm`. Từ lúc đó không còn đề tài nào `Đã đăng ký` hay `Chờ GV duyệt` trong đợt. Duyệt đề cương chỉ hoàn tất chặng Đề cương, **không đổi trạng thái**. Đề tài giữ `Đang thực hiện` qua Đề cương, Giữa kỳ, Cuối kỳ cho tới khi có điểm đầu tiên.
3. **Trạng thái chấm điểm** (tính trên mọi Sinh viên của nhóm):
   - `Đang cho điểm`: đã có ít nhất một điểm nhưng chưa đủ bốn điểm CTHĐ, TKHĐ, CBHD, CBPB cho mọi Sinh viên.
   - `Đã cho điểm`: đủ bốn điểm cho mọi Sinh viên và không có cặp lệch.
   - `Có lệch điểm`: đủ bốn điểm nhưng ít nhất một Sinh viên có cặp chéo lệch ≥ 2 theo đúng bốn cặp của PDR-007. Sửa hết lệch thì về `Đã cho điểm`.
4. **Lệch điểm chặn xác nhận:** cảnh báo vẫn không chặn lưu điểm (giữ PDR-007), nhưng Giáo vụ **không xác nhận được** đề tài `Có lệch điểm`. Giáo vụ gửi thông báo nhắc các Giảng viên trong cặp lệch xem lại phiếu (không gửi cho Sinh viên).
5. **Xác nhận và công bố theo cả nhóm đề tài** (thay PDR-009/010): xác nhận từng đề tài hoặc nhiều đề tài cùng lúc, chỉ với đề tài `Đã cho điểm`; sau xác nhận đề tài `Đã xác nhận`, điểm bị khóa. **Hủy xác nhận** (bắt buộc lý do, có lịch sử) khi chưa công bố đưa đề tài về `Đã cho điểm` để Giảng viên sửa điểm (đúng tinh thần PDR-005). Công bố chỉ với đề tài `Đã xác nhận` khi nhóm đã chốt bản cuối hoặc đã hết hạn chốt; công bố xong là `Đã hoàn tất`. Thao tác theo lô xử lý đề tài hợp lệ, bỏ qua và báo lý do từng đề tài không hợp lệ.
6. **Ẩn đề xuất bị từ chối sau hạn đăng ký:** khi đăng ký đã đóng, danh sách đề tài của đợt (Chi tiết đợt, tab Đề tài) không hiện đề xuất `Bị từ chối`; bản ghi vẫn được giữ và tra cứu được trong lịch sử. Trong thời gian đăng ký, đề xuất bị từ chối vẫn hiện để Giáo vụ theo dõi.

## Không đổi

- Bốn cặp chéo và ngưỡng 2,00 của PDR-007; công thức và làm tròn PDR-008; bước Chủ tịch xác nhận điểm CTHĐ của PDR-006 vẫn là điều kiện trước khi Giáo vụ xác nhận.
- Các khác biệt khác giữa báo cáo và tài liệu (REPORT_SPEC §10, mục 5–18) chưa được quyết định ở PDR này.

## Hệ quả

- Enum trạng thái đề tài ở frontend, backend và CSDL thêm `Đang cho điểm`, `Có lệch điểm`, `Đã xác nhận`. Trạng thái chấm điểm suy ra từ phiếu điểm; backend phải tính và kiểm tra lại khi xác nhận, không tin trạng thái do giao diện gửi lên.
- Phân công phản biện không còn gắn với "chuyển `Đang thực hiện`" mà gắn với "đề cương đã được duyệt" (PDR-021 giữ nguyên điều kiện đó).
- Kiểm thử: chuyển trạng thái khi hết hạn đăng ký; nhóm 1/2 SV thiếu một phiếu; lệch đúng 2,00 và 1,99; xác nhận bị chặn khi lệch; hủy xác nhận có/không lý do; công bố khi chưa chốt bản cuối; lô có đề tài hợp lệ và không hợp lệ; ẩn `Bị từ chối` trước/sau hạn đăng ký.
