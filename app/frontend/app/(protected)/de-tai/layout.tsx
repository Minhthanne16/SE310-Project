import type { Metadata } from 'next';
import { AppShell } from '@/features/navigation/components/AppShell';

export const metadata: Metadata = {
  title: 'Không gian đề tài · QLKLTN',
};

// Dùng chung cho nhóm, GVHD và Giáo vụ (DESIGN/03): không giới hạn khu vực theo vai trò,
// quyền xem do máy chủ quyết định.
export default function Layout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <AppShell>{children}</AppShell>;
}
