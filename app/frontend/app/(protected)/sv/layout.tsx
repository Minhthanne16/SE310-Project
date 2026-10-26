import type { Metadata } from 'next';
import { AppShell } from '@/features/navigation/components/AppShell';

export const metadata: Metadata = {
  title: 'Sinh viên · QLKLTN',
};

export default function Layout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <AppShell area="Student">{children}</AppShell>;
}
