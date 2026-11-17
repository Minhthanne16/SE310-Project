# Kế hoạch hoàn tất MVP QLKLTN

**Trạng thái:** Đang triển khai; chưa đạt nghiệm thu MVP

**Cập nhật:** 2026-11-17 (rà soát tài liệu Phase 00/G0.1); đối chiếu codebase và test gần nhất ngày 2026-11-16.

**Mục đích:** Biến nền kỹ thuật và các màn hình hiện có thành MVP quản lý khóa luận tốt nghiệp có thể vận hành trọn một đợt trên dữ liệu thật.

## 1. Căn cứ và ranh giới

Nguồn nghiệp vụ ưu tiên theo thứ tự là `docs/requirements/`, `docs/product/`, các PDR trong `docs/decisions/`, rồi `docs/architecture/`. `docs/DESIGN/` chỉ quyết định cách thể hiện khi không mâu thuẫn với các nguồn trên. Các file phase hiện có trong thư mục này là đặc tả chi tiết cho từng luồng; kế hoạch này tổ chức chúng thành backlog thực thi, cổng chất lượng và thứ tự phụ thuộc.

Tài liệu được người dùng đính kèm về **phục hồi chức năng khớp vai** không thuộc sản phẩm QLKLTN. Nó không được dùng để thay đổi vai trò, dữ liệu, thuật toán hoặc phạm vi MVP; chỉ tham khảo cách trình bày một kế hoạch end-to-end.

Không mở rộng MVP sang SLA, RPO/RTO, thời hạn lưu trữ tổng quát hoặc kiểm thử tải. Đây là OQ-007 đang tạm hoãn; bài kiểm thử 100 người dùng đồng thời theo PDR-046 thực hiện sau khi luồng chức năng hoàn chỉnh.

## 2. Đích nghiệm thu MVP

MVP hoàn tất khi một **đợt khóa luận** có thể đi từ chuẩn bị đến công bố kết quả mà không cần bảng tính hoặc kho dữ liệu giả là nguồn chính:

1. Giáo vụ quản lý tài khoản, mở đợt có mốc và người tham gia.
2. Giảng viên tạo/công bố đề tài; Sinh viên lập nhóm, ghi danh hoặc đề xuất đề tài.
3. Nhóm nộp đề cương, báo cáo và bản cuối theo phiên bản; Giảng viên xử lý đúng quyền.
4. Giáo vụ cấu hình mẫu, phân công phản biện, lập hội đồng và công bố lịch.
5. Bốn thành phần điểm của từng Sinh viên được nhập, kiểm tra, xác nhận và công bố đúng điều kiện.
6. Ba vai trò (Sinh viên, Giảng viên, Giáo vụ) chỉ thấy/thao tác dữ liệu thuộc quyền; lịch sử và thông báo giải thích được thay đổi quan trọng.

Ngoài tiêu chí nghiệp vụ, mọi lát cắt MVP phải có migration được review, kiểm soát quyền ở backend, UI dùng API thật, kiểm thử hành vi và hướng dẫn vận hành local/test. Không coi một màn hình, stub 501, seed frontend hoặc API đơn lẻ là hoàn thành.

## 3. Điểm xuất phát cần xử lý

| Nhóm | Có thể dùng làm nền | Chưa đạt MVP / cần hoàn tất |
| --- | --- | --- |
| Xác thực và nhập người dùng | Đăng nhập JWT-cookie, đổi mật khẩu lần đầu, import CSV preview/import và seed local đã có. | Quản trị vòng đời tài khoản, quên/đặt lại mật khẩu có giới hạn, audit; kiểm chứng toàn bộ UI với API thật. |
| Hồ sơ cá nhân | Đọc/sửa hồ sơ, đổi mật khẩu, audit, avatar MinIO và chuông dùng API thật ([PDR-051](../decisions/PDR-051-ho-so-anh-dai-dien-va-chuong-thong-bao.md)). | Áp dụng migration `AddProfileContactAndNotifications` có kiểm soát ở từng môi trường; lịch sử nhiều lần đăng nhập chưa có. |
| Đợt, đề tài, đăng ký, tài liệu, hội đồng, điểm, kết quả | Có nhiều màn frontend/demo và một phần mẫu phiếu đánh giá. | Chưa có mô hình dữ liệu/API nghiệp vụ end-to-end; không được nối trực tiếp UI demo vào nghiệm thu. |
| Hạ tầng dùng chung | PostgreSQL local/Neon hướng dẫn, email và Docker Compose đã có. | Cấu hình storage, migration có kiểm soát, môi trường test cô lập, secret, sao lưu/khôi phục theo phạm vi được chốt. |

`Products` là mô-đun mẫu/legacy được giữ theo PDR-002; không lấy nó làm tiêu chí MVP QLKLTN và không tự xóa trong kế hoạch này.

## 4. Thứ tự phụ thuộc

```text
Nền tài khoản + hồ sơ + storage
            ↓
Đợt + chín mốc + người tham gia
            ↓
Đề tài + nhóm + ghi danh/đề xuất
            ↓
Đề cương + bài nộp + bản cuối
            ├────────→ Mẫu phiếu + phân công phản biện
            │                         ↓
            └────────→ Hội đồng + lịch bảo vệ
                                      ↓
                           Chấm điểm + xác nhận + công bố
                                      ↓
                         Thông báo + báo cáo + E2E release gate
```

Không làm song song các migration hoặc thay đổi cùng hợp đồng API. Có thể song song UI với backend **chỉ sau khi** endpoint, request/response, mã lỗi và quyền đã được chốt bằng test/API contract.

## 5. Backlog thực thi theo lát cắt

Mỗi task dưới đây có kích thước S hoặc M. Khi thực hiện phải tách commit/PR đủ nhỏ để review, viết test trước với logic hay bug, rồi cập nhật tài liệu nếu quy tắc nghiệp vụ đổi.

### G0 — Khóa phạm vi và chuẩn bị môi trường

**Phụ thuộc:** Không.  
**Tài liệu chi tiết:** `phase-00-chot-nghiep-vu.md`.

#### G0.1 — Lập ma trận quy tắc, trạng thái và quyền

- [x] Tạo ma trận entity–trạng thái–chuyển trạng thái–vai trò từ PDR-005 đến PDR-047.
- [x] Rà các chỗ DESIGN mâu thuẫn PDR và ghi rõ PDR là nguồn thực thi; không biến ghi chú giao diện thành quy tắc mới.
- [x] Gắn mỗi quy tắc với test biên và lỗi dự kiến.

**Bằng chứng hoàn thành đầu việc G0.1 (2026-11-17):** [Ma trận Phase 00 và ca giấy T01–T40](PHASE-00-RULE-MATRIX.md), [kết quả Phase 00](phase-00-chot-nghiep-vu.md), [OPEN_QUESTIONS](../OPEN_QUESTIONS.md) và [REVIEW](REVIEW.md). Đây là kết quả rà soát tài liệu, chưa phải bằng chứng test API/DB.

**Nghiệm thu:** Không còn quy tắc chưa xác định trong luồng đợt → công bố; OQ-007 được ghi rõ là ngoài cổng MVP.  
**Kiểm chứng:** Review chéo ma trận với `OPEN_QUESTIONS.md`, `REVIEW.md` và PDR liên quan.
**Tình trạng nghiệm thu G0.1:** Chưa đạt do OQ-020/025/028/029/030/031 còn cần quyết định, đặc biệt ca T40 chưa có kết quả xác định; checkpoint CP00 chưa được phê duyệt.

#### G0.2 — Chuẩn hóa quy trình kỹ thuật và môi trường test

- [ ] Xác định database local/test tách biệt Neon/shared; ghi cách tạo, migrate và reset test an toàn.
- [ ] Chốt contract `ApiResponse`, lỗi 400/401/403/404/409, paging/filter và quy ước thời gian trước khi thêm endpoint.
- [ ] Thêm checklist review migration: SQL, index/ràng buộc, rollback hợp lý và seed chỉ local/test.

**Nghiệm thu:** Không có thao tác test nào yêu cầu migrate/seed database chung; mọi module mới có điểm kiểm thử backend và frontend rõ ràng.

### G1 — Tài khoản, hồ sơ và nền dùng chung

**Phụ thuộc:** G0.  
**Tài liệu chi tiết:** `phase-01-tai-khoan-va-nen-dung-chung.md`.

#### G1.1 — Hoàn tất và kiểm chứng auth/CSV hiện hữu

- [ ] Kiểm thử ba role, cookie HttpOnly, security stamp, OTP, resend, lockout và import CSV transaction/line errors.
- [ ] Đối chiếu service/type/frontend với endpoint thực tế; xóa nhãn hoặc luồng nào chỉ giả lập.

**Nghiệm thu:** Tài khoản ở từng trạng thái chỉ có đúng quyền đã nêu trong PDR-002/003/004; nhập lại/tranh chấp email không tạo dữ liệu trùng.

#### G1.2 — Quản trị tài khoản và khôi phục truy cập

- [x] Hoàn chỉnh API/UI danh sách, tạo, sửa, vô hiệu hóa/kích hoạt, xóa khi không có tham chiếu và reset bởi Giáo vụ.
- [x] Thực hiện quên mật khẩu trung tính, token một lần 30 phút, rate-limit PDR-044 và điều kiện nhận thư PDR-045.
- [x] Audit các thao tác quản trị; token/mật khẩu không được xuất hiện trong log, response hay file xuất.

**Nghiệm thu:** Tài khoản có tham chiếu không bị xóa vật lý; phiên cũ bị thu hồi sau reset/đổi mật khẩu; giới hạn 60 giây, 5/giờ/email và 20/giờ/nguồn có test biên. *(2026-11-07: hợp đồng PDR-004/PDR-052.)*

#### G1.3 — Hoàn tất hồ sơ và avatar trên MinIO

- [x] Review lát `Profiles` đang dở dang, viết migration cho trường hồ sơ đã chọn; không chỉnh migration đã áp dụng.
- [x] Cung cấp `GET/PUT /api/profile`, đổi mật khẩu thường và endpoint/avatar flow theo contract đã chốt; self-service họ tên theo PDR-036 và audit khi Giáo vụ sửa tên người khác.
- [x] Tích hợp MinIO qua backend: validate magic bytes, JPG/PNG/WebP tối đa 2 MB, object key không đoán được, authorization khi đọc, dọn object mồ côi theo transaction/error strategy.
- [x] Thay profile demo và stub 501 bằng API thật; hiển thị loading/error/empty có thể dùng bàn phím.

**Nghiệm thu:** Dữ liệu tồn tại sau refresh; user thường không thể xem/sửa hồ sơ người khác qua API; ảnh giả ảnh/quá 2 MB không thay ảnh cũ; đổi mật khẩu thu hồi phiên cũ.

**Checkpoint G1:** Chạy test backend/frontend liên quan trên DB test; luồng login → hồ sơ → logout thực tế thành công cho ba role.

### G2 — Đợt khóa luận, chín mốc và người tham gia

**Phụ thuộc:** G1.  
**Tài liệu chi tiết:** `phase-02-dot-khoa-luan.md`.

#### G2.1 — Vòng đời đợt và chín mốc

- [x] Tạo entity/migration/API/UI cho Nháp, Đang diễn ra, Đã kết thúc, sao chép và xóa đúng điều kiện.
- [x] Lưu chín mốc, validation thứ tự ngày/giờ, hạn nộp trễ riêng PDR-041 và Gantt dữ liệu thật.
- [x] Mở đợt bắt buộc đủ mốc; thiếu người chỉ cảnh báo; kết thúc bị chặn nếu còn đề tài chưa ở trạng thái cuối hợp lệ.

*(Đối chiếu code 2026-11-16: `RoundHandlers`, `RoundsController`, `RoundRepository`, `RoundRules`, `CreateRoundDialog`, `RoundLifecycleDialog`, `RoundGantt` và `RoundHomePage`; `RoundWorkflowTests` cùng test UI xác nhận sao chép, chín mốc, cảnh báo thiếu người và các điều kiện chuyển trạng thái. Khi chạy frontend cần bật `NEXT_PUBLIC_ROUNDS_API=true` để lấy dữ liệu thật. Mục G2.2 vẫn chưa hoàn tất vì thao tác đồng thời có thể vượt bước kiểm tra trùng SV, chưa ghi đủ history khi gỡ người và cấu hình mặc định còn dùng demo.)*

**Nghiệm thu:** Sao chép chỉ mang khung cấu hình theo PDR-034; các ca sai mốc, mốc giáp ranh và deadline trễ đều có test.

#### G2.2 — Tham gia đợt và dashboard theo quyền

- [ ] Thêm/gỡ SV/GV với constraints/transaction chống một SV thuộc hai đợt đang diễn ra.
- [ ] Chặn gỡ người đã có dữ liệu nghiệp vụ nhưng cho gỡ người chưa có dữ liệu, đồng thời ghi history.
- [ ] Thay dashboard/round demo bằng query theo role/đợt thật.

**Nghiệm thu:** Quyền xuyên đợt bị từ chối tại backend; thao tác đồng thời không phá PDR-029/030.

**Checkpoint G2:** Giáo vụ tạo–cấu hình–mở một đợt; SV/GV thấy chính xác phần được giao sau reload.

### G3 — Đề tài, nhóm, ghi danh và đề xuất

**Phụ thuộc:** G2.  
**Tài liệu chi tiết:** `phase-03-de-tai-va-dang-ky.md`.

#### G3.1 — Đề tài do Giảng viên quản lý và Giáo vụ công bố

- [x] Xây entity/API/UI cho tạo/sửa/xóa/công bố đề tài và lịch sử.
- [x] Áp dụng quyền GVHD/Giáo vụ, trạng thái trước/sau công bố và cảnh báo tải đề tài không chặn lưu.

**Nghiệm thu:** Đề tài đã có nhóm không thể bị xóa/sửa trái quy tắc; SV chỉ xem sau công bố. *(2026-11-07: [PDR-053](../decisions/PDR-053-de-tai-giang-vien-va-cong-bo-danh-sach.md).)*

#### G3.2 — Nhóm và ghi danh đề tài công bố

- [x] Bảo đảm nhóm 1–2 SV, đúng đợt, đúng đại diện và một SV/một nhóm/đợt. *(backend, PDR-054)*
- [x] Dùng ràng buộc DB + transaction cho tranh chấp hai nhóm nhận một đề tài và idempotency. *(backend, PDR-054)*
- [ ] Thực hiện hủy theo PDR-047, giữ nhóm/đại diện/lịch sử để ghi danh lại.

*(Rà soát 2026-11-15: `CancelRegistrationHandler` đã chặn hủy sau khi nộp đề cương, có test tại `OutlineWorkflowTests`; tuy nhiên `RegistrationMapping.BuildAsync` chưa tính điều kiện này vào `canCancel`, nên UI vẫn có thể hiện nút hủy không hợp lệ. Giữ mục này chưa hoàn tất đến khi đồng bộ trạng thái nút với quyền thực tế.)*

**Nghiệm thu:** Một trong hai yêu cầu đồng thời thắng; hủy ở mốc không hợp lệ bị chặn và thao tác lặp không làm sai trạng thái.

#### G3.3 — Đề xuất đề tài và quyết định GVHD

- [x] Tạo/sửa/hủy đề xuất chờ, duyệt/từ chối bắt buộc lý do và lịch sử.
- [x] Áp dụng PDR-012: chỉ hủy khi chờ GV, đề xuất lại dùng nguyên nhóm và không tạo nhóm thứ hai.

*(Đối chiếu 2026-11-15: `TopicProposalRequests`, API đề xuất, màn `/sv/don-dang-ky` và `/gv/de-xuat`; `TopicWorkflowTests`, `RegistrationConcurrencyTests` và test giao diện. PostgreSQL concurrency test cần chạy lại trên DB test khi nghiệm thu E2E.)*

**Checkpoint G3:** Nhóm 1 SV và 2 SV hoàn thành đầy đủ ghi danh hoặc đề xuất trên UI/API thật, gồm ca cạnh tranh.

### G4 — Đề cương, phiên bản tài liệu và bản cuối

**Phụ thuộc:** G3.  
**Tài liệu chi tiết:** `phase-04-de-cuong-va-tai-lieu.md`.

#### G4.1 — Đề cương, yêu cầu sửa và duyệt

- [x] Version hóa đề cương, yêu cầu chỉnh sửa của GVHD, nộp lại một bản cho các yêu cầu mở và duyệt (không đổi trạng thái đề tài theo PDR-049; xem [PDR-057](../decisions/PDR-057-de-cuong-va-yeu-cau-chinh-sua.md)).
- [ ] Gắn mọi quyết định với người, thời điểm và bản nộp; áp dụng deadline/late-submission từ đợt. Đã có người/thời điểm/bản nộp và hạn mốc Đề cương; còn nộp trễ chờ P02 lưu hạn trễ riêng (PDR-041).

**Nghiệm thu:** Còn yêu cầu mở không thể duyệt; phiên bản cũ luôn tra cứu được; GVHD khác không xử lý được.

#### G4.2 — Upload báo cáo giữa kỳ/cuối kỳ

- [ ] Dùng storage qua backend, chỉ chấp nhận PDF thực sự tối đa 20 MB, kiểm tra quyền xem/tải và giữ tất cả version theo PDR-039–042.
- [ ] Bảo đảm lỗi storage/database không để record hoặc object mồ côi.

**Nghiệm thu:** File giả PDF/sai quyền/quá dung lượng bị chặn; các mốc đúng hạn, trong hạn trễ và quá hạn cho kết quả đúng. *(2026-11-12: đã triển khai theo [PDR-058](../decisions/PDR-058-nop-bao-cao-giua-ky-cuoi-ky.md), kiểm thử tự động với storage giả; còn thiếu chạy thật trên MinIO và các phần phụ thuộc P04-S01/P05 nên chưa tick.)*

#### G4.3 — Chốt bản khóa luận cuối và ngoại lệ

- [x] Chốt thủ công/tự động idempotent; hỗ trợ hạn bổ sung một lần theo PDR-011.
- [x] Giáo vụ mới được kết thúc `Không đủ điều kiện công bố` có lý do nếu vẫn không có bản; trạng thái này không tự thành điểm không đạt.

*(Đối chiếu 2026-11-15: [PDR-059](../decisions/PDR-059-chot-ban-khoa-luan-cuoi.md), `ThesisFinalizationRequests`, `ThesisFinalizationJob`, migration `AddThesisFinalization`, API `/api/topics/{id}/thesis/*`, `SubmissionPanel` và test handler/UI. Đã hoàn thiện đường code và test tự động; **chưa nghiệm thu** job trên PostgreSQL + MinIO thật, migration trên DB test và build frontend production.)*

**Checkpoint G4:** Một nhóm có lịch sử nộp nhiều bản và nhóm không nộp được xử lý đúng, dữ liệu/tệp vẫn truy vết được sau restart.

### G5 — Mẫu đánh giá và phân công phản biện

**Phụ thuộc:** G2, G4.  
**Tài liệu chi tiết:** `phase-05-phieu-va-phan-bien.md`.

#### G5.1 — Mẫu điểm có phiên bản

- [ ] Hoàn chỉnh mẫu HD, PB và mẫu hội đồng dùng chung; tiêu chí lá tổng tối đa 10 theo PDR-035.
- [ ] Thực thi draft/version/lock/close/delete theo PDR-024–028; snapshot mẫu cho phiếu sau này.

**Nghiệm thu:** Mẫu từng gán không bị xóa; thay đổi không làm đổi phiếu cũ; mẫu hội đồng dùng chung version nhưng hai phiếu độc lập.

#### G5.2 — Phân công phản biện

- [x] Phân công sau duyệt đề cương; chặn GVHD tự phản biện; triển khai batch có báo cáo từng dòng (P05-S02, PDR-062; test workflow, API và PostgreSQL).
- [ ] Cho đổi trước phiếu với history, khóa đổi sau phiếu đầu tiên; chỉ mở nhập điểm PB sau báo cáo cuối kỳ. *(Đổi trước phiếu có history/thông báo và khóa theo `ReviewerFirstScoredAt` đã có test; còn đặt dấu khóa cùng phiếu đầu tiên và chặn lưu phiếu khi chưa có báo cáo cuối kỳ ở P07-S01.)*

**Checkpoint G5:** Danh sách phản biện cho GV lấy từ API thật, permissions và điều kiện PDR-021–023 có test.

### G6 — Hội đồng và lịch bảo vệ

**Phụ thuộc:** G5.  
**Tài liệu chi tiết:** `phase-06-hoi-dong-va-lich-bao-ve.md`.

#### G6.1 — Hội đồng và bất biến thành viên

- [ ] Quản lý Chủ tịch/Thư ký, thành viên, đề tài và lịch sử; ngăn trùng vai trò, GVHD chấm đề tài mình và hơn một lượt có hiệu lực.
- [ ] Khóa thay Chủ tịch/Thư ký từ phiếu đầu tiên theo PDR-020.

#### G6.2 — Lập lịch, công bố, sửa/hủy/đính chính

- [ ] Nhập start/end/room, chặn trùng phòng và trùng lịch Giảng viên bằng transaction/ràng buộc thích hợp.
- [ ] Thực hiện công bố idempotent; sửa/hủy trước điểm có lý do/history/notification; sau điểm chỉ đính chính theo PDR-018/019.

**Nghiệm thu:** Case chồng lấn, sát giờ, đồng thời, sau điểm đều xác định; lịch cũ/hủy vẫn tra cứu được và không xóa vật lý.

**Checkpoint G6:** Giáo vụ công bố lịch; đúng SV/GV thấy thông tin qua API và UI, các user khác bị chặn.

### G7 — Chấm điểm, xác nhận và công bố

**Phụ thuộc:** G4, G5, G6.  
**Tài liệu chi tiết:** `phase-07-cham-diem-va-ket-qua.md`.

#### G7.1 — Bốn phiếu điểm và luồng Chủ tịch/Thư ký

- [ ] Nhập HD, PB, CTHĐ, TKHĐ theo từng SV và quyền bối cảnh; ghi snapshot mẫu, người nhập/chấm, lịch sử sửa và audit.
- [ ] Thư ký nhập/sửa điểm CTHĐ và TKHĐ; Chủ tịch chỉ xem, không có bước xác nhận hay trả lại (PDR-050, thay PDR-006).

#### G7.2 — Công thức, cảnh báo và trạng thái đề tài

- [ ] Tính `(CTHĐ + TKHĐ + 2×CBHD + 2×CBPB) / 6`, làm tròn số học hai chữ số.
- [ ] Cảnh báo bốn cặp chéo chênh từ 2,00 trở lên, vẫn cho lưu điểm nhưng chặn Giáo vụ xác nhận đề tài khi còn lệch; chỉ tính tổng khi đủ bốn điểm (PDR-049).

#### G7.3 — Xác nhận/công bố đơn lẻ và theo lô

- [ ] Xác nhận/công bố theo từng đề tài hoặc lô đề tài, báo lý do từng đề tài bỏ qua; hủy xác nhận trước công bố cần lý do/history và khóa sau công bố (PDR-049).
- [ ] Không công bố khi thiếu điều kiện bản cuối; chỉ SV liên quan xem điểm sau công bố.

**Nghiệm thu:** Đề tài 2 SV có điểm riêng từng người nhưng dùng trạng thái xác nhận/công bố chung của đề tài; các mốc 1,99/2,00 và giá trị làm tròn giữa có test ở API/UI/export.

**Checkpoint G7:** Hai kịch bản 1 SV, 2 SV hoàn thành chấm → xác nhận → công bố không dùng dữ liệu demo.

### G8 — Thông báo, báo cáo và release gate

**Phụ thuộc:** G1–G7.  
**Tài liệu chi tiết:** `phase-08-thong-bao-bao-cao-va-hoan-thien.md`.

#### G8.1 — Thông báo và audit nghiệp vụ

- [ ] Event thông báo cho đăng ký, duyệt, phân công, lịch, điểm và công bố; trạng thái đọc riêng từng người nhận.
- [ ] Áp dụng PDR-038: người gửi chỉ ẩn khỏi danh sách của mình, không xóa nội dung hay trạng thái người nhận.

#### G8.2 — Thống kê và xuất dữ liệu

- [ ] Báo cáo trạng thái đề tài, sáu chặng, tải GV và phân bố điểm từ DB thật.
- [ ] Xuất theo quyền/filter/đợt và chống CSV/Excel formula injection cho giá trị bắt đầu `=`, `+`, `-`, `@`.

#### G8.3 — E2E, vận hành và dọn demo

- [ ] Chạy kịch bản E2E đầy đủ cho nhóm 1/2 SV cùng các ngoại lệ PDR chính.
- [ ] Chạy test/backend/frontend build tương ứng, review migration SQL và verify cấu hình DB, email, MinIO, secret, CORS/cookie.
- [ ] Loại kho demo/stub khỏi tất cả màn nghiệp vụ được gắn mốc MVP; giữ Products legacy theo PDR-002.

**Checkpoint G8 / Definition of Done:** Mọi tiêu chí tại mục 2 có bằng chứng test hoặc thao tác thực tế trên môi trường test cô lập; không còn lỗi Critical/High chưa có quyết định chấp nhận rủi ro bằng văn bản.

### Rà soát codebase ngày 2026-11-16, bổ sung Phase 00 ngày 2026-11-17 — tiến độ và kịch bản demo

Đếm **55 checkbox triển khai** ở G0–G8 (không tính bốn checkbox phê duyệt ở mục 9): **23/55 = 41,8%**, gồm **19 đầu việc đối chiếu code/test ngày 2026-11-16**, **3 đầu việc lập đặc tả G0.1 ngày 2026-11-17** và **1 đầu việc G5.2 (P05-S02) ngày 2026-11-17**. Đây là **tỷ lệ đầu việc được đánh dấu theo bằng chứng code/test hoặc tài liệu**, chưa phải phần trăm MVP đủ điều kiện vận hành; G0.1 và CP00 chưa đạt nghiệm thu, các checkpoint E2E và cổng release chưa đạt.

| Nhóm | Đã đánh dấu / tổng | Phần có thể chứng minh | Phần chưa đủ để nghiệm thu |
| --- | ---: | --- | --- |
| G0 | 3/6 | Đã lập ma trận quy tắc, quyền, trạng thái, đối chiếu DESIGN/PDR và ca giấy T01–T40 | Chờ quyết định OQ-020/025/028/029/030/031, phê duyệt CP00; G0.2 còn quy trình DB test, API contract và review migration |
| G1 | 7/9 | Quản trị tài khoản, reset, hồ sơ, avatar, thông báo nền | Hai mục kiểm chứng auth/CSV và gỡ demo toàn luồng |
| G2 | 3/6 | Vòng đời/sao chép/xóa đợt, chín mốc và Gantt từ dữ liệu API; kiểm tra mở/kết thúc | Race condition khi hai đợt mở cùng SV, history gỡ người và nguồn demo mặc định |
| G3 | 6/7 | Đề tài, công bố, ghi danh, đề xuất và quyết định GV | `canCancel` lệch điều kiện đã nộp đề cương; checkpoint E2E nhóm 1/2 SV |
| G4 | 3/6 | Đề cương và chốt bản khóa luận cuối có code/test | Hạn trễ đề cương; upload thật MinIO, quyền GV phản biện và recovery |
| G5 | 1/4 | API/UI mẫu phiếu là nền ban đầu; phân công phản biện theo PDR-021/023/062 (API, màn Giáo vụ và GVPB, test) | Mẫu đủ ba vai trò, snapshot; chặn lưu phiếu PB và dấu khóa cùng phiếu đầu tiên (P07) |
| G6 | 0/4 | Một số màn hình demo | API và quy tắc hội đồng, lịch, va chạm và công bố |
| G7 | 0/6 | Một số màn hình demo | Bốn phiếu điểm, tính điểm, xác nhận và công bố thật |
| G8 | 0/7 | Có thông báo và một số audit theo module | Thông báo xuyên quy trình, báo cáo/export, E2E và release gate |

**Các lỗi và lệch luồng cần xử lý tiếp (đối chiếu mã nguồn):**

1. **Ưu tiên cao — trùng SV khi mở đợt đồng thời.** `OpenRoundHandler` kiểm tra xung đột trước khi cập nhật trạng thái, nhưng chưa có khóa/ràng buộc DB bảo vệ hai yêu cầu mở cùng lúc (`RoundHandlers.cs`, đoạn TODO tại 337–338). Cần thử bằng PostgreSQL concurrency test.
2. **Ưu tiên cao — tiến độ bài nộp có thể sai.** `TopicDetailPage.progressSteps` lấy Giữa kỳ/Cuối kỳ từ `topic.submissions`, trong khi `GetTopicHandler` hiện chỉ điền các phiên bản Đề cương vào mảng này; báo cáo thật được lấy riêng qua API bài nộp. Sau khi nộp báo cáo, dòng tiến độ có thể vẫn hiện `Chưa nộp`.
3. **Ưu tiên cao — thao tác kết thúc ngoại lệ thiếu xác nhận.** Nút `Không đủ điều kiện công bố` trong `SubmissionPanel` gọi trực tiếp `decide('ineligible')`. Cần xác nhận rõ đề tài/lý do trước khi chuyển trạng thái cuối, nhất là khi trình diễn.
4. **Ưu tiên vừa — quyền hủy ghi danh hiển thị sai.** `RegistrationMapping.BuildAsync` còn báo `canCancel=true` dù nhóm đã nộp Đề cương; `CancelRegistrationHandler` từ chối hành động này. Giữ G3.2 chưa đánh dấu.
5. **Ưu tiên vừa — điều kiện công bố trên UI dùng thiếu dữ liệu.** `publishResultBlocker` đọc `topic.submissions` dù danh sách đề tài từ API chỉ cung cấp số phiên bản/chốt bản cuối. Đồng thời các lệnh xác nhận, hủy xác nhận, công bố và nhắc lệch điểm ở `topicApiService` còn là stub; giữ G7 chưa đánh dấu.
6. **Ưu tiên vừa — điều kiện cấp hạn bổ sung.** `SubmissionRequests.ToDto` có thể bật `CanGrantExtension` khi đề tài chưa có nhóm, trong khi `GrantThesisExtensionCommand` từ chối đề tài không có `GroupId`. Đồng bộ điều kiện hiển thị để tránh thao tác 409.
7. **Ưu tiên vừa — phạm vi dữ liệu người tham gia đợt.** `RoundMapping.ToDto` luôn trả `LecturerIds`, `StudentIds`, `LockedStudentIds` qua cả API GET danh sách/chi tiết cho GV/SV đã tham gia (`RoundHandlers.cs`, `RoundsController.cs`). Đối chiếu `docs/product/ROLES.md` về nguyên tắc SV chỉ xem dữ liệu thuộc về mình hoặc thông tin công bố chung; cần xác nhận danh sách ID này có được công bố cho toàn đợt hay phải giới hạn theo vai trò. Thêm kiểm thử phân quyền phản hồi API sau khi chốt quy tắc.

**Điều kiện chạy demo:** Dùng **database test cô lập**, backend, PostgreSQL, MinIO và frontend cùng hoạt động; cập nhật các migration đã review trên **DB test**; chuẩn bị tài khoản đủ ba vai trò, một đợt với chín mốc, 1 nhóm một SV, 1 nhóm hai SV, giảng viên hướng dẫn và vài PDF hợp lệ. Bật `NEXT_PUBLIC_ROUNDS_API=true` khi chạy frontend để các màn đợt/đề tài dùng API thật. Chọn ngày mốc phù hợp với từng hành động; không sửa đồng hồ/migration của DB dùng chung. Luôn reload sau thao tác để xác nhận dữ liệu thật được lưu.

1. **Giáo vụ — tài khoản và hồ sơ:** `/login` → `/giao-vu/nguoi-dung` (tìm, tạo/import CSV, khóa/mở, reset) → `/ho-so` (sửa hồ sơ/avatar, đổi mật khẩu). Kiểm tra bằng tài khoản SV không truy cập trang Giáo vụ được.
2. **Giáo vụ — đợt:** `/giao-vu/dot` → tạo Nháp, sao chép đợt mẫu (chỉ sao chép khung cấu hình), nhập đủ chín mốc và hạn nộp trễ, thêm SV/GV, thử mở khi thiếu mốc để thấy lỗi rồi sửa và mở thành công. Kiểm tra cảnh báo thiếu người không khóa mở. Tải lại trang, mở chi tiết đợt và xem Gantt từ dữ liệu vừa lưu. Thử xóa một đợt Nháp riêng; xác nhận đợt đang diễn ra không cho xóa. Không thử mở song song hai đợt cùng một SV vì còn lỗi đồng thời.
3. **Giảng viên → Giáo vụ → Sinh viên — đề tài:** `/gv/de-tai` tạo/sửa đề tài → `/giao-vu/de-tai` công bố → `/sv/dang-ky` và `/sv/dang-ky/[id]` xem và ghi danh nhóm 1/2 SV. Xác nhận nhóm thứ hai không ghi danh được đề tài vừa bị nhận; hủy/ghi danh lại khi hợp lệ và xem lịch sử.
4. **Sinh viên ↔ Giảng viên — đề xuất:** `/sv/don-dang-ky` tạo/sửa/hủy đề xuất chờ → `/gv/de-xuat` từ chối có lý do hoặc chấp nhận → SV kiểm tra lịch sử và đề xuất lại bằng **cùng nhóm**. Dùng hai đề xuất để demo cả nhánh chấp nhận và từ chối.
5. **Sinh viên ↔ GVHD — đề cương:** `/sv/de-tai` hoặc `/de-tai/[id]` nộp PDF đề cương nhiều phiên bản → `/gv/huong-dan` vào không gian đề tài, nhận xét/yêu cầu sửa/duyệt → SV tải lại các bản và thấy trạng thái; kiểm tra không duyệt khi còn yêu cầu mở.
6. **Nhóm → Giáo vụ — tài liệu và bản khóa luận:** `/de-tai/[id]` nộp báo cáo giữa kỳ/cuối kỳ và `Bản khóa luận`, tải các phiên bản, tự chốt một bản. Xem lịch sử/phiên bản ngay trong panel bài nộp; phần tiến độ tổng quan đang có lỗi đồng bộ dữ liệu nêu trên. Trên **nhóm thử riêng** đã quá hạn và chưa nộp bản khóa luận, Giáo vụ cấp hạn bổ sung một lần hoặc kết thúc `Không đủ điều kiện công bố` với lý do; thao tác kết thúc này hiện thiếu hộp xác nhận nên phải kiểm tra kỹ trước khi nhấn trên DB thử. Job chốt tự động chỉ demo sau khi đã xác thực trên DB test.
7. **Giáo vụ — mẫu đánh giá:** `/giao-vu/phieu-danh-gia` xem danh mục/tạo mẫu ở mức hiện có. **Không demo** phân công phản biện, hội đồng, bốn điểm, xác nhận/công bố kết quả như tính năng thật vì thiếu API end-to-end G5–G7.

**Điểm kiểm chứng trực tiếp trong buổi demo:**

| Chặng | Kết quả cần quan sát | Cách xác minh |
| --- | --- | --- |
| Tài khoản | Tài khoản mới đăng nhập đúng vai trò; tài khoản SV không vào được màn Giáo vụ | Đăng xuất, đăng nhập lại, mở URL role bị cấm |
| Tạo/sao chép đợt | Bản sao chỉ mang khung, không mang người/ngày; đợt gốc vẫn nguyên | Mở hai bản ghi song song, tải lại trang |
| Mốc/mở đợt | Thiếu mốc bị chặn; đủ mốc mở được dù thiếu người, có cảnh báo | Thử lỗi trước khi sửa, reload và xem Gantt |
| Ghi danh nhóm | Một đề tài chỉ nhận được một nhóm hợp lệ, nhóm 1/2 SV hiện đúng | Đăng nhập hai nhóm lần lượt, kiểm tra lịch sử đề tài |
| Đề xuất GVHD | Đề xuất được từ chối có lý do hoặc duyệt, nhóm giữ nguyên khi đề xuất lại | Đổi vai trò SV/GV, tải lại lịch sử |
| Đề cương | Có nhiều phiên bản, GVHD yêu cầu sửa và duyệt sau khi đóng yêu cầu | SV nộp lần hai, GV duyệt, reload |
| Báo cáo/bản khóa luận | API bài nộp trả đúng phiên bản và tệp, bản đã chốt hiển thị đúng | Tải lại tệp, kiểm tra panel sau reload |
| Ngoại lệ không nộp | Chỉ Giáo vụ xử lý hạn bổ sung và lý do kết thúc; không sinh điểm | Dùng nhóm thử riêng trên DB test |
| Mẫu phiếu đánh giá | Tạo hoặc xem mẫu đã lưu, làm rõ giới hạn hiện tại của G5 | Tải lại danh mục và kiểm tra thông tin mẫu |

**Bằng chứng kiểm tra tại ngày rà soát:** `dotnet test Backend.sln --no-restore` **329 pass, 7 skip** (các ca PostgreSQL cần môi trường); frontend `npm.cmd run typecheck` **pass**, `npm.cmd run lint` **pass** (1 cảnh báo unused import), `npm.cmd test` **471 pass / 48 files**. `npm.cmd run build` **không thành công do mạng không tải được** Be Vietnam Pro/JetBrains Mono từ Google Fonts qua `next/font`. Đã phát hiện lệch `canCancel` so với quy tắc hủy sau khi nộp đề cương, nguy cơ race condition khi mở đồng thời hai đợt có chung SV, và các thao tác kết quả G7 còn stub. Đã sửa mô tả backlog G7 theo PDR-049/050. Chưa thực hiện E2E đầy đủ với PostgreSQL/MinIO/SMTP thật, migration lên DB test hoặc đánh giá an toàn triển khai; vì vậy **chưa đạt G8**.

## 6. Chuẩn kiểm thử bắt buộc cho từng lát cắt

| Lớp | Phải chứng minh |
| --- | --- |
| Domain/Application | Chuyển trạng thái, công thức, deadline, điều kiện nghiệp vụ và idempotency bằng unit tests. |
| Infrastructure | Mapping, migration mới, ràng buộc/transaction, storage failure và truy vết bằng integration tests với DB/storage test. |
| API | Contract thành công/lỗi, 401/403/404/409, validation, quyền ngang hàng và dữ liệu xuyên đợt. |
| Frontend | Service map đúng contract; loading/error/empty; component interaction, điều hướng theo role và accessibility cơ bản. |
| End-to-end | Ba role đi qua UI → API → DB; reload/restart không mất dữ liệu; file và notification kiểm tra đúng quyền. |

Trước khi merge một lát cắt, chạy tối thiểu các lệnh phù hợp trong `AGENTS.md`: `dotnet restore Backend.sln --locked-mode`, `dotnet test Backend.sln --no-restore`, `npm ci`, `npm run typecheck`, `npm run lint`, `npm test` và `npm run build` khi phần frontend bị ảnh hưởng. Lỗi không thể chạy phải ghi nguyên nhân và rủi ro, không đánh dấu task hoàn tất.

## 7. Rủi ro và cách kiểm soát

| Rủi ro | Mức | Kiểm soát |
| --- | --- | --- |
| UI demo bị hiểu nhầm là chức năng thật | Cao | Chỉ nghiệm thu khi request thực đến backend/database; gắn checklist loại demo ở G8. |
| Hợp đồng API thay đổi lệch hai phía | Cao | Chốt contract trước, cập nhật service/type/controller cùng task, test contract và lỗi. |
| Sai quyền hoặc lộ dữ liệu liên đợt | Cao | `[Authorize]`/role policy ở backend, query scoping, test gọi API trực tiếp bằng role sai. |
| Migration/storage gây mất hoặc mồ côi dữ liệu | Cao | Review SQL, DB test cô lập, transaction/compensation, không sửa migration đã áp dụng. |
| Quy tắc điểm/lịch phức tạp bị làm muộn | Cao | Giữ đúng thứ tự G4→G5→G6→G7 và viết test biên trước implementation. |
| Cấu hình/secret local lẫn với Neon | Vừa | `.env` nằm backend, chỉ commit `.env.example`; không log secret; xác minh target DB trước migrate/seed. |
| NFR chưa định lượng | Vừa, hậu MVP | Ghi giới hạn trung thực; sau G8 xử lý OQ-007/PDR-046 thay vì tự tuyên bố SLA. |

## 8. Cách quản lý tiến độ

- Các file `phase-00` đến `phase-08` là checklist chi tiết. Chỉ tick khi có link PR/commit, test hoặc bằng chứng thao tác tương ứng.
- Mỗi task Gx phải ghi: contract thay đổi, migration (nếu có), test đã chạy, known limitation và tài liệu/PDR bị ảnh hưởng.
- Chỉ bắt đầu phase sau khi checkpoint trước đạt. Ngoại lệ song song phải nêu rõ dependency không dùng chung.
- Bất cứ thay đổi nào đụng quy tắc nghiệp vụ phải cập nhật `requirements/`, PDR hoặc `OPEN_QUESTIONS.md` trước khi coi code hoàn tất.

## 9. Phê duyệt trước khi triển khai

- [ ] Người phụ trách sản phẩm xác nhận mục 2 là ranh giới MVP.
- [ ] Nhóm kỹ thuật xác nhận thứ tự G0→G8 và môi trường test tách biệt.
- [ ] Người phụ trách xác nhận MinIO là storage local/test cho avatar và tài liệu trong MVP; chiến lược production/retention nằm ngoài phần chưa chốt.
- [ ] Bắt đầu từ G0/G1; không triển khai đồng loạt toàn bộ backlog.
