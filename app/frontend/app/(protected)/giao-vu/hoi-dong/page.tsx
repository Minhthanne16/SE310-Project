import { Suspense } from 'react';
import type { Metadata } from 'next';
import { CouncilBoardPage } from '@/features/councils/components/CouncilBoardPage';

export const metadata: Metadata = {
  title: 'Hội đồng bảo vệ · QLKLTN',
};

// Dùng useSearchParams (?dot=) nên bọc trong Suspense.
export default function Page() {
  return (
    <Suspense fallback={null}>
      <CouncilBoardPage />
    </Suspense>
  );
}
