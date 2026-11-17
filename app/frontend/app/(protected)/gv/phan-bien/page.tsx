import type { Metadata } from 'next';
import { ReviewerTopicsPage } from '@/features/reviewers/components/ReviewerTopicsPage';

export const metadata: Metadata = {
  title: 'Đề tài phản biện · QLKLTN',
};

export default function Page() {
  return <ReviewerTopicsPage />;
}
