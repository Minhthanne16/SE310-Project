import type { Metadata } from 'next';
import { StudentMyTopicPage } from '@/features/outline/components/StudentMyTopicPage';

export const metadata: Metadata = {
  title: 'Đề tài của tôi · QLKLTN',
};

export default function Page() {
  return <StudentMyTopicPage />;
}
