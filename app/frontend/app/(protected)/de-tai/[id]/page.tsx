import { TopicWorkspacePage } from '@/features/outline/components/TopicWorkspacePage';

export default async function Page({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  return <TopicWorkspacePage topicId={id} />;
}
