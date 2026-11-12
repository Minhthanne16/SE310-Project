import type { Metadata } from 'next';
import { StudentWorkspacePage } from '@/features/submissions/components/StudentWorkspacePage';

export const metadata: Metadata = {
  title: 'Đề tài của tôi · QLKLTN',
};

export default function StudentWorkspace() {
  return <StudentWorkspacePage />;
}
