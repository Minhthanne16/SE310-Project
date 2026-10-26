import type { Metadata } from 'next';
import { AppShell } from '@/features/navigation/components/AppShell';

export const metadata: Metadata = {
  title: 'Giảng viên · QLKLTN',
};

export default function Layout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <AppShell area="Lecturer">{children}</AppShell>;
}
