# Implementation Plan: Hồ sơ cá nhân và ảnh MinIO

## Overview

Hoàn thiện hồ sơ cho cả ba vai trò với dữ liệu lưu bền, API có phân quyền, ảnh đại diện private trong MinIO và frontend dùng API thật.

## Architecture decisions

- Chỉ lưu khóa object avatar trong PostgreSQL; dữ liệu ảnh ở bucket MinIO private.
- API xác thực stream ảnh qua `GET /api/profile/avatar`, không công khai bucket hay trả credential/presigned URL dài hạn.
- `PUT /api/profile` cập nhật họ tên, ngày sinh, số điện thoại và email phụ của chính chủ; thay đổi họ tên có lịch sử theo PDR-036.

## Tasks

### Phase 1: Dữ liệu và hợp đồng

- [ ] Task 1: Bổ sung trường hồ sơ/audit và migration.
  - Acceptance: hồ sơ lưu được phone, email phụ, avatar key; đổi họ tên có audit.
  - Verification: migration và test persistence.
- [ ] Task 2: Thêm `GET/PUT /api/profile` và đổi mật khẩu thường.
  - Acceptance: mọi role chỉ đọc/sửa hồ sơ mình; input được validate; đổi mật khẩu thu hồi phiên cũ.
  - Verification: API tests quyền, validation, session revocation.

### Checkpoint: API lõi

- [ ] Backend tests và build pass.

### Phase 2: Avatar và tích hợp

- [ ] Task 3: Thêm adapter MinIO + upload/get/delete avatar.
  - Acceptance: chỉ JPG/PNG/WebP magic bytes, tối đa 2 MB; object private; thay/gỡ không làm lộ ảnh cũ.
  - Verification: API tests fake storage và request multipart.
- [ ] Task 4: Chuyển frontend profile từ demo sang API thật.
  - Acceptance: reload vẫn giữ hồ sơ/ảnh; họ tên sửa được theo PDR-036.
  - Verification: typecheck, unit tests, browser flow.

### Checkpoint: Hoàn tất

- [ ] Migration được review SQL; backend/frontend tests và build pass.

## Risks

| Risk | Mitigation |
| --- | --- |
| Giả mạo MIME hoặc upload quá lớn | Chặn request size, kiểm tra magic bytes ở backend, giới hạn 2 MB. |
| Lộ object MinIO | Bucket/object private, chỉ stream qua endpoint đã xác thực. |
| Mất avatar cũ khi cập nhật thất bại | Upload object mới trước, chỉ đổi key DB sau khi thành công; xóa object cũ hậu xử lý. |
