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

it('defaults to the first running round, 8 per page, with all columns', async () => {
  await renderPage();
  expect(screen.getByLabelText('Đợt')).toHaveValue('r-vb1-hk1');
  expect(
    screen.getByRole('heading', { level: 1, name: 'Quản lý đề tài' }),
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
  expect(
    screen.getByRole('button', { name: 'Đã công bố danh sách' }),
  ).toBeDisabled();
});

it('shows the published state for VB1 and a blocked note for a draft round', async () => {
  await renderPage();
  expect(
    screen.getByText(
      (_, el) =>
        el?.tagName === 'P' &&
        (el.textContent ?? '').includes('đã hết lúc 23:59 ngày 18/09/2026'),
    ),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Đã công bố danh sách' }),
  ).toBeDisabled();
  expect(screen.queryByRole('note')).not.toBeInTheDocument();

  pick('Đợt', 'r-vb2-hk2-nhap');
  await screen.findByText('Chưa có đề tài nào trong đợt');
  expect(screen.getByRole('note')).toHaveTextContent(
    'Chỉ công bố được danh sách của đợt đang diễn ra.',
  );
  expect(
    screen.getByRole('button', { name: 'Đóng & công bố danh sách' }),
  ).toBeDisabled();
});

it('publishes the list after the deadline through the confirmation dialog', async () => {
  await renderThs();
  expect(
    screen.getByText(
      (_, el) =>
        el?.tagName === 'P' &&
        (el.textContent ?? '').includes('đã hết lúc 23:59 ngày 14/08/2026'),
    ),
  ).toBeInTheDocument();
  expect(screen.queryByRole('note')).not.toBeInTheDocument();
  const button = screen.getByRole('button', {
    name: 'Đóng & công bố danh sách',
  });
  expect(button).toBeEnabled();

  fireEvent.click(button);
  const dialog = await screen.findByRole('dialog');
  expect(dialog).toHaveAccessibleName('Đóng và công bố danh sách đề tài?');
  expect(dialog).toHaveTextContent('không gửi thêm hay xóa đề tài');
  expect(dialog).toHaveTextContent('mô tả và yêu cầu của đề tài chưa có nhóm');
  expect(dialog).toHaveTextContent('Lĩnh vực bị khóa');
  // Cảnh báo chỉ để theo dõi, không chặn công bố.
  expect(dialog).toHaveTextContent(
    /giảng viên chưa đạt số đề tài tối thiểu. Vẫn công bố được/,
  );
  fireEvent.click(within(dialog).getByRole('button', { name: 'Để sau' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

  fireEvent.click(button);
  fireEvent.click(
    within(await screen.findByRole('dialog')).getByRole('button', {
      name: 'Đóng và công bố',
    }),
  );
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  );
  expect(
    await screen.findByText('Đã công bố danh sách đề tài.'),
  ).toBeInTheDocument();
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Đã công bố danh sách' }),
    ).toBeDisabled(),
  );
});

it('disables publishing with a reason before the deadline', async () => {
  await renderThs('2026-08-14');
  const button = screen.getByRole('button', {
    name: 'Đóng & công bố danh sách',
  });
  expect(button).toBeDisabled();
  expect(
    screen.getByText(
      (_, el) =>
        el?.tagName === 'P' &&
        (el.textContent ?? '').includes(
          'đang gửi đề tài đến 23:59 ngày 14/08/2026',
        ),
    ),
  ).toBeInTheDocument();
  const reason = screen.getByRole('note');
  expect(reason).toHaveTextContent('Chưa đóng và công bố được.');
  expect(reason).toHaveTextContent('Giảng viên còn được gửi đề tài đến 23:59');
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
    within(await screen.findByRole('dialog')).getByRole('button', {
      name: 'Đóng và công bố',
    }),
  );
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Máy chủ từ chối.',
  );
  expect(screen.getByRole('dialog')).toBeInTheDocument();
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

it('exports the filtered list as CSV', async () => {
  await renderPage();
  pick('Lọc theo giảng viên hướng dẫn', 'CB103');
  await waitFor(() => expect(rowCount()).toBe(2));
  fireEvent.click(screen.getByRole('button', { name: 'Xuất danh sách' }));
  await waitFor(() => expect(downloadCsv).toHaveBeenCalledTimes(1));
  const [name, csv] = vi.mocked(downloadCsv).mock.calls[0];
  expect(name).toBe('danh-sach-de-tai.csv');
  expect(csv).toContain('VB1-17');
  expect(csv).toContain('VB1-18');
  expect(csv).not.toContain('VB1-01,');
  expect(screen.getByRole('status')).toHaveTextContent(
    'Đã tải tệp CSV danh sách đề tài (2 đề tài theo bộ lọc hiện tại).',
  );
});

it('tells the user instead of downloading when the list is empty', async () => {
  await renderPage();
  pick('Đợt', 'r-vb2-hk2-nhap');
  await screen.findByText('Chưa có đề tài nào trong đợt');
  fireEvent.click(screen.getByRole('button', { name: 'Xuất danh sách' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Chưa có đề tài nào trong đợt nên không có gì để xuất.',
  );
  expect(downloadCsv).not.toHaveBeenCalled();
});

it('tells the user to change the filter when the filtered list is empty', async () => {
  await renderPage();
  fireEvent.change(screen.getByLabelText('Tìm đề tài'), {
    target: { value: 'không khớp gì cả' },
  });
  await screen.findByText('Không có đề tài nào khớp bộ lọc');
  fireEvent.click(screen.getByRole('button', { name: 'Xuất danh sách' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Danh sách đang trống theo bộ lọc hiện tại nên không có gì để xuất.',
  );
  expect(downloadCsv).not.toHaveBeenCalled();
});

it('searches by student and lecturer name as the placeholder promises', async () => {
  await renderPage();
  fireEvent.change(screen.getByLabelText('Tìm đề tài'), {
    target: { value: 'Đinh Công Minh' },
  });
  await waitFor(() => expect(rowCount()).toBe(1));
});
