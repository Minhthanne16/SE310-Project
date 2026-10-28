import { Suspense } from 'react';
import { TopicDetailPage } from '@/features/topics/components/TopicDetailPage';

export default async function Page({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  return (
    <Suspense fallback={null}>
      <TopicDetailPage topicId={id} />
    </Suspense>
  );
}
