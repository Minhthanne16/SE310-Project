import type { Metadata } from 'next';
import { AppShell } from '@/features/navigation/components/AppShell';

export const metadata: Metadata = {
  title: 'Hồ sơ cá nhân · QLKLTN',
};

// Hồ sơ dùng chung cho cả ba vai trò.
export default function Layout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <AppShell>{children}</AppShell>;
}
