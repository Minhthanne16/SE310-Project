import type { Metadata } from 'next';
import { LecturerTopicsPage } from '@/features/topics/components/LecturerTopicsPage';

export const metadata: Metadata = {
  title: 'Đề tài của tôi · QLKLTN',
};

export default function LecturerTopics() {
  return <LecturerTopicsPage />;
}
