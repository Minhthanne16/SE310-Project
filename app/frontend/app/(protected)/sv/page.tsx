import { Suspense } from 'react';
import { RoundHomePage } from '@/features/rounds/components/RoundHomePage';

export default function Home() {
  return (
    <Suspense fallback={null}>
      <RoundHomePage />
    </Suspense>
  );
}
