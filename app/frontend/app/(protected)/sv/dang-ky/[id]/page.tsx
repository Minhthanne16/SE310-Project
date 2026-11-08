import type { Metadata } from 'next';
import { StudentTopicDetail } from '@/features/topics/components/StudentTopicDetailPage';

export const metadata: Metadata = {
  title: 'Chi tiết đề tài · QLKLTN',
};

export default async function Page({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  return <StudentTopicDetail topicId={id} />;
}
