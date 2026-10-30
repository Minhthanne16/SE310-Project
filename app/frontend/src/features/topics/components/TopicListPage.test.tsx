import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import toast from 'react-hot-toast';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { currentUrl, resetNavigation, setUrl } from '@/test/navigationMock';
import { downloadCsv } from '@/lib/csv';
import { createRoundService } from '@/features/rounds/services/roundService';
import { createTopicService } from '@/features/topics/services/topicService';
import { TopicListPage } from './TopicListPage';

vi.mock('next/navigation', async () => {
  const mod = await import('@/test/navigationMock');
  return mod.navigationModule;
});
vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));
vi.mock('@/lib/csv', async () => ({
  ...(await vi.importActual<typeof import('@/lib/csv')>('@/lib/csv')),
  downloadCsv: vi.fn(),
}));

const TODAY = '2026-10-26';

beforeEach(() => {
  resetNavigation('/giao-vu/de-tai');
  vi.mocked(downloadCsv).mockClear();
  vi.mocked(toast.success).mockClear();
});
afterEach(cleanup);

const services = (today = TODAY) => {
  const roundService = createRoundService({ today });
  const topicService = createTopicService({ today, roundService });
  return { roundService, topicService };
};

// Thạc sĩ: đã hết hạn gửi đề tài, chưa công bố (VB1 đã công bố).
const renderThs = async (today = TODAY) => {
  setUrl('/giao-vu/de-tai?dot=r-ths-1-2026');
  const s = services(today);
  render(<TopicListPage {...s} />);
  await screen.findByText('Học tăng cường cho điều phối giao thông');
  return s;
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

it('defaults to the first running round, 10 per page, with all columns', async () => {
  await renderPage();
  expect(screen.getByLabelText('Chọn đợt')).toHaveValue('r-vb1-hk1');
  expect(
    screen.getByRole('heading', { level: 1, name: 'Quản lý đề tài' }),
  ).toBeInTheDocument();
  for (const name of [
    'Mã',
    'Tên đề tài',
    'GVHD',
    'Nhóm',
    'Nguồn',
    'Trạng thái',
    'Khóa luận',
  ])
    expect(screen.getByRole('columnheader', { name })).toBeInTheDocument();
  expect(rowCount()).toBe(10);
  expect(screen.getByText('18 đề tài · Trang 1/2')).toBeInTheDocument();

  const row = screen
    .getByText('Nền tảng đặt sân thể thao trực tuyến')
    .closest('tr')!;
  expect(within(row).getByText('VB1-03')).toBeInTheDocument();
  expect(
    within(row).getByText('Nguyễn Văn An, Lê Thị Bình'),
  ).toBeInTheDocument();
  expect(within(row).getByText('Đã đăng ký')).toBeInTheDocument();
  expect(within(row).getByText('Chờ nộp đề cương')).toBeInTheDocument();
  expect(
    screen.getByRole('link', { name: 'Nền tảng đặt sân thể thao trực tuyến' }),
  ).toHaveAttribute('href', '/giao-vu/de-tai/t-vb1-03');
  // Chưa đăng ký: nhóm và khóa luận hiện "—".
  const free = screen
    .getByText('Hệ thống quản lý phòng khám nhỏ')
    .closest('tr')!;
  expect(within(free).getAllByText('—')).toHaveLength(2);

  fireEvent.click(screen.getByRole('button', { name: 'Sau' }));
  expect(screen.getByText('18 đề tài · Trang 2/2')).toBeInTheDocument();
  expect(rowCount()).toBe(8);
});

it('shows the over-limit chip only for lecturers above the maximum', async () => {
  await renderPage();
  const chips = screen.getAllByText('GV vượt mức');
  // CB101 có 8 đề tài (tối đa tạm 6); trang 1 chỉ có VB1-01..10.
  expect(chips).toHaveLength(8);
  for (const chip of chips)
    expect(chip.closest('tr')).toHaveTextContent('Nguyễn Thị Hương');
  // Văn bản cho trình đọc màn hình, không chỉ tooltip.
  expect(chips[0]).toHaveTextContent('GV vượt mức: 8/6 đề tài');
});

it('filters by GVHD, status and search, and shows the no-result state', async () => {
  await renderPage();
  pick('Lọc theo GVHD', 'CB103');
  await waitFor(() => expect(rowCount()).toBe(2));
  expect(screen.queryByText('GV vượt mức')).not.toBeInTheDocument();

  pick('Lọc theo GVHD', '');
  pick('Lọc theo trạng thái', 'Bị từ chối');
  await waitFor(() => expect(rowCount()).toBe(1));
  expect(
    screen.getByText('Mạng xã hội cho câu lạc bộ sinh viên'),
  ).toBeInTheDocument();

  pick('Lọc theo trạng thái', 'Tất cả');
  fireEvent.change(screen.getByLabelText('Tìm kiếm'), {
    target: { value: 'vb1-04' },
  });
  await waitFor(() => expect(rowCount()).toBe(1));
  expect(screen.getByText('Chatbot hỗ trợ tuyển sinh')).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('Tìm kiếm'), {
    target: { value: 'không khớp gì cả' },
  });
  expect(await screen.findByText('Lọc không có kết quả')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Xóa bộ lọc' }));
  expect(
    await screen.findByText('Hệ thống quản lý phòng khám nhỏ'),
  ).toBeInTheDocument();
  expect(screen.getByLabelText('Tìm kiếm')).toHaveValue('');
});

it('switches rounds through ?dot= and shows the empty state for a round without topics', async () => {
  await renderPage();
  pick('Chọn đợt', 'r-ths-1-2026');
  expect(currentUrl()).toContain('dot=r-ths-1-2026');
  expect(
    await screen.findByText('Học tăng cường cho điều phối giao thông'),
  ).toBeInTheDocument();
  expect(screen.getByText('6 đề tài · Trang 1/1')).toBeInTheDocument();

  pick('Chọn đợt', 'r-vb2-hk2-nhap');
  expect(await screen.findByText('Chưa có đề tài')).toBeInTheDocument();
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
});

it('honours ?dot= on first load', async () => {
  setUrl('/giao-vu/de-tai?dot=r-vb1-hk2-2025');
  render(<TopicListPage {...services()} />);
  expect(
    await screen.findByText('Website bán hàng thủ công mỹ nghệ'),
  ).toBeInTheDocument();
  expect(screen.getByLabelText('Chọn đợt')).toHaveValue('r-vb1-hk2-2025');
  expect(screen.getByText('Đã công bố danh sách')).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Đóng & công bố danh sách' }),
  ).toBeDisabled();
});

it('shows the published banner for VB1 and a neutral one for a draft round', async () => {
  await renderPage();
  expect(
    screen.getByText('Đã công bố danh sách', { selector: 'strong' }),
  ).toBeInTheDocument();
  expect(
    screen.getByText(/Hạn gửi đề tài: 18\/09\/2026 · Đã hết hạn gửi đề tài/),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Đóng & công bố danh sách' }),
  ).toBeDisabled();
  expect(screen.getByText(/Danh sách đã được công bố\./)).toBeInTheDocument();

  pick('Chọn đợt', 'r-vb2-hk2-nhap');
  await screen.findByText('Chưa có đề tài');
  expect(screen.getByText(/Đợt nháp\./)).toBeInTheDocument();
  expect(screen.queryByText(/Giảng viên còn thêm/)).not.toBeInTheDocument();
});

it('explains the lock and publishes the list after the deadline', async () => {
  await renderThs();
  expect(
    screen.getByText('Đang gửi đề tài', { selector: 'strong' }),
  ).toBeInTheDocument();
  expect(
    screen.getByText(/Giảng viên còn thêm, sửa, xóa đề tài/),
  ).toBeInTheDocument();
  expect(
    screen.getByText(/Hạn gửi đề tài: 14\/08\/2026 · Đã hết hạn gửi đề tài/),
  ).toBeInTheDocument();
  const button = screen.getByRole('button', {
    name: 'Đóng & công bố danh sách',
  });
  expect(button).toBeEnabled();

  fireEvent.click(button);
  const dialog = await screen.findByRole('alertdialog');
  expect(dialog).toHaveTextContent('không thêm hoặc xóa đề tài');
  expect(dialog).toHaveTextContent('mô tả và yêu cầu của đề tài chưa có nhóm');
  expect(dialog).toHaveTextContent('Lĩnh vực bị khóa');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Hủy' }));
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();

  fireEvent.click(button);
  fireEvent.click(
    within(await screen.findByRole('alertdialog')).getByRole('button', {
      name: 'Công bố danh sách',
    }),
  );
  await waitFor(() =>
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument(),
  );
  expect(toast.success).toHaveBeenCalledWith('Đã công bố danh sách đề tài.');
  expect(
    await screen.findByText('Đã công bố danh sách', { selector: 'strong' }),
  ).toBeInTheDocument();
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Đóng & công bố danh sách' }),
    ).toBeDisabled(),
  );
  expect(screen.getByText(/Danh sách đã được công bố\./)).toBeInTheDocument();
});

it('disables publishing with a reason before the deadline', async () => {
  await renderThs('2026-08-14');
  const button = screen.getByRole('button', {
    name: 'Đóng & công bố danh sách',
  });
  expect(button).toBeDisabled();
  expect(
    screen.getByText(/Hạn gửi đề tài: 14\/08\/2026 · Chưa hết hạn gửi đề tài/),
  ).toBeInTheDocument();
  const reason = screen.getByText(/Chưa công bố được: Chưa hết hạn gửi đề tài/);
  expect(button).toHaveAttribute('aria-describedby', reason.id);
});

it('shows the service error inside the dialog when publishing fails', async () => {
  const s = services();
  vi.spyOn(s.topicService, 'publish').mockRejectedValue(
    new Error('Máy chủ từ chối.'),
  );
  setUrl('/giao-vu/de-tai?dot=r-ths-1-2026');
  render(<TopicListPage {...s} />);
  await screen.findByText('Học tăng cường cho điều phối giao thông');
  fireEvent.click(
    screen.getByRole('button', { name: 'Đóng & công bố danh sách' }),
  );
  fireEvent.click(
    within(await screen.findByRole('alertdialog')).getByRole('button', {
      name: 'Công bố danh sách',
    }),
  );
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Máy chủ từ chối.',
  );
  expect(screen.getByRole('alertdialog')).toBeInTheDocument();
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
  pick('Chọn đợt', 'r-ths-1-2026');
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

it('exports the filtered list as CSV', async () => {
  await renderPage();
  pick('Lọc theo GVHD', 'CB103');
  await waitFor(() => expect(rowCount()).toBe(2));
  fireEvent.click(screen.getByRole('button', { name: 'Xuất danh sách' }));
  await waitFor(() => expect(downloadCsv).toHaveBeenCalledTimes(1));
  const [name, csv] = vi.mocked(downloadCsv).mock.calls[0];
  expect(name).toBe('danh-sach-de-tai.csv');
  expect(csv).toContain('VB1-17');
  expect(csv).toContain('VB1-18');
  expect(csv).not.toContain('VB1-01,');
  expect(toast.success).toHaveBeenCalledWith('Đã xuất 2 đề tài.');
});

it('tells the user instead of downloading when the list is empty', async () => {
  await renderPage();
  pick('Chọn đợt', 'r-vb2-hk2-nhap');
  await screen.findByText('Chưa có đề tài');
  fireEvent.click(screen.getByRole('button', { name: 'Xuất danh sách' }));
  expect(
    await screen.findByText('Danh sách đang trống nên không có gì để xuất.'),
  ).toBeInTheDocument();
  expect(downloadCsv).not.toHaveBeenCalled();
});
