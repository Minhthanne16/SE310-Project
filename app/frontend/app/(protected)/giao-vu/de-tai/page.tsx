import { Suspense } from 'react';
import { TopicListPage } from '@/features/topics/components/TopicListPage';

// Trang thật được ưu tiên hơn route catch-all [...slug]; dùng useSearchParams
// (?dot=) nên bọc trong Suspense.
export default function Page() {
  return (
    <Suspense fallback={null}>
      <TopicListPage />
    </Suspense>
  );
}
