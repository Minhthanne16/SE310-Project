import Link from 'next/link';
import { StatusState } from '@/components/ui/StatusState';

// Trang 404 (artboard Trang404, biến thể Không tìm thấy). Ngoài khung đăng
// nhập nên không biết vai trò: nút về trang chủ dẫn tới trang đăng nhập.
export default function NotFound() {
  return (
    <div className="status-page-shell">
      <header className="status-page-header">
        <Link href="/login" className="app-logo">
          <span aria-hidden="true">Q</span>
          QLKLTN
        </Link>
      </header>
      <main className="status-page-main">
        <StatusState
          variant="notFound"
          fullPage
          action={{ href: '/login', label: 'Về trang đăng nhập' }}
        />
      </main>
    </div>
  );
}
