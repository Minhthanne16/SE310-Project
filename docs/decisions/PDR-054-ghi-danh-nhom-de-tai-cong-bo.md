# PDR-054: Ghi danh nhóm vào đề tài công bố (P03-S02, backend)

## Trạng thái

Đã chấp nhận ngày 2026-11-07. Hai điểm DESIGN chưa nói đã được người dùng chốt trực tiếp cùng ngày (mục "Quyết định của người dùng"). Quy tắc còn lại lấy từ [BUSINESS_RULES](../requirements/BUSINESS_RULES.md), DESIGN 03 · Chi tiết đề tài và ghi danh, [PDR-030](PDR-030-khoa-go-nguoi-tham-gia-da-co-du-lieu.md), [PDR-047](PDR-047-huy-ghi-danh-de-tai-cong-bo.md), [PDR-048](PDR-048-cong-bo-de-tai-o-chi-tiet-dot.md), [PDR-049](PDR-049-vong-doi-ket-qua-theo-nhom-de-tai.md).

## Bối cảnh

Người dùng yêu cầu làm backend ghi danh nhóm trước; màn sinh viên (`/sv/dang-ky`, `/sv/dang-ky/[id]`) sẽ nối sau theo hợp đồng dưới đây. DESIGN chỉ nêu "Ghi danh: nhập thành viên bằng MSSV (kiểm tra hợp lệ)" và "ghi danh (đại diện nhóm)".

## Quyết định của người dùng

1. **Thành viên thứ hai vào nhóm ngay**, không cần xác nhận, khi đại diện nhập mã hợp lệ: cùng đợt, là sinh viên đang hoạt động, chưa có nhóm. Thành viên đó nhận thông báo trên chuông.
2. **Người bấm ghi danh là đại diện.** Nhóm đã có từ lần ghi danh trước (nhóm giữ nguyên sau khi hủy theo PDR-047) thì chỉ đại diện được ghi danh lại, với đúng thành viên cũ.

## Hợp đồng API

Ba endpoint chỉ dành cho vai trò `Student`; lỗi dùng `ApiResponse`.

| Method + route | Body | Thành công | Lỗi |
| --- | --- | --- | --- |
| `GET /api/topics/my-registration?roundId=` | — | 200 `MyRegistrationDto` | 403 không thuộc đợt, 404 |
| `POST /api/topics/{id}/registration` | `{ memberCodes: string[] }` (0 hoặc 1 mã; nhận cả email) | 200 `MyRegistrationDto` | 400 thành viên không hợp lệ, 403, 404, 409 |
| `DELETE /api/topics/{id}/registration` | — | 200 `MyRegistrationDto` | 403, 404, 409 |

- **`MyRegistrationDto`:** `{ round, registrationOpen, group, topic, canCancel, history[] }`.
  - `round`: như PDR-053.
  - `group`: `{ id, representativeId, members[{ id, code, name, className, representative }] }` hoặc `null`.
  - `topic`: `TopicDto` hoặc `null`.
  - `history`: `{ topicId, topicCode, topicTitle, registeredAt, registeredBy, cancelledAt, cancelledBy }`, mới nhất trước.
- **`TopicDto.group`:** thêm trường thành viên nhóm, đại diện đứng trước.
  - Giáo vụ và GVHD thấy nhóm.
  - Sinh viên chỉ thấy nhóm của chính mình; với đề tài của nhóm khác nhận mảng rỗng.
- **Thông điệp lỗi** (theo các trạng thái lỗi trong DESIGN):

| Mã | Trường hợp | Thông điệp |
| --- | --- | --- |
| 400 | Thành viên không hợp lệ | "Mã sinh viên … không tồn tại hoặc không thuộc đợt."; "Không nhập mã của chính bạn…"; "Sinh viên … đã có nhóm trong đợt."; "Nhóm có tối đa 2 sinh viên…"; "Nhóm đã có thành viên cố định…" |
| 409 | Đề tài vừa bị nhóm khác nhận | "Đề tài vừa có nhóm khác nhận. Tải lại danh sách và chọn đề tài khác." |
| 409 | Đợt đã đóng | "Đã hết thời gian đăng ký đề tài của đợt." |
| 409 | Nhóm đã có đề tài | "Nhóm của bạn đã ghi danh một đề tài. Hủy ghi danh trước khi chọn đề tài khác." |
| 409 | Hủy lặp / không còn ghi danh | "Nhóm không còn ghi danh đề tài này." |
| 403 | Không phải đại diện khi ghi danh lại | "Chỉ đại diện nhóm được ghi danh cho nhóm." |

## Quy tắc thực thi

- **Cửa sổ đăng ký:** mở từ lúc Giáo vụ công bố tới hết ngày kết thúc mốc "Công bố đề tài · SV đăng ký" (giờ Việt Nam), áp cho cả ghi danh và hủy. Hết hạn thì đề tài có nhóm hiển thị `Đang thực hiện` (PDR-049).
- **Chỉ ghi danh đề tài GV công bố đang trống.** Ghi danh thành công thì đề tài `Đã đăng ký`; GVHD không còn sửa được đề tài đó (PDR-053).
- **Không có hai nhóm cùng nhận một đề tài.**
  - Nhận đề tài bằng cập nhật có điều kiện (`GroupId IS NULL` và `Chưa đăng ký`) trong cùng transaction với việc tạo nhóm. Nhóm thua không lưu gì.
  - Chỉ mục duy nhất `GroupMembers(RoundId, StudentId)` chặn một sinh viên thuộc hai nhóm trong đợt.
  - Chỉ mục duy nhất `ThesisTopics(GroupId)` chặn một nhóm giữ hai đề tài, kể cả khi có thao tác đồng thời.
- **Hủy (PDR-047):**
  - Bất kỳ thành viên nào cũng hủy được, cho cả nhóm.
  - Đề tài về `Chưa đăng ký`; nhóm giữ nguyên thành viên và đại diện.
  - Lần ghi danh được giữ trong `TopicRegistrations` với người/thời điểm hủy.
  - Hủy lặp hoặc hủy đồng thời chỉ có một lần hiệu lực.
- **Lịch sử đề tài:** nhóm "Nhóm" ghi "Ghi danh" (kèm thành viên) và "Hủy ghi danh".
- **Ràng buộc với tài khoản và đợt:**
  - PDR-030: sinh viên đã có nhóm không gỡ được khỏi đợt (`RoundDto.lockedStudentIds`).
  - Tài khoản đã có nhóm tính là "đã có dữ liệu" nên chỉ bị vô hiệu hóa (PDR-004).

## Chưa làm

- **Điều kiện "nhóm chưa nộp đề cương" của PDR-047:** chưa kiểm được vì chưa có mô-đun nộp bài (P04). Phải chặn thêm ở `CancelRegistrationHandler` khi có.
- **Giao diện sinh viên** (tìm/chi tiết/ghi danh/hủy, lỗi đề tài vừa có nhóm nhận): nối vào hợp đồng trên ở bước frontend. Màn `/sv/dang-ky` hiện chỉ xem danh sách.
- **Đề xuất đề tài (P03-S03)** dùng chung bảng nhóm này khi làm.

## Hệ quả

- Migration `AddTopicGroups`:
  - thêm bảng `ThesisGroups`, `GroupMembers`, `TopicRegistrations`;
  - thêm cột cho phép null `ThesisTopics.GroupId`.
  - Xóa đợt sẽ xóa theo nhóm, thành viên và lần ghi danh.
  - Không tự chạy trên Neon/dữ liệu dùng chung.
- **Kiểm thử:**
  - test handler trên SQLite;
  - test hợp đồng HTTP;
  - E2E trên PostgreSQL local: 4 nhóm tranh 1 đề tài, hai đại diện cùng kéo một sinh viên, hai thành viên cùng hủy, xóa đợt có nhóm.
