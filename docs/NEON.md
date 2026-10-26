# Kết nối SE310-Project với Neon PostgreSQL

Hướng dẫn này dành cho repo hiện tại: frontend Next.js gọi `/api/*` qua proxy, backend ASP.NET Core 10 dùng EF Core/Npgsql. **Chỉ backend giữ thông tin Neon.** Frontend không cần `DATABASE_URL` và không được nhận mật khẩu database.

## Thiết lập hiện tại của repo

- Neon project: `se310-project` (`lucky-dream-62992773`) trong tổ chức **Minh Thân**.
- Vùng: `aws-ap-southeast-1` (Singapore). Branch đang liên kết: `main` trong file `app/.neon` local.
- Migration `20261020143314_InitialCreate` đã áp dụng. Bảng `Products` hiện trống; API `GET /api/products` đã trả về thành công từ Neon.
- Ba migration `20261024044840_AddUsers` (thêm bảng `Users` cho đăng nhập), `20261024060228_AddUserActivationCode` (thêm cột OTP) và `20261024070722_AddUserProfileFields` (thêm ngày sinh, lớp, bộ môn, học hàm) **chưa** áp dụng lên Neon. Cả ba chỉ thêm bảng hoặc cột, không đổi `Products`. Xem SQL bằng `dotnet tool run dotnet-ef migrations script 20261020143314_InitialCreate AddUserProfileFields --project src/Backend.Infrastructure --startup-project src/Backend.API`, rồi áp dụng có chủ đích theo mục 4, nên thử trên branch Neon riêng trước. Không bật `SeedDevelopmentUsers` trên Neon.
- Chuỗi kết nối pooled cho Docker được lưu trong `app/.env` local và đã được gitignore. Nếu clone repo sang máy khác, tạo lại file này từ `app/.env.example` rồi điền chuỗi từ Neon Console; không commit secret.

Các bước tạo project và chạy migration bên dưới dành cho trường hợp muốn thiết lập lại ở project/branch khác. Đừng chạy lại quy trình tạo project nếu bạn tiếp tục dùng project trên.

## 1. Xác định bạn muốn đưa gì lên Neon

- **Database mới, chưa có dữ liệu cần giữ:** tạo project Neon rồi chạy EF Core migration `InitialCreate` lên database trống (mục 4). Đây là cách đơn giản nhất.
- **Chuyển cả schema và dữ liệu PostgreSQL local:** tạo database Neon trống rồi `pg_dump`/`pg_restore` (mục 6). Sau khi restore, không chạy lại migration khởi tạo nếu bảng `__EFMigrationsHistory` đã được chuyển theo.

Đừng chạy cả hai quy trình lên cùng một database. Chọn đúng branch/database Neon trước khi chạy lệnh ghi dữ liệu.

## 2. Tạo project và lấy thông tin kết nối Neon

1. Vào [Neon Console](https://console.neon.tech/), đăng nhập và chọn **Create project**. Đặt tên, chọn vùng gần nơi backend sẽ chạy, rồi tạo project. Ghi lại branch, database và role được tạo. Có thể tạo branch phát triển riêng để thử trước.
2. Trong project, bấm **Connect**. Chọn đúng **Branch**, **Compute**, **Database**, **Role**. Sao chép hai kết nối: bật **Connection pooling** để lấy host có `-pooler` cho API; tắt nó để lấy host trực tiếp cho migration, `psql`, `pg_dump`/`pg_restore`.
3. Neon thường cho chuỗi URI như `postgresql://ROLE:PASSWORD@HOST/DATABASE?sslmode=require`. Đây là secret: đừng dán vào chat, issue, source, `README.md` hoặc `appsettings.json` được commit. Nếu lộ, đổi mật khẩu role trong Neon.
4. Backend repo này dùng `GetConnectionString("DefaultConnection")` và Npgsql, vì vậy đặt biến môi trường **`ConnectionStrings__DefaultConnection`** theo cú pháp key/value Npgsql, ví dụ:

   ```text
   Host=ep-example-pooler.region.aws.neon.tech;Port=5432;Database=neondb;Username=neondb_owner;Password=<MAT_KHAU>;SSL Mode=VerifyFull
   ```

   Thay host, database, role, password bằng giá trị của **chính project Neon**. Với migration/restore, dùng host trực tiếp (bỏ `-pooler`). URI `postgresql://...` từ Console dùng tốt với `psql`; chuyển các trường sang dạng trên cho biến cấu hình .NET. Nếu password chứa dấu `;` hoặc dấu `"`, xem [quy tắc connection string của Npgsql](https://www.npgsql.org/doc/connection-string-parameters) và escape đúng, hoặc tạo mật khẩu phù hợp. `SSL Mode=VerifyFull` yêu cầu TLS và xác minh hostname/chứng chỉ. Không dùng `Trust Server Certificate=true`.

> [Neon: Connect to your stack](https://neon.com/docs/get-started/connect-neon) giải thích cách lấy URL. [Neon: Connection pooling](https://neon.com/docs/connect/connection-pooling) khuyến nghị kết nối pooled cho web app và direct cho schema migration/dump/restore. [Npgsql: Security and encryption](https://www.npgsql.org/doc/security.html) giải thích các mức SSL.

## 3. Chuẩn bị máy local

Cần .NET SDK 10, PostgreSQL client (`psql`, `pg_dump`, `pg_restore`) nếu muốn kiểm tra/chuyển dữ liệu, và Node.js 24 nếu chạy frontend. Kiểm tra:

```powershell
dotnet --version
psql --version
pg_dump --version
```

Nếu chỉ dùng database mới với EF migration, không bắt buộc cài `psql`. Neon cần kết nối ra Internet đến host Neon trên cổng 5432; nếu timeout, kiểm tra firewall/VPN/DNS.

Trong **terminal PowerShell chạy backend**, đặt chuỗi direct tạm thời (thay placeholder, không lưu vào file được commit):

```powershell
$env:ConnectionStrings__DefaultConnection = 'Host=ep-example.region.aws.neon.tech;Port=5432;Database=neondb;Username=neondb_owner;Password=<MAT_KHAU>;SSL Mode=VerifyFull'
```

Biến trên chỉ sống trong terminal đó. Đừng dùng `setx` hoặc lưu secret vào lịch sử lệnh của máy dùng chung. Có thể dùng secret manager của hệ thống/hosting khi triển khai. Backend đọc biến này tại `app/backend/src/Backend.Infrastructure/DependencyInjection.cs`; không cần đổi code. Cần thay sang chuỗi pooled sau khi hoàn tất migration.

## 4. Database Neon mới: tạo schema bằng EF Core migration

Chạy trong cùng terminal đã đặt **direct** connection string:

```powershell
cd app/backend
dotnet restore Backend.sln --locked-mode
dotnet tool restore
dotnet tool run dotnet-ef migrations list --project src/Backend.Infrastructure --startup-project src/Backend.API
dotnet tool run dotnet-ef database update --project src/Backend.Infrastructure --startup-project src/Backend.API
```

Migration có sẵn là `20261020143314_InitialCreate`; nó tạo bảng `Products`, và EF Core ghi lịch sử vào `__EFMigrationsHistory`. Trước khi cập nhật **database có dữ liệu**, xem migration trong `app/backend/src/Backend.Infrastructure/Data/Migrations/` và có bản sao lưu. Với môi trường triển khai thực tế, nên review SQL và chạy migration trong quy trình deploy riêng; [Microsoft: Applying Migrations](https://learn.microsoft.com/en-us/ef/core/managing-schemas/migrations/applying) nêu các lựa chọn an toàn hơn lệnh CLI trực tiếp lên production.

Kiểm tra trong Neon **SQL Editor** (đúng branch/database):

```sql
SELECT * FROM "__EFMigrationsHistory";
SELECT COUNT(*) FROM "Products";
```

Nếu muốn có 3 sản phẩm mẫu, đặt `SeedSampleProducts=true` **chỉ khi chạy API trên database mới dành cho phát triển**. `SeedSampleProducts` mặc định `false` và chỉ thêm dữ liệu khi bảng `Products` đang trống. Không bật seed cho dữ liệu thật.

## 5. Chạy backend và frontend với Neon

Đổi biến trong terminal backend sang host **pooled** lấy từ cùng branch/database/role. Nếu `-pooler` nằm ngay trước phần vùng của hostname, dùng đúng tên host Console cung cấp:

```powershell
$env:ConnectionStrings__DefaultConnection = 'Host=ep-example-pooler.region.aws.neon.tech;Port=5432;Database=neondb;Username=neondb_owner;Password=<MAT_KHAU>;SSL Mode=VerifyFull'
$env:InitializeDatabase = 'false'
$env:SeedSampleProducts = 'false'
dotnet run --project src/Backend.API --launch-profile http
```

Ở terminal khác, từ thư mục gốc repo:

```powershell
cd app/frontend
npm ci
npm run dev
```

Mở `http://localhost:3000`. `app/frontend/next.config.ts` chuyển `/api/*` sang `http://localhost:5290/api/*` khi chạy local; kiểm tra API qua `http://localhost:5290/health` và `http://localhost:5290/api/products`. CRUD từ giao diện sẽ ghi vào Neon. Có thể kiểm tra lại bằng SQL Editor:

```sql
SELECT "Id", "Name", "Price", "Stock" FROM "Products" ORDER BY "CreatedAt" DESC LIMIT 10;
```

Để chạy bằng Docker, runtime workspace có file `app/compose.neon.yaml`. Nó dùng secret trong `app/.env` và chỉ khởi động backend/frontend, không khởi động PostgreSQL local. File `.env` được gitignore và cần một dòng theo cú pháp Npgsql:

```text
ConnectionStrings__DefaultConnection=Host=ep-example-pooler.region.aws.neon.tech;Port=5432;Database=neondb;Username=neondb_owner;Password=<MAT_KHAU>;SSL Mode=VerifyFull
```

Sau khi đã chạy mục 4 hoặc 6, từ thư mục gốc chạy:

```powershell
cd app
docker compose -f compose.neon.yaml up --build
```

Kiểm tra `http://localhost:5290/api/products` và `http://localhost:3000`. `app/compose.yaml` vẫn dành cho PostgreSQL local; không dùng `docker compose up` mặc định nếu bạn muốn API trỏ tới Neon. Frontend Docker proxy tới service API, không kết nối Neon trực tiếp. Không đưa chuỗi Neon vào `build.args` vì build args có thể lưu trong metadata/image.

## 6. Có dữ liệu local: chuyển sang Neon

Quy trình này sao chép **schema và dữ liệu**, kể cả `__EFMigrationsHistory`, từ PostgreSQL local của `app/compose.yaml` (mặc định cổng `127.0.0.1:5432`). Đích Neon phải là database/branch trống, **chưa** chạy mục 4. Dừng các thao tác ghi vào nguồn trong lúc dump/cutover để tránh bỏ sót dữ liệu.

1. Chạy PostgreSQL local nếu cần: `cd app; docker compose up -d db` từ thư mục gốc. Đọc `POSTGRES_USER`, `POSTGRES_DB` trong `app/.env` local; nếu chưa có, xem `app/.env.example`. Không chia sẻ mật khẩu.
2. Tạo file dump ở nơi riêng, **ngoài repo** hoặc trong thư mục đã gitignore. Ví dụ trong PowerShell, từ thư mục gốc:

   ```powershell
   $env:PGPASSWORD = '<MAT_KHAU_POSTGRES_LOCAL>'
   pg_dump -h 127.0.0.1 -p 5432 -U se310 -d se310 -Fc -f "$env:TEMP\se310-local.dump"
   Remove-Item Env:PGPASSWORD
   ```

   Đổi `se310` theo `app/.env` của bạn. `-Fc` tạo custom archive; không mở file bằng editor hoặc commit file dump. `pg_dump` phiên bản client phải tương thích với PostgreSQL nguồn (Compose hiện dùng PostgreSQL 17).
3. Đặt các biến **direct** của Neon (cùng database/role đã chọn ở mục 2), rồi restore:

   ```powershell
   $env:PGHOST = 'ep-example.region.aws.neon.tech'
   $env:PGPORT = '5432'
   $env:PGDATABASE = 'neondb'
   $env:PGUSER = 'neondb_owner'
   $env:PGPASSWORD = '<MAT_KHAU_NEON>'
   $env:PGSSLMODE = 'require'
   pg_restore --verbose --exit-on-error --no-owner --no-acl -d "$env:PGDATABASE" "$env:TEMP\se310-local.dump"
   Remove-Item Env:PGPASSWORD
   ```

   `PGSSLMODE=require` bật TLS cho `pg_restore` theo kiểu URI mẫu của Neon; nếu muốn xác minh hostname/chứng chỉ ở mức `verify-full`, cấu hình CA phù hợp với PostgreSQL client đang dùng trước khi đổi chế độ. `--no-owner` tránh lỗi role owner từ local; `--no-acl` bỏ quyền grant của môi trường cũ. Không thêm `--clean` nếu chưa kiểm tra chính xác database đích vì tùy chọn đó xóa object hiện có. Nếu công cụ báo lỗi quyền/extension, dừng và xem log trước khi thử lại.
4. Trong SQL Editor Neon, kiểm tra số dòng và lịch sử migration:

   ```sql
   SELECT COUNT(*) FROM "Products";
   SELECT * FROM "__EFMigrationsHistory";
   ```

   So sánh count với nguồn local. Nếu nguồn có schema khác repo hiện tại, xem lại migration và thử ở branch Neon riêng trước khi chuyển API. Sau khi dữ liệu khớp, chuyển API sang chuỗi pooled theo mục 5.
5. Xóa file dump ở máy khi không còn cần thiết và đã xác minh dữ liệu/backup phù hợp. Xóa biến `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGSSLMODE` khỏi session nếu muốn tránh chạy lệnh PostgreSQL nhầm database.

Tham khảo [Neon: Migrate data from Postgres with pg_dump and pg_restore](https://neon.com/docs/import/migrate-from-postgres). Nếu database lớn hoặc cần thời gian ngừng ghi rất ngắn, dùng công cụ/chỉ dẫn migration của Neon thay vì thao tác thủ công ở trên.

## 7. Triển khai và xử lý lỗi thường gặp

- **Backend báo thiếu `ConnectionStrings:DefaultConnection`:** đặt đúng tên biến `ConnectionStrings__DefaultConnection` trong môi trường **của API**, không phải chỉ trong terminal frontend hoặc `NEXT_PUBLIC_*`.
- **`password authentication failed`:** đối chiếu role, password, branch/database; dùng thông tin Connect mới từ Neon. Không in chuỗi kết nối thật để debug.
- **Timeout/DNS:** kiểm tra host, cổng 5432 và kết nối mạng nơi backend chạy. Host Neon không phải `localhost` hoặc `db`.
- **`relation "Products" does not exist`:** chưa chạy migration lên database mới, hoặc đang kết nối sai branch/database. Kiểm tra `__EFMigrationsHistory` trước khi chạy lại.
- **Frontend không thấy dữ liệu:** kiểm tra `GET /api/products` của backend trước, rồi kiểm tra rewrite Next.js và `API_INTERNAL_URL`. `GET /health` chỉ xác nhận API đang chạy, không kiểm tra DB.
- **Ứng dụng chạy ở cloud:** thêm `ConnectionStrings__DefaultConnection` vào secret/environment của **dịch vụ backend** với chuỗi pooled; dùng direct secret trong job migration riêng. Đặt `InitializeDatabase=false` và `SeedSampleProducts=false` sau khi chuẩn bị schema. Không đưa secret vào build args, image, client bundle hoặc Git.

Database Neon chỉ thay PostgreSQL. Redis, MinIO và SMTP là các dịch vụ khác, không tự chuyển lên Neon.
