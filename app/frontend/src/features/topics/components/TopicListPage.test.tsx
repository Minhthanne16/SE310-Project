import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { currentUrl, resetNavigation, setUrl } from '@/test/navigationMock';
import { createRoundService } from '@/features/rounds/services/roundService';
import { createTopicService } from '@/features/topics/services/topicService';
import { TopicListPage } from './TopicListPage';

vi.mock('next/navigation', async () => {
  const mod = await import('@/test/navigationMock');
  return mod.navigationModule;
});

const TODAY = '2026-10-26';

beforeEach(() => {
  resetNavigation('/giao-vu/de-tai');
});
afterEach(cleanup);

const services = (today = TODAY) => {
  const roundService = createRoundService({ today });
  // Mặc định mức đề tài là 0 (chưa đặt, không cảnh báo); test cảnh báo đặt 2–6.
  const topicService = createTopicService({
    today,
    roundService,
    loadLimits: { min: 2, max: 6 },
  });
  return { roundService, topicService };
};

const renderPage = async () => {
  const s = services();
  render(<TopicListPage {...s} />);
  await screen.findByText('Hệ thống quản lý phòng khám nhỏ');
  return s;
};

const pick = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

const rowCount = () => screen.getAllByRole('row').length - 1;

it('defaults to the first running round, 8 per page, with all columns', async () => {
  await renderPage();
  expect(screen.getByLabelText('Đợt')).toHaveValue('r-vb1-hk1');
  expect(
    screen.getByRole('heading', { level: 1, name: 'Đề tài' }),
  ).toBeInTheDocument();
  for (const name of [
    'Đề tài',
    'GV hướng dẫn',
    'GV phản biện',
    'Hội đồng',
    'Khóa luận',
    'Trạng thái',
  ])
    expect(screen.getByRole('columnheader', { name })).toBeInTheDocument();
  expect(rowCount()).toBe(8);
  expect(screen.getByText(/Hiển thị 1–8 trên 18 đề tài/)).toBeInTheDocument();

  const row = screen
    .getByText('Nền tảng đặt sân thể thao trực tuyến')
    .closest('tr')!;
  expect(
    within(row).getByText('VB1-03 · N.V. An, L.T. Bình'),
  ).toBeInTheDocument();
  expect(within(row).getByText('Đã đăng ký')).toBeInTheDocument();
  expect(within(row).getByText('Chưa nộp')).toBeInTheDocument();
  expect(within(row).getByText('Chưa phân công')).toBeInTheDocument();
  expect(within(row).getByText('Chưa gán')).toBeInTheDocument();
  expect(
    screen.getByRole('link', { name: 'Nền tảng đặt sân thể thao trực tuyến' }),
  ).toHaveAttribute('href', '/giao-vu/de-tai/t-vb1-03');
  const free = screen
    .getByText('Hệ thống quản lý phòng khám nhỏ')
    .closest('tr')!;
  expect(within(free).getByText(/VB1-01 · Chưa có nhóm/)).toBeInTheDocument();
  expect(within(free).getByText('Chưa có phiên bản')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
  expect(screen.getByText(/Hiển thị 9–16 trên 18 đề tài/)).toBeInTheDocument();
  expect(rowCount()).toBe(8);
  fireEvent.click(screen.getByRole('button', { name: '3' }));
  expect(screen.getByText(/Hiển thị 17–18 trên 18 đề tài/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Trang sau' })).toBeDisabled();
});

it('shows the over-limit chip only for lecturers above the maximum', async () => {
  await renderPage();
  const chips = screen.getAllByText(/GV vượt mức/);
  // CB101 có 8 đề tài (tối đa tạm 6); trang 1 hiện VB1-01..08.
  expect(chips.length).toBeGreaterThan(0);
  for (const chip of chips)
    expect(chip.closest('tr')).toHaveTextContent('Nguyễn Thị Hương');
  expect(chips[0]).toHaveTextContent('GV vượt mức 8/6');
});

it('filters by GVHD, status and search, and shows the no-result state', async () => {
  await renderPage();
  pick('Lọc theo giảng viên hướng dẫn', 'CB103');
  await waitFor(() => expect(rowCount()).toBe(2));
  expect(screen.queryByText(/GV vượt mức/)).not.toBeInTheDocument();

  pick('Lọc theo giảng viên hướng dẫn', '');
  fireEvent.click(screen.getByRole('button', { name: 'Bị từ chối' }));
  expect(screen.getByRole('button', { name: 'Bị từ chối' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await waitFor(() => expect(rowCount()).toBe(1));
  expect(
    screen.getByText('Mạng xã hội cho câu lạc bộ sinh viên'),
  ).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Tất cả' }));
  fireEvent.change(screen.getByLabelText('Tìm đề tài'), {
    target: { value: 'vb1-04' },
  });
  await waitFor(() => expect(rowCount()).toBe(1));
  expect(screen.getByText('Chatbot hỗ trợ tuyển sinh')).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('Tìm đề tài'), {
    target: { value: 'không khớp gì cả' },
  });
  expect(
    await screen.findByText('Không có đề tài nào khớp bộ lọc'),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Xóa bộ lọc' }));
  expect(
    await screen.findByText('Hệ thống quản lý phòng khám nhỏ'),
  ).toBeInTheDocument();
  expect(screen.getByLabelText('Tìm đề tài')).toHaveValue('');
});

it('switches rounds through ?dot= and shows the empty state for a round without topics', async () => {
  await renderPage();
  pick('Đợt', 'r-ths-1-2026');
  expect(currentUrl()).toContain('dot=r-ths-1-2026');
  expect(
    await screen.findByText('Học tăng cường cho điều phối giao thông'),
  ).toBeInTheDocument();
  expect(screen.getByText(/Hiển thị 1–6 trên 6 đề tài/)).toBeInTheDocument();

  pick('Đợt', 'r-vb2-hk2-nhap');
  expect(
    await screen.findByText('Chưa có đề tài nào trong đợt'),
  ).toBeInTheDocument();
});

it('honours ?dot= on first load', async () => {
  setUrl('/giao-vu/de-tai?dot=r-vb1-hk2-2025');
  render(<TopicListPage {...services()} />);
  expect(
    await screen.findByText('Website bán hàng thủ công mỹ nghệ'),
  ).toBeInTheDocument();
  expect(screen.getByLabelText('Đợt')).toHaveValue('r-vb1-hk2-2025');
  expect(screen.getByRole('status')).toHaveTextContent(
    'đã công bố cho sinh viên ngày 16/02/2026',
  );
});

it('no longer publishes or exports here and points to the round detail instead', async () => {
  await renderPage();
  expect(
    screen.queryByRole('button', { name: /công bố danh sách/i }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Xuất danh sách' }),
  ).not.toBeInTheDocument();
  expect(screen.queryByRole('note')).not.toBeInTheDocument();
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Đề tài');
  expect(
    screen.getByText(/làm ở Chi tiết đợt, tab Đề tài/),
  ).toBeInTheDocument();
});

it('shows the publish state of the selected round with a link to its Đề tài tab', async () => {
  await renderPage();
  const line = screen.getByRole('status');
  expect(line).toHaveTextContent(
    'Danh sách đề tài đã công bố cho sinh viên ngày 21/09/2026.',
  );
  expect(
    within(line).getByRole('link', { name: 'Mở tab Đề tài của đợt' }),
  ).toHaveAttribute('href', '/giao-vu/dot/r-vb1-hk1?tab=de-tai');

  pick('Đợt', 'r-ths-1-2026');
  await screen.findByText('Học tăng cường cho điều phối giao thông');
  expect(screen.getByRole('status')).toHaveTextContent(
    'Danh sách đề tài chưa công bố cho sinh viên.',
  );
  expect(
    screen.getByRole('link', { name: 'Mở tab Đề tài của đợt' }),
  ).toHaveAttribute('href', '/giao-vu/dot/r-ths-1-2026?tab=de-tai');

  pick('Đợt', 'r-vb2-hk2-nhap');
  await screen.findByText('Chưa có đề tài nào trong đợt');
  expect(screen.getByRole('status')).toHaveTextContent(
    'Đợt đang Nháp nên chưa công bố danh sách đề tài.',
  );
});

it('filters by the new statuses Không có nhóm and Không đủ điều kiện công bố', async () => {
  await renderPage();
  fireEvent.click(screen.getByRole('button', { name: 'Không có nhóm' }));
  await waitFor(() => expect(rowCount()).toBe(5));
  for (const chip of screen.getAllByText('Không có nhóm'))
    expect(chip).toBeInTheDocument();

  pick('Đợt', 'r-vb1-hk2-2025');
  fireEvent.click(
    screen.getByRole('button', { name: 'Không đủ điều kiện công bố' }),
  );
  await waitFor(() => expect(rowCount()).toBe(1));
  expect(
    screen.getByText('Ứng dụng quản lý lịch hẹn khám bệnh'),
  ).toBeInTheDocument();
});

it('stops loading and explains when there are no rounds at all', async () => {
  const s = services();
  const roundService = { ...s.roundService, list: async () => [] };
  render(
    <TopicListPage topicService={s.topicService} roundService={roundService} />,
  );
  expect(await screen.findByText('Chưa có đợt')).toBeInTheDocument();
  expect(
    screen.queryByText('Đang tải danh sách đề tài...'),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole('link', { name: 'Đến danh sách đợt' }),
  ).toHaveAttribute('href', '/giao-vu/dot');
});

it('does not show the previous round while another round is loading', async () => {
  const s = services();
  await renderPage();
  cleanup();
  const original = s.topicService.list;
  let release: () => void = () => {};
  vi.spyOn(s.topicService, 'list').mockImplementation(async (filters) => {
    if (filters.roundId === 'r-ths-1-2026')
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    return original(filters);
  });
  render(<TopicListPage {...s} />);
  await screen.findByText('Hệ thống quản lý phòng khám nhỏ');
  pick('Đợt', 'r-ths-1-2026');
  expect(
    await screen.findByText('Đang tải danh sách đề tài...'),
  ).toBeInTheDocument();
  expect(
    screen.queryByText('Hệ thống quản lý phòng khám nhỏ'),
  ).not.toBeInTheDocument();
  release();
  expect(
    await screen.findByText('Học tăng cường cho điều phối giao thông'),
  ).toBeInTheDocument();
});

it('searches by student and lecturer name as the placeholder promises', async () => {
  await renderPage();
  fireEvent.change(screen.getByLabelText('Tìm đề tài'), {
    target: { value: 'Đinh Công Minh' },
  });
  await waitFor(() => expect(rowCount()).toBe(1));
});
