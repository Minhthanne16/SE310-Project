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
import type { Topic } from '@/types/topic';
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
  fireEvent.click(screen.getByRole('tab', { name }));

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
  const crumb = screen.getByRole('navigation', { name: 'Đường dẫn' });
  expect(crumb).toHaveTextContent('Đề tài / VB1-25-01');
  expect(within(crumb).getByRole('link', { name: 'Đề tài' })).toHaveAttribute(
    'href',
    '/giao-vu/de-tai?dot=r-vb1-hk2-2025',
  );
  expect(
    screen.getByText('Đã hoàn tất', { selector: '.tpc-chip' }),
  ).toBeInTheDocument();
  expect(
    await screen.findByRole('link', { name: 'Văn bằng 1 · HK2 2025–2026' }),
  ).toHaveAttribute('href', '/giao-vu/de-tai?dot=r-vb1-hk2-2025');
  expect(
    screen.getByRole('link', { name: 'Xem ở trang Kết quả' }),
  ).toHaveAttribute('href', '/giao-vu/ket-qua');
  expect(screen.getByRole('tab', { name: 'Tổng quan' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  expect(
    screen.getByRole('tab', { name: 'Báo cáo và phiên bản' }),
  ).toHaveAttribute('aria-selected', 'false');
  const panel = screen.getByRole('tabpanel');
  for (const name of [
    'Tiến độ 6 chặng',
    'Mô tả đề tài',
    'Nhóm sinh viên',
    'Phân công và lịch bảo vệ',
  ])
    expect(within(panel).getByRole('heading', { name })).toBeInTheDocument();
  expect(within(panel).getByText('Nguyễn Thị Hương')).toBeInTheDocument(); // GVHD
  expect(within(panel).getByText('Vũ Đức Anh')).toBeInTheDocument(); // GVPB
  expect(
    within(panel).getByText('Hội đồng 1 · đã công bố'),
  ).toBeInTheDocument();
  const member = within(panel).getByText('Đinh Công Minh').closest('li')!;
  expect(member).toHaveTextContent('Đại diện');
});

it('shows the six stages as done for a finished topic', async () => {
  await renderDetail('t-vb1-25-01');
  const steps = within(
    screen
      .getByRole('heading', { name: 'Tiến độ 6 chặng' })
      .closest('section')!,
  ).getAllByRole('listitem');
  expect(steps).toHaveLength(6);
  for (const step of steps) expect(step).toHaveTextContent('✓');
});

it('lists both members of a two-student group with one representative', async () => {
  await renderDetail('t-vb1-04');
  const group = screen
    .getByRole('heading', { name: 'Nhóm sinh viên' })
    .closest('section')!;
  const items = within(group).getAllByRole('listitem');
  expect(items).toHaveLength(2);
  expect(group.textContent?.match(/Đại diện/g)).toHaveLength(1);
  expect(items[0]).toHaveTextContent('Đại diện');
});

it('shows placeholders for a topic with no group or assignments', async () => {
  await renderDetail('t-vb1-01');
  expect(
    screen.getByText('Chưa có nhóm', { selector: 'p' }),
  ).toBeInTheDocument();
  expect(screen.getAllByText('Chưa phân công')).toHaveLength(2);
  expect(screen.getByText('Chưa xếp lịch')).toBeInTheDocument();
  expect(screen.queryByText('Chủ tịch')).not.toBeInTheDocument();
});

it('switches tabs and honours ?tab=', async () => {
  await renderDetail('t-vb1-06');
  tab('Báo cáo và phiên bản');
  expect(currentUrl()).toContain('tab=bao-cao');
  expect(
    screen.getByRole('tab', { name: 'Báo cáo và phiên bản' }),
  ).toHaveAttribute('aria-selected', 'true');
  setUrl('/giao-vu/de-tai/t-vb1-06?tab=lich-su');
  expect(
    await screen.findByRole('group', { name: 'Lọc lịch sử' }),
  ).toBeInTheDocument();
  setUrl('/giao-vu/de-tai/t-vb1-06?tab=khong-hop-le');
  expect(
    await screen.findByRole('heading', { name: 'Tiến độ 6 chặng' }),
  ).toBeInTheDocument();
});

it('lists submission versions per document, newest first, with a late tag', async () => {
  await renderDetail('t-vb1-05');
  tab('Báo cáo và phiên bản');
  const versions = await screen.findAllByRole('listitem');
  expect(versions).toHaveLength(2);
  expect(versions[0]).toHaveTextContent('Lần 2');
  expect(versions[0]).toHaveTextContent('Nộp trễ');
  // Một nhãn mỗi dòng: Nộp trễ ưu tiên hơn Mới nhất.
  expect(versions[0]).not.toHaveTextContent('Mới nhất');
  expect(versions[0]).toHaveTextContent('Sửa phạm vi và kế hoạch');
  expect(versions[0]).toHaveTextContent('.pdf');
  expect(versions[1]).toHaveTextContent('Lần 1');
  expect(versions[1]).toHaveTextContent('Bản đầu');
  expect(versions[1]).not.toHaveTextContent('Nộp trễ');
  expect(versions[1]).not.toHaveTextContent('Mới nhất');
});

it('shows document group status chips and a disabled download action', async () => {
  await renderDetail('t-vb1-25-01');
  tab('Báo cáo và phiên bản');
  const group = (name: string) =>
    screen.getByRole('heading', { name }).closest('section')!;
  expect(group('Đề cương')).toHaveTextContent(/Đã duyệt \d\d\/\d\d/);
  expect(group('Báo cáo giữa kỳ')).toHaveTextContent('1 phiên bản');
  expect(group('Báo cáo cuối kỳ')).toHaveTextContent('Đã chốt Bản 1');
  const dl = within(group('Báo cáo cuối kỳ')).getByRole('button', {
    name: /^Tải .*\.pdf$/,
  });
  expect(dl).toHaveAttribute('aria-disabled', 'true');
  expect(dl).not.toBeDisabled();
  const note = document.getElementById(dl.getAttribute('aria-describedby')!);
  expect(note).toHaveTextContent('Chưa có API tải tệp');
  fireEvent.click(dl);
  expect(screen.queryByRole('link', { name: 'Tải' })).not.toBeInTheDocument();
  cleanup();

  // Đã cho điểm nhưng chưa chốt bản cuối.
  await renderDetail('t-vb1-25-03');
  tab('Báo cáo và phiên bản');
  expect(group('Báo cáo cuối kỳ')).toHaveTextContent(
    '1 phiên bản · chưa chốt bản cuối',
  );
});

it('shows the class of each member and the defense schedule', async () => {
  await renderDetail('t-vb1-25-01');
  const panel = screen.getByRole('tabpanel');
  const member = within(panel).getByText('Đinh Công Minh').closest('li')!;
  expect(member).toHaveTextContent(/22520010 · \S+/);
  const dl = within(panel)
    .getByRole('heading', { name: 'Phân công và lịch bảo vệ' })
    .closest('section')!;
  for (const label of [
    'Hướng dẫn',
    'Phản biện',
    'Hội đồng',
    'Chủ tịch',
    'Thư ký',
    'Bảo vệ',
    'Phòng',
  ])
    expect(within(dl).getByText(label, { selector: 'dt' })).toBeInTheDocument();
  expect(dl).toHaveTextContent('Hội đồng 1 · đã công bố');
  expect(dl).toHaveTextContent(
    /(Thứ|Chủ Nhật) .*\d\d\/\d\d\/\d{4} · \d\d:\d\d/,
  );
  expect(dl).toHaveTextContent(/B4\.1\d · thứ tự \d/);
});

it('shows an empty state when nothing has been submitted', async () => {
  await renderDetail('t-vb1-03');
  tab('Báo cáo và phiên bản');
  expect(await screen.findByText('Nhóm chưa nộp bài nào.')).toBeInTheDocument();
});

it('shows per-role scores, the weighted total and the formula note', async () => {
  await renderDetail('t-vb1-25-01');
  tab('Điểm');
  const row = (await screen.findByText('Đinh Công Minh')).closest('tr')!;
  // (8,5 + 8,5 + 2×9 + 2×8,5) / 6 = 8,67
  for (const text of ['8,5', '9,0', '8,67'])
    expect(within(row).getAllByText(text).length).toBeGreaterThan(0);
  expect(screen.getByText(/HD × 2/)).toBeInTheDocument();
  for (const name of [
    'Hướng dẫn',
    'Phản biện',
    'Chủ tịch',
    'Thư ký',
    'Điểm KL',
  ])
    expect(screen.getByRole('columnheader', { name })).toBeInTheDocument();
  expect(screen.queryByText('Cờ lệch điểm hội đồng')).not.toBeInTheDocument();
});

it('shows "Chưa đủ điểm" when a score is missing', async () => {
  await renderDetail('t-vb1-18');
  tab('Điểm');
  expect(await screen.findAllByText('Chưa đủ điểm')).toHaveLength(2);
  expect(screen.getAllByText('8,0').length).toBeGreaterThan(0);
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
  const list = await screen.findByRole('list', { name: 'Lịch sử thay đổi' });
  const items = within(list).getAllByRole('listitem');
  expect(items[0]).toHaveTextContent('Công bố kết quả');
  expect(items[0]).toHaveTextContent('Phạm Minh Châu');
  expect(
    screen.getByRole('button', { name: /^Tất cả \(\d+\)$/ }),
  ).toHaveAttribute('aria-pressed', 'true');

  fireEvent.click(screen.getByRole('button', { name: /^Điểm \(1\)$/ }));
  const scored = within(
    screen.getByRole('list', { name: 'Lịch sử thay đổi' }),
  ).getAllByRole('listitem');
  expect(scored).toHaveLength(1);
  expect(scored[0]).toHaveTextContent('Nhập điểm cho Đinh Công Minh');
  expect(scored[0]).toHaveTextContent('Điểm');
});

it('shows a filtered-empty message and a separate empty history state', async () => {
  await renderDetail('t-vb1-03');
  tab('Lịch sử');
  fireEvent.click(await screen.findByRole('button', { name: /^Điểm \(0\)$/ }));
  expect(
    screen.getByText('Không có mục nào thuộc “Điểm”.'),
  ).toBeInTheDocument();
  cleanup();

  resetNavigation('/giao-vu/de-tai/x?tab=lich-su');
  await renderDetail('t-vb1-01');
  expect(
    await screen.findByText('Đề tài chưa có thay đổi nào.'),
  ).toBeInTheDocument();
});

it('shows a retry state when loading fails', async () => {
  const roundService = createRoundService({ today: TODAY });
  const topicService = createTopicService({ today: TODAY, roundService });
  vi.spyOn(topicService, 'get').mockRejectedValue(new Error('Mất kết nối.'));
  render(<TopicDetailPage topicId="t-vb1-01" topicService={topicService} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Mất kết nối.');
  expect(screen.getByRole('button', { name: 'Thử lại' })).toBeInTheDocument();
});

it('numbers version labels per kind, matching the file name', async () => {
  await renderDetail('t-vb1-25-01');
  tab('Báo cáo và phiên bản');
  for (const item of screen.getAllByRole('listitem')) {
    const label = /(?:Lần|Bản) (\d+)/.exec(item.textContent ?? '')![1];
    expect(item.textContent).toContain(`-v${label}.pdf`);
  }
});

it('shows a valid HH:mm defense time for every seeded defense', async () => {
  const roundService = createRoundService({ today: TODAY });
  const topicService = createTopicService({ today: TODAY, roundService });
  const list = await topicService.list({ roundId: 'r-vb1-hk2-2025' });
  const withDefense = list.items.filter((t) => t.defense);
  expect(withDefense.length).toBeGreaterThan(0);
  for (const t of withDefense) {
    renderRaw(t.id);
    const row = (await screen.findByText('Bảo vệ', { selector: 'dt' }))
      .nextElementSibling!;
    expect(row.textContent).toMatch(/ · \d\d:\d\d$/);
    cleanup();
  }
});

const fixtureTopic = async (patch: Partial<Topic>): Promise<Topic> => {
  const roundService = createRoundService({ today: TODAY });
  const base = await createTopicService({ today: TODAY, roundService }).get(
    't-vb1-25-01',
  );
  return { ...base, ...patch };
};

it('shows "Chờ duyệt" for an unapproved outline and an unpublished council', async () => {
  const roundService = createRoundService({ today: TODAY });
  const base = await fixtureTopic({});
  const topic = await fixtureTopic({
    outlineApprovedAt: null,
    defense: { ...base.defense!, councilPublished: false },
  });
  const topicService = createTopicService({
    today: TODAY,
    roundService,
    topics: [topic],
  });
  render(<TopicDetailPage topicId={topic.id} topicService={topicService} />);
  await screen.findByRole('heading', { level: 1 });
  expect(screen.getByText('Hội đồng 1 · chưa công bố')).toBeInTheDocument();
  tab('Báo cáo và phiên bản');
  const outline = screen
    .getByRole('heading', { name: 'Đề cương' })
    .closest('section')!;
  expect(outline).toHaveTextContent('Chờ duyệt');
});

it('shows the deviation chip, flagged cells and box for a deviating topic', async () => {
  await renderDetail('t-vb1-25-02');
  expect(
    screen.getByText('Lệch điểm ≥ 2', { selector: '.tpc-chip' }),
  ).toBeInTheDocument();
  tab('Điểm');
  const row = (await screen.findByText('Lý Thùy Dung')).closest('tr')!;
  // CT 5,5 lệch HD 8,0 (2,5) và PB 7,5 (2,0); TK 6,0 lệch HD 8,0 (2,0).
  const flagged = Array.from(row.querySelectorAll('td.tpc-score-dev')).map(
    (td) => td.textContent,
  );
  expect(flagged).toEqual([
    '8,0 (lệch ≥ 2)',
    '7,5 (lệch ≥ 2)',
    '5,5 (lệch ≥ 2)',
    '6,0 (lệch ≥ 2)',
  ]);
  const flaggedCell = row.querySelector('td.tpc-score-dev')!;
  expect(flaggedCell).toHaveAttribute('aria-describedby', 'tpc-dev-box');
  expect(document.getElementById('tpc-dev-box')).toHaveTextContent(
    'Cờ lệch điểm hội đồng',
  );
  const box = screen.getByText('Cờ lệch điểm hội đồng').closest('div')!;
  expect(box).toHaveTextContent('Lý Thùy Dung: CT 5,5 lệch HD 8,0 (2,5 điểm)');
  expect(box).toHaveTextContent('Lý Thùy Dung: CT 5,5 lệch PB 7,5 (2,0 điểm)');
  expect(box).toHaveTextContent('Lý Thùy Dung: TK 6,0 lệch HD 8,0 (2,0 điểm)');
  expect(box).not.toHaveTextContent('TK 6,0 lệch PB');
});

it('hides the deviation chip, cells and box when no pair deviates', async () => {
  await renderDetail('t-vb1-25-01');
  expect(screen.queryByText('Lệch điểm ≥ 2')).not.toBeInTheDocument();
  tab('Điểm');
  await screen.findByText('Đinh Công Minh');
  expect(document.querySelector('.tpc-score-dev')).toBeNull();
  expect(screen.queryByText('Cờ lệch điểm hội đồng')).not.toBeInTheDocument();
});
