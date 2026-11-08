import type { Metadata } from 'next';
import { ForgotPasswordPage } from '@/features/auth/components/ForgotPasswordPage';

export const metadata: Metadata = {
  title: 'Quên mật khẩu · QLKLTN',
  // Trang có thể mở từ liên kết chứa token: không gửi Referer ra ngoài.
  referrer: 'no-referrer',
};

export default function ForgotPassword() {
  return <ForgotPasswordPage />;
}
