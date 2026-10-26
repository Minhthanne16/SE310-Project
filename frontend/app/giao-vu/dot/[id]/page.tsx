import { RoundDetailPage } from '@/features/rounds/components/RoundDetailPage';

export default async function Page({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  return <RoundDetailPage roundId={id} />;
}
