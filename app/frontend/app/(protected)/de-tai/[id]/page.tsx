import type { Metadata } from 'next';
import { WorkspacePage } from '@/features/workspace/components/WorkspacePage';

export const metadata: Metadata = {
  title: 'Không gian đề tài · QLKLTN',
};

export default async function Page({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  return <WorkspacePage topicId={id} />;
}
