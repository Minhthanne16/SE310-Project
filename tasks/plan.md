# Kế hoạch tái tổ chức working tree

## Mục tiêu

Sắp xếp lại mã hiện có theo ownership của feature, giữ nguyên route, hợp đồng API, hành vi và migration. Không tạo mô-đun QLKLTN rỗng.

## Quyết định cấu trúc

- Frontend: `app/` chỉ sở hữu route; nhóm `(legacy-products)`, `(public)` và `(protected)` thể hiện phạm vi route mà không đổi URL. Mã Products nằm hoàn toàn trong `src/features/products/`.
- Backend: các kiểu, entity, repository, controller và test của Products, Auth và Users đặt trong thư mục feature tương ứng ở từng layer. `Common`, `Data`, `Authentication` và `Integrations` vẫn là phần dùng chung/hạ tầng.
- Namespace Application, Infrastructure và API phản ánh vị trí feature mới; không đổi tên controller, route hay DTO public. Namespace Domain giữ nguyên để không làm lệch identity trong EF Core migration đã áp dụng.

## Các bước

1. Kiểm tra baseline của frontend và backend.
2. Gom route/frontend legacy Products về feature, đồng thời sắp xếp route groups.
3. Gom mã backend hiện hữu theo feature tại Domain, Application, Infrastructure, API và Tests; cập nhật namespace/import.
4. Kiểm tra route/API không đổi và chạy typecheck, test, build phù hợp.

## Rủi ro và giảm thiểu

| Rủi ro | Giảm thiểu |
| --- | --- |
| Đổi namespace làm lỗi biên dịch | Chỉ đổi namespace nội bộ; chạy `dotnet test`. |
| Di chuyển route Next.js đổi URL | Chỉ dùng route group trong ngoặc, không đổi segment thực. |
| Đụng thay đổi của người dùng | Không chạm `.env.example` hoặc `frontend/next-env.d.ts`. |

## Chuyển runtime workspace vào `app/`

### Mục tiêu

Đưa toàn bộ thành phần cần để chạy ứng dụng vào `app/`: `backend/`, `frontend/`, hai file Compose, `.dockerignore`, `.env.example`, `.env` local và `.neon`. Các tài liệu, workflow CI và hướng dẫn agent ở root được cập nhật để dùng đường dẫn mới.

### Các bước

1. Di chuyển các thành phần runtime vào `app/` mà không đọc hoặc thay đổi secret trong `.env`.
2. Cập nhật Compose/CI để build context vẫn là thư mục chứa `backend/` và `frontend/`.
3. Cập nhật README, hướng dẫn Neon, thiết kế có tham chiếu path và `AGENTS.md`.
4. Chạy frontend/backend checks từ `app/`, kiểm tra Compose config và các đường dẫn cũ.

### Rủi ro và giảm thiểu

| Rủi ro | Giảm thiểu |
| --- | --- |
| Compose không tìm thấy `.env` hoặc Dockerfile | Di chuyển cả Compose, env và `.dockerignore` vào cùng `app/`; kiểm tra `docker compose config`. |
| CI build sai context | Cập nhật `working-directory`, cache path, build context và Dockerfile path cùng lúc. |
| Mất cấu hình local | Chỉ move `.env` bằng đường dẫn literal, không đọc hay ghi nội dung. |
