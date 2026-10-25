import type { Metadata } from 'next';
import { AppShell } from '@/features/navigation/components/AppShell';

export const metadata: Metadata = {
  title: 'Giáo vụ · QLKLTN',
};

export default function Layout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <AppShell area="AcademicAffairs">{children}</AppShell>;
}
