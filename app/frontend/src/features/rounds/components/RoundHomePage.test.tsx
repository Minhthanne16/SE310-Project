import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { currentUrl, resetNavigation, setUrl } from '@/test/navigationMock';
import { SessionProvider } from '@/features/auth/session/SessionProvider';
import type { AuthService } from '@/features/auth/services/authService';
import {
  createRoundService,
  type RoundService,
} from '@/features/rounds/services/roundService';
import type { CurrentUser } from '@/types/auth';
import { RoundHomePage } from './RoundHomePage';

vi.mock('next/navigation', async () => {
  const mod = await import('@/test/navigationMock');
  return mod.navigationModule;
});

beforeEach(() => resetNavigation('/giao-vu'));
afterEach(cleanup);

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
  await screen.findByRole('button', {
    name: 'Mở đợt Văn bằng 1 HK1 2026–2027',
  });
  return service;
};

const openFirstRound = async () => {
  await renderPage();
  fireEvent.click(
    screen.getByRole('button', { name: 'Mở đợt Văn bằng 1 HK1 2026–2027' }),
  );
  await screen.findByRole('region', { name: 'Việc sắp đến hạn' });
};

it('lists every round as a card, including drafts, with week and milestone', async () => {
  await renderPage();
  expect(screen.getByText('Chào Phạm Minh Châu')).toBeInTheDocument();
  expect(
    screen.getByText(
      /Bạn quản lý 5 đợt khóa luận \(3 đang diễn ra, 1 nháp, 1 đã kết thúc\)/,
    ),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Mở đợt Văn bằng 2 HK2 2026–2027' }),
  ).toBeInTheDocument();
  expect(screen.getByText('Chưa mở đợt')).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Mở đợt Văn bằng 1 HK2 2025–2026' }),
  ).toBeInTheDocument();
  expect(screen.getByText(/^Tuần 8\/\d+ của đợt · /)).toBeInTheDocument();
  expect(screen.getByText('Báo cáo giữa kỳ · hạn 30/10')).toBeInTheDocument();
  expect(
    screen
      .getByRole('button', { name: 'Mở đợt Văn bằng 1 HK1 2026–2027' })
      .querySelector('.progress-bar span'),
  ).toHaveStyle({ width: '67%' });
});

it('opens the round detail from a card and goes back to all rounds', async () => {
  await openFirstRound();
  expect(currentUrl()).toBe('/giao-vu?dot=r-vb1-hk1');
  const todo = screen.getByRole('region', { name: 'Việc sắp đến hạn' });
  expect(
    within(todo).getByRole('link', {
      name: /Mốc “Báo cáo giữa kỳ” kết thúc sau 4 ngày\./,
    }),
  ).toHaveAttribute('href', '/giao-vu/dot/r-vb1-hk1?tab=tien-do');
  expect(screen.getByText('Đợt')).toBeInTheDocument();
  expect(screen.queryByText(/đề tài chưa công bố/)).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Soạn thông báo/ })).toHaveAttribute(
    'href',
    '/giao-vu/thong-bao/gui',
  );
  expect(
    screen.getByRole('link', {
      name: 'Quản lý đợt Văn bằng 1 · HK1 2026–2027',
    }),
  ).toHaveAttribute('href', '/giao-vu/dot/r-vb1-hk1');

  fireEvent.click(screen.getByRole('button', { name: 'Tất cả đợt' }));
  expect(
    await screen.findByRole('button', { name: 'Mở đợt Thạc sĩ Đợt 1/2026' }),
  ).toBeInTheDocument();
  expect(currentUrl()).toBe('/giao-vu');
});

it('starts on the detail view when the URL has ?dot=', async () => {
  setUrl('/giao-vu?dot=r-ths-1-2026');
  render(
    <SessionProvider authService={fakeAuth()}>
      <RoundHomePage roundService={createRoundService()} />
    </SessionProvider>,
  );
  expect(
    await screen.findByRole('region', { name: 'Việc sắp đến hạn' }),
  ).toBeInTheDocument();
  expect(screen.getByText('Đang diễn ra')).toBeInTheDocument();
});

it('shows a not-found state for an unknown ?dot=', async () => {
  setUrl('/giao-vu?dot=khong-co');
  render(
    <SessionProvider authService={fakeAuth()}>
      <RoundHomePage roundService={createRoundService()} />
    </SessionProvider>,
  );
  expect(await screen.findByText('Không tìm thấy đợt')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Tất cả đợt' }));
  expect(
    await screen.findByRole('button', {
      name: 'Mở đợt Văn bằng 1 HK1 2026–2027',
    }),
  ).toBeInTheDocument();
});

it('filters the notice board by source and by title or sender, and opens an item', async () => {
  await openFirstRound();
  const board = screen.getByRole('region', { name: 'Bảng thông báo' });
  await within(board).findByText('Nhắc hạn nộp báo cáo giữa kỳ');
  // Mới hiện 5 thông báo; "Xem thêm N thông báo cũ hơn" lấy nốt.
  expect(
    within(board).queryByText('Bắt đầu đợt khóa luận HK1 2026–2027'),
  ).not.toBeInTheDocument();
  fireEvent.click(
    within(board).getByRole('button', {
      name: /^Xem thêm \d+ thông báo cũ hơn$/,
    }),
  );
  expect(
    await within(board).findByText('Bắt đầu đợt khóa luận HK1 2026–2027'),
  ).toBeInTheDocument();
  expect(
    within(board).queryByRole('button', { name: /^Xem thêm/ }),
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
    await within(board).findByText('Không có thông báo phù hợp.'),
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

it('follows a URL change made by Next navigation without popstate', async () => {
  await openFirstRound();
  // Ví dụ bấm "Trang chủ" trên sidebar: Link của Next đổi URL, không popstate.
  act(() => setUrl('/giao-vu'));
  expect(
    await screen.findByRole('button', { name: 'Mở đợt Thạc sĩ Đợt 1/2026' }),
  ).toBeInTheDocument();
  act(() => setUrl('/giao-vu?dot=r-ths-1-2026'));
  expect(
    await screen.findByRole('region', { name: 'Việc sắp đến hạn' }),
  ).toBeInTheDocument();
});

it('moves focus to the heading of the new view', async () => {
  await openFirstRound();
  expect(screen.getByRole('heading', { level: 1 })).toHaveFocus();
  fireEvent.click(screen.getByRole('button', { name: 'Tất cả đợt' }));
  await waitFor(() =>
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Chào Phạm Minh Châu',
    ),
  );
  expect(screen.getByRole('heading', { level: 1 })).toHaveFocus();
});

it('tells apart a running round before its first week and after its last milestone', async () => {
  const base = createRoundService();
  const [vb1] = await base.list({ status: 'Đang diễn ra' });
  const shift = (days: number) => {
    const move = (iso: string) =>
      new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000)
        .toISOString()
        .slice(0, 10);
    return {
      ...vb1,
      milestones: vb1.milestones.map((m) => ({
        ...m,
        startDate: move(m.startDate),
        endDate: move(m.endDate),
      })),
    };
  };
  const later = {
    ...shift(400),
    id: 'later',
    name: 'Mở đợt Văn bằng 1 Đợt tương lai',
  };
  const earlier = { ...shift(-400), id: 'earlier', name: 'Đợt đã qua mốc' };
  const service = createRoundService({
    today: '2026-10-26',
    rounds: [later, earlier],
  });
  render(
    <SessionProvider authService={fakeAuth()}>
      <RoundHomePage roundService={service} />
    </SessionProvider>,
  );
  await screen.findByRole('button', {
    name: 'Mở đợt Văn bằng 1 Đợt tương lai',
  });
  expect(screen.getByText('Chưa bắt đầu')).toBeInTheDocument();
  expect(screen.getByText('Đã qua mốc cuối')).toBeInTheDocument();
});
