# Hướng dẫn cho agent làm việc trong SE310-Project

## Bắt buộc đọc tài liệu trước khi code

- Trước khi viết, sửa, đánh giá hoặc đề xuất thay đổi **code** trong repository, phải đọc toàn bộ tệp trong `docs/` theo cách đệ quy. Bắt đầu tại `docs/CONTENT.md`, sau đó đọc tất cả tài liệu Markdown/text và mở kiểm tra tài nguyên hình ảnh hỗ trợ trong `docs/`.
- `docs/` là nguồn chuẩn của sản phẩm QLKLTN. Mã nguồn mẫu hiện có, tên file, route, giao diện mẫu hoặc dữ liệu giả không được dùng để suy diễn yêu cầu chưa được tài liệu xác nhận.
- Đọc `docs/OPEN_QUESTIONS.md` trước khi code phần liên quan. Nếu còn câu hỏi mở hoặc tài liệu nghiệp vụ và `docs/DESIGN/` mâu thuẫn, dừng việc code để làm rõ/ghi nhận quyết định; không tự chọn một quy tắc.
- Khi thay đổi làm ảnh hưởng yêu cầu, quy tắc, vai trò, mô hình miền hoặc quyết định đã chốt, cập nhật tài liệu liên quan trong cùng tác vụ trước khi xem thay đổi mã là hoàn thành.

## Phạm vi và cấu trúc

- File này áp dụng cho toàn bộ repository. Đọc `README.md` và file liên quan trước khi sửa.
- `app/frontend/`: Next.js App Router, React, TypeScript. Client API ở `app/frontend/src/api/request.ts` và `app/frontend/src/features/*/services/`; kiểu dữ liệu ở `app/frontend/src/types/`. `app/frontend/next.config.ts` chuyển `/api/*` sang backend.
- `app/backend/src/Backend.API/`: controller, middleware, cấu hình HTTP. `app/backend/src/Backend.Application/`: DTO, command/query, validation, response. `app/backend/src/Backend.Domain/`: entity và interface. `app/backend/src/Backend.Infrastructure/`: EF Core, migration, repository, tích hợp ngoài.
- `app/backend/tests/Backend.Tests/` và các file `*.test.ts(x)` là nơi kiểm tra hành vi.
- PostgreSQL local được cấu hình trong `app/compose.yaml`. Cách dùng Neon nằm ở [docs/NEON.md](docs/NEON.md).

## Skills cần chọn theo công việc

Chỉ dùng skill thực sự phù hợp với tác vụ, theo hướng dẫn của môi trường agent:

| Công việc | Skill |
| --- | --- |
| Sửa lỗi hoặc gặp test lỗi, hành vi bất thường | `systematic-debugging` |
| Thay đổi logic/hành vi, thêm endpoint, sửa bug | `test-driven-development` |
| Nhận input, xác thực, lưu dữ liệu, tích hợp dịch vụ ngoài | `security-and-hardening` |
| Làm giao diện/trang/component mới | `frontend-design` |
| Refactor để dễ đọc mà giữ nguyên hành vi | `code-simplification` |
| Yêu cầu lớn cần chia thành các bước thực hiện | `planning-and-task-breakdown` |
| Thiết lập project Neon hoặc mở rộng backend trên Neon | `neon` |
| Kết nối PostgreSQL, schema, migration hoặc branch Neon | `neon-postgres` |

## Quy tắc bắt buộc khi sửa API

1. **Trước khi code backend**, kiểm tra frontend đang gọi endpoint nào và dùng hợp đồng nào: `app/frontend/src/api/request.ts`, `app/frontend/src/features/*/services/`, `app/frontend/src/types/`, các component gọi service, `app/frontend/next.config.ts` và test liên quan. Ghi lại method, URL, request body, response body, mã trạng thái, lỗi và trường hợp thiếu dữ liệu.
2. **Trước khi code frontend**, kiểm tra backend thực sự cung cấp gì: controller trong `app/backend/src/Backend.API/`, DTO/validator/handler trong `app/backend/src/Backend.Application/`, `ApiResponse<T>`, middleware lỗi và OpenAPI/Scalar khi API đang chạy. Không suy đoán endpoint từ tên file hoặc chỉ dựa vào type phía frontend.
3. Mỗi thay đổi hợp đồng API phải đối chiếu **cả hai phía trước khi sửa**, cập nhật cả hai phía trong cùng tác vụ nếu cần, rồi kiểm tra lại bằng test hoặc request thực tế. Không âm thầm đổi tên field, kiểu, nullability, route, status code, cấu trúc lỗi hay quy tắc xác thực.
4. Quy ước hiện tại: frontend gọi `/api/products`; Next.js proxy đến backend; response thành công dùng `{ success, message, data, errors? }`. `apiRequest<T>` trả `data` và ném lỗi nếu HTTP lỗi hoặc `success=false`. Backend dùng `api/[controller]` với `ProductsController` cho GET/POST/PUT/DELETE. Xác thực dùng JWT trong cookie HttpOnly `qlkltn_access` qua `AuthController` (`/api/auth/*`); endpoint QLKLTN mới phải khai báo `[Authorize]` hoặc `[Authorize(Roles = AppRoles.…)]`, và 401/403 trả `ApiResponse` (xem `docs/decisions/PDR-002-…`). Kiểm tra mã nguồn hiện tại vì quy ước có thể thay đổi.
5. Khi thay đổi entity hoặc DTO có ảnh hưởng database, kiểm tra mapping EF Core và migration; không sửa migration đã áp dụng chỉ để che sai lệch. Xem kỹ SQL/migration trước khi áp dụng lên dữ liệu có thật.

## Cách làm và kiểm tra

- Giữ ranh giới các tầng hiện có. Đặt logic nghiệp vụ ở Application, truy cập dữ liệu ở Infrastructure, HTTP ở API; frontend không kết nối trực tiếp PostgreSQL/Neon.
- Không commit mật khẩu, connection string thật, token hoặc file dump. Dùng biến môi trường/secrets; không in secret ra log hoặc kết quả kiểm tra.
- Không tự chạy migration, seed, restore hoặc xóa trên database dùng chung/production chỉ để kiểm tra code. Xác định đúng database/branch trước khi thao tác.
- Chỉ chạy kiểm tra phù hợp với phần đã sửa. Backend: từ `app/backend/` chạy `dotnet restore Backend.sln --locked-mode`, `dotnet test Backend.sln --no-restore`; frontend: từ `app/frontend/` chạy `npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` khi tương ứng. Nếu không chạy được, nêu rõ lý do.
- Tôn trọng thay đổi có sẵn trong working tree; không hoàn tác hoặc ghi đè thay đổi ngoài phạm vi tác vụ.
