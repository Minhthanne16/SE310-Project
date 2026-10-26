import type { Metadata } from 'next';
import { LoginPage } from '@/features/auth/components/LoginPage';

export const metadata: Metadata = {
  title: 'Đăng nhập · QLKLTN',
};

export default function Login() {
  return <LoginPage />;
}
