# PDR-057: Đề cương và yêu cầu chỉnh sửa (P04-S01)

## Trạng thái

Đã chấp nhận ngày 2026-11-12, khi làm P04-S01. Quyết định này thực thi [PDR-013](PDR-013-yeu-cau-chinh-sua-de-cuong.md) cùng [PDR-039](PDR-039-chi-nhan-pdf-cho-ban-nop-hoc-thuat.md), [PDR-040](PDR-040-gioi-han-pdf-hai-muoi-megabyte.md), [PDR-042](PDR-042-giu-moi-phien-ban-tai-lieu-khong-tu-xoa.md), [PDR-047](PDR-047-huy-ghi-danh-de-tai-cong-bo.md) và [PDR-049](PDR-049-vong-doi-ket-qua-theo-nhom-de-tai.md). Nó ghi lại hợp đồng API và những chỗ tài liệu chưa nói, không đổi quy tắc nghiệp vụ đã chốt.

## Bối cảnh

Mục P04-S01 trong kế hoạch còn dòng "Chuyển đề tài sang `Đang thực hiện` chỉ khi đề cương được GVHD hợp lệ duyệt". Dòng này viết trước [PDR-049](PDR-049-vong-doi-ket-qua-theo-nhom-de-tai.md). PDR-049 đã chốt rằng `Đang thực hiện` bắt đầu khi hết thời gian đăng ký, còn duyệt đề cương chỉ hoàn tất chặng Đề cương và **không đổi trạng thái**. Theo [CONTENT.md](../CONTENT.md), quyết định mới hơn được ưu tiên, nên kế hoạch được sửa theo PDR-049.

Tài liệu cũng chưa nói rõ một số điểm khi dựng:

- ai được xem và tải đề cương;
- khi nào GVHD đóng được một yêu cầu;
- nhận xét có phải là yêu cầu không;
- khi nào nhóm bắt đầu được nộp.

## Quyết định

### Vai trò và quyền

| Người xem | Xem / tải | Nộp phiên bản | Nhận xét, tạo / đóng yêu cầu, duyệt |
| --- | --- | --- | --- |
| Thành viên nhóm đang giữ đề tài | Có | Có | Không |
| GVHD của đề tài | Có | Không | Có |
| Giáo vụ | Có | Không | Không (chỉ xem) |
| Người khác (SV ngoài nhóm, GV khác) | **404** (không lộ đề tài có tồn tại) | — | — |

### Cách làm

- **Bắt đầu nộp:** nhóm nộp được từ lúc ghi danh hoặc được chấp nhận đề xuất. Không phải chờ ngày bắt đầu mốc Đề cương. Như vậy điều kiện "nhóm chưa nộp đề cương" của PDR-047 có nghĩa, và hủy ghi danh bị chặn ngay sau lần nộp đầu.
- **Hạn nộp:** đóng sau 23:59 (giờ Việt Nam) ngày kết thúc mốc Đề cương.
  - Hạn trễ riêng theo PDR-041 chưa có chỗ lưu, vì dữ liệu mốc chỉ có công tắc "Cho nộp trễ".
  - Vì vậy hiện **không nhận nộp trễ**. Trường `late` và `lateDeadline` đã có trong hợp đồng và sẽ được dùng khi P02 lưu hạn trễ.
  - Thông điệp chặn là "Đã hết hạn nộp đề cương (dd/MM/yyyy)."
  - Tạo yêu cầu chỉnh sửa không mở thêm hạn (PDR-013).
- **Phiên bản:**
  - Mỗi lần nộp tạo `Lần n` mới; không ghi đè, không xóa (PDR-042).
  - Hai thành viên nộp cùng lúc vẫn nhận số khác nhau, nhờ chỉ mục duy nhất (đề tài, loại, số) và thử lại.
  - Tệp lưu ở object storage dùng chung với ảnh đại diện, khóa `submissions/{topicId}/{guid}.pdf`.
  - Ghi CSDL lỗi thì xóa tệp vừa lưu. Storage lỗi thì trả 503 và không tạo bản ghi.
- **Một lần nộp cho cả lần sửa:** lúc nộp, phiên bản mới được liên kết với **mọi yêu cầu đang mở**.
- **Đóng yêu cầu:**
  - Chỉ GVHD đóng được.
  - Chỉ đóng sau khi nhóm đã nộp ít nhất một phiên bản liên kết với yêu cầu đó, tức là GVHD kiểm tra trên bản nộp lại.
  - Đóng lặp trả 409.
- **Nhận xét và yêu cầu là hai việc riêng:**
  - Nhận xét gắn với một phiên bản, sửa được và không chặn duyệt.
  - Yêu cầu chỉnh sửa có trạng thái `Đang mở` / `Đã hoàn tất`, và chặn duyệt khi còn mở.
  - Sau khi duyệt, GVHD vẫn sửa được nhận xét, nhưng không tạo thêm yêu cầu.
  - Tạo yêu cầu cần đã có ít nhất một phiên bản; yêu cầu ghi lại phiên bản đang xem lúc tạo.
- **Duyệt:**
  - Chỉ GVHD duyệt được, và chỉ duyệt **phiên bản mới nhất** khi **không còn yêu cầu mở**.
  - Hai điều kiện này được kiểm lại ngay trong câu cập nhật, nên một yêu cầu hay phiên bản mới xuất hiện cùng lúc sẽ làm thao tác duyệt thất bại (409).
  - Duyệt lưu người, thời điểm và phiên bản được duyệt. Sau khi duyệt, nhóm không nộp thêm.
  - **Trạng thái đề tài không đổi** (PDR-049). Điều kiện phân công phản biện (PDR-021) dùng dấu "đề cương đã duyệt" này.
- **"Phiên bản đang chờ GVHD":** là phiên bản mới nhất khi chưa duyệt và không có yêu cầu mở nào tạo sau nó. Ngược lại, lượt thuộc về nhóm.
- **Lịch sử đề tài** (nhóm "Bài nộp"): "Nộp đề cương lần n", "Nhận xét đề cương lần n", "Tạo yêu cầu chỉnh sửa", "Xác nhận hoàn tất yêu cầu chỉnh sửa", "Duyệt đề cương lần n".
- **Thông báo chuông** (liên kết `/de-tai/{topicId}`):
  - nộp gửi GVHD;
  - yêu cầu, nhận xét, duyệt gửi các thành viên nhóm.

## Hợp đồng API

Gốc `api/topics/{topicId}/outline`, mọi vai trò đã đăng nhập; lỗi dùng `ApiResponse`.

| Method + route | Vai trò | Body | Thành công | Lỗi |
| --- | --- | --- | --- | --- |
| `GET /` | SV, GV, Giáo vụ | — | 200 `OutlineDto` | 404 |
| `POST /submissions` | SV | multipart: `file` (PDF ≤ 20 MB), `note` (≤ 2000, không bắt buộc) | 200 `OutlineDto` | 400 tệp rỗng / không phải PDF / quá 20 MB, 404, 409 hết hạn / đã duyệt / chưa có nhóm, 503 storage |
| `GET /submissions/{sid}/file` | SV, GV, Giáo vụ | — | 200 `application/pdf` (attachment, `nosniff`) | 404, 503 |
| `PUT /submissions/{sid}/comment` | GV | `{ comment }` (≤ 2000, rỗng để xóa) | 200 `OutlineDto` | 400, 404 |
| `POST /requests` | GV | `{ content }` (bắt buộc, ≤ 2000) | 200 `OutlineDto` | 400, 404, 409 chưa có phiên bản / đã duyệt |
| `POST /requests/{rid}/resolve` | GV | — | 200 `OutlineDto` | 404, 409 chưa nộp lại / đã hoàn tất |
| `POST /approve` | GV | `{ submissionId }` | 200 `OutlineDto` | 404, 409 còn yêu cầu mở / không phải bản mới nhất / đã duyệt |

Sai vai trò của endpoint (ví dụ SV gọi `POST /requests`) trả 403. Người không liên quan tới đề tài nhận 404.

`OutlineDto` gồm các trường sau.

- **Đề tài và người xem:**
  - `topicId`, `topicCode`, `topicTitle`;
  - `viewerRole`: `member` | `supervisor` | `staff`.
- **Hạn và trạng thái duyệt:**
  - `deadline` (yyyy-MM-dd), `lateDeadline` (rỗng);
  - `approvedAt`, `approvedBy`, `approvedVersionNo`;
  - `currentSubmissionId`.
- **Quyền thao tác:** `canSubmit`, `submitBlockedReason`, `canReview`, `canApprove`, `approveBlockedReason`.
- **`submissions[]`** (mới nhất trước): `id`, `versionNo`, `fileName`, `sizeBytes`, `note`, `submittedBy`, `submittedAt`, `late`, `reviewComment`, `reviewedBy`, `reviewedAt`, `addressedRequestIds[]`.
- **`requests[]`** (đang mở trước): `id`, `content`, `createdBy`, `createdAt`, `raisedOnVersionNo`, `status` (`open` | `resolved`), `resolvedBy`, `resolvedAt`, `addressedInVersions[]`, `canResolve`.

Bổ sung vào API đề tài có sẵn:

- `TopicDto.outlineApprovedAt` có ở mọi nơi trả đề tài.
- `TopicDto.outline` = `{ versions, openRequests, awaitingReview }` chỉ có ở `GET /api/topics/mine`, cho danh sách nhóm hướng dẫn.
- `TopicDetailDto.submissions[]` = `{ id, kind: "Đề cương", versionNo, submittedBy, submittedAt, late, fileName, note }`, cũ trước. Chỉ Giáo vụ, GVHD và thành viên nhóm nhận dữ liệu này.
- `DELETE /api/topics/{id}/registration` trả 409 "Nhóm đã nộp đề cương nên không hủy ghi danh được." (PDR-047).

Proxy Next.js (`next.config.ts`) đặt `experimental.proxyClientMaxBodySize = '21mb'`. Mặc định 10 MB sẽ cắt tệp 10–20 MB. Phía backend, `RequestSizeLimit` của endpoint nộp là 21 MiB.

## Giao diện

- **`/de-tai/[id]` (Không gian đề tài):** một màn dùng chung cho nhóm, GVHD và Giáo vụ, quyền theo `viewerRole`. Hiện có phần Tổng quan đề tài và chặng Đề cương. Chặng Đề cương gồm:
  - chip lượt;
  - hạn;
  - form nộp PDF có kiểm tra tại chỗ;
  - danh sách yêu cầu, có nút "Xác nhận hoàn tất" cho GVHD;
  - danh sách phiên bản có nút "Tải" và nhận xét;
  - nút duyệt có hộp xác nhận, kèm lý do khi bị khóa.
- **`/sv/de-tai`:** mở Không gian đề tài của nhóm trong đợt Đang diễn ra.
- **`/gv/huong-dan`:** gồm
  - bảng nhóm hướng dẫn: Mã, Đề tài, Nhóm, Đề cương, Việc cần làm, nút "Mở";
  - lọc "Tất cả" / "Cần xử lý" (phiên bản đang chờ GVHD).
- **Chi tiết đề tài của Giáo vụ:** tab Báo cáo và phiên bản hiện dữ liệu đề cương thật, và nút "Tải" của đề cương đã hoạt động.
- Kết quả thao tác hiện bằng toast; lý do bị khóa dùng `role="note"`; lỗi tệp và lỗi nội dung hiện tại chỗ (PDR-056).

## Hệ quả và việc còn lại

- Hạn trễ riêng của mốc Đề cương (PDR-041) cần P02 lưu ngày trễ; khi có, `OutlineRules.WindowBlocker` nhận nộp tới hạn trễ và gắn `late`.
- Xóa đợt (chỉ ở trạng thái Nháp) hoặc xóa đề tài bằng tay xóa bản ghi theo cascade, nhưng không xóa tệp trên storage. Đợt có bài nộp không còn là Nháp nên luồng thường không gặp; dọn tệp mồ côi thuộc P04-S02.
- Các chặng Giữa kỳ, Cuối kỳ dùng chung bảng `TopicSubmissions` (cột `Kind`) ở P04-S02/S03.
- OQ-020 mục "duyệt đề cương khi còn yêu cầu" vẫn mở. Đến khi chốt, giữ quy tắc PDR-013: không duyệt khi còn yêu cầu mở.
