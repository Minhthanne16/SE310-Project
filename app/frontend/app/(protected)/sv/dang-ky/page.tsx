import type { Metadata } from 'next';
import { StudentTopicsPage } from '@/features/topics/components/StudentTopicsPage';

export const metadata: Metadata = {
  title: 'Đăng ký đề tài · QLKLTN',
};

export default function StudentTopics() {
  return <StudentTopicsPage />;
}
