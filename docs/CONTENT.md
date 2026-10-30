# Mục lục tài liệu QLKLTN

Đây là điểm bắt đầu để hiểu hệ thống quản lý khóa luận tốt nghiệp (QLKLTN). Tài liệu trong thư mục này chuẩn hóa yêu cầu và các quyết định nghiệp vụ đã được xác nhận; chúng thay thế cho việc suy đoán từ mã nguồn mẫu hiện có.

## Thứ tự đọc bắt buộc trước khi code

1. Đọc toàn bộ tệp trong `docs/` theo thứ tự tài liệu này; với hình trong tài liệu, phải mở kiểm tra thay vì bỏ qua.
2. Đọc [PROJECT_SPEC.md](PROJECT_SPEC.md), [FEATURE.md](FEATURE.md) và [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md).
3. Đọc toàn bộ `product/`, `requirements/`, `architecture/`, `decisions/` và `DESIGN/`.
4. Chỉ bắt đầu code khi không có mục liên quan vẫn ở trạng thái **Mở** trong `OPEN_QUESTIONS.md`. Nếu có, làm rõ trước thay vì tự đặt quy tắc mới.

## Tài liệu hiện hành

| Khu vực | Mục đích |
| --- | --- |
| [PROJECT_SPEC.md](PROJECT_SPEC.md) | Bức tranh tổng thể, phạm vi và trạng thái chuẩn bị phát triển. |
| [FEATURE.md](FEATURE.md) | Danh mục khả năng theo vai trò, không phải đặc tả API hay UI. |
| [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md) | Các chi tiết chưa đủ căn cứ để hiện thực. |
| [STRUCTURE.md](STRUCTURE.md) | Bản đồ thư mục tài liệu hiện tại. |
| [README.md](README.md) | Con trỏ ngắn cho người mở trực tiếp thư mục `docs/`. |
| `product/` | Tầm nhìn, phạm vi, vai trò và thuật ngữ nghiệp vụ. |
| `requirements/` | Luồng cấp cao, quy tắc nghiệp vụ và ràng buộc phi chức năng. |
| `architecture/` | Bối cảnh hệ thống và mô hình miền ở mức khái niệm. |
| `decisions/` | Các quyết định đã được nguồn tài liệu hoặc người phụ trách sản phẩm xác nhận, kèm lý do và hệ quả. |
| `DESIGN/` | Bàn giao giao diện có sẵn, gồm Markdown và sitemap hình ảnh; chỉ là tài liệu bổ sung, không tự thay đổi yêu cầu nghiệp vụ. |
| [`plan/`](plan/README.md) | Rà soát điểm bất nhất và lộ trình phase đề xuất để hoàn thiện QLKLTN; không thay thế quyết định nghiệp vụ. |
| [NEON.md](NEON.md) | Hướng dẫn kỹ thuật có sẵn cho PostgreSQL/Neon của repo; không thay thế yêu cầu QLKLTN. |

## Nguồn và quy ước

- Nguồn nghiệp vụ được các tài liệu hiện có dẫn chiếu: *Báo cáo Cuối kỳ - SE310 - QLKLTN (cập nhật 16-10)*. Bản báo cáo gốc hiện không có trong `docs/`, nên lần rà soát này không kiểm chứng trực tiếp được nội dung báo cáo; xem [plan/REVIEW.md](plan/REVIEW.md).
- Các nội dung đã được tài liệu hiện hành ghi nhận hoặc người dùng xác nhận được chuẩn hóa thành yêu cầu hoặc quyết định. Các chỗ thiếu, mơ hồ hoặc mâu thuẫn được ghi tại `OPEN_QUESTIONS.md`.
- Khi tài liệu trong `DESIGN/` khác với yêu cầu, quy tắc, quyết định hoặc câu hỏi mở hiện hành, không tự chọn một bên: ghi nhận và làm rõ trước khi code.
- Tài liệu này mô tả **sản phẩm mục tiêu**. Mã nguồn hiện tại chỉ là nền kỹ thuật ban đầu, chưa được coi là bằng chứng rằng một chức năng QLKLTN đã tồn tại.
