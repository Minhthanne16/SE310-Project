# Kế hoạch hoàn thiện ứng dụng QLKLTN

> Trạng thái: kế hoạch triển khai, chưa phải đặc tả API, schema hay quyết định nghiệp vụ mới. Cập nhật theo `docs/` và codebase ngày 26-10-2026. Checklist thực hiện ở [todo.md](todo.md). Công việc tái tổ chức working tree trước đây đã hoàn thành; kế hoạch này thay cho kế hoạch tái tổ chức trong file này.

## 1. Đích đến và nguyên tắc

Một Khoa có thể vận hành trọn một đợt khóa luận từ tạo đợt, công bố đề tài, đăng ký/đề xuất, nộp tài liệu, phân công, bảo vệ, chấm từng sinh viên, xác nhận đến công bố kết quả mà không lấy bảng tính làm nguồn dữ liệu chính. Ba vai trò tài khoản duy nhất là `Student`, `Lecturer`, `AcademicAffairs`; hướng dẫn, phản biện, chủ tịch, thư ký là phân công theo ngữ cảnh. Sinh viên chỉ thấy điểm của mình sau khi công bố. Nguồn chuẩn: [đặc tả dự án](../docs/PROJECT_SPEC.md), [phạm vi](../docs/product/SCOPE.md), [vai trò](../docs/product/ROLES.md), [quy tắc](../docs/requirements/BUSINESS_RULES.md), [luồng](../docs/requirements/WORKFLOWS.md) và [PDR-001](../docs/decisions/PDR-001-vai-tro-va-quy-trinh-co-kiem-soat.md).

- Xây các module QLKLTN cạnh Products mẫu theo [PDR-002](../docs/decisions/PDR-002-xac-thuc-va-lo-trinh-ma-nguon.md); không tự lên lịch xóa Products hay sửa migration đã áp dụng.
- Mỗi công việc là một lát cắt có thể kiểm thử: quy tắc miền → lưu trữ/migration → handler/API → client/UI → test. Nếu vượt một phiên làm việc, tách thành PR nhỏ nhưng giữ hợp đồng hai phía đồng bộ.
- Mọi endpoint QLKLTN kiểm tra quyền ở backend, gồm vai trò tài khoản và quan hệ với đợt/đề tài/hội đồng. UI chỉ phản ánh quyền đã được API cung cấp.
- `docs/DESIGN/` là bản bàn giao giao diện và dữ liệu minh họa; chi tiết ở đó không tự chốt các điểm đang mở trong [OPEN_QUESTIONS.md](../docs/OPEN_QUESTIONS.md).
- Không chạy migration, seed hay thử nghiệm ghi dữ liệu trên Neon/shared/production ngoài quy trình triển khai đã xét đúng branch và SQL. Dùng DB test cô lập cho kiểm thử tích hợp.

## 2. Hiện trạng đã kiểm tra

| Khu vực | Có thật trong code | Còn thiếu để hoàn thiện QLKLTN |
| --- | --- | --- |
| Nền chạy | `app/backend` .NET 10, EF Core/PostgreSQL, MediatR; `app/frontend` Next.js App Router; Compose local/Neon; CI build/test. | Hợp đồng, dữ liệu, kiểm thử tích hợp theo các luồng nghiệp vụ mới. |
| Xác thực | `/api/auth/login`, `me`, `activation-code`, `change-initial-password`, `logout`; JWT cookie HttpOnly, security stamp, BCrypt, SMTP/Mailpit; login/OTP frontend. | Đổi mật khẩu thông thường, quên/đặt lại mật khẩu, quản trị người dùng đầy đủ. |
| Người dùng | Bảng `Users`, nhập CSV preview/commit ở `/api/users/import/*` theo PDR-004. | UI CSV; thêm/sửa/tìm/lọc/vô hiệu hóa/kích hoạt lại/đặt lại mật khẩu; hồ sơ sửa được. |
| Giao diện | Sidebar theo ba vai trò, session guard, login, trang hồ sơ chỉ xem, route Products mẫu. | `/sv`, `/gv`, `/giao-vu` và các menu con phần lớn là `SectionPlaceholder`; chuông, dashboard, trang nghiệp vụ chưa kết nối dữ liệu. |
| Miền QLKLTN | Chưa có entity, migration, controller hay service riêng cho đợt, đề tài, nhóm, tài liệu, hội đồng, điểm, kết quả, thông báo. | Toàn bộ luồng nghiệp vụ chính từ đợt tới công bố. |
| Tích hợp | Adapter/config Redis, MinIO, Google Identity có trong repo; chưa chứng minh là chức năng QLKLTN. | Chỉ dùng khi có ca sử dụng và quyết định phù hợp; riêng lưu tài liệu chờ OQ-006. |

Các nhận định trên dựa vào `ApplicationDbContext` hiện chỉ có `Products`/`Users`, ba controller `Products`, `Auth`, `Users`, các route App Router và `menuConfig.ts`. Test hiện hành bao phủ nền Products/Auth/CSV, không chứng minh các luồng QLKLTN đã hoàn tất. Xem [README](../README.md).

## 3. Cổng quyết định trước khi code phần liên quan

| Cổng | Cần chốt bằng cập nhật `docs/requirements/` hoặc PDR | Chặn task |
| --- | --- | --- |
| G-01 / OQ-001 | Trạng thái/lịch sử, hạn hủy đề xuất và thời điểm được đề xuất lại. | T14; nhánh sửa/hủy đề xuất trong T13. |
| G-02 / OQ-002 | Đến hạn chốt bản cuối mà chưa có bản nộp: xử lý và điều kiện công bố. Bản DESIGN nói “tự chốt”/“hết hạn” nhưng chưa giải đáp trường hợp không có bản. | T19, T27, T28. |
| G-03 / OQ-003 | Ai được yêu cầu/sửa/đóng yêu cầu chỉnh sửa đề cương, vòng đời và quyền nộp lại. | T17. |
| G-04 / OQ-004 | Chặn hay cảnh báo trùng phòng/giờ; quy tắc sửa/xóa lịch và hội đồng đã công bố/đã có điểm. DESIGN mô tả cảnh báo nhưng câu hỏi vẫn mở. | T21, T22. |
| G-05 / OQ-005 | Điểm cũ được giữ, hủy hay nhập lại khi đổi thành viên hội đồng sau khi có điểm. | T21, T25, T27. |
| G-06 / OQ-006 | Loại file, dung lượng, nộp trễ, lưu trữ/kiểm soát truy cập/giữ-xóa tài liệu. DESIGN nêu PDF 20 MB nhưng chưa phải ngưỡng được chốt. | T16–T19; ảnh hồ sơ trong T06. |
| G-07 / OQ-007 | Chỉ tiêu đồng thời, latency, thời hạn lưu, backup/restore và cách đo. | T31–T33 trước phát hành thực tế. |
| G-08 / đối chiếu DESIGN | Xác nhận các chi tiết chỉ có trên canvas trước khi lấy làm quy tắc: 9 mốc và ngày hạn, một SV chỉ thuộc một đợt đang diễn ra, phạm vi chỉnh sửa đề tài sau công bố, điều kiện đủ phản biện, mẫu phiếu/điểm tiêu chí, xóa người dùng chưa có dữ liệu, sao chép đợt, hủy xác nhận điểm, khôi phục mật khẩu, dashboard thử nghiệm. Ghi riêng từng quyết định; không biến chúng thành mặc định ngầm. | T03–T04, T07–T11, T20, T23, T27 và các task liên quan. |

T00 tổng hợp ma trận mâu thuẫn `requirements/` ↔ `DESIGN/` ↔ PDR và nhận quyết định của nhóm/Khoa. Các task độc lập khác có thể đi tiếp, nhưng task bị chặn chỉ triển khai sau khi cổng tương ứng đóng. Với việc không thể chốt ở đầu dự án, giữ phần đó ở backlog và không đưa thành tiêu chí phát hành “đã xong”.

## 4. Module, dữ liệu và phụ thuộc

| Module | Sở hữu dữ liệu/khả năng | Cần trước | Màn hình chính theo sitemap (route là gợi ý) |
| --- | --- | --- | --- |
| Identity & Users | Phiên đăng nhập, hồ sơ, quản trị tài khoản, CSV, đặt lại mật khẩu. | Nền hiện có. | `/login`, `/quen-mat-khau`, `/ho-so`, `/giao-vu/nguoi-dung`. |
| Periods | Đợt, thành viên đợt, mốc, trạng thái mở/kết thúc. | Users. | `/giao-vu/dot`, dashboard theo đợt. |
| Topics | Đề tài GV công bố, danh sách, lịch sử và công bố danh sách. | Periods. | `/gv/de-tai`, `/giao-vu/de-tai`, `/sv/dang-ky`. |
| Groups & Registration | Nhóm 1–2 SV, đại diện, đăng ký một đề tài, đề xuất/xét duyệt/hủy. | Periods + Topics. | `/sv/dang-ky/*`, `/sv/don-dang-ky`, `/gv/de-xuat`. |
| Workspace & Submissions | Không gian đề tài, đề cương, nhận xét, bản giữa/cuối, phiên bản, bản chốt. | Registration + G-03/G-06. | `/sv/de-tai`, không gian đề tài của GV. |
| Assignments & Defense | Phản biện, hội đồng hai người, lịch, công bố lịch. | Submissions + G-04/G-05. | `/giao-vu/phan-bien`, `/giao-vu/hoi-dong`, `/gv/hoi-dong`. |
| Evaluation & Results | Mẫu/tiêu chí, 4 phiếu từng SV, lệch điểm, tính/xác nhận/công bố kết quả. | Assignments + Workspace + G-02/G-05. | `/giao-vu/phieu-danh-gia`, `/giao-vu/ket-qua`, tab điểm. |
| Notifications & Audit | Tin gửi, chuông, lịch sử thay đổi, việc cần làm. | Các event của module trên. | Dashboard, chuông, `/gv/thong-bao/gui`, `/giao-vu/thong-bao/gui`, lịch sử đề tài. |
| Reporting & Operations | Thống kê, xuất danh sách/điểm, quan sát, backup/khôi phục. | Dữ liệu thật từ các module. | `/giao-vu/thong-ke`, export, vận hành. |

Phụ thuộc chính: `Users → Periods → Topics → Registration → Submissions → Assignments → Evaluation → Results`. Audit cần từ lát cắt đầu tiên. Notifications có thể thêm dần khi mỗi event thật xuất hiện; dashboard và báo cáo đọc dữ liệu đã có, không dựng bằng mock làm bằng chứng hoàn thành.

## 5. Quy ước kỹ thuật và Definition of Done

- Mã mới theo lớp hiện có: `Backend.Domain` (bất biến), `Backend.Application` (use case/DTO/validation), `Backend.Infrastructure` (EF/repository/tích hợp), `Backend.API` (HTTP/auth), `frontend/src/features/<module>` và `frontend/app` (route). Tên thư mục là vị trí dự kiến, không phải schema đã chốt.
- Trước mỗi lát cắt API: đối chiếu `frontend/src/api/request.ts`, service/type/UI và controller/DTO/`ApiResponse`/middleware/OpenAPI thực tế; ghi method, path, body, response, status, lỗi, nullability. Đổi hợp đồng ở hai phía trong cùng lát cắt.
- Migration mới là additive trong giai đoạn xây module; đặt constraint/index bảo vệ bất biến cùng transaction và kiểm thử thao tác đồng thời. Review SQL trước khi chạy trên DB thật.
- Mỗi task xong khi: tiêu chí bên dưới đạt; test quy tắc thành công/thất bại/quyền 401–403/ca đồng thời nếu có; typecheck/lint/build phù hợp; UI có loading, empty, error, trạng thái thiết kế liên quan; tài liệu và migration cập nhật cùng code; không để secret trong repo/log.
- Lệnh kiểm tra chuẩn: `cd app/backend; dotnet restore Backend.sln --locked-mode; dotnet test Backend.sln --no-restore`; `cd app/frontend; npm ci; npm run typecheck; npm run lint; npm test; npm run build`. Kiểm thử DB dùng instance/branch cô lập, không dùng Neon đang chứa dữ liệu thật.
- Thứ tự triển khai không ấn định lịch ngày hoặc số người. Mỗi task dưới đây là một đơn vị review; tách nhỏ nếu cần mà không đổi tiêu chí nghiệm thu.

## 6. Backlog theo phase

### Phase 0 — Chốt phạm vi và hợp đồng (P0)

**T00 — Ma trận quy tắc và câu hỏi mở.** Phụ thuộc: không. Làm: đối chiếu từng quy tắc trong `BUSINESS_RULES`, `WORKFLOWS`, PDR và `DESIGN/03`; ghi quyết định cho G-01…G-08 theo chủ sở hữu nghiệp vụ, cập nhật `OPEN_QUESTIONS` và tài liệu chuẩn. Đạt khi mỗi xung đột có kết luận/được ghi là chặn, không còn hai quy tắc trái nhau cho cùng một thao tác. Kiểm: review bảng truy vết và phê duyệt nghiệp vụ; không test code. Vị trí: `docs/OPEN_QUESTIONS.md`, `docs/requirements/*`, `docs/decisions/*`.

**T01 — Bản đồ hợp đồng và dữ liệu.** Phụ thuộc: T00 cho các phần đã chốt. Làm: lập danh sách use case, quyền, request/response, trạng thái/lỗi, dữ liệu sở hữu, giao dịch và migration dự kiến cho từng module; phân biệt “đã chốt” với “dự kiến”. Đạt khi mọi route dự kiến truy được tới quy tắc và màn sử dụng, không suy ra hợp đồng từ mock. Kiểm: đối chiếu `Auth/Users/Products` hiện có và review FE/BE cùng nhau. Vị trí: tài liệu kế hoạch/hợp đồng mới trong `docs/`, không sửa API trong task này.

**Checkpoint P0:** ma trận quyết định có người chịu trách nhiệm; backlog nêu rõ task nào bị chặn; phạm vi Products mẫu theo PDR-002 được giữ.

### Phase 1 — Tài khoản và nền dùng chung (P1)

**T02 — Đổi mật khẩu thông thường.** Phụ thuộc: T01. Làm: thống nhất contract, thêm handler/API và nối `ProfilePage`/`authService.changePassword`. Đạt khi tài khoản đã kích hoạt đổi được mật khẩu, mật khẩu cũ sai hoặc mật khẩu mới vi phạm bị từ chối, phiên cũ mất hiệu lực; tài khoản chờ OTP vẫn theo luồng riêng. Kiểm: test handler + HTTP 200/400/401 và FE dialog. Vị trí: `Backend.Application/Auth`, `Backend.API/Controllers/Auth`, `frontend/src/features/auth`, `frontend/src/features/profile`.

**T03 — Quên mật khẩu và đặt lại qua email.** Phụ thuộc: T01, quyết định chính sách công khai email/giới hạn gửi ở G-08. Làm: token/link 30 phút một lần theo `DESIGN/03`, mail, trang nhập email/đặt lại và lỗi hết hạn/đã dùng. Đạt khi link dùng một lần, hết hạn được xử lý, đổi mật khẩu thu hồi phiên cũ, người không dùng được email có luồng giáo vụ đã chốt. Kiểm: test đồng hồ giả, token dùng lại, quyền và flow Mailpit. Vị trí: `Backend.Application/Auth`, `Backend.Infrastructure/Integrations/Email`, `Backend.API/Controllers/Auth`, `frontend/app/(public)`.

**T04 — Quản trị tài khoản.** Phụ thuộc: T01; nhánh xóa/đặt lại chờ G-08. Làm: API/UI danh sách, tìm/lọc, thêm/sửa theo ba vai trò, đặt lại mật khẩu, vô hiệu hóa/kích hoạt lại; xử lý xóa chưa có dữ liệu theo chính sách đã chốt. Đạt khi chỉ Giáo vụ thao tác; không xóa chính mình; tài khoản có dữ liệu được vô hiệu hóa thay vì xóa; trùng mã/email trả lỗi rõ ràng. Kiểm: test 403, uniqueness, revoke security stamp và UI các trạng thái lỗi. Vị trí: `Backend.Application/Users`, `Backend.API/Controllers/Users`, `frontend/src/features/users`, `frontend/app/(protected)/giao-vu`.

**T05 — Giao diện nhập CSV.** Phụ thuộc: T01; tận dụng API PDR-004 đã có. Làm: upload preview, bảng lỗi theo dòng, commit tệp, báo cáo kết quả; tải báo cáo lỗi nếu được chốt. Đạt khi preview không ghi DB, import báo đúng valid/error/imported rows, lỗi tệp hiện hữu ích, báo cáo xuất chặn CSV formula injection. Kiểm: FE test với response thật/giả theo contract và test nhập tích hợp trên DB cô lập. Vị trí: `frontend/src/features/users`, `frontend/src/api`, `Backend.Tests/Features/Users`.

**T06 — Hồ sơ và phiên cá nhân.** Phụ thuộc: T02, T04, G-06 nếu cho upload ảnh. Làm: API/UI chỉnh sửa các trường được phép, hiển thị hoạt động đăng nhập từ dữ liệu thật; mã/email/role vẫn do Giáo vụ quản lý. Đạt khi không sửa được trường khóa bằng request trực tiếp, hồ sơ và session hiển thị nhất quán sau lưu; ảnh chỉ thêm sau khi chính sách file chốt. Kiểm: test quyền tự sửa/không sửa hộ người khác và FE validation. Vị trí: `Backend.Application/Users`, `Backend.API/Controllers/Users`, `frontend/src/features/profile`.

**Checkpoint P1:** sinh viên, giảng viên, giáo vụ từ CSV hoặc tạo thủ công đều đăng nhập/kích hoạt/quản lý được; luồng đổi/quên mật khẩu chạy qua API thật; test identity cũ vẫn xanh.

### Phase 2 — Đợt và đề tài công bố (P2)

**T07 — Vòng đời đợt.** Phụ thuộc: T04, G-08 cho chính sách đợt. Làm: tạo/list/detail/mở/kết thúc/xóa nháp, trạng thái và quyền nhìn thấy; thêm sao chép đợt cũ sau khi xác định chính xác dữ liệu/cấu hình được sao chép. Đạt khi đợt nháp chỉ Giáo vụ thấy, trạng thái chuyển hợp lệ, bản sao chỉ chứa dữ liệu đã được phê duyệt và không đổi lịch sử đợt cũ, không xóa nhầm đợt có dữ liệu. Kiểm: test role, transition, clone và query theo trạng thái; UI `/giao-vu/dot`. Vị trí: `Backend.Domain/Entities`, `Backend.Application/Periods`, `Backend.Infrastructure/Data`, `frontend/src/features/periods`.

**T08 — Cấu hình mốc và tham gia đợt.** Phụ thuộc: T07, G-08. Làm: cấu hình mốc theo quyết định, kiểm tra thứ tự, bật/tắt nộp trễ nếu được chốt; thêm/gỡ GV/SV từ tài khoản. Đạt khi quyền và ràng buộc thành viên nhất quán, không gỡ người đã phát sinh dữ liệu, các deadline được API trả cùng múi giờ/quy ước. Kiểm: test validation, membership/concurrency, UI tab Cấu hình/GV/SV. Vị trí: `Backend.Application/Periods`, `Backend.Infrastructure/Data`, `frontend/src/features/periods`.

**T09 — Danh sách đợt và việc cần làm tối thiểu.** Phụ thuộc: T07–T08. Làm: dashboard theo vai trò dựa trên đợt thật, trạng thái trống/không quyền, liên kết vào chi tiết; Gantt theo mốc đã chốt nếu có. Đạt khi SV/GV chỉ thấy đợt tham gia, Giáo vụ thấy cả nháp, không hiển thị thẻ đợt bằng mock. Kiểm: test query và UI với 0/1/n đợt theo vai trò. Vị trí: `Backend.Application/Periods`, `frontend/src/features/dashboard`, `frontend/app/(protected)`.

**T10 — Đề tài do giảng viên tạo.** Phụ thuộc: T08, G-08 cho quyền sửa sau công bố. Làm: CRUD đề tài trong đợt, lĩnh vực/yêu cầu, lọc đợt và cảnh báo mức số đề tài (chỉ cảnh báo). Đạt khi GV chỉ sửa đề tài của mình trong phạm vi cho phép, Giáo vụ xem toàn đợt, constraint không tạo đề tài ngoài đợt. Kiểm: test chủ sở hữu, deadline, số lượng cảnh báo và UI `/gv/de-tai`. Vị trí: `Backend.Application/Topics`, `Backend.Infrastructure/Data`, `frontend/src/features/topics`.

**T11 — Công bố danh sách và tra cứu đề tài.** Phụ thuộc: T10. Làm: thao tác Giáo vụ đóng/công bố danh sách, list/detail cho SV với tìm/lọc/phân trang. Đạt khi SV chưa thấy đề tài nháp; công bố chuyển quyền hiển thị nhất quán và không thay đổi được ngoài quy tắc đã chốt. Kiểm: test quyền trước/sau công bố, pagination, UI trạng thái chưa mở/trống. Vị trí: `Backend.Application/Topics`, `Backend.API/Controllers`, `frontend/src/features/topics`.

**Checkpoint P2:** Giáo vụ mở đợt, thêm người và công bố danh sách; GV gửi đề tài; SV chỉ xem được danh sách hợp lệ.

### Phase 3 — Nhóm, đăng ký và đề xuất (P3)

**T12 — Nhóm và đăng ký đề tài công bố.** Phụ thuộc: T08, T11. Làm: nhóm 1–2 SV, đúng một đại diện, tra MSSV, ghi danh và hủy ghi danh theo quy tắc đã chốt. Đạt khi một SV không nằm trong hai nhóm cùng đợt và một đề tài chỉ có tối đa một nhóm; hai request tranh chấp có một request thành công và một lỗi nghiệp vụ rõ ràng. Kiểm: test transaction/index/concurrency với PostgreSQL và UI `/sv/dang-ky/[id]`. Vị trí: `Backend.Domain`, `Backend.Application/Registration`, `Backend.Infrastructure/Data`, `frontend/src/features/registration`.

**T13 — Đề xuất đề tài và duyệt của GV.** Phụ thuộc: T12; nhánh hủy/sửa chờ G-01 tại T14. Làm: SV tạo đề xuất với GVHD; GV liên quan chấp nhận/từ chối có lý do; nhóm và đề tài chuyển trạng thái theo quy tắc. Đạt khi không thể đề xuất trước khi công bố danh sách hoặc khi đã có nhóm/đề xuất còn hiệu lực; chỉ GV được chọn xét; lịch sử ghi đủ. Kiểm: test role, status, double action và UI `/gv/de-xuat`, `/sv/don-dang-ky`. Vị trí: `Backend.Application/Registration`, `Backend.Infrastructure/Data`, `frontend/src/features/registration`.

**T14 — Sửa/hủy và lịch sử đăng ký.** Phụ thuộc: T12–T13, G-01. Làm: hiện thực trạng thái/hạn hủy/đề xuất lại đã chốt, dòng thời gian cho SV/GV/Giáo vụ. Đạt khi không có bản ghi “biến mất” làm mất truy vết; lần đăng ký lại theo đúng quyết định, quyền xem lịch sử đúng phạm vi. Kiểm: test các mốc trước/sau hạn và UI 4 kịch bản Đơn đăng ký. Vị trí: `Backend.Application/Registration`, `Backend.Application/Audit`, `frontend/src/features/registration`.

**Checkpoint P3:** hai nhóm không thể chiếm một đề tài, đề xuất được đúng GV xét và giữ lý do/lịch sử; test thao tác đồng thời dùng PostgreSQL.

### Phase 4 — Không gian đề tài và tài liệu (P4)

**T15 — Không gian đề tài và audit chung.** Phụ thuộc: T12–T14. Làm: API đọc tổng quan, vai trò ngữ cảnh, tiến độ và lịch sử cho thành viên/GV được phân công/Giáo vụ; ghi audit trong cùng transaction khi trạng thái thay đổi. Đạt khi người ngoài không đọc được dữ liệu riêng; màn SV/GV/Giáo vụ dùng cùng dữ liệu nguồn nhưng hiện quyền khác nhau. Kiểm: test 403 theo quan hệ và UI các trạng thái trống/đã đăng ký. Vị trí: `Backend.Application/Workspace`, `Backend.Application/Audit`, `frontend/src/features/workspace`.

**T16 — Nền lưu phiên bản tài liệu.** Phụ thuộc: T15, G-06. Làm: metadata, object storage riêng tư, upload/download có kiểm tra chủ thể, checksum/loại/kích thước, xử lý lỗi giữa DB và storage, không ghi đè phiên bản. Đạt khi file trái chính sách bị từ chối, người không được quyền không tải được, bản cũ vẫn tra được, không có URL công khai vô hạn. Kiểm: integration test storage cô lập, lỗi upload dở dang và quyền tải. Vị trí: `Backend.Application/Submissions`, `Backend.Infrastructure/Integrations/Storage`, `Backend.API/Controllers`, `frontend/src/features/workspace`.

**T17 — Đề cương và vòng nhận xét.** Phụ thuộc: T16, G-03. Làm: nộp đề cương, GVHD nhận xét/duyệt/yêu cầu sửa, nộp lại, chuyển `Đang thực hiện` khi duyệt. Đạt khi chỉ GVHD xét đề cương, phiên bản cũ còn xem, từng yêu cầu sửa theo vòng đời đã chốt. Kiểm: test trạng thái và quyền, UI không gian đề tài hai vai trò. Vị trí: `Backend.Application/Submissions`, `Backend.Application/Topics`, `frontend/src/features/workspace`.

**T18 — Báo cáo giữa kỳ và cuối kỳ.** Phụ thuộc: T17, G-06. Làm: nộp nhiều phiên bản theo mốc, ghi chú thay đổi nếu áp dụng, trạng thái đúng hạn/nộp trễ, GVHD phản hồi. Đạt khi luật deadline/late nhất quán backend/UI, tài liệu trước không bị xóa, mỗi bản có người nộp và thời gian. Kiểm: test đồng hồ giả, quyền nhóm, lỗi file và UI hoạt động. Vị trí: `Backend.Application/Submissions`, `Backend.Infrastructure/Data`, `frontend/src/features/workspace`.

**T19 — Chốt bản cuối.** Phụ thuộc: T18, G-02, G-06. Làm: thao tác chốt và xử lý hạn chót tự động theo quyết định; hiển thị bản chính thức trong không gian đề tài. Đạt khi không thể công bố dựa vào bản thiếu/không hợp lệ, tự động chốt có thể chạy lặp an toàn, audit nêu rõ người/hệ thống thực hiện. Kiểm: test có/không có bản nộp, sát deadline, chạy lặp, UI xác nhận. Vị trí: `Backend.Application/Submissions`, job hạ tầng nếu cần, `frontend/src/features/workspace`.

**Checkpoint P4:** SV nộp, GVHD duyệt, phiên bản và bản cuối truy vết được; phân quyền tải file qua backend đã kiểm chứng.

### Phase 5 — Phân công và bảo vệ (P5)

**T20 — Phân công phản biện.** Phụ thuộc: T17–T18, G-08 cho điều kiện đủ/tự gợi ý. Làm: danh sách đủ điều kiện, gán từng đề tài/hàng loạt, GV xem nhiệm vụ. Đạt khi GVHD không làm phản biện chính đề tài; người không được phân công không xem/chấm; thuật toán gợi ý nếu có chỉ hỗ trợ và có giải thích. Kiểm: test conflict, transaction gán hàng loạt và UI hai vai trò. Vị trí: `Backend.Application/Assignments`, `Backend.Infrastructure/Data`, `frontend/src/features/assignments`.

**T21 — Hội đồng và thành viên.** Phụ thuộc: T20, G-04, G-05. Làm: hội đồng đúng chủ tịch/thư ký, gán đề tài, quy tắc sửa/xóa sau phát sinh điểm. Đạt khi cùng GV không giữ hai vai trò trong một hội đồng; GVHD không ngồi hội đồng của chính đề tài; thay thành viên xử lý điểm theo quyết định. Kiểm: test vai trò, transaction và UI tạo/sửa. Vị trí: `Backend.Application/Defense`, `Backend.Infrastructure/Data`, `frontend/src/features/defense`.

**T22 — Lịch bảo vệ và công bố.** Phụ thuộc: T21, G-04. Làm: ngày/giờ/phòng, xếp thứ tự, kiểm tra xung đột, công bố và xem lịch theo vai trò. Đạt khi xung đột được chặn/cảnh báo theo quyết định, không công bố lịch sai, sửa lịch công bố tuân thủ chính sách và ghi audit. Kiểm: test trùng GV/giờ/phòng, trạng thái công bố và UI SV/GV/Giáo vụ. Vị trí: `Backend.Application/Defense`, `Backend.Infrastructure/Data`, `frontend/src/features/defense`.

**Checkpoint P5:** mỗi đề tài đủ điều kiện có PB và lịch bảo vệ hợp lệ; SV/GV chỉ xem lịch liên quan; thay đổi sau công bố không làm sai điểm.

### Phase 6 — Phiếu, điểm và kết quả (P6)

**T23 — Mẫu phiếu và tiêu chí.** Phụ thuộc: T08, G-08 cho cấu trúc/thang/điều kiện khóa. Làm: tạo/sửa/đóng mẫu, tiêu chí con, gán mẫu theo vai trò và đợt; tránh sửa cấu trúc phiếu đã có điểm theo chính sách. Đạt khi điểm tiêu chí hợp lệ theo mẫu áp dụng, mỗi vai trò dùng đúng mẫu của đợt, dữ liệu chấm cũ không bị giải nghĩa lại. Kiểm: test version/gán mẫu/validation và UI `/giao-vu/phieu-danh-gia`. Vị trí: `Backend.Application/Evaluation`, `Backend.Infrastructure/Data`, `frontend/src/features/evaluation`.

**T24 — Điểm hướng dẫn và phản biện.** Phụ thuộc: T20, T23. Làm: phiếu riêng theo từng SV cho CBHD/CBPB, nhận xét PB, quyền sửa trước xác nhận. Đạt khi điểm của hai SV cùng nhóm độc lập; chỉ GVHD/PB đúng phân công nhập được; sau xác nhận không sửa. Kiểm: test role/ownership/2 SV, UI `/gv/huong-dan`, `/gv/phan-bien`. Vị trí: `Backend.Application/Evaluation`, `Backend.API/Controllers`, `frontend/src/features/evaluation`.

**T25 — Điểm hội đồng.** Phụ thuộc: T21–T23, G-05. Làm: thư ký nhập hai thành phần CTHĐ/TKHĐ cho từng SV, chủ tịch chỉ xem, xử lý thay thành viên sau điểm. Đạt khi nguồn/người nhập của từng phiếu rõ ràng, không ai ngoài thư ký được ghi, điểm cũ được xử lý theo quyết định. Kiểm: test 403/chuyển thành viên/2 SV và UI `/gv/hoi-dong`. Vị trí: `Backend.Application/Evaluation`, `Backend.Application/Defense`, `frontend/src/features/evaluation`.

**T26 — Tính điểm và cảnh báo lệch.** Phụ thuộc: T24–T25. Làm: chỉ tính khi đủ 4 thành phần; `(CTHĐ + TKHĐ + 2×CBHD + 2×CBPB)/6`, thang 10, làm tròn 2 số; cờ lệch theo BUSINESS_RULES. Đạt khi thiếu một phiếu không có điểm tổng, hai SV tính riêng, cờ không chặn lưu và được đưa tới Giáo vụ. Kiểm: unit test biên 0/10/1.995/thiếu phiếu/lệch đúng ngưỡng và query detail. Vị trí: `Backend.Application/Evaluation`, `Backend.Tests/Features/Evaluation`.

**T27 — Xác nhận và công bố.** Phụ thuộc: T19, T26, G-02, G-05; nhánh hủy xác nhận chờ G-08. Làm: Giáo vụ xác nhận, khóa sửa, hủy xác nhận theo chính sách đã chốt và công bố theo điều kiện bản cuối; SV xem kết quả cá nhân sau công bố. Đạt khi mọi SV trong nhóm đủ 4 phiếu mới chuyển đề tài `Đã cho điểm`; không rò điểm trước công bố; thao tác theo lô có báo cáo thành công/bỏ qua và audit; đề tài hoàn tất đúng thời điểm. Kiểm: test quyền/visibility, thiếu bản cuối, 1 SV thiếu điểm, transaction và UI `/giao-vu/ket-qua`. Vị trí: `Backend.Application/Results`, `Backend.Infrastructure/Data`, `frontend/src/features/results`.

**Checkpoint P6:** một nhóm 1–2 SV đi hết chuỗi nộp → chấm 4 vai trò → xác nhận → công bố; tổng điểm và quyền xem đúng trên API, UI và DB test.

### Phase 7 — Thông báo, truy vết, thống kê (P7)

**T28 — Thông báo nghiệp vụ và gửi tay.** Phụ thuộc: T07–T27 theo từng event đã có; G-02 cho thông báo hạn cuối. Làm: event tạo thông báo khi mở đợt, đăng ký/xét đề xuất, nhận xét, phân công/lịch, kết quả; GV gửi nhóm mình, Giáo vụ gửi theo đợt/vai trò; bảng thông báo có lọc/tìm/mở, chuông và đánh dấu đã đọc. Đạt khi người nhận đúng phạm vi, retry không tạo thông báo trùng, thao tác chính không bị sai khi gửi mail thất bại, nội dung nhạy cảm không lộ sớm. Kiểm: test recipient/duplicate/403 và UI dashboard/chuông. Vị trí: `Backend.Application/Notifications`, `Backend.Infrastructure`, `frontend/src/features/notifications`.

**T29 — Lịch sử và dashboard hoàn chỉnh.** Phụ thuộc: T15, T28 và dữ liệu P2–P6. Làm: timeline đề tài có lọc, việc cần xử lý và trạng thái theo từng vai trò, Gantt đợt dựa mốc thật. Đạt khi các thay đổi quan trọng trong BUSINESS_RULES có actor/time/before-after phù hợp, dữ liệu dashboard khớp trạng thái nguồn, không lộ dữ liệu nhóm khác. Kiểm: test audit của từng transition và UI `/sv`, `/gv`, `/giao-vu`, `/gv/lich-su`. Vị trí: `Backend.Application/Audit`, `Backend.Application/Dashboard`, `frontend/src/features/dashboard`.

**T30 — Thống kê và xuất dữ liệu.** Phụ thuộc: T27. Làm: đề tài theo trạng thái/6 chặng, tải GV so với mức cảnh báo, phân bố điểm, xuất danh sách đề tài/bảng điểm theo đợt. Đạt khi số tổng khớp truy vấn gốc, export tôn trọng quyền và phạm vi đợt, ô văn bản không gây CSV/Excel formula injection. Kiểm: test aggregate với dữ liệu chuẩn và kiểm file xuất; UI `/giao-vu/thong-ke`. Vị trí: `Backend.Application/Reporting`, `Backend.API/Controllers`, `frontend/src/features/reporting`.

**Checkpoint P7:** thông báo, lịch sử và thống kê được đối chiếu với một đợt chạy thử có dữ liệu thật, không dùng số liệu mẫu.

### Phase 8 — Kiểm định và phát hành (P8)

**T31 — An toàn dữ liệu và vận hành.** Phụ thuộc: các module P1–P7, G-07. Làm: rà soát quyền ngang/dọc, cookie/CSRF theo kiến trúc thực tế, upload/download, secret, migration SQL, index, logging không chứa OTP/token; kế hoạch backup/restore và retention theo chỉ tiêu đã chốt. Đạt khi có bằng chứng kiểm thử bảo mật và khôi phục trên môi trường thử riêng, không còn endpoint QLKLTN thiếu authorize. Kiểm: review quyền theo ma trận, integration tests, restore rehearsal có kiểm soát. Vị trí: backend/frontend/config/CI/docs vận hành.

**T32 — Kiểm thử luồng và phi chức năng.** Phụ thuộc: T31, G-07. Làm: fixture đợt đầy đủ, E2E ba vai trò qua proxy `/api`, ca cạnh tranh đăng ký, lỗi SMTP/storage/DB, accessibility cơ bản và hiệu năng theo số đo được chốt. Đạt khi mọi luồng trong `WORKFLOWS` có test/bằng chứng, các ngưỡng OQ-007 đạt hoặc được xử lý thành issue chặn. Kiểm: chạy full backend/frontend gate và E2E trên DB cô lập. Vị trí: `app/backend/tests`, `app/frontend` tests/E2E, CI.

**T33 — Chuẩn bị phát hành.** Phụ thuộc: T32. Làm: rà soát migration theo thứ tự, chuẩn bị môi trường/secret, runbook triển khai và rollback, dữ liệu ban đầu, hướng dẫn Giáo vụ, checklist UAT cho ba vai trò. Đạt khi người vận hành có thể tạo đợt đầu tiên và xử lý sự cố theo tài liệu, mọi G-01…G-08 liên quan đã đóng, UAT một đợt mẫu từ đăng ký tới công bố đạt. Kiểm: diễn tập trên môi trường staging; triển khai production là quyết định/thao tác riêng. Vị trí: `docs/`, `.github/workflows`, cấu hình triển khai.

**Checkpoint phát hành:** luồng hoàn chỉnh qua trình duyệt và API, kết quả từng SV đúng; quyền không rò dữ liệu; audit/backup/restore được kiểm chứng; tài liệu và chỉ tiêu vận hành đồng bộ. Không đánh dấu “hoàn thành ứng dụng” chỉ vì build/test nền hiện tại xanh.

## 7. Truy vết và rủi ro

| Rủi ro | Cách kiểm soát trong kế hoạch |
| --- | --- |
| DESIGN đặt quy tắc khác hoặc chi tiết hơn tài liệu chuẩn | T00/G-01…G-08 chốt trước phần tương ứng; test dựa trên quyết định đã ghi. |
| Đăng ký/chấm cùng lúc gây sai dữ liệu | Constraint/index + transaction + test PostgreSQL concurrent ở T12, T21, T27. |
| Migration làm lệch DB Neon hoặc Products | Migration additive; review SQL, branch test riêng, kiểm tra lịch sử migration; giữ Products theo PDR-002. |
| File/điểm bị lộ | Backend kiểm tra người nhận/người nộp/người chấm và trạng thái công bố ở T16/T24–T28; test 401/403. |
| Tích hợp SMTP/storage thất bại làm mất trạng thái | Test failure/retry/idempotency và tách trạng thái gửi khỏi transaction nghiệp vụ ở T16/T28. |
| UI trông đầy đủ nhưng không có dữ liệu thật | Mỗi checkpoint dùng API và DB thử cô lập; placeholder chỉ bỏ khi slice thực sự hoàn chỉnh. |

## 8. Cách thực hiện và theo dõi

1. Lấy task tiếp theo không bị chặn trong [todo.md](todo.md), đọc lại `docs/OPEN_QUESTIONS.md` và tài liệu liên quan tại thời điểm code.
2. Chốt contract FE/BE và migration của task, viết test cho hành vi, triển khai lát cắt, kiểm đủ checkpoint; ghi link PR/commit hoặc bằng chứng test ngay bên cạnh task checklist khi thực hiện.
3. Sau mỗi 2–3 task, chạy lại test liên quan và review bằng ba tài khoản; cuối phase chạy checkpoint đầy đủ. Nếu phát hiện câu hỏi mới, thêm vào `OPEN_QUESTIONS.md` thay vì đoán.
4. Có thể làm song song các slice độc lập sau khi hợp đồng chung chốt; migration cùng bảng, auth policy và workflow trạng thái phải có một chủ sở hữu/chuỗi tích hợp rõ ràng.

Không có ước lượng lịch cố định khi G-01…G-08 và năng lực triển khai chưa được chốt. Thứ tự này là thứ tự phụ thuộc, không phải lời hứa tiến độ.
