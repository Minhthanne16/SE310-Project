import { Suspense } from 'react';
import type { Metadata } from 'next';
import { ReviewerAssignmentPage } from '@/features/reviewers/components/ReviewerAssignmentPage';

export const metadata: Metadata = {
  title: 'Giảng viên phản biện · QLKLTN',
};

// Dùng useSearchParams (?dot=) nên bọc trong Suspense.
export default function Page() {
  return (
    <Suspense fallback={null}>
      <ReviewerAssignmentPage />
    </Suspense>
  );
}
