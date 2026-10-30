# Cấu trúc tài liệu QLKLTN

Tài liệu này là bản đồ của `docs/`, chỉ nêu vị trí và mục đích. Thư mục `plan/` chứa lộ trình triển khai và bản rà soát theo yêu cầu hiện tại; chưa có `specs/` hay `legacy/`.

```text
docs/
├── DESIGN/
│   ├── 01-sitemap.md
│   ├── 02-thiet-ke-dung-chung.md
│   ├── 03-dac-ta-man-hinh.md
│   └── Sitemap.png
├── architecture/
│   ├── DOMAIN_MODEL.md
│   └── SYSTEM_CONTEXT.md
├── decisions/
│   ├── PDR-001-vai-tro-va-quy-trinh-co-kiem-soat.md
│   ├── PDR-002-xac-thuc-va-lo-trinh-ma-nguon.md
│   ├── PDR-003-otp-kich-hoat-qua-email.md
│   ├── PDR-004-nhap-tai-khoan-csv.md
│   ├── PDR-005-mo-lai-ket-qua-truoc-cong-bo.md
│   ├── PDR-006-xac-nhan-diem-chu-tich-hoi-dong.md
│   ├── PDR-007-canh-bao-lech-diem-bon-cap-cheo.md
│   ├── PDR-008-lam-tron-diem-tong.md
│   ├── PDR-009-ket-qua-theo-tung-sinh-vien.md
│   ├── PDR-010-xu-ly-ket-qua-theo-lo.md
│   ├── PDR-011-tham-quyen-xu-ly-nhom-chua-nop-ban-khoa-luan.md
│   ├── PDR-012-huy-de-xuat-dang-cho-giang-vien.md
│   ├── PDR-013-yeu-cau-chinh-sua-de-cuong.md
│   ├── PDR-014-chan-trung-phong-bao-ve.md
│   ├── PDR-015-chan-trung-lich-giang-vien-hoi-dong.md
│   ├── PDR-016-mot-luot-bao-ve-co-hieu-luc-moi-de-tai.md
│   ├── PDR-017-thoi-gian-tung-luot-bao-ve.md
│   ├── PDR-018-sua-lich-da-cong-bo-va-dinh-chinh.md
│   ├── PDR-019-huy-lich-bao-ve-da-cong-bo.md
│   ├── PDR-020-khoa-thay-thanh-vien-hoi-dong-sau-diem.md
│   ├── PDR-021-phan-cong-phan-bien-sau-duyet-de-cuong.md
│   ├── PDR-022-dieu-kien-nhap-diem-phan-bien.md
│   ├── PDR-023-khoa-thay-giang-vien-phan-bien-sau-phieu.md
│   ├── PDR-024-mau-hoi-dong-chung-phieu-diem-rieng.md
│   ├── PDR-025-phien-ban-hoa-mau-phieu-da-gan.md
│   ├── PDR-026-khoa-phien-ban-mau-trong-dot-sau-diem.md
│   ├── PDR-027-chi-xoa-mau-nhap-chua-gan.md
│   ├── PDR-028-dong-mau-khong-chan-dot-dang-dung.md
│   ├── PDR-029-mot-sinh-vien-mot-dot-dang-dien-ra.md
│   ├── PDR-030-khoa-go-nguoi-tham-gia-da-co-du-lieu.md
│   ├── PDR-031-chi-ket-thuc-dot-khi-moi-de-tai-ket-thuc.md
│   ├── PDR-032-du-chin-moc-hop-le-truoc-khi-mo-dot.md
│   ├── PDR-033-mo-dot-duoc-khi-chua-co-nguoi-tham-gia.md
│   ├── PDR-034-sao-chep-khung-cau-hinh-dot.md
│   ├── PDR-035-cong-diem-tieu-chi-cap-cuoi.md
│   ├── PDR-036-chu-tai-khoan-va-giao-vu-sua-ho-ten.md
│   ├── PDR-037-phan-hoi-trung-tinh-khi-quen-mat-khau.md
│   ├── PDR-038-an-thong-bao-da-gui-chi-voi-nguoi-gui.md
│   ├── PDR-039-chi-nhan-pdf-cho-ban-nop-hoc-thuat.md
│   ├── PDR-040-gioi-han-pdf-hai-muoi-megabyte.md
│   ├── PDR-041-han-nop-tre-rieng-tung-moc.md
│   ├── PDR-042-giu-moi-phien-ban-tai-lieu-khong-tu-xoa.md
│   ├── PDR-043-gioi-han-anh-dai-dien.md
│   ├── PDR-044-gioi-han-yeu-cau-dat-lai-mat-khau.md
│   ├── PDR-045-chi-tai-khoan-hoat-dong-da-kich-hoat-duoc-tu-dat-lai-mat-khau.md
│   ├── PDR-046-moc-kiem-thu-mot-tram-nguoi-dung-dong-thoi.md
│   └── PDR-047-huy-ghi-danh-de-tai-cong-bo.md
├── product/
│   ├── GLOSSARY.md
│   ├── ROLES.md
│   ├── SCOPE.md
│   └── VISION.md
├── plan/
│   ├── README.md
│   ├── REVIEW.md
│   ├── phase-00-chot-nghiep-vu.md
│   ├── phase-01-tai-khoan-va-nen-dung-chung.md
│   ├── phase-02-dot-khoa-luan.md
│   ├── phase-03-de-tai-va-dang-ky.md
│   ├── phase-04-de-cuong-va-tai-lieu.md
│   ├── phase-05-phieu-va-phan-bien.md
│   ├── phase-06-hoi-dong-va-lich-bao-ve.md
│   ├── phase-07-cham-diem-va-ket-qua.md
│   └── phase-08-thong-bao-bao-cao-va-hoan-thien.md
├── requirements/
│   ├── BUSINESS_RULES.md
│   ├── NON_FUNCTIONAL.md
│   └── WORKFLOWS.md
├── CONTENT.md
├── FEATURE.md
├── NEON.md
├── OPEN_QUESTIONS.md
├── PROJECT_SPEC.md
└── README.md
```

| Khu vực | Chức năng |
| --- | --- |
| Cấp gốc | Điểm vào, phạm vi, danh mục chức năng và câu hỏi chưa chốt. |
| `product/` | Ngôn ngữ chung để xác định sản phẩm và vai trò trước khi nói về kỹ thuật. |
| `requirements/` | Luồng và quy tắc dùng để thiết kế, hiện thực và kiểm thử. |
| `architecture/` | Khái niệm miền, tác nhân và ranh giới hệ thống; không phải sơ đồ triển khai chi tiết. |
| `decisions/` | Các lựa chọn đã có căn cứ rõ ràng, không chứa giả định mới. |
| `plan/` | Lộ trình phase và điểm cần thảo luận; không tự chốt câu hỏi mở. |
| `DESIGN/` | Tài liệu bàn giao giao diện hiện có, được giữ tách khỏi yêu cầu nghiệp vụ để tránh nhầm chi tiết UI với quy tắc sản phẩm. |
| `NEON.md` | Hướng dẫn kỹ thuật hiện có của repo, giữ nguyên vì được README gốc tham chiếu. |
| `README.md` | Con trỏ ngắn về `CONTENT.md` và vị trí tài liệu thiết kế giao diện. |
