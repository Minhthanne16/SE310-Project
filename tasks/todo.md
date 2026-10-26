# Checklist tái tổ chức working tree

- [x] Baseline: frontend typecheck/test xanh; backend có 75/82 test pass và 7 lỗi Windows Event Log có sẵn.
- [x] Frontend: route group phản ánh public/protected/legacy; Products tự chứa page component, header và types.
- [x] Backend: Auth, Products, Users được nhóm theo feature trong mỗi layer; hợp đồng HTTP không đổi.
- [x] Tests backend được nhóm theo feature.
- [x] Kiểm tra lại typecheck, test, lint/build phù hợp và diff chỉ gồm thay đổi cấu trúc.

## Chuyển runtime workspace vào `app/`

- [x] Di chuyển backend, frontend, Compose, env và Docker ignore vào `app/`.
- [x] Cập nhật CI, README, Neon, tài liệu thiết kế có path và AGENTS.
- [x] Kiểm tra Compose config, frontend và backend từ thư mục mới.
