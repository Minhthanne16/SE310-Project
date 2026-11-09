'use client';

import { Toaster } from 'react-hot-toast';

/**
 * Nơi hiện mọi thông báo kết quả thao tác (lưu, gửi, xóa, lỗi cả thao tác).
 * Gọi `toast.success(...)` / `toast.error(...)` từ react-hot-toast; kiểu dáng ở
 * `.app-toast*` trong index.css. Quy tắc dùng toast xem docs/DESIGN.md.
 */
export const AppToaster = () => (
  <Toaster
    position="top-right"
    toastOptions={{
      className: 'app-toast',
      duration: 5000,
      success: {
        className: 'app-toast app-toast-success',
        duration: 5000,
        iconTheme: { primary: 'var(--ok-ink)', secondary: 'var(--surface)' },
      },
      error: {
        className: 'app-toast app-toast-error',
        // Lỗi ở lại lâu hơn để kịp đọc.
        duration: 8000,
        iconTheme: {
          primary: 'var(--danger-ink)',
          secondary: 'var(--surface)',
        },
      },
    }}
  />
);
