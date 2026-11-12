import type { Metadata } from 'next';
import { SupervisionPage } from '@/features/outline/components/SupervisionPage';

export const metadata: Metadata = {
  title: 'Nhóm hướng dẫn · QLKLTN',
};

export default function Page() {
  return <SupervisionPage />;
}
