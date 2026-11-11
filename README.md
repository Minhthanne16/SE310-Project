# SE310 Project

Ứng dụng quản lý sản phẩm mẫu với Next.js 16 và ASP.NET Core 10. Runtime workspace nằm trong `app/`, gồm frontend và backend kết nối qua `/api` của Next.js.

## Tech stack

| Phần | Công nghệ |
| --- | --- |
| Frontend | Node.js 24, Next.js 16.4.3 App Router, React 19.3.0, TypeScript 5.9.3 strict mode |
| UI | Tailwind CSS 4.3.3, React Hot Toast, Lucide React |
| FE testing/tooling | Vitest 5.0.3, Testing Library, jsdom, Oxlint 1.87.0, Prettier 3.9.9, Turbopack |
| Backend | ASP.NET Core Web API, .NET 10, Clean Architecture, CQRS/MediatR 14.2.0, Repository |
| Validation/mapping | FluentValidation 12.1.1, AutoMapper 16.2.0 |
| Data | PostgreSQL hoặc Neon, EF Core 10.0.12, Npgsql 10.0.3 |
| Integrations | Redis 8/StackExchange.Redis, MinIO, JWT Bearer, BCrypt, Google Identity SDK, SMTP/MailKit |
| API/tests | OpenAPI + Scalar, xUnit, ASP.NET Core TestHost, coverlet |
| Delivery | Docker multi-stage, Docker Compose, GHCR workflow, GitHub Actions, npm audit, Gitleaks |

## Cấu trúc

```text
app/
  frontend/
    app/                       Next.js App Router
    src/features/products/     Giao diện và client cho sản phẩm
    src/api/                   HTTP client qua Next.js proxy
    Dockerfile
  backend/
    src/Backend.Domain/         Entity và repository contract
    src/Backend.Application/    CQRS handlers, validation, mapping
    src/Backend.Infrastructure/ EF Core, PostgreSQL migration, Redis/MinIO/SMTP adapters
    src/Backend.API/            HTTP controllers, OpenAPI/Scalar, JWT config
    tests/Backend.Tests/        xUnit và TestHost
    Dockerfile
  compose.yaml
  compose.neon.yaml
    backend/.env.example
.github/workflows/             CI và publish GHCR theo lệnh thủ công
```

CRUD sản phẩm chạy qua MediatR và EF Core PostgreSQL. Đã có API đăng nhập cục bộ (`/api/auth/login`, `me`, `activation-code`, `change-initial-password`, `logout`): JWT nằm trong cookie HttpOnly, phân quyền theo ba vai trò `Student`, `Lecturer`, `AcademicAffairs`, mật khẩu băm bằng BCrypt. Sinh viên đăng nhập lần đầu bằng MSSV rồi đổi mật khẩu kèm OTP 6 số gửi qua email; giảng viên, giáo vụ dùng mật khẩu Giáo vụ đặt khi tạo tài khoản, không cần OTP ([PDR-055](docs/decisions/PDR-055-mat-khau-giang-vien-giao-vu-va-nhap-excel.md)). Giáo vụ tạo tài khoản hàng loạt từ tệp Excel (.xlsx) hoặc CSV qua `/api/users/import/preview` và `/api/users/import`, và quản lý tài khoản (danh sách, thêm, sửa, vô hiệu hóa/kích hoạt lại, xóa, đặt lại mật khẩu, có lịch sử thao tác xem tại ngăn Sửa) qua `/api/users` ([PDR-004](docs/decisions/PDR-004-nhap-tai-khoan-csv.md)). Quên mật khẩu (`/api/auth/forgot-password`, `reset-password/check`, `reset-password`) gửi liên kết 30 phút dùng một lần, phản hồi trung tính và giới hạn tần suất ([PDR-052](docs/decisions/PDR-052-hop-dong-quen-mat-khau-va-lich-su-tai-khoan.md)); khi đặt API sau reverse proxy ghi đè `X-Forwarded-For`, khai IP proxy ở `ForwardedHeaders__TrustedProxies`. Xem [PDR-002](docs/decisions/PDR-002-xac-thuc-va-lo-trinh-ma-nguon.md) và [PDR-003](docs/decisions/PDR-003-otp-kich-hoat-qua-email.md). Redis, MinIO và Google đã có package, cấu hình và adapter cơ bản; hồ sơ, đổi mật khẩu thường, ảnh đại diện trên MinIO và chuông thông báo dùng API thật ([PDR-051](docs/decisions/PDR-051-ho-so-anh-dai-dien-va-chuong-thong-bao.md)); Đề tài của đợt: GV gửi/sửa/xóa đề tài, Giáo vụ công bố danh sách, SV xem danh sách đã công bố qua `/api/topics` ([PDR-053](docs/decisions/PDR-053-de-tai-giang-vien-va-cong-bo-danh-sach.md)); API ghi danh nhóm và hủy ghi danh đã có ([PDR-054](docs/decisions/PDR-054-ghi-danh-nhom-de-tai-cong-bo.md)), giao diện ghi danh và đề xuất đề tài chưa có. repo **chưa có** refresh token hoặc upload tài liệu nộp.

### Gửi email (OTP)

- **Mặc định khi dùng Compose:** mail đi vào Mailpit, xem tại <http://localhost:8025>. Không cần cấu hình gì thêm.
- **Gửi thật qua Gmail:** bật xác minh 2 bước cho tài khoản Gmail, tạo App Password tại <https://myaccount.google.com/apppasswords>, rồi điền vào `app/backend/.env`: `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`, `SMTP_USE_STARTTLS=true`, `SMTP_USER=<gmail>`, `SMTP_PASSWORD=<App Password>`, `SMTP_FROM=QLKLTN <gmail>`. Không dùng mật khẩu Gmail thật và không commit `.env`. Khi chạy `dotnet run`, dùng các biến `Email__Host`, `Email__Port`, `Email__UseStartTls`, `Email__Username`, `Email__Password`, `Email__From`.

API bắt buộc có `Authentication__Jwt__SigningKey` (tối thiểu 32 byte, ví dụ `openssl rand -base64 48`), nếu thiếu sẽ không khởi động. Với Compose, đặt `JWT_SIGNING_KEY` trong `app/backend/.env`.

## Chạy bằng Docker Compose

1. Sao chép `app/backend/.env.example` thành `app/backend/.env` rồi thay các giá trị mật khẩu mẫu. `.env` được git bỏ qua.
2. Chạy `cd app; docker compose --env-file backend/.env up --build` từ thư mục gốc. Nếu cổng `5432` đang được PostgreSQL khác dùng, đặt `POSTGRES_HOST_PORT=5433` trong `app/backend/.env`.
3. Mở frontend tại <http://localhost:3000>, API tại <http://localhost:5290>, Scalar tại <http://localhost:5290/scalar>, MinIO Console tại <http://localhost:9001> và hộp thư Mailpit tại <http://localhost:8025>.

Compose tự chạy migration, seed ba sản phẩm mẫu và ba tài khoản thử: Sinh viên `sv.22520001@qlkltn.local` (22520001), Giảng viên `gv.0001@qlkltn.local` (GV0001) và Giáo vụ `giaovu.0001@qlkltn.local` (GVU0001). Cả ba chỉ là seed local, đã kích hoạt sẵn để đăng nhập trực tiếp, không cần OTP/đổi mật khẩu; không bật seed này trên Neon/dữ liệu thật. Volume PostgreSQL, Redis, MinIO và Data Protection keys giữ dữ liệu giữa các lần khởi động.

### Dùng Neon thay PostgreSQL local

Project Neon `se310-project` đã có migration khởi tạo. Đặt chuỗi kết nối pooled vào `ConnectionStrings__DefaultConnection` trong `app/backend/.env` local (xem `app/backend/.env.example`), rồi chạy `cd app; docker compose --env-file backend/.env -f compose.neon.yaml up --build`. Cấu hình này không tự chạy migration hoặc seed. Xem [hướng dẫn Neon](docs/NEON.md) để lấy lại chuỗi kết nối, kiểm tra branch và chuyển dữ liệu nếu cần.

MinIO trong Compose chỉ dành cho local development. Image `minio/minio` đã bị gỡ khỏi Docker Hub nên Compose dùng `pgsty/minio`, bản build cộng đồng của cùng mã nguồn. Bản open-source này đã được lưu trữ và có [cảnh báo bảo mật từ dự án MinIO](https://github.com/minio/minio/security/advisories); các cổng trong Compose chỉ bind vào `127.0.0.1`. Khi triển khai thực tế, dùng dịch vụ MinIO được duy trì và quản lý riêng.

## Chạy riêng để phát triển

Yêu cầu Node.js 24, .NET SDK 10 và PostgreSQL. Khai báo biến môi trường `ConnectionStrings__DefaultConnection` cho API, ví dụ chuỗi kết nối tới PostgreSQL local. Với Neon, dùng chuỗi kết nối do Neon cấp qua biến môi trường; không ghi vào file được commit.

```powershell
cd app/backend
dotnet restore Backend.sln --locked-mode
dotnet tool restore
dotnet tool run dotnet-ef database update --project src/Backend.Infrastructure --startup-project src/Backend.API
dotnet run --project src/Backend.API
```

Ở terminal khác:

```powershell
cd app/frontend
npm ci
npm run dev
```

`app/frontend/next.config.ts` chuyển `/api/*` đến `http://localhost:5290` khi chạy local. Có thể đặt `API_INTERNAL_URL` nếu API ở địa chỉ khác. Các màn đợt và đề tài luôn gọi API thật nên `npm run dev` cần backend đang chạy; kho dữ liệu trong bộ nhớ (`roundDemoService.ts`, `topicDemoService.ts`) chỉ dùng cho test. Đặt `InitializeDatabase=true` để API tự chạy migration khi khởi động.

## Kiểm tra

```powershell
cd app/backend
dotnet restore Backend.sln --locked-mode
dotnet test Backend.sln --no-restore

cd ../frontend
npm run typecheck
npm run lint
npm test
npm run build
npm audit --audit-level=high
```

Test ghi danh đề tài (P03-S02) gồm test đồng thời trên PostgreSQL thật. Một lệnh từ thư mục gốc dựng PostgreSQL tạm trong Docker, chạy test backend + frontend của phần đề tài/ghi danh rồi xóa container (thêm `-All` để chạy toàn bộ test):

```powershell
powershell -ExecutionPolicy Bypass -File app/scripts/test-ghi-danh.ps1
```

Không có biến `QLKLTN_TEST_POSTGRES` thì `dotnet test` bỏ qua 7 test đồng thời (`RegistrationConcurrencyTests`); không trỏ biến này vào database dùng chung.

CI dùng `npm ci`, NuGet lockfile, build/test cả hai phần và Gitleaks. Workflow GHCR chỉ chạy khi được kích hoạt thủ công (`workflow_dispatch`).
