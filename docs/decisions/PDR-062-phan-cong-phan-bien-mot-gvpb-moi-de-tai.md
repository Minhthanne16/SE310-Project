# PDR-062: Phân công phản biện — một GVPB mỗi đề tài, đồng thời, Tự gợi ý và thông báo (P05-S02)

## Trạng thái

Đã chấp nhận ngày 2026-11-17. Bổ sung chi tiết thực thi cho [PDR-021](PDR-021-phan-cong-phan-bien-sau-duyet-de-cuong.md), [PDR-022](PDR-022-dieu-kien-nhap-diem-phan-bien.md), [PDR-023](PDR-023-khoa-thay-giang-vien-phan-bien-sau-phieu.md); không đổi các quyết định đó. Người dùng đã chốt **giữ "Tự gợi ý"**, chỉ điền sẵn bản nháp và Giáo vụ xác nhận mới lưu.

## Bối cảnh

DESIGN/03 (màn Giảng viên phản biện) và Phase 05 còn bốn chỗ chưa có quy tắc: nghĩa của "kiểm tra một người được gán đồng thời", thuật toán và tính chất của "Tự gợi ý" (có số 6 cố định, trái ngưỡng theo đợt), nội dung thông báo, nhãn chip điều kiện.

## Quyết định

1. **Một đề tài tối đa một GVPB.** Gán lại cho người khác là "đổi". Máy khách gửi `expectedReviewerId` (GVPB đang thấy trên màn). Nếu GVPB hiện tại của đề tài khác giá trị đó, máy chủ trả 409 "Phân công vừa thay đổi, tải lại". Gán lại đúng người đang có là thao tác lặp, không lỗi, không ghi lịch sử, không thông báo.
2. **"Kiểm tra một người được gán đồng thời"** gồm ba trường hợp: (a) hai Giáo vụ cùng gán một đề tài: bản ghi sau thấy `expectedReviewerId` lệch nên nhận 409; (b) đổi GVPB song song với nhập phiếu: cập nhật có điều kiện một dòng (`ReviewerFirstScoredAt IS NULL` và `ReviewerId` đúng giá trị mong đợi), bên nào chạm trước thắng; (c) trong một lô, cùng một đề tài xuất hiện hai lần: dòng sau lỗi "Trùng đề tài trong lô". Một GV được phản biện nhiều đề tài; vượt `LecturerLoadMax` của đợt chỉ **cảnh báo** (không chặn), giống tải hướng dẫn.
3. **Tự gợi ý** không ghi cơ sở dữ liệu; chỉ điền sẵn bản nháp trên màn. Giáo vụ xem, sửa rồi bấm "Lưu và gửi thông báo" mới lưu. Chỉ gợi ý cho đề tài đủ điều kiện và chưa có GVPB. Ứng viên: GV thuộc đợt, đang hoạt động, không phải GVHD của đề tài, có số đề tài phản biện (kể cả đã được gợi ý trong lượt này) nhỏ hơn `LecturerLoadMax` của đợt (`LecturerLoadMax = 0` nghĩa là chưa đặt mức, không loại ai). Xếp hạng: (1) cùng lĩnh vực, tức GV hướng dẫn ít nhất một đề tài cùng `Field` (cắt khoảng trắng, không phân biệt hoa thường) trong đợt; (2) ít đề tài phản biện hơn; (3) ít đề tài hướng dẫn hơn; (4) mã GV tăng dần. Không có ứng viên thì `lecturerId = null` kèm lý do. Số 6 ở DESIGN/03 được thay bằng `LecturerLoadMax` của đợt (DESIGN/03 dòng "Mức tối thiểu và tối đa đề tài mỗi GV lấy theo từng đợt").
4. **Thông báo** (cùng transaction với phân công): GVPB mới nhận loại `assign` "Bạn được phân công phản biện DT-xxx" (liên kết `/de-tai/{id}`); GVPB cũ khi bị đổi nhận "Bạn không còn phản biện DT-xxx" (liên kết `/gv/phan-bien`). GVHD không nhận thông báo. Mỗi lần gán hoặc đổi ghi một mục lịch sử đề tài, nhóm "Phân công" ("Phân công phản biện" hoặc "Đổi phản biện", chi tiết "GV cũ (mã) → GV mới (mã)").
5. **Chip lý do** trên màn Giáo vụ: Đủ điều kiện, Chưa duyệt đề cương, Đề tài không có nhóm, Đề tài đã kết thúc, Đã khóa · có phiếu phản biện. Màn GVPB: Chưa chấm, Chưa đủ điều kiện chấm (kèm lý do, ví dụ "Nhóm chưa nộp báo cáo cuối kỳ"), Đã chấm (từ P07).
6. **Quyền xem của GVPB** chỉ đọc: xem đề tài, đề cương, bài nộp và tải tệp; không duyệt, nhận xét hay sửa. GV không phải GVHD và không phải GVPB hiện tại nhận 404; GVPB cũ sau khi bị đổi cũng nhận 404. Không gỡ được GV khỏi đợt khi đang phản biện đề tài trong đợt (mở rộng PDR-030).
7. **Khóa theo PDR-023:** cột `ReviewerFirstScoredAt` là dấu khóa. P07 phải đặt giá trị này bằng một câu `UPDATE` có điều kiện `ReviewerId = @me` trong **cùng transaction** với phiếu phản biện đầu tiên; từ đó mọi thao tác đổi bị từ chối. Trước P07 cột luôn rỗng.
8. **Điều kiện lưu phiếu** (PDR-022) được đóng gói ở `ReviewerRules.ScoreBlocker` (người xem là GVPB hiện tại, nhóm đã nộp báo cáo cuối kỳ) và trả về qua cờ `canScore`; việc chặn lưu phiếu thật thuộc P07.

## Ngoài phạm vi

- Gỡ GVPB mà không thay bằng người khác.
- GVPB có được là thành viên hội đồng của cùng đề tài không: chuyển sang P06 ([OQ-032](../OPEN_QUESTIONS.md)).

## Hệ quả

- Cần các cột `ReviewerId`, `ReviewerAssignedAt`, `ReviewerAssignedById`, `ReviewerFirstScoredAt` trên đề tài và ràng buộc GVPB khác GVHD ở cơ sở dữ liệu.
- Test: trước/sau duyệt đề cương, thiếu giữa kỳ/cuối kỳ vẫn gán được, GVHD, GV ngoài đợt, gán lặp và `expectedReviewerId` cũ, đổi trước/sau dấu khóa, lô hỗn hợp, gợi ý, vượt tải, quyền đọc, gỡ GV khỏi đợt, đồng thời (PostgreSQL).
