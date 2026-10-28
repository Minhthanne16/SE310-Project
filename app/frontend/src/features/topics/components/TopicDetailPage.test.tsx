import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { currentUrl, resetNavigation, setUrl } from '@/test/navigationMock';
import { createRoundService } from '@/features/rounds/services/roundService';
import { createTopicService } from '@/features/topics/services/topicService';
import { TopicDetailPage } from './TopicDetailPage';

vi.mock('next/navigation', async () => {
  const mod = await import('@/test/navigationMock');
  return mod.navigationModule;
});

const TODAY = '2026-10-26';

beforeEach(() => resetNavigation('/giao-vu/de-tai/x'));
afterEach(cleanup);

const renderRaw = (id: string) => {
  const roundService = createRoundService({ today: TODAY });
  const topicService = createTopicService({ today: TODAY, roundService });
  render(<TopicDetailPage topicId={id} topicService={topicService} />);
};

const renderDetail = async (id: string) => {
  renderRaw(id);
  await screen.findByRole('heading', { level: 1 });
};

const tab = (name: string) =>
  fireEvent.click(screen.getByRole('button', { name }));

it('shows a not-found state with a link back for an unknown id', async () => {
  renderRaw('khong-co');
  expect(await screen.findByText('Không tìm thấy đề tài')).toBeInTheDocument();
  expect(
    screen.getByRole('link', { name: '← Về danh sách đề tài' }),
  ).toHaveAttribute('href', '/giao-vu/de-tai');
});

it('shows the header and the overview tab by default', async () => {
  await renderDetail('t-vb1-25-01');
  expect(
    screen.getByRole('heading', {
      level: 1,
      name: 'Website bán hàng thủ công mỹ nghệ',
    }),
  ).toBeInTheDocument();
  expect(screen.getByText('VB1-25-01')).toBeInTheDocument();
  expect(
    screen.getByText('Đã hoàn tất', { selector: '.app-chip' }),
  ).toBeInTheDocument();
  expect(
    screen.getByText('GV công bố', { selector: '.app-chip' }),
  ).toBeInTheDocument();
  expect(
    await screen.findByRole('link', { name: 'Văn bằng 1 · HK2 2025–2026' }),
  ).toHaveAttribute('href', '/giao-vu/de-tai?dot=r-vb1-hk2-2025');
  expect(screen.getByRole('link', { name: 'Tất cả đề tài' })).toHaveAttribute(
    'href',
    '/giao-vu/de-tai?dot=r-vb1-hk2-2025',
  );
  expect(screen.getByRole('button', { name: 'Tổng quan' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  const fields = screen
    .getByRole('heading', { name: 'Tổng quan' })
    .closest('section')!;
  expect(within(fields).getByText('Phát triển phần mềm')).toBeInTheDocument();
  expect(within(fields).getByText('Nguyễn Thị Hương')).toBeInTheDocument(); // GVHD
  expect(within(fields).getByText('Vũ Đức Anh')).toBeInTheDocument(); // GVPB
  expect(within(fields).getByText('Hội đồng 1')).toBeInTheDocument();
  const member = within(fields)
    .getByText(/Đinh Công Minh/)
    .closest('li')!;
  expect(within(member).getByText('Đại diện')).toBeInTheDocument();
});

it('lists both members of a two-student group with one representative', async () => {
  await renderDetail('t-vb1-04');
  const fields = screen
    .getByRole('heading', { name: 'Tổng quan' })
    .closest('section')!;
  const items = within(fields).getAllByRole('listitem');
  expect(items).toHaveLength(2);
  expect(within(fields).getAllByText('Đại diện')).toHaveLength(1);
  expect(items[0]).toHaveTextContent('Đại diện');
});

it('shows placeholders for a topic with no group or assignments', async () => {
  await renderDetail('t-vb1-01');
  expect(screen.getByText('Chưa có nhóm')).toBeInTheDocument();
  expect(screen.getAllByText('Chưa phân công')).toHaveLength(2);
});

it('switches tabs and honours ?tab=', async () => {
  await renderDetail('t-vb1-06');
  tab('Báo cáo');
  expect(currentUrl()).toContain('tab=bao-cao');
  expect(screen.getByRole('button', { name: 'Báo cáo' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(
    await screen.findByRole('heading', { name: 'Báo cáo' }),
  ).toBeInTheDocument();
  setUrl('/giao-vu/de-tai/t-vb1-06?tab=lich-su');
  expect(
    await screen.findByRole('heading', { name: 'Lịch sử' }),
  ).toBeInTheDocument();
  setUrl('/giao-vu/de-tai/t-vb1-06?tab=khong-hop-le');
  expect(
    await screen.findByRole('heading', { name: 'Tổng quan' }),
  ).toBeInTheDocument();
});

it('lists submission versions newest first with a late chip', async () => {
  await renderDetail('t-vb1-05');
  tab('Báo cáo');
  const rows = (await screen.findAllByRole('row')).slice(1);
  expect(rows).toHaveLength(2);
  expect(rows[0]).toHaveTextContent('v2');
  expect(rows[0]).toHaveTextContent('Nộp trễ');
  expect(rows[1]).toHaveTextContent('v1');
  expect(rows[1]).not.toHaveTextContent('Nộp trễ');
});

it('shows an empty state when nothing has been submitted', async () => {
  await renderDetail('t-vb1-03');
  tab('Báo cáo');
  expect(await screen.findByText('Nhóm chưa nộp bài nào.')).toBeInTheDocument();
});

it('shows per-role scores, the weighted total and the formula note', async () => {
  await renderDetail('t-vb1-25-01');
  tab('Điểm');
  const row = (await screen.findByText(/Đinh Công Minh/)).closest('tr')!;
  // (8,5 + 8,5 + 2×9 + 2×8,5) / 6 = 8,67
  for (const text of ['8,50', '9,00', '8,67'])
    expect(within(row).getAllByText(text).length).toBeGreaterThan(0);
  expect(screen.getByText(/2 × CBHD/)).toBeInTheDocument();
  for (const role of ['CTHĐ', 'TKHĐ', 'CBHD', 'CBPB'])
    expect(
      screen.getByRole('columnheader', { name: role }),
    ).toBeInTheDocument();
});

it('shows "Chưa đủ điểm" when a score is missing', async () => {
  await renderDetail('t-vb1-18');
  tab('Điểm');
  expect(await screen.findAllByText('Chưa đủ điểm')).toHaveLength(2);
  expect(screen.getAllByText('8,00').length).toBeGreaterThan(0);
});

it('shows an empty scores state when there are no score sheets', async () => {
  await renderDetail('t-vb1-03');
  tab('Điểm');
  expect(
    await screen.findByText('Chưa có phiếu điểm nào.'),
  ).toBeInTheDocument();
});

it('shows the history newest first and filters it by category', async () => {
  await renderDetail('t-vb1-25-01');
  tab('Lịch sử');
  const items = await screen.findAllByRole('listitem');
  expect(items[0]).toHaveTextContent('Công bố kết quả');
  expect(items[0]).toHaveTextContent('Phạm Minh Châu');
  expect(screen.getByLabelText('Lọc lịch sử')).toHaveValue('Tất cả');

  fireEvent.change(screen.getByLabelText('Lọc lịch sử'), {
    target: { value: 'Điểm' },
  });
  const scored = screen.getAllByRole('listitem');
  expect(scored).toHaveLength(1);
  expect(scored[0]).toHaveTextContent('Nhập điểm cho Đinh Công Minh');
  expect(scored[0]).toHaveTextContent('Điểm');
});

it('shows a filtered-empty message and a separate empty history state', async () => {
  await renderDetail('t-vb1-03');
  tab('Lịch sử');
  fireEvent.change(await screen.findByLabelText('Lọc lịch sử'), {
    target: { value: 'Điểm' },
  });
  expect(
    screen.getByText('Không có mục nào thuộc “Điểm”.'),
  ).toBeInTheDocument();
  cleanup();

  resetNavigation('/giao-vu/de-tai/x?tab=lich-su');
  await renderDetail('t-vb1-01');
  expect(await screen.findByText('Lịch sử trống')).toBeInTheDocument();
});

it('shows a retry state when loading fails', async () => {
  const roundService = createRoundService({ today: TODAY });
  const topicService = createTopicService({ today: TODAY, roundService });
  vi.spyOn(topicService, 'get').mockRejectedValue(new Error('Mất kết nối.'));
  render(<TopicDetailPage topicId="t-vb1-01" topicService={topicService} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Mất kết nối.');
  expect(screen.getByRole('button', { name: 'Thử lại' })).toBeInTheDocument();
});
