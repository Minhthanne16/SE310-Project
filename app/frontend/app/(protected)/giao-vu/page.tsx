import { Suspense } from 'react';
import { RoundHomePage } from '@/features/rounds/components/RoundHomePage';

// Trang chủ Giáo vụ: thẻ các đợt, việc cần xử lý, Bảng thông báo, Gantt.
// Suspense vì trang đọc ?dot= bằng useSearchParams.
export default function Home() {
  return (
    <Suspense fallback={null}>
      <RoundHomePage />
    </Suspense>
  );
}
