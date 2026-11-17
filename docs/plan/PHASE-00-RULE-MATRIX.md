# Phase 00 — Ma trận quy tắc, quyền, trạng thái và ca kiểm chứng

**Rà soát:** 2026-11-17. **Phạm vi:** đặc tả để triển khai G1–G8; đây là kết quả review tài liệu trên giấy, chưa thay thế kiểm thử tích hợp/API hoặc phê duyệt của người phụ trách nghiệp vụ.

**Thứ tự áp dụng:** `requirements/` và `product/` cùng quyết định PDR được chấp thuận; PDR mới ghi rõ thay thế PDR cũ có hiệu lực cho phần được thay thế; `DESIGN/` mô tả cách hiển thị. Các OQ mở ở cuối tài liệu cần chủ sở hữu ra quyết định trước khi triển khai nhánh tương ứng. Mốc ngày/hạn dùng ngày tại Việt Nam theo PDR của từng nghiệp vụ.

## P00-S01 — Đợt, đề tài, đề xuất và nhóm

| Thực thể và chuyển trạng thái / thao tác | Người thực hiện, điều kiện và hạn | Kết quả và dấu vết bắt buộc | Lặp, tranh chấp và ca kiểm chứng |
| --- | --- | --- | --- |
| Đợt `Nháp → Đang diễn ra` | Giáo vụ; đủ chín mốc đúng thứ tự, ngày hợp lệ, hạn trễ riêng của mốc đã bật; kiểm tra SV không nằm trong đợt đang diễn ra khác | Mở đợt; ghi người/thời điểm. Thiếu người chỉ cảnh báo | Mở lặp hoặc sai mốc bị từ chối; hai yêu cầu mở hai đợt chung SV phải chỉ có tối đa một yêu cầu thắng. **T01, T02**. PDR-029/032/033 |
| Đợt `Đang diễn ra → Đã kết thúc` | Giáo vụ; tất cả đề tài thuộc một trong `Đã hoàn tất`, `Không đủ điều kiện công bố`, `Không có nhóm`; `Bị từ chối` không tính | Lưu sự kiện kết thúc; giữ đề tài, bài nộp và lịch sử | Kết thúc lặp không phát sinh sự kiện mới; có đề tài dở thì từ chối và nêu đề tài. **T03**. PDR-031/048 |
| Sao chép đợt `bất kỳ → Nháp mới` | Giáo vụ; chọn đợt nguồn | Chỉ mang khung chín mốc và cờ nộp trễ, không mang ngày/hạn trễ, SV/GV, đề tài, điểm | Bấm sao chép hai lần tạo hai bản Nháp riêng nếu được yêu cầu; không dùng chung dữ liệu nghiệp vụ. **T04**. PDR-034/041 |
| Gắn hoặc gỡ người tham gia | Giáo vụ; thêm SV vào đợt Đang diễn ra phải kiểm tra PDR-029; chỉ gỡ khi **chưa có dữ liệu nghiệp vụ trong đợt** | Gỡ khỏi danh sách tham gia, giữ tài khoản/đợt cũ; lưu người và thời điểm gỡ | Backend kiểm tra lại cùng giao dịch khi dữ liệu vừa phát sinh. SV có nhóm/đề tài/bài nộp/kết quả và GV có đề tài HD, PB, hội đồng, nhận xét/điểm đều bị khóa. Thông báo đơn thuần không khóa. **T05, T06**. PDR-029/030 |
| Công bố danh sách đề tài `chưa công bố → đã công bố` | Giáo vụ; đợt đang chạy, có ≥1 đề tài, chưa công bố, chưa qua hạn đăng ký; không phải đợi hết hạn GV gửi đề tài | Lưu `TopicsPublishedAt`, lịch sử đề tài; cho SV xem/ghi danh | Công bố lặp bị chặn. Công bố sớm chỉ cảnh báo; công bố sau hạn đăng ký bị chặn. **T07**. PDR-048/053 |
| Đề tài GV `Chưa đăng ký → Đã đăng ký` | Nhóm 1–2 SV thuộc đợt trong cửa sổ đăng ký, đề tài đã công bố, chưa có nhóm | Gắn duy nhất một nhóm, giữ lịch sử đăng ký; các nhóm khác nhận xung đột | Phải cập nhật có điều kiện và ràng buộc duy nhất trong DB; hai nhóm cạnh tranh cùng một đề tài chỉ một nhóm thắng. **T08**. PDR-047/049/054 |
| Đề tài GV `Đã đăng ký → Chưa đăng ký` khi hủy | **Bất kỳ thành viên** nhóm đã đăng ký; còn hạn đăng ký và **chưa từng nộp đề cương** | Gỡ liên kết ghi danh; giữ nguyên nhóm, đại diện và lịch sử lần cũ; có thể ghi danh lại | Hủy lặp/đồng thời với nộp đề cương phải kiểm tra lại điều kiện tại thời điểm ghi. **T09**. PDR-047/054 |
| Đề xuất `Chờ GV duyệt → Đã hủy` | Thành viên nhóm khi đề xuất còn chờ và trong cửa sổ cho phép; PDR-012 | Giữ bản ghi đã hủy và nhóm; rời danh sách GV chờ xử lý; nhóm được đề xuất lại khi đăng ký còn mở | Hủy lặp hoặc GV duyệt đồng thời phải chỉ có một kết quả cuối, giữ lịch sử. **T10**. PDR-012 |
| Đề xuất `Chờ GV duyệt → Đã đăng ký` hoặc `Bị từ chối` | GV được đề xuất; trong điều kiện xử lý đề xuất đã chốt; từ chối có lý do | Duyệt gắn đề tài cho nhóm; từ chối giữ bản ghi/lý do; sau hạn đăng ký ẩn đề xuất bị từ chối khỏi tab Đề tài, vẫn còn lịch sử | GV duyệt/từ chối lặp và sinh viên hủy đồng thời phải kiểm tra trạng thái mới. **T11**. PDR-012/049. **Chờ OQ-028** cho đề xuất vẫn chờ tại hạn đóng |
| Đề tài có nhóm `Đã đăng ký → Đang thực hiện` khi hết hạn đăng ký | Hệ thống; hết cuối mốc đăng ký, **không phụ thuộc duyệt đề cương** | Trạng thái nghiệp vụ khi đọc đúng `Đang thực hiện`; trạng thái nộp/duyệt đề cương theo dõi riêng | Hai lần đọc không làm đổi kết quả; cơ chế lưu sự kiện/historic còn **OQ-030**. **T12**. PDR-049/053 |
| Đề tài đã công bố không nhóm `Chưa đăng ký → Không có nhóm` | Hệ thống; hết hạn đăng ký | Trạng thái kết thúc cho đợt; không tự sinh nhóm | Đọc lặp nhất quán; không biến đề xuất chờ thành không nhóm trước khi chốt **OQ-028**. **T12**. PDR-049 |
| Nhóm | SV tạo/đại diện quản lý theo nghiệp vụ đăng ký hoặc đề xuất | Giữ danh tính, thành viên và đại diện sau hủy đơn/ghi danh; vòng đời nhóm không suy diễn thêm nhãn trạng thái | Một SV không được giữ hai đăng ký/đề xuất đang hoạt động theo các ràng buộc đã có; xử lý tranh chấp ở transaction. **T09–T11**. PDR-012/047/054 |

**T08 — Tranh chấp hai nhóm.** Nhóm A và B cùng gửi đăng ký vào đề tài X còn trống khi cửa sổ đăng ký mở. Transaction A khóa/cập nhật có điều kiện thành công, ghi bản ghi nhóm A và lịch sử một lần. Transaction B không thể cùng sở hữu X, phải nhận phản hồi xung đột (API P03 đã dùng `409`), không để lại đăng ký đang hiệu lực hoặc lịch sử thành công giả. Đảo thứ tự A/B rồi chạy lại trên DB test PostgreSQL. Nếu một request được retry sau khi thành công, kiểm tra trạng thái trước khi ghi thêm bản ghi.

**PDR-030 cho cả hai vai trò.** Kiểm tra độc lập SV chưa có dữ liệu, đã tạo nhóm (kể cả đã hủy ghi danh), đã có bài nộp, kết quả; GV chưa có dữ liệu, GVHD có đề tài, GV phản biện được phân công, Chủ tịch/Thư ký hội đồng, GV đã có nhận xét/phiếu điểm; người chỉ có thông báo. Chạy gỡ từng người, gỡ hàng loạt và gỡ cùng lúc phát sinh tham chiếu. Với người có nghiệp vụ, kết quả là không gỡ và không xóa dấu vết. Các phép kiểm tra đầy đủ này thuộc **G2/G3/G5/G6/G7 integration test**; ma trận là đặc tả, chưa xác nhận code đã đáp ứng.

## P00-S02 — Bài nộp, phân công và lịch bảo vệ

| Chuyển trạng thái / ngoại lệ | Quyền và tiền điều kiện | Kết quả, audit và xử lý lặp | Kiểm chứng |
| --- | --- | --- | --- |
| Đề cương `chưa nộp → các phiên bản → đã duyệt` | Thành viên nhóm nộp PDF trong hạn; GVHD nhận xét, mở/đóng từng yêu cầu sau khi có bản nộp lại liên kết. Chỉ duyệt bản hiện hành khi **tất cả yêu cầu đã đóng** | Giữ mọi phiên bản, yêu cầu, liên kết phiên bản và người xác nhận; GVHD duyệt không làm đổi trạng thái đề tài. Đóng lặp yêu cầu bị từ chối | **T13**. PDR-013/057 |
| Báo cáo Giữa kỳ/Cuối kỳ và Bản khóa luận | Nhóm nộp đúng loại, **PDF hợp lệ ≤20 MB**; cửa sổ hạn thường và hạn trễ riêng từng mốc; bài mới tăng phiên bản | Bản cũ tồn tại và tải được theo quyền. GVHD nhận xét/yêu cầu chỉnh sửa Giữa kỳ/Cuối kỳ; Giữa kỳ không có bước duyệt, yêu cầu Cuối kỳ mở chặn **nhóm tự chốt Thesis**, job tự chốt vẫn hoạt động | **T14, T15**. PDR-039–042/058–060 |
| Ảnh hồ sơ | Chủ tài khoản hoặc người có quyền cập nhật hồ sơ; JPG/PNG/WebP tối đa 2 MB | Từ chối nội dung/size không hợp lệ, không thay ảnh cũ khi lỗi | **T16**. PDR-043 |
| Thesis `chưa chốt → đã chốt một phiên bản` | Thành viên nhóm chọn một `Thesis` đã nộp, chưa chốt và không có yêu cầu Cuối kỳ mở | Lưu con trỏ bản chốt **một lần**, lịch sử; khóa nộp thêm Thesis sau chốt. Retry/đua giữa hai yêu cầu chỉ có một bản cuối | **T17**. PDR-011/059/060 |
| Thesis quá hạn có bản nhưng chưa chốt | Job kiểm tra định kỳ theo **hạn hiệu lực** và giờ VN | Tự chốt bản mới nhất, đúng một sự kiện lịch sử kể cả job chạy lặp; yêu cầu sửa Cuối kỳ mở không ngăn job | **T18**. PDR-011/059/060 |
| Thesis quá hạn **không có bản** | Giáo vụ cấp hạn bổ sung một lần cho đúng nhóm, sau hạn gốc, ngày tương lai, lý do; nếu vẫn không có bản sau hạn bổ sung, Giáo vụ quyết định không đủ điều kiện | Không tự tạo bản/điểm/kết quả. Quyết định `Không đủ điều kiện công bố` có lý do/lịch sử, là trạng thái kết thúc, không mở lại thông thường; **trạng thái nguồn đang chờ OQ-031** | **T19, T40**. PDR-011/059 |
| Gán/thay phản biện | Giáo vụ; chỉ sau khi GVHD **đã duyệt đề cương**. Phản biện nhập điểm sau **Báo cáo cuối kỳ**, không đợi Thesis chốt | Ghi người phân công, thay đổi và thông báo. Từ phiếu phản biện đầu tiên, khóa thay GV phản biện | **T20**. PDR-021–023 |
| Xếp/công bố lịch bảo vệ | Giáo vụ; mỗi đề tài có một lượt hiệu lực; giờ bắt đầu < giờ kết thúc từng lượt; GVHD không chấm hội đồng đề tài mình | Chặn lưu **và** công bố nếu chồng thời gian phòng hoặc GV; hai lượt giáp giờ được phép, lịch sử công bố giữ nguyên | **T21**. PDR-014–017 |
| Sửa/hủy lịch đã công bố trước điểm | Giáo vụ, có lý do, kiểm lại xung đột, báo người bị ảnh hưởng; hủy là trạng thái nghiệp vụ | Lịch mới duy nhất có hiệu lực, giữ bản trước và lịch sử. Hủy không xóa vật lý | **T22**. PDR-016/018/019 |
| Lịch sau điểm đầu tiên | Giáo vụ chỉ **đính chính** giờ/phòng kèm lý do và giữ lịch gốc; không hủy hay thay Chủ tịch/Thư ký bình thường | Khóa thay thành viên từ phiếu đầu, audit đính chính; retry không làm trùng lượt | **T23**. PDR-018–020 |

**Điều kiện công bố thống nhất.** Công bố **danh sách đề tài** theo PDR-048 trước hạn đăng ký, có thể sớm trước khi hết hạn GV gửi. Công bố **kết quả khóa luận** chỉ khi đề tài `Đã xác nhận` và có Thesis đã chốt **hoặc** đã quá hạn chốt mà có ít nhất một Thesis, theo PDR-011/049/059. Thiếu Thesis hoàn toàn không thể công bố dù đã quá hạn. `DESIGN/03` là mô tả giao diện và phải đọc cùng PDR. Điểm REPORT_SPEC khác PDR đang ở OQ-020/025, không coi là quyết định bổ sung.

## P00-S03 — Điểm, mẫu phiếu và quyền tài khoản

| Quy tắc / trạng thái | Người xử lý và tiền điều kiện | Kết quả và lịch sử | Ca kiểm chứng |
| --- | --- | --- | --- |
| Mẫu `Nháp → đã gán / Đóng` | Giáo vụ; mẫu ba vai trò HD, PB, hội đồng. Chủ tịch và Thư ký **chung mẫu** nhưng mỗi SV có **hai phiếu độc lập** | Mẫu đã gán thay tiêu chí bằng **phiên bản mới**; từ phiếu đầu tiên khóa chuyển phiên bản trong đợt. Chỉ xóa Nháp chưa từng gán; Đóng không ngắt chấm của đợt đã gán. Tổng điểm tối đa tiêu chí **lá = 10** | **T24**. PDR-024–028/035 |
| Bốn phiếu của **mỗi SV** | GVHD nhập điểm HD, phản biện nhập PB sau báo cáo cuối kỳ, Thư ký nhập riêng CTHĐ và TKHĐ; Chủ tịch xem, không xác nhận/trả lại | Từ phiếu đầu `Đang cho điểm`, đủ bốn phiếu **cho mọi SV** mới tính kết quả đề tài. Lưu lịch sử thay điểm | **T25**. PDR-050 thay PDR-006; PDR-021–024/049 |
| Lệch điểm & điểm tổng | So 4 cặp CTHĐ–HD, CTHĐ–PB, TKHĐ–HD, TKHĐ–PB trên điểm gốc. Cặp có chênh **≥2,00** cho trạng thái `Có lệch điểm` | Cho lưu phiếu lệch, chặn **xác nhận cả đề tài** khi lệch. Tổng từng SV `(CT + TK + 2×HD + 2×PB)/6`, **decimal HALF UP** đến 2 chữ số, gồm xuất dữ liệu | **T26–T28**. PDR-007/008/049 |
| Xác nhận `Đã cho điểm → Đã xác nhận` | Giáo vụ; mọi SV đủ bốn phiếu, không cặp lệch | Khóa sửa điểm trên **cả nhóm đề tài**; theo lô trả kết quả **từng đề tài**, nêu lý do bỏ qua | **T25, T29**. PDR-049 thay PDR-009/010 |
| Hủy xác nhận `Đã xác nhận → Đã cho điểm` | Giáo vụ, **trước công bố** và bắt buộc lý do | Ghi người/lý do/thời điểm, mở lại quyền sửa điểm; phải xác nhận lại sau sửa. Sau công bố không mở lại thường | **T30**. PDR-005/049 |
| Công bố `Đã xác nhận → Đã hoàn tất` | Giáo vụ; có điều kiện Thesis như phần S02 | Công bố cả nhóm, SV chỉ xem **điểm của mình** sau công bố. Theo lô trả đúng từng đề tài được/bị bỏ qua | **T19, T31**. PDR-011/049/059 |
| Họ tên, khôi phục, thông báo | Chủ tài khoản tự sửa tên; Giáo vụ có quyền chỉnh tên theo PDR-036. Email khôi phục chỉ gửi khi tài khoản hoạt động, đã kích hoạt; mọi email hợp định dạng có phản hồi trung tính, kể cả bị giới hạn | Ghi audit đổi tên; reset giới hạn ≥60 giây/email, ≤5 lần/giờ/email, ≤20 lần/giờ/nguồn. Người gửi ẩn thông báo đã gửi **chỉ ở phía mình**, người nhận còn xem và lịch sử giữ nguyên | **T32–T34**. PDR-036–038/044/045 |

## Bộ ca giấy/kiểm thử biên và kết quả kỳ vọng

| ID | Dữ liệu hoặc hành động | Kỳ vọng theo tài liệu |
| --- | --- | --- |
| T01–T04 | Mở thiếu mốc, thiếu người, hai đợt chung SV, kết thúc khi còn đề tài dở, sao chép | Chặn lỗi mốc/SV/kết thúc; thiếu người cảnh báo; bản sao chỉ giữ khung |
| T05–T06 | Gỡ SV có nhóm; GV có phân công/điểm; người chỉ nhận thông báo; gỡ cùng lúc tạo dữ liệu | Hai vai trò có tham chiếu nghiệp vụ bị chặn, người chưa có dữ liệu được gỡ có lịch sử; transaction không làm đứt tham chiếu |
| T07–T12 | Công bố danh sách sớm/hết hạn, hai nhóm cùng ghi danh, hủy sau đề cương, hủy đề xuất, GV từ chối, hết hạn đăng ký | Chỉ một nhóm thắng; hủy sau đề cương bị chặn; bản hủy/từ chối giữ lịch sử; có nhóm chuyển `Đang thực hiện`, không nhóm chuyển `Không có nhóm`; các trường hợp OQ-028/029/030 phải chờ quyết định |
| T13–T16 | GVHD yêu cầu sửa, SV nộp lại, GVHD đóng, duyệt khi còn yêu cầu mở; PDF sai nội dung/20 MB+; quá hạn riêng; ảnh >2 MB | Không duyệt khi còn yêu cầu mở; đúng quyền và liên kết phiên bản; chặn file/size/hạn sai; giữ bản cũ |
| T17–T19 | Hai yêu cầu chốt hai bản, job chạy hai lần, hết hạn không có Thesis, cấp hạn một lần rồi không nộp | Chỉ một bản chốt/một sự kiện; job không tự chấm; ngoại lệ chờ Giáo vụ, `Không đủ điều kiện công bố` có lý do, **không công bố**; nguồn trạng thái chờ OQ-031 |
| T20–T23 | Phân công PB trước khi duyệt, nhập điểm PB trước báo cáo cuối, trùng phòng/GV, hai lượt giáp nhau, thay thư ký sau điểm | Chặn phân công/chấm sớm; chặn chồng lấn, cho phép giáp giờ; sau điểm khóa thay người/hủy, chỉ đính chính có audit |
| T24 | Sửa mẫu đang gán, đổi phiên bản sau điểm đầu, xóa mẫu Đóng/đã gán, tổng tiêu chí lá 10,01 | Chặn trực tiếp/đổi/xóa; phiên bản mới không phá lịch sử; tổng vượt 10 bị từ chối |
| T25 | Nhóm hai SV, SV A đủ 4 phiếu, SV B thiếu 1 phiếu | Cả đề tài `Đang cho điểm`, không xác nhận; không công bố kết quả của riêng SV A |
| T26 | Bốn điểm có một cặp lệch đúng **2,00** | `Có lệch điểm`, vẫn lưu được phiếu; xác nhận bị chặn; nhắc đúng các giảng viên liên quan |
| T27 | Bốn điểm chỉ có các cặp lệch tối đa **1,99** | Không có cờ lệch, đủ điểm thì `Đã cho điểm` |
| T28 | Tổng thô **7,125**, rồi **7,124** | Kết quả **7,13** và **7,12** ở UI/API/export; so lệch bằng điểm thành phần gốc |
| T29–T31 | Xác nhận lô gồm đề tài đủ/thiếu điểm/lệch; hủy xác nhận có/không lý do; công bố thiếu Thesis | Chỉ đề tài hợp lệ thành công, báo lý do từng đề tài; không lý do từ chối; thiếu Thesis chặn công bố |
| T32–T34 | Tự sửa họ tên, email không tồn tại/vô hiệu/chưa kích hoạt, spam reset, ẩn thông báo đã gửi | Sửa có audit; phản hồi reset trung tính, chỉ tài khoản hợp lệ nhận thư; ẩn không mất bản của người nhận |
| T35 | Nhóm có yêu cầu sửa **Cuối kỳ** chưa đóng, đã có Thesis và muốn `POST /thesis/lock`; nhóm khác có yêu cầu sửa **Giữa kỳ** chưa đóng | Chặn chốt thủ công nhóm đầu bằng 409, `CanLock=false` và lý do; yêu cầu Giữa kỳ không chặn chốt ở nhóm sau (PDR-060) |
| T36 | Hai nhóm đều có yêu cầu sửa Cuối kỳ mở; job chạy sau hạn hiệu lực, một nhóm có nhiều Thesis, nhóm còn lại chưa nộp Thesis | Job tự chốt bản mới nhất đúng một lần cho nhóm có Thesis; không tự tạo bản cho nhóm trống; yêu cầu mở vẫn giữ lịch sử và không chặn job (PDR-011/059/060) |
| T37 | Đề tài `Đã xác nhận`, đã có Thesis nhưng chưa chốt, trước/sau hạn hiệu lực; đề tài khác quá hạn nhưng không có Thesis | Trước hạn không công bố; sau hạn và có ít nhất một Thesis được xét công bố theo PDR-011/049/059; thiếu Thesis luôn chặn. Không bỏ qua điều kiện xác nhận cả nhóm |
| T38 | Giáo vụ duyệt đề cương trước hạn đăng ký; hệ thống đọc lại đề tài trước/sau hạn đăng ký | Duyệt chỉ hoàn tất chặng Đề cương; đề tài `Đã đăng ký` trước hạn, `Đang thực hiện` từ lúc hết hạn. Lưu trạng thái/audit theo OQ-030 |
| T39 | Đề tài hai SV có đủ bốn điểm mỗi người, yêu cầu xác nhận/công bố lặp, một SV gọi xem điểm của SV còn lại | Xác nhận/công bố cả đề tài chỉ một lần; lặp không tạo lịch sử giả; SV chỉ thấy điểm chính mình khi đã công bố; thao tác trái quyền nhận 403/404 theo hợp đồng endpoint (PDR-049/050) |
| T40 | Giáo vụ kết thúc không đủ điều kiện sau hạn bổ sung từ từng trạng thái `Đang thực hiện`, `Đang cho điểm`, `Có lệch điểm`, `Đã cho điểm`, `Đã xác nhận` | **Chưa xác định quyền chuyển với mọi trạng thái nguồn**; owner giải quyết OQ-031 rồi bổ sung expected API/status/audit trước G4/G7. Không tự chọn một tập nguồn |

**Lỗi cần bắt ở API khi triển khai:** `400` với payload/định dạng không hợp lệ, `401` chưa xác thực, `403` sai vai trò, `404` tài nguyên ngoài phạm vi, `409` xung đột trạng thái/hạn/phiên bản khi PDR đã định nghĩa (đặc biệt PDR-054/059/060). Phản hồi dùng `ApiResponse`; mã chính xác của mỗi endpoint mới phải chốt trong **G0.2** và test hợp đồng. Không cho UI quyết định kết quả concurrency hoặc quyền cuối cùng.

## Truy vết PDR, DESIGN, OQ và phase phụ thuộc

| Phạm vi nguồn đã đối chiếu | Bộ test và phase thực thi | Phần cần sửa/chấp thuận |
| --- | --- | --- |
| PDR-005–010 (006 bị PDR-050 thay; 009–010 bị PDR-049 thay) | T25–T31/T39, **G7** | R03/R09 trong `REVIEW.md` đã ghi nguồn mới; 4 phiếu cho từng SV, xác nhận theo đề tài |
| PDR-011–013, 039–043, 047, 057–060 | T09–T19/T35–T38/T40, **G3/G4/G7** | Phân biệt `Final` và `Thesis`, không coi hết hạn là đã có Thesis; PDR-058 thay giới hạn nộp trễ ban đầu của PDR-057 |
| PDR-014–023 | T20–T23, **G5/G6/G7** | Lịch trùng chặn; reviewer gán sau duyệt đề cương, nhập điểm sau báo cáo cuối |
| PDR-024–028, 035 | T24, **G5/G7** | Cần test snapshot phiên bản và tổng tối đa 10 |
| PDR-029–034, 048, 053–054 | T01–T12, **G2/G3** | OQ-028/029/030 và ca gỡ người đồng thời cần được giải quyết trước nghiệm thu phần phụ thuộc |
| PDR-036–038, 044–045 | T32–T34, **G1/G8** | Giữ phản hồi trung tính, giới hạn tần suất và quyền lịch sử |
| PDR-046 | Kiểm thử 100 concurrent users **sau G8** | **OQ-007 hoãn**, ngoài cổng MVP |

**Bất nhất đã đồng bộ trong lượt này:** `requirements/WORKFLOWS.md`, PDR-013/021 về điểm bắt đầu `Đang thực hiện`; PDR-024/050 về nhập điểm hội đồng; PDR-057/058 về nộp trễ Đề cương; PDR-060 về link hợp đồng Báo cáo; `plan/REVIEW.md` R03/R09; kế hoạch Phase 07; nhãn cũ về Chủ tịch xác nhận và gỡ Giảng viên trong `DESIGN/03`; nhật ký OQ-011 và các OQ mới. Những phần còn chờ chủ nghiệp vụ được để mở rõ ràng, tránh suy diễn từ REPORT_SPEC hay giao diện.

| OQ/R | Rủi ro và đầu ra chờ quyết định | Bước phụ thuộc |
| --- | --- | --- |
| OQ-020 | REPORT_SPEC §10 mục 6–18 khác PDR; owner xác nhận giữ PDR hay đổi PDR/report | **CP00**, trước G4–G8 phần liên quan |
| OQ-025(a–l) | Mâu thuẫn/thiếu quy tắc giữa REPORT_SPEC, PDR, DESIGN, BUSINESS_RULES; rà từng dòng và ra quyết định; phần (d) đồng bộ WORKFLOWS theo PDR-049 nhưng vẫn theo dõi đối chiếu | **CP00**, trước G2–G8 khi ảnh hưởng API/DB |
| OQ-028 | Đề xuất còn `Chờ GV duyệt` lúc đóng đăng ký: trạng thái cuối, quyền và lịch sử; PDR-049 đòi không còn trạng thái chờ | **P00-S01/CP00 → G3** |
| OQ-029 | Tạo đề tài sau hạn GV gửi khi đã quá hạn đăng ký và danh sách chưa công bố; quy tắc đóng/khôi phục đợt | **P00-S01/CP00 → G2/G3** |
| OQ-030 | Trạng thái hết hạn tính khi đọc hay được ghi; mốc audit và tính duy nhất khi retry/đồng thời | **P00-S01/CP00 → G2/G3** |
| OQ-031 | Tập trạng thái nguồn cho kết thúc ngoại lệ `Không đủ điều kiện công bố`, có cần hủy xác nhận trước và mã lỗi khi chuyển sai | **P00-S02/S03/CP00 → G2/G4/G7** |
| OQ-022/023/024/026/027 | Hạ tầng, mã dùng chung, tài liệu cũ, Products/migration và typography; giữ theo trạng thái hiện tại đến quyết định riêng | **G0.2/G1/G8** theo module, chưa gán hoàn thành CP00 |
| R03/R09 | Lịch sử review dùng PDR-006/009/010 cũ; ghi rõ PDR-050/049 thay thế | **P00-S03**, đã cập nhật tham chiếu |
| OQ-007 | SLA/NFR và tải 100 concurrent users hoãn theo PDR-046 | **Sau G8**, không chặn Phase 00–08 |

**Biên bản nghiệm thu giấy:** ma trận và kịch bản T01–T40 đã được lập từ PDR/requirements. Ca T40 nêu rõ expected result đang thiếu quyết định. Chưa có chữ ký/chấp thuận sản phẩm, chưa chạy hệ thống hoặc DB concurrency cho các ca này. **CP00 chỉ đạt khi các OQ chặn luồng đã được người có thẩm quyền quyết định, tài liệu liên quan đã đồng bộ và có xác nhận của người phụ trách sản phẩm/kỹ thuật.**
