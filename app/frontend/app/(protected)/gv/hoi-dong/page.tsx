import type { Metadata } from 'next';
import { LecturerCouncilPage } from '@/features/councils/components/LecturerCouncilPage';

export const metadata: Metadata = {
  title: 'Hội đồng bảo vệ · QLKLTN',
};

export default function Page() {
  return <LecturerCouncilPage />;
}
