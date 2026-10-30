import { Suspense } from 'react';
import { EvaluationTemplatePage } from '@/features/evaluations/components/EvaluationTemplatePage';

// Trang thật được ưu tiên hơn route catch-all [...slug]; dùng useSearchParams
// (?tab=, ?dot=) nên bọc trong Suspense.
export default function Page() {
  return (
    <Suspense fallback={null}>
      <EvaluationTemplatePage />
    </Suspense>
  );
}
