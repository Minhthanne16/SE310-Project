import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { currentUrl, resetNavigation } from '@/test/navigationMock';
import type { Round } from '@/types/round';
import type {
  ReviewerAssignments,
  ReviewerLecturer,
  ReviewerTopicRow,
} from '@/types/reviewer';
import { ReviewerAssignmentPage } from './ReviewerAssignmentPage';

vi.mock('next/navigation', async () => {
  const mod = await import('@/test/navigationMock');
  return mod.navigationModule;
});

beforeEach(() => resetNavigation('/giao-vu/phan-bien'));
afterEach(cleanup);

const rounds = [
  { id: 'r1', name: 'Đợt 1', status: 'Đang diễn ra' },
  { id: 'r2', name: 'Đợt 2', status: 'Đã kết thúc' },
] as Round[];

const person = (id: string, name: string) => ({
  id,
  code: id.toUpperCase(),
  name,
});

const row = (
  id: string,
  overrides: Partial<ReviewerTopicRow> = {},
): ReviewerTopicRow => ({
  topicId: id,
  code: `DT-00${id}`,
  title: `Đề tài ${id}`,
  field: 'CNPM',
  supervisor: person('gva', 'Giảng viên A'),
  group: [
    {
      ...person(`sv${id}`, `SV ${id}`),
      className: 'KTPM',
      representative: true,
    },
  ],
  outlineApprovedAt: '2026-09-10T03:00:00Z',
  reviewer: null,
  assignedAt: null,
  eligible: true,
  blockedReason: null,
  locked: false,
  lockReason: null,
  hasMidterm: false,
  hasFinal: false,
  ...overrides,
});

const lecturer = (
  id: string,
  name: string,
  reviewCount = 0,
  max = 2,
): ReviewerLecturer => ({
  id,
  code: id.toUpperCase(),
  name,
  department: null,
  reviewCount,
  superviseCount: 1,
  max,
  level: 'ok',
});

const data = (
  topics: ReviewerTopicRow[],
  lecturers = [
    lecturer('gva', 'Giảng viên A'),
    lecturer('gvb', 'Giảng viên B'),
    lecturer('gvc', 'Giảng viên C'),
  ],
  loadMax = 2,
): ReviewerAssignments => ({
  round: { id: 'r1', name: 'Đợt 1', status: 'Đang diễn ra', loadMax },
  topics,
  lecturers,
});

const fakeService = (initial: ReviewerAssignments) => ({
  list: vi.fn().mockResolvedValue(initial),
  suggest: vi.fn(),
  assign: vi.fn(),
  batch: vi.fn(),
  mine: vi.fn(),
});

const renderPage = async (service: ReturnType<typeof fakeService>) => {
  render(
    <ReviewerAssignmentPage
      service={service}
      roundService={{ list: vi.fn().mockResolvedValue(rounds) }}
    />,
  );
  await screen.findByRole('table');
};

const selectOf = (code: string) =>
  screen.getByRole('combobox', { name: `Giảng viên phản biện ${code}` });

it('shows eligible rows, locked rows with their reason and the not eligible block', async () => {
  const service = fakeService(
    data([
      row('1'),
      row('2', {
        reviewer: person('gvb', 'Giảng viên B'),
        locked: true,
        lockReason: 'GVPB đã nhập phiếu điểm; không đổi được (PDR-023)',
      }),
      row('3', { eligible: false, blockedReason: 'Chưa duyệt đề cương' }),
    ]),
  );
  await renderPage(service);

  expect(service.list).toHaveBeenCalledWith('r1');
  expect(screen.getByText('Đủ điều kiện')).toBeInTheDocument();
  expect(selectOf('DT-002')).toBeDisabled();
  expect(selectOf('DT-002')).toHaveAccessibleDescription(
    /không đổi được \(PDR-023\)/,
  );
  expect(screen.getByText('Đã khóa · có phiếu phản biện')).toBeInTheDocument();
  const block = screen.getByRole('region', { name: 'Chưa đủ điều kiện (1)' });
  expect(within(block).getByText('DT-003')).toBeInTheDocument();
  expect(within(block).getByText('Chưa duyệt đề cương')).toBeInTheDocument();
  // GVHD không chọn được làm GVPB của chính đề tài.
  const supervisorOption = within(selectOf('DT-001')).getByRole('option', {
    name: /Giảng viên A.*\(GVHD\)/,
  });
  expect(supervisorOption).toBeDisabled();
});

it('selects the round from ?dot= and updates the URL when the round changes', async () => {
  resetNavigation('/giao-vu/phan-bien?dot=r2');
  const service = fakeService(data([row('1')]));
  service.list.mockResolvedValue({
    ...data([row('1')]),
    round: { id: 'r2', name: 'Đợt 2', status: 'Đã kết thúc', loadMax: 0 },
  });
  await renderPage(service);

  expect(service.list).toHaveBeenCalledWith('r2');
  fireEvent.change(screen.getByLabelText('Đợt'), { target: { value: 'r1' } });
  expect(currentUrl()).toBe('/giao-vu/phan-bien?dot=r1');
  await waitFor(() => expect(service.list).toHaveBeenLastCalledWith('r1'));
});

it('suggests into a draft without saving, then saves after confirmation and toasts', async () => {
  const service = fakeService(data([row('1'), row('2')]));
  service.suggest.mockResolvedValue([
    { topicId: '1', lecturerId: 'gvb', reason: 'Cùng lĩnh vực' },
    { topicId: '2', lecturerId: null, reason: 'Không có ứng viên' },
  ]);
  service.batch.mockResolvedValue({
    succeeded: 1,
    failed: 0,
    results: [
      {
        topicId: '1',
        code: 'DT-001',
        ok: true,
        message: 'ok',
        warning: null,
        row: null,
      },
    ],
  });
  await renderPage(service);
  expect(
    screen.getByRole('button', { name: 'Lưu và gửi thông báo' }),
  ).toBeDisabled();

  fireEvent.click(screen.getByRole('button', { name: 'Tự gợi ý' }));
  const dialog = screen.getByRole('alertdialog');
  expect(dialog).toHaveTextContent('chưa được lưu');
  fireEvent.click(
    within(dialog).getByRole('button', { name: 'Điền sẵn gợi ý' }),
  );

  await waitFor(() => expect(selectOf('DT-001')).toHaveValue('gvb'));
  expect(service.batch).not.toHaveBeenCalled();
  expect(screen.getByText('Gợi ý')).toBeInTheDocument();
  expect(
    screen.getByText(/Không gợi ý được: Không có ứng viên/),
  ).toBeInTheDocument();
  expect(
    await screen.findByText(/Đã điền sẵn 1 gợi ý\. Chưa lưu/),
  ).toBeInTheDocument();

  service.list.mockResolvedValue(
    data([row('1', { reviewer: person('gvb', 'Giảng viên B') }), row('2')]),
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Lưu và gửi thông báo (1)' }),
  );
  const confirm = screen.getByRole('alertdialog');
  fireEvent.click(
    within(confirm).getByRole('button', { name: 'Lưu và gửi thông báo' }),
  );

  await waitFor(() =>
    expect(service.batch).toHaveBeenCalledWith('r1', [
      { topicId: '1', reviewerId: 'gvb', expectedReviewerId: null },
    ]),
  );
  expect(
    await screen.findByText(/Đã lưu 1 phân công và gửi thông báo/),
  ).toBeInTheDocument();
  await waitFor(() => expect(selectOf('DT-001')).toHaveValue('gvb'));
  expect(screen.queryByText('Gợi ý')).not.toBeInTheDocument();
});

it('reports failed rows in place, keeps their draft and toasts the error', async () => {
  const service = fakeService(data([row('1'), row('2')]));
  service.batch.mockResolvedValue({
    succeeded: 1,
    failed: 1,
    results: [
      {
        topicId: '1',
        code: 'DT-001',
        ok: true,
        message: 'ok',
        warning: null,
        row: null,
      },
      {
        topicId: '2',
        code: 'DT-002',
        ok: false,
        message: 'Phân công vừa thay đổi, tải lại',
        warning: null,
        row: null,
      },
    ],
  });
  await renderPage(service);
  fireEvent.change(selectOf('DT-001'), { target: { value: 'gvb' } });
  fireEvent.change(selectOf('DT-002'), { target: { value: 'gvc' } });
  service.list.mockResolvedValue(
    data([row('1', { reviewer: person('gvb', 'Giảng viên B') }), row('2')]),
  );

  fireEvent.click(
    screen.getByRole('button', { name: 'Lưu và gửi thông báo (2)' }),
  );
  fireEvent.click(
    within(screen.getByRole('alertdialog')).getByRole('button', {
      name: 'Lưu và gửi thông báo',
    }),
  );

  const alert = await screen.findByText('Phân công vừa thay đổi, tải lại', {
    selector: '[role="alert"]',
  });
  expect(alert).toBeInTheDocument();
  expect(selectOf('DT-002')).toHaveAttribute('aria-invalid', 'true');
  expect(selectOf('DT-002')).toHaveValue('gvc');
  expect(
    await screen.findByText(/Đã lưu 1 phân công; 1 dòng lỗi/),
  ).toBeInTheDocument();
});

it('keeps the confirm dialog with an inline error when the whole batch fails', async () => {
  const service = fakeService(data([row('1')]));
  service.batch.mockRejectedValue(new Error('Mỗi lô tối đa 200 đề tài.'));
  await renderPage(service);
  fireEvent.change(selectOf('DT-001'), { target: { value: 'gvb' } });

  fireEvent.click(
    screen.getByRole('button', { name: 'Lưu và gửi thông báo (1)' }),
  );
  fireEvent.click(
    within(screen.getByRole('alertdialog')).getByRole('button', {
      name: 'Lưu và gửi thông báo',
    }),
  );

  expect(
    await screen.findByText('Mỗi lô tối đa 200 đề tài.'),
  ).toBeInTheDocument();
  expect(screen.getByRole('alertdialog')).toBeInTheDocument();
});

it('fills the draft for selected rows with bulk assign and skips the supervisor', async () => {
  const service = fakeService(
    data([row('1'), row('2', { supervisor: person('gvb', 'Giảng viên B') })]),
  );
  await renderPage(service);

  fireEvent.click(screen.getByRole('checkbox', { name: 'Chọn DT-001' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Chọn DT-002' }));
  expect(screen.getByText('2 đề tài đã chọn')).toBeInTheDocument();
  fireEvent.change(
    screen.getByLabelText('Giảng viên phản biện cho các đề tài đã chọn'),
    { target: { value: 'gvb' } },
  );
  fireEvent.click(screen.getByRole('button', { name: 'Gán hàng loạt' }));

  expect(selectOf('DT-001')).toHaveValue('gvb');
  expect(selectOf('DT-002')).toHaveValue('');
  expect(
    await screen.findByText(/Đã điền sẵn 1 đề tài, bỏ qua 1/),
  ).toBeInTheDocument();
  expect(service.batch).not.toHaveBeenCalled();
});

it('warns when the draft pushes a lecturer over the round maximum', async () => {
  const service = fakeService(
    data(
      [row('1'), row('2')],
      [lecturer('gva', 'Giảng viên A'), lecturer('gvb', 'Giảng viên B', 1, 1)],
      1,
    ),
  );
  await renderPage(service);

  fireEvent.change(selectOf('DT-001'), { target: { value: 'gvb' } });

  const note = screen.getByRole('note');
  expect(note).toHaveTextContent('Giảng viên B (2)');
  expect(note).toHaveTextContent('chỉ là cảnh báo');
  expect(screen.getByText('Vượt mức')).toBeInTheDocument();
  // Vượt mức không chặn lưu.
  expect(
    screen.getByRole('button', { name: 'Lưu và gửi thông báo (1)' }),
  ).toBeEnabled();
});

it('shows an empty state when the round has no topics', async () => {
  const service = fakeService(data([]));
  render(
    <ReviewerAssignmentPage
      service={service}
      roundService={{ list: vi.fn().mockResolvedValue(rounds) }}
    />,
  );
  expect(await screen.findByText('Chưa có đề tài')).toBeInTheDocument();
});
