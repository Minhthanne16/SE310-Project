import type { Metadata } from 'next';
import Link from 'next/link';
import '@/features/auth/auth.css';
import { AuthBrand } from '@/features/auth/components/AuthBrand';

export const metadata: Metadata = {
  title: 'Quên mật khẩu · QLKLTN',
};

// Luồng Quên mật khẩu (liên kết 30 phút) chưa có API nên trang chỉ báo đang
// xây dựng và chỉ cách xử lý hiện tại: liên hệ Giáo vụ Khoa.
export default function ForgotPassword() {
  return (
    <div className="login-page auth-page">
      <AuthBrand />
      <main className="login-main">
        <div className="auth-column">
          <Link href="/login" className="auth-back">
            ← Quay lại đăng nhập
          </Link>
          <section className="auth-building" aria-labelledby="forgot-title">
            <h2 id="forgot-title">Quên mật khẩu đang xây dựng</h2>
            <p>
              Nếu không đăng nhập được, hãy liên hệ Giáo vụ Khoa để được đặt lại
              mật khẩu.
            </p>
          </section>
          <Link href="/login" className="auth-primary-link">
            Quay lại đăng nhập
          </Link>
          <p className="auth-note">
            Không còn dùng được email này? Liên hệ giáo vụ khoa để được đặt lại
            mật khẩu.
          </p>
        </div>
      </main>
    </div>
  );
}
