# Đặc tả rút gọn từ báo cáo cuối kỳ (bản cập nhật 03-11)

Tệp này tóm tắt *Báo cáo Cuối kỳ - SE310 - QLKLTN (cập nhật 03-11).docx* để cả nhóm có chung ngữ cảnh mà không phải mở bản Word. Báo cáo gốc không nằm trong repo.

**Thứ bậc nguồn.** Tệp này là **tham chiếu**, không thay thế `requirements/`, `decisions/` hay `OPEN_QUESTIONS.md`. Nhiều PDR ngày 2026-10-28 mới hơn và chặt hơn báo cáo. Những chỗ báo cáo khác repo được liệt kê ở [mục 10](#10-chỗ-báo-cáo-khác-tài-liệu-hiện-hành). Mục 1–4 đã chốt theo báo cáo ([PDR-049](decisions/PDR-049-vong-doi-ket-qua-theo-nhom-de-tai.md)); các mục còn lại chưa chốt thì giữ PDR hiện hành (xem `OQ-020`).

## 1. Phạm vi và vai trò

- Hệ thống web quản lý khóa luận tốt nghiệp trong phạm vi một Khoa: mở đợt, đăng ký đề tài, đề cương, nộp báo cáo, phản biện, hội đồng bảo vệ, chấm điểm, xác nhận và công bố kết quả, thông báo.
- Mặc định sinh viên đã đủ điều kiện làm khóa luận. Giáo vụ thao tác thay mặt Khoa; Trưởng khoa không có tài khoản riêng.
- **Sinh viên (SV):**
  - đăng ký hoặc đề xuất đề tài theo nhóm;
  - nộp đề cương, báo cáo giữa kỳ và khóa luận;
  - xem nhận xét, lịch bảo vệ và điểm (điểm chỉ thấy sau khi công bố).
- **Giảng viên (GV):**
  - gửi đề tài và duyệt đề xuất của SV;
  - duyệt, nhận xét đề cương;
  - hướng dẫn, phản biện, làm chủ tịch hoặc thư ký hội đồng theo phân công, chấm điểm;
  - gửi thông báo cho các nhóm mình hướng dẫn.
- **Giáo vụ:**
  - quản lý đợt, người tham gia, mẫu phiếu và tiêu chí, người dùng;
  - đóng và công bố danh sách đề tài;
  - phân công phản biện, lập hội đồng và lịch bảo vệ;
  - xác nhận và công bố kết quả, thống kê, gửi thông báo.

## 2. Đợt khóa luận và 9 mốc

- **Thuộc tính đợt:**
  - Mỗi đợt thuộc một chương trình (Văn bằng 1, Văn bằng 2, Thạc sĩ). Tên đợt không trùng trong cùng chương trình.
  - Đợt có ngày bắt đầu tuần 1 và mức đề tài tối thiểu, tối đa mỗi GV hướng dẫn. Mức này **chỉ cảnh báo**, không chặn.
- **Trạng thái đợt:**
  - `Nháp` (chỉ giáo vụ thấy, xóa được) → `Đang diễn ra` (Mở đợt, có thông báo) → `Đã kết thúc` (chỉ xem).
- **9 mốc**, theo thứ tự. Mỗi mốc có ngày bắt đầu, ngày kết thúc, số ngày nhắc trước hạn (1, 3, 7 ngày hoặc không) và đối tượng nhận nhắc:
  1. GV gửi đề tài
  2. Công bố đề tài · SV đăng ký
  3. Đề cương (có *Cho nộp trễ*)
  4. Báo cáo giữa kỳ (có *Cho nộp trễ*)
  5. Báo cáo cuối kỳ (có *Cho nộp trễ*)
  6. Lịch phản biện
  7. Lịch bảo vệ
  8. Thời gian cho điểm (chồng lên mốc 6–7, chỉ nhắc, không khóa phiếu)
  9. Chốt bản cuối · công bố
- **Kiểm tra mốc:** mốc sai thứ tự không lưu được; dòng lỗi tô đỏ kèm lý do.
- **Người tham gia:**
  - Thêm GV, SV vào đợt bằng cách chọn từ danh sách hoặc dán mã, Excel; có bước kiểm tra trước khi thêm.
  - SV không ở hai đợt chưa kết thúc cùng lúc; GV tham gia nhiều đợt được.
  - Chỉ gỡ được người chưa có dữ liệu trong đợt.

## 3. Vòng đời đề tài (bản 03-11)

```text
Chưa đăng ký ──(nhóm ghi danh)──────────────┐
Chờ GV duyệt ──(GV chấp nhận)───────────────┤──► Đã đăng ký
      └─(GV từ chối, bắt buộc lý do)─► Bị từ chối
Hết thời gian đăng ký (cuối mốc 2):
   có nhóm  ──► Đang thực hiện
   chưa nhóm ─► Không có nhóm (kết thúc, không tính khi kết thúc đợt)
Đang thực hiện ──(có điểm đầu tiên)──► Đang cho điểm
Đang cho điểm ──(đủ 4 điểm, không lệch)──► Đã cho điểm
              └─(đủ 4 điểm, có cặp lệch)──► Có lệch điểm ──(sửa hết lệch)──► Đã cho điểm
Đã cho điểm ──(giáo vụ xác nhận cả nhóm)──► Đã xác nhận ──(hủy xác nhận, có lý do)──► Đã cho điểm
Đã xác nhận ──(công bố; đã chốt bản cuối hoặc hết hạn)──► Đã hoàn tất
Nhóm không nộp bản khóa luận nào sau hạn bổ sung ──► Không đủ điều kiện công bố (giáo vụ kết thúc)
```

- **Đang thực hiện** kéo dài từ hết thời gian đăng ký, qua Đề cương và Giữa kỳ, đến khi nộp báo cáo cuối kỳ. Duyệt đề cương chỉ hoàn tất chặng Đề cương, **không đổi trạng thái**.
- **Đã hoàn tất:** công bố chính là hoàn tất; không có bước "đóng khóa luận" riêng. Bản nộp cuối cùng là bản chính thức và bị khóa.
- **Thống kê:** dùng đủ 12 trạng thái trên (gồm Chờ GV duyệt và Bị từ chối).
- **Danh sách đề tài của đợt** sau hạn đăng ký không hiện đề xuất `Bị từ chối` (vẫn còn trong lịch sử), theo PDR-049.

## 4. Tiến độ 6 chặng (khung Tiến độ trong Không gian đề tài)

| Chặng | Hoàn tất khi |
| --- | --- |
| Đăng ký | Ghi danh thành công hoặc đề xuất được GVHD chấp nhận |
| Đề cương | GVHD duyệt đề cương (nộp được nhiều lần) |
| Giữa kỳ | Nhóm nộp báo cáo giữa kỳ trong khung của đợt; GVHD nhận xét |
| Cuối kỳ | Chốt bản cuối, hoặc hệ thống tự lấy bản mới nhất khi hết hạn |
| Đánh giá | Đủ điểm hướng dẫn, phản biện và hội đồng (ba phần chạy song song) |
| Kết quả | Đề tài Đã hoàn tất (gồm Đã cho điểm, Đã xác nhận, Công bố) |

- **Thứ tự nộp:** đề cương được duyệt rồi mới mở báo cáo giữa kỳ và cuối kỳ; đã bảo vệ (Đã cho điểm) rồi mới chốt bản cuối.
- **Khóa luận cuối kỳ:**
  - Mỗi lần tải lên là một phiên bản mới, kèm một dòng ghi chú thay đổi bắt buộc; không ghi đè, không xóa.
  - Khóa luận không có trạng thái riêng, chỉ hiện "Đã nộp" kèm số phiên bản.
  - Chấm điểm không gắn với phiên bản nào.

## 5. Quy tắc nghiệp vụ chính

**Nhóm và đề tài**
- Nhóm có tối đa 2 SV và 1 đại diện. Mỗi SV chỉ thuộc một nhóm trong một đợt.
- Hai nhóm không nhận cùng một đề tài: nhóm ghi danh trước được nhận, không có bước duyệt nhóm.
- GV chỉ thêm, xóa đề tài khi giáo vụ chưa đóng danh sách. Sau khi đóng: tên đề tài bị khóa; đề tài chưa có nhóm chỉ còn sửa được mô tả và yêu cầu.
- Giáo vụ **đóng và công bố danh sách** thủ công sau mốc 1. Từ đó SV mới ghi danh hoặc đề xuất được.
- **Đề xuất của SV:**
  - Đề xuất chỉ cần GVHD chấp nhận, không qua giáo vụ.
  - Mỗi nhóm có tối đa 1 đề xuất đang chờ, và không ghi danh đề tài khác trong lúc chờ.
  - Khi còn Chờ GV duyệt, đại diện sửa được đơn. Đổi GV thì đơn chuyển sang GV mới.
- **Số đề tài mỗi GV** = đề tài GV gửi + đề xuất của SV đã được GV chấp nhận.

**Đề cương và tài liệu**
- Mọi bản nộp đều là PDF, tối đa 20 MB.
- **Cho nộp trễ** bật theo từng mốc 3, 4, 5. Bài nộp sau hạn được gắn nhãn *Nộp trễ*; mốc không bật thì hết hạn là khóa nộp.
- GVHD quản lý yêu cầu chỉnh sửa đề cương: thêm, xóa, mở lại. SV đánh dấu đã làm.
- Hoàn tác duyệt đề cương được khi đợt chưa qua mốc Đề cương.

**Phân công, hội đồng, lịch**
- GVHD không phản biện và không ngồi hội đồng của đề tài mình hướng dẫn. Vi phạm thì **chặn**.
- **Hội đồng:**
  - Gồm đúng 2 GV: chủ tịch và thư ký. Thư ký nhập điểm cho cả hai.
  - Tên hội đồng tự đặt: Hội đồng 1, 2…
  - Chỉ xóa được hội đồng ở trạng thái Nháp.
- **Lịch bảo vệ:**
  - Mỗi hội đồng có ngày, giờ bắt đầu, phòng và số phút cho mỗi đề tài; giờ từng đề tài tự tính theo thứ tự.
  - Công bố lịch thì gửi thông báo cho các bên. Sửa lịch đã công bố cũng gửi thông báo thay đổi.

**Chấm điểm và kết quả**
- Điểm chấm **riêng từng SV** theo mẫu phiếu giáo vụ gán cho từng vai trò trong đợt: HD, PB, Hội đồng (chủ tịch và thư ký dùng chung mẫu).
- **Cấu trúc phiếu:**
  - Phiếu gồm tiêu chí chung, mỗi tiêu chí chung có các hạng mục con.
  - Tổng điểm tiêu chí chung = 10; tổng điểm hạng mục con = điểm của tiêu chí chung chứa nó. Không dùng trọng số %.
- **Thời điểm chấm:** phiếu mở cho người được phân công, không phụ thuộc thứ tự giữa các vai trò. GV sửa được điểm đến khi giáo vụ xác nhận.
- **Công thức:** `Điểm KLTN = (CTHĐ + TKHĐ + 2×CBHD + 2×CBPB) / 6`, thang 10, làm tròn 2 chữ số (quy tắc làm tròn theo PDR-008). Chỉ tính khi đủ 4 điểm.
- **Lệch điểm:**
  - Có lệch khi CTHĐ hoặc TKHĐ chênh **≥ 2** so với CBHD hoặc CBPB (bốn cặp chéo).
  - Cảnh báo không chặn lưu điểm, nhưng **chặn xác nhận**: đề tài ở `Có lệch điểm` cho tới khi hết lệch.
  - Giáo vụ gửi thông báo nhắc các GV trong cặp lệch, không gửi cho SV.
- **Xác nhận và công bố theo cả nhóm đề tài**, từng đề tài hoặc theo lô:
  - Xác nhận chỉ áp dụng cho đề tài `Đã cho điểm`.
  - Hủy xác nhận (bắt buộc lý do) khi chưa công bố: đề tài về `Đã cho điểm` để GV sửa điểm.
  - Công bố cần kết quả đã xác nhận và nhóm đã chốt bản cuối hoặc đã hết hạn chốt. Đề tài chưa chốt bị bỏ qua khi công bố theo lô.
- **Kết thúc đợt:** chỉ khi mọi đề tài đã kết thúc. Đề tài `Không có nhóm` không tính.

**Tài khoản và thông báo**
- **Tài khoản:**
  - Mã người dùng và email không trùng.
  - Mật khẩu ban đầu là mã người dùng, phải đổi ở lần đăng nhập đầu. Mật khẩu ≥ 8 ký tự, có chữ và số.
  - Liên kết đặt lại mật khẩu có hiệu lực 30 phút.
- Giáo vụ tạo được tài khoản SV, GV và giáo vụ; nhập tài khoản từ CSV có xem trước. Không đổi vai trò hay mã người dùng sau khi tạo.
- Tài khoản đã có dữ liệu chỉ bị vô hiệu hóa, kích hoạt lại được. Không xóa được tài khoản của chính mình.
- **Bảng thông báo** ở Trang chủ: chỉ đọc, không trả lời, không trạng thái đã đọc. Nội dung tối đa 2000 ký tự. Thông báo đã gửi không sửa được, chỉ xóa được.
- **Chuông** chứa thông báo tự động của hệ thống, có trạng thái chưa đọc.

## 6. Danh sách use case theo vai trò

| Vai trò | Use case |
| --- | --- |
| Chung | Đăng nhập (kèm Quên mật khẩu), Xem / Cập nhật thông tin cá nhân, Đổi mật khẩu |
| Sinh viên | Xem danh sách đề tài đã công bố, Ghi danh, Đề xuất đề tài, Hủy đăng ký / đề xuất, Xem chi tiết đề tài, Nộp đề cương, Nộp báo cáo giữa kỳ / cuối kỳ (và chốt bản cuối), Xem nhận xét, Xem lịch bảo vệ, Xem điểm, Xem thông báo |
| Giảng viên | Thêm / Sửa / Xóa đề tài, Duyệt đề xuất, Xem lịch sử đề tài, Xem thông tin nhóm (Hướng dẫn, Phản biện, Hội đồng), Nhận xét / duyệt đề cương, Xem đề tài phản biện, hội đồng và lịch, Xem báo cáo và nhận xét phản biện, Chấm điểm, Gửi / Xem thông báo |
| Giáo vụ | Quản lý đợt, Quản lý người tham gia đợt, Quản lý phiếu và tiêu chí, Thêm / Sửa / Xóa người dùng, Xem danh sách và chi tiết đề tài, Xem lịch sử đề tài, Đóng và công bố danh sách, Xuất danh sách đề tài, Phân công phản biện, Quản lý hội đồng, Lập lịch bảo vệ, Thống kê, Xác nhận kết quả, Công bố kết quả, Xuất bảng điểm, Gửi thông báo |

## 7. Màn hình (tóm tắt chương 3.1)

- **Khu vực:** sau đăng nhập, người dùng vào một trong ba khu `/sv`, `/gv`, `/giao-vu`. Trang dùng chung: Đăng nhập, Hồ sơ, Thông báo (chuông), Không gian đề tài.
- **Trang chủ:** việc cần làm, Bảng thông báo và Gantt của đợt.
- **Không gian đề tài:** dùng chung cho SV và GV, quyền khác nhau theo vai trò. Có khung Tiến độ 6 chặng (thu gọn được) và 4 tab: Tổng quan, Thông báo, Hoạt động, Điểm số.
- **Màn hình Giáo vụ:**
  - Đợt khóa luận: tab Tiến độ (Gantt 9 mốc), Cấu hình, Giảng viên, Sinh viên, Đề tài.
  - Người dùng.
  - Quản lý đề tài.
  - Mẫu phiếu.
  - Giảng viên phản biện, gồm khung "Chưa đủ điều kiện" và Tự gợi ý.
  - Hội đồng bảo vệ.
  - Kết quả: các tab Đã cho điểm, Có lệch điểm, Đã xác nhận, Đã hoàn tất, Đang cho điểm. Xem điểm chi tiết bằng cách mở rộng dòng (inline).
  - Thống kê.
- Chi tiết bàn giao giao diện nằm ở [`DESIGN/`](DESIGN/).

## 8. Dữ liệu (tóm tắt chương 3.2)

Báo cáo liệt kê 17 bảng:

| Nhóm | Bảng |
| --- | --- |
| Tài khoản | `users` |
| Đợt | `registration_periods`, `period_milestones` (9 mốc, nhắc hạn, đối tượng, `allow_late`), `period_participants`, `period_evaluation_forms` |
| Mẫu phiếu | `evaluation_forms` (có phiên bản), `evaluation_criteria` |
| Đề tài | `topics`, `topic_members`, `topic_histories`, `outline_revision_items` |
| Tài liệu | `submissions`, `feedbacks` |
| Điểm | `scores` (phiếu theo vai trò × SV), `score_details`; cờ `has_score_deviation` trên `topic_members` |
| Hội đồng | `committees` (chủ tịch, thư ký, lịch) |
| Thông báo | `notifications` (một dòng mỗi người nhận, cùng `batch_id`) |

- Báo cáo mô tả các nghiệp vụ nhiều bước bằng thủ tục lưu trữ, ví dụ `sp_register_topic`, `sp_save_score`, `sp_confirm_result`, `sp_publish_result`, `sp_close_period`.
- Báo cáo ghi hệ quản trị MySQL 8.0. Repo dùng PostgreSQL/Neon và EF Core (xem `architecture/`, PDR-002), nên chỉ dùng phần này làm tham khảo mô hình.
- **Enum trạng thái** trong từ điển dữ liệu đã cập nhật theo vòng đời ở mục 3. Ràng buộc chuyển trạng thái do trigger trên `topics` kiểm tra.

## 9. Phi chức năng

- Giao diện dễ dùng, mở rộng được.
- Thao tác thông thường phản hồi dưới 3 giây (chỉ tiêu tải còn hoãn, xem OQ-007).
- Phân quyền theo vai trò ở backend. Mật khẩu được băm. Chỉ người có quyền mới xem được điểm và tài liệu.
- Lỗi tải hoặc lưu phải báo cho người dùng và cho thử lại. Không báo thành công khi chưa lưu được.

## 10. Chỗ báo cáo khác tài liệu hiện hành

Cột "Repo" là quy tắc trước 03/11. Mục 1–4 nay theo cột báo cáo (PDR-049); mục 5–18 vẫn theo cột Repo cho tới khi chốt.

| # | Chủ đề | Báo cáo 03-11 | Repo hiện hành |
| --- | --- | --- | --- |
| 1 | Khi nào `Đang thực hiện` | Tự chuyển khi hết thời gian đăng ký; duyệt đề cương không đổi trạng thái | Chuyển khi GVHD duyệt đề cương (`BUSINESS_RULES`, `WORKFLOWS` §2.3) |
| 2 | Trạng thái mới | Thêm `Không có nhóm`, `Đang cho điểm`, `Có lệch điểm`, `Đã xác nhận` | Chuỗi cũ `Đã đăng ký → Đang thực hiện → Đã cho điểm → Đã hoàn tất` (`PROJECT_SPEC`) |
| 3 | Lệch điểm | Chặn xác nhận tới khi hết lệch; giáo vụ nhắc GV trong cặp lệch | Chỉ cảnh báo, hiện khi xác nhận (PDR-007) |
| 4 | Đơn vị xác nhận và công bố | Theo cả nhóm đề tài, từng đề tài hoặc theo lô | Theo từng SV; lô báo lý do từng người (PDR-009, PDR-010) |
| 5 | Chủ tịch xác nhận điểm CTHĐ | Thư ký nhập điểm cả hai, không có bước chủ tịch xác nhận | Chủ tịch xác nhận hoặc trả lại có lý do (PDR-006) |
| 6 | Mở lại kết quả | "Hủy xác nhận" có lý do, về `Đã cho điểm` | Mở lại trước công bố có lý do (PDR-005); tương đương, cần thống nhất tên gọi |
| 7 | Điều kiện phân công phản biện | Đủ 3 điều kiện: đề cương duyệt, đã nộp giữa kỳ, đã nộp cuối kỳ | Từ khi đề cương được duyệt (PDR-021); PB nhập điểm sau khi nộp cuối kỳ (PDR-022) |
| 8 | Trùng phòng, trùng GV giữa hai hội đồng | Chỉ cảnh báo khi lưu, còn cảnh báo thì không công bố | Chặn khi lưu (PDR-014, PDR-015) |
| 9 | Duyệt đề cương khi còn yêu cầu mở | Được duyệt | Phải hoàn tất mọi yêu cầu trước (PDR-013) |
| 10 | Hủy đề xuất | Xóa khỏi CSDL; chỉ đại diện hủy | Giữ `Đã hủy` trong lịch sử (PDR-012) |
| 11 | Hủy ghi danh | Chỉ đại diện, khi đợt còn mở | Bất kỳ thành viên nào, khi chưa nộp đề cương (PDR-047) |
| 12 | Xóa mẫu phiếu | Xóa được mẫu chưa có điểm, kể cả đang gán | Chỉ xóa mẫu Nháp chưa từng gán; còn lại thì Đóng hoặc tạo phiên bản (PDR-025, PDR-027) |
| 13 | Sao chép đợt | Sao chép mức đề tài, mẫu phiếu, 9 mốc dời theo ngày mới | Chỉ khung 9 mốc và cờ Cho nộp trễ, không ngày, không mẫu (PDR-034) |
| 14 | Xóa thông báo đã gửi | Người nhận không còn thấy | Chỉ ẩn khỏi "Tôi đã gửi" của người gửi (PDR-038) |
| 15 | Kết thúc đợt | Mọi đề tài đã công bố; `Không có nhóm` không tính | `Đã hoàn tất` hoặc `Không đủ điều kiện công bố` (PDR-031) |
| 16 | Kích hoạt tài khoản | Đổi mật khẩu ở lần đầu | Đổi mật khẩu kèm OTP qua email (PDR-003) |
| 17 | Nộp trễ | Bật hoặc tắt theo mốc; khóa luận nộp trễ được tới trước buổi bảo vệ | Hạn trễ riêng từng mốc (PDR-041) |
| 18 | Hệ quản trị CSDL | MySQL 8.0, có stored procedure và trigger | PostgreSQL/Neon và EF Core (PDR-002) |

Mục 1–4 đã chốt ngày 03/11/2026 theo báo cáo, ghi tại [PDR-049](decisions/PDR-049-vong-doi-ket-qua-theo-nhom-de-tai.md) (đóng OQ-019); bảng giữ lại để truy vết. Mục 5–18 là chỗ báo cáo chưa cập nhật theo PDR ngày 28/10, theo dõi ở OQ-020.
