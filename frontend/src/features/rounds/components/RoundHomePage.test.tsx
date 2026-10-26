import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { SessionProvider } from '@/features/auth/session/SessionProvider';
import type { AuthService } from '@/features/auth/services/authService';
import {
  createRoundService,
  type RoundService,
} from '@/features/rounds/services/roundService';
import type { CurrentUser } from '@/types/auth';
import { RoundHomePage } from './RoundHomePage';

afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', '/');
});

const me: CurrentUser = {
  id: 'real-guid',
  userCode: 'GV001',
  fullName: 'Phạm Minh Châu',
  email: 'chau.pm@truong.edu.vn',
  role: 'AcademicAffairs',
  mustChangePassword: false,
};

const fakeAuth = (): AuthService => ({
  login: vi.fn(),
  getCurrentUser: vi.fn().mockResolvedValue(me),
  sendActivationCode: vi.fn(),
  changeInitialPassword: vi.fn(),
  changePassword: vi.fn(),
  logout: vi.fn(),
});

const renderPage = async (
  service: RoundService = createRoundService({ today: '2026-10-26' }),
) => {
  render(
    <SessionProvider authService={fakeAuth()}>
      <RoundHomePage roundService={service} />
    </SessionProvider>,
  );
  await screen.findByRole('button', { name: 'Văn bằng 1 · HK1 2026–2027' });
  return service;
};

const openFirstRound = async () => {
  await renderPage();
  fireEvent.click(
    screen.getByRole('button', { name: 'Văn bằng 1 · HK1 2026–2027' }),
  );
  await screen.findByRole('heading', {
    level: 1,
    name: 'Văn bằng 1 · HK1 2026–2027',
  });
};

it('lists every round as a card, including drafts, with week and milestone', async () => {
  await renderPage();
  expect(screen.getByText('Xin chào, Phạm Minh Châu')).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Văn bằng 2 · HK2 2026–2027' }),
  ).toBeInTheDocument();
  expect(screen.getByText('Chưa mở đợt')).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Văn bằng 1 · HK2 2025–2026' }),
  ).toBeInTheDocument();
  expect(screen.getByText('Tuần 8')).toBeInTheDocument();
  expect(screen.getByText('Báo cáo giữa kỳ')).toBeInTheDocument();
  expect(
    screen.getByRole('progressbar', {
      name: /Văn bằng 1 · HK1 2026–2027/,
    }),
  ).toHaveAttribute('aria-valuenow', '67');
});

it('opens the round detail from a card and goes back to all rounds', async () => {
  await openFirstRound();
  expect(window.location.search).toBe('?dot=r-vb1-hk1');
  expect(
    screen.getByRole('heading', { name: 'Việc cần xử lý' }),
  ).toBeInTheDocument();
  expect(
    screen.getByText('Mốc “Báo cáo giữa kỳ” kết thúc sau 4 ngày.'),
  ).toBeInTheDocument();
  expect(screen.getByText('2 đề tài chưa công bố.')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Soạn thông báo/ })).toHaveAttribute(
    'href',
    '/giao-vu/thong-bao/gui',
  );
  expect(
    screen.getByRole('link', {
      name: 'Quản lý đợt Văn bằng 1 · HK1 2026–2027',
    }),
  ).toHaveAttribute('href', '/giao-vu/dot/r-vb1-hk1');

  fireEvent.click(screen.getByRole('button', { name: '← Tất cả đợt' }));
  expect(
    await screen.findByRole('button', { name: 'Thạc sĩ · Đợt 1/2026' }),
  ).toBeInTheDocument();
  expect(window.location.search).toBe('');
});

it('starts on the detail view when the URL has ?dot=', async () => {
  window.history.replaceState(null, '', '/?dot=r-ths-1-2026');
  render(
    <SessionProvider authService={fakeAuth()}>
      <RoundHomePage roundService={createRoundService()} />
    </SessionProvider>,
  );
  expect(
    await screen.findByRole('heading', {
      level: 1,
      name: 'Thạc sĩ · Đợt 1/2026',
    }),
  ).toBeInTheDocument();
});

it('shows a not-found state for an unknown ?dot=', async () => {
  window.history.replaceState(null, '', '/?dot=khong-co');
  render(
    <SessionProvider authService={fakeAuth()}>
      <RoundHomePage roundService={createRoundService()} />
    </SessionProvider>,
  );
  expect(await screen.findByText('Không tìm thấy đợt')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '← Tất cả đợt' }));
  expect(
    await screen.findByRole('button', { name: 'Văn bằng 1 · HK1 2026–2027' }),
  ).toBeInTheDocument();
});

it('filters the notice board by source and by title or sender, and opens an item', async () => {
  await openFirstRound();
  const board = screen.getByRole('region', { name: 'Bảng thông báo' });
  await within(board).findByText('Nhắc hạn nộp báo cáo giữa kỳ');
  // Mới hiện 5 thông báo; "Xem thêm" lấy nốt.
  expect(
    within(board).queryByText('Bắt đầu đợt khóa luận HK1 2026–2027'),
  ).not.toBeInTheDocument();
  fireEvent.click(within(board).getByRole('button', { name: 'Xem thêm' }));
  expect(
    await within(board).findByText('Bắt đầu đợt khóa luận HK1 2026–2027'),
  ).toBeInTheDocument();
  expect(
    within(board).queryByRole('button', { name: 'Xem thêm' }),
  ).not.toBeInTheDocument();

  fireEvent.click(within(board).getByRole('button', { name: 'Từ giáo vụ' }));
  await waitFor(() =>
    expect(
      within(board).queryByText('Lịch họp nhóm hướng dẫn tuần 8'),
    ).not.toBeInTheDocument(),
  );
  expect(
    within(board).getByText('Cập nhật mẫu báo cáo giữa kỳ'),
  ).toBeInTheDocument();

  fireEvent.click(within(board).getByRole('button', { name: 'Tôi đã gửi' }));
  await waitFor(() =>
    expect(
      within(board).queryByText('Cập nhật mẫu báo cáo giữa kỳ'),
    ).not.toBeInTheDocument(),
  );
  expect(
    within(board).getByText('Nhắc hạn nộp báo cáo giữa kỳ'),
  ).toBeInTheDocument();

  fireEvent.click(within(board).getByRole('button', { name: 'Tất cả' }));
  fireEvent.change(within(board).getByLabelText('Tìm thông báo'), {
    target: { value: 'hương' },
  });
  await waitFor(() =>
    expect(
      within(board).queryByText('Nhắc hạn nộp báo cáo giữa kỳ'),
    ).not.toBeInTheDocument(),
  );
  const item = within(board).getByRole('button', {
    name: /Lịch họp nhóm hướng dẫn tuần 8/,
  });
  expect(item).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(item);
  expect(item).toHaveAttribute('aria-expanded', 'true');
  expect(
    within(board).getByText(/phòng B3\.02/, { selector: '.notice-body' }),
  ).toBeInTheDocument();

  fireEvent.change(within(board).getByLabelText('Tìm thông báo'), {
    target: { value: 'khong-ai-ca' },
  });
  expect(
    await within(board).findByText('Không có thông báo'),
  ).toBeInTheDocument();
});

it('draws the Gantt with a text list per milestone and links to the config tab', async () => {
  await openFirstRound();
  const gantt = screen.getByRole('group', {
    name: 'Tiến độ Văn bằng 1 · HK1 2026–2027',
  });
  expect(within(gantt).getByText('T8')).toBeInTheDocument();
  expect(within(gantt).getAllByRole('listitem').length).toBeGreaterThanOrEqual(
    9,
  );
  expect(
    within(gantt).getByText(': 19/10/2026 – 30/10/2026, Đang diễn ra.'),
  ).toBeInTheDocument();
  expect(
    within(gantt).getByRole('link', { name: 'Cấu hình mốc Đề cương' }),
  ).toHaveAttribute('href', '/giao-vu/dot/r-vb1-hk1?tab=cau-hinh');
});
