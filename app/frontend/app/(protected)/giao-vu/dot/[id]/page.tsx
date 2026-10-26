import { Suspense } from 'react';
import { RoundDetailPage } from '@/features/rounds/components/RoundDetailPage';

export default async function Page({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  return (
    <Suspense fallback={null}>
      <RoundDetailPage roundId={id} />
    </Suspense>
  );
}
