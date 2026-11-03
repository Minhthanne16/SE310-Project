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
import {
  currentUrl,
  push,
  resetNavigation,
  setUrl,
} from '@/test/navigationMock';
import { createRoundService } from '@/features/rounds/services/roundService';
import { seedRounds } from '@/features/rounds/services/roundSeed';
import type { EvaluationService } from '@/features/evaluations/services/evaluationService';
import { createTopicService } from '@/features/topics/services/topicService';
import { RoundDetailPage } from './RoundDetailPage';

vi.mock('next/navigation', async () => {
  const mod = await import('@/test/navigationMock');
  return mod.navigationModule;
});

beforeEach(() => resetNavigation('/giao-vu/dot/x'));
afterEach(cleanup);

const renderDetail = async (
  id = 'r-vb1-hk1',
  service = createRoundService(),
) => {
  render(<RoundDetailPage roundId={id} roundService={service} />);
  await screen.findByRole('heading', { level: 1 });
  return service;
};

// Dịch vụ đợt mà đề tài của đợt `id` đều đã ở trạng thái kết thúc (kết thúc được).
const serviceReadyToFinish = (id: string) =>
  createRoundService({
    rounds: seedRounds().map((r) =>
      r.id === id
        ? { ...r, topicSummary: { ...r.topicSummary, pendingResultCount: 0 } }
        : r,
    ),
  });

const tab = (name: string) =>
  fireEvent.click(screen.getByRole('tab', { name: new RegExp(`^${name}`) }));

const tabSelected = (name: string) =>
  expect(
    screen.getByRole('tab', { name: new RegExp(`^${name}`) }),
  ).toHaveAttribute('aria-selected', 'true');

it('shows a not-found state with a link back for an unknown id', async () => {
  render(
    <RoundDetailPage roundId="khong-co" roundService={createRoundService()} />,
  );
  expect(await screen.findByText('Không tìm thấy đợt')).toBeInTheDocument();
  expect(
    screen.getByRole('link', { name: '← Về danh sách đợt' }),
  ).toHaveAttribute('href', '/giao-vu/dot');
});

it('shows the heading, chips and the progress tab with the Gantt by default', async () => {
  await renderDetail();
  expect(
    screen.getByRole('heading', {
      level: 1,
      name: 'Văn bằng 1 · HK1 2026–2027',
    }),
  ).toBeInTheDocument();
  expect(
    screen.getByText('Đang diễn ra', { selector: '.rnd-pill' }),
  ).toBeInTheDocument();
  tabSelected('Tiến độ');
  expect(
    screen.getByRole('navigation', { name: 'Đường dẫn' }),
  ).toHaveTextContent('Đợt khóa luận');
  expect(
    screen.getByRole('group', { name: /Tiến độ Văn bằng 1/ }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Kết thúc đợt' }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Mở đợt' }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Xóa đợt' }),
  ).not.toBeInTheDocument();
});

it('switches between the four tabs and honours ?tab=', async () => {
  await renderDetail();
  tab('Cấu hình');
  expect(
    screen.getByRole('heading', { name: 'Mốc thời gian' }),
  ).toBeInTheDocument();
  expect(currentUrl()).toBe('/giao-vu/dot/x?tab=cau-hinh');
  tab('Giảng viên');
  expect(await screen.findByText('Nguyễn Thị Hương')).toBeInTheDocument();
  tab('Sinh viên');
  expect(await screen.findByText('Nguyễn Văn An')).toBeInTheDocument();
  tab('Tiến độ');
  fireEvent.click(
    screen.getByRole('button', { name: 'Cấu hình mốc Đề cương' }),
  );
  tabSelected('Cấu hình');
});

it('starts on the tab named in the URL', async () => {
  setUrl('/giao-vu/dot/x?tab=sinh-vien');
  await renderDetail();
  tabSelected('Sinh viên');
});

it('validates milestone order live and saves a valid configuration', async () => {
  const service = await renderDetail();
  tab('Cấu hình');
  const save = screen.getByRole('button', {
    name: 'Lưu và thông báo thay đổi',
  });
  expect(save).toBeDisabled();

  fireEvent.change(screen.getByLabelText('Bắt đầu Báo cáo giữa kỳ'), {
    target: { value: '2026-09-01' },
  });
  fireEvent.change(screen.getByLabelText('Kết thúc Báo cáo giữa kỳ'), {
    target: { value: '2026-09-05' },
  });
  expect(screen.getByRole('alert')).toHaveTextContent('mốc sai thứ tự');
  expect(
    screen.getByText(/Mốc này bắt đầu trước mốc “Đề cương”/),
  ).toBeInTheDocument();
  expect(screen.getByLabelText('Bắt đầu Báo cáo giữa kỳ')).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  expect(save).toBeDisabled();

  // Hủy trả về cấu hình đã lưu.
  fireEvent.click(screen.getByRole('button', { name: 'Hủy thay đổi' }));
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Bắt đầu Báo cáo giữa kỳ')).toHaveValue(
    '2026-10-19',
  );

  fireEvent.change(screen.getByLabelText('Kết thúc Báo cáo giữa kỳ'), {
    target: { value: '2026-11-02' },
  });
  fireEvent.change(screen.getByLabelText('Thông báo cho Đề cương'), {
    target: { value: 'Sinh viên' },
  });
  fireEvent.click(screen.getByRole('switch', { name: 'Cho nộp trễ Đề cương' }));
  fireEvent.click(save);
  await waitFor(() => expect(save).toBeDisabled());
  const saved = (await service.get('r-vb1-hk1')).milestones;
  expect(saved.find((m) => m.key === 'midterm')?.endDate).toBe('2026-11-02');
  expect(saved.find((m) => m.key === 'outline')).toMatchObject({
    notifyAudience: 'Sinh viên',
    allowLate: false,
  });
});

it('only offers the late switch for the three report milestones', async () => {
  await renderDetail();
  tab('Cấu hình');
  expect(screen.getAllByRole('switch')).toHaveLength(3);
  expect(
    screen.getByRole('switch', { name: 'Cho nộp trễ Đề cương' }),
  ).toBeChecked();
  expect(
    screen.getByRole('switch', { name: 'Cho nộp trễ Báo cáo giữa kỳ' }),
  ).toBeChecked();
  expect(
    screen.getByRole('switch', { name: 'Cho nộp trễ Báo cáo cuối kỳ' }),
  ).toBeChecked();
  expect(
    screen.getByText('Chỉ để nhắc, không khóa phiếu chấm.'),
  ).toBeInTheDocument();
});

it('adds students by code and shows mixed check results before adding', async () => {
  const service = await renderDetail('r-vb2-hk1');
  tab('Sinh viên');
  expect(await screen.findByText('Phạm Quốc Khánh')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Thêm sinh viên' }));
  const dialog = screen.getByRole('dialog', { name: 'Thêm sinh viên vào đợt' });
  fireEvent.click(
    within(dialog).getByRole('tab', { name: 'Nhập theo mã (dán danh sách)' }),
  );
  fireEvent.change(
    within(dialog).getByLabelText(/Dán mã hoặc email sinh viên/),
    {
      target: {
        value: '22520010\n99999999, 22520001, 22520010@student.truong.edu.vn',
      },
    },
  );
  fireEvent.click(
    within(dialog).getByRole('button', { name: 'Kiểm tra danh sách' }),
  );

  const results = await within(dialog).findByRole('rowgroup', {
    name: 'Kết quả kiểm tra',
  });
  // Email của cùng một sinh viên (22520010) chỉ tính một lần.
  expect(within(results).getAllByText('Sẽ thêm')).toHaveLength(1);
  expect(
    within(results).getByText('Không có trong hệ thống'),
  ).toBeInTheDocument();
  expect(within(results).getByText('Đang ở đợt khác')).toBeInTheDocument();
  expect(
    within(results).getByText(/Đang thuộc đợt “Văn bằng 1 · HK1 2026–2027”/),
  ).toBeInTheDocument();

  fireEvent.click(
    within(dialog).getByRole('button', { name: 'Thêm 1 sinh viên hợp lệ' }),
  );
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  );
  expect(await screen.findByText('Đinh Công Minh')).toBeInTheDocument();
  expect((await service.get('r-vb2-hk1')).studentIds).toContain('22520010');
});

it('fills the code box from a CSV file, skipping the header, and checks the entries', async () => {
  await renderDetail('r-vb2-hk1');
  tab('Sinh viên');
  await screen.findByText('Phạm Quốc Khánh');
  fireEvent.click(screen.getByRole('button', { name: 'Thêm sinh viên' }));
  const dialog = screen.getByRole('dialog', { name: 'Thêm sinh viên vào đợt' });
  fireEvent.click(
    within(dialog).getByRole('tab', { name: 'Nhập theo mã (dán danh sách)' }),
  );
  expect(
    within(dialog).getByRole('button', { name: 'Chọn tệp Excel/CSV' }),
  ).toBeInTheDocument();
  const file = new File(
    [
      'MSSV,Họ tên\r\n22520010,Đinh Công Minh\r\n22520011@student.truong.edu.vn,Lý\r\n',
    ],
    'ds.csv',
    { type: 'text/csv' },
  );
  fireEvent.change(within(dialog).getByLabelText('Tệp Excel hoặc CSV'), {
    target: { files: [file] },
  });
  const box = within(dialog).getByLabelText(/Dán mã hoặc email sinh viên/);
  await waitFor(() =>
    expect(box).toHaveValue('22520010\n22520011@student.truong.edu.vn'),
  );
  expect(
    within(dialog).getByText('Đã đọc 2 dòng từ tệp ds.csv.'),
  ).toBeInTheDocument();

  fireEvent.click(
    within(dialog).getByRole('button', { name: 'Kiểm tra danh sách' }),
  );
  const results = await within(dialog).findByRole('rowgroup', {
    name: 'Kết quả kiểm tra',
  });
  expect(within(results).getAllByText('Sẽ thêm')).toHaveLength(2);
});

it('shows the email and account status of each person in the participants tab', async () => {
  await renderDetail('r-vb1-hk1');
  tab('Giảng viên');
  expect(await screen.findByText('cb101@truong.edu.vn')).toBeInTheDocument();
  expect(
    screen.getByRole('columnheader', { name: 'Tài khoản' }),
  ).toBeInTheDocument();
  expect(screen.getAllByText('Đang hoạt động').length).toBeGreaterThan(0);
  tab('Sinh viên');
  expect(
    await screen.findByText('22520001@student.truong.edu.vn'),
  ).toBeInTheDocument();
  expect(
    screen.getByText('22520030@student.truong.edu.vn'),
  ).toBeInTheDocument();
  expect(screen.getAllByText('Chưa đăng nhập').length).toBeGreaterThan(0);
  fireEvent.change(screen.getByRole('searchbox'), {
    target: { value: '22520030@student' },
  });
  expect(screen.getByText('Cao Thị Hồng')).toBeInTheDocument();
  expect(screen.queryByText('Nguyễn Văn An')).not.toBeInTheDocument();
});

it('adds lecturers picked from a list of people not yet in the round', async () => {
  const service = await renderDetail('r-vb2-hk2-nhap');
  tab('Giảng viên');
  fireEvent.click(screen.getByRole('button', { name: 'Thêm giảng viên' }));
  const dialog = screen.getByRole('dialog', {
    name: 'Thêm giảng viên vào đợt',
  });
  expect(await within(dialog).findByLabelText(/CB101/)).toBeInTheDocument();
  // CB103 đã trong đợt nên không có trong danh sách chọn.
  expect(within(dialog).queryByLabelText(/CB103/)).not.toBeInTheDocument();
  expect(
    within(dialog).getByRole('button', { name: 'Thêm vào đợt' }),
  ).toBeDisabled();
  fireEvent.click(within(dialog).getByLabelText(/CB101/));
  fireEvent.click(
    within(dialog).getByRole('button', { name: 'Thêm 1 giảng viên' }),
  );
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  );
  expect((await service.get('r-vb2-hk2-nhap')).lecturerIds).toContain('CB101');
});

it('removes a participant after confirming, and blocks one who has data in this round', async () => {
  const service = await renderDetail();
  tab('Sinh viên');
  await screen.findByText('Cao Thị Hồng');

  fireEvent.click(
    screen.getByRole('button', { name: 'Gỡ Cao Thị Hồng khỏi đợt' }),
  );
  const confirm = screen.getByRole('alertdialog');
  fireEvent.click(within(confirm).getByRole('button', { name: 'Gỡ khỏi đợt' }));
  await waitFor(() =>
    expect(screen.queryByText('Cao Thị Hồng')).not.toBeInTheDocument(),
  );
  expect((await service.get('r-vb1-hk1')).studentIds).not.toContain('22520030');

  const locked = screen.getByRole('button', {
    name: 'Gỡ Nguyễn Văn An khỏi đợt',
  });
  expect(locked).toBeDisabled();
  expect(locked).toHaveAccessibleDescription('Đã có dữ liệu, không gỡ được');
  expect(screen.getByText('Nguyễn Văn An')).toBeInTheDocument();
});

it('lets a lecturer with past data be removed from this round', async () => {
  const service = await renderDetail();
  tab('Giảng viên');
  fireEvent.click(
    await screen.findByRole('button', { name: 'Gỡ Nguyễn Thị Hương khỏi đợt' }),
  );
  fireEvent.click(
    within(screen.getByRole('alertdialog')).getByRole('button', {
      name: 'Gỡ khỏi đợt',
    }),
  );
  await waitFor(() =>
    expect(screen.queryByText('Nguyễn Thị Hương')).not.toBeInTheDocument(),
  );
  expect((await service.get('r-vb1-hk1')).lecturerIds).not.toContain('CB101');
});

it('asks before leaving the config tab with unsaved changes', async () => {
  await renderDetail();
  tab('Cấu hình');
  fireEvent.change(screen.getByLabelText('Kết thúc Báo cáo giữa kỳ'), {
    target: { value: '2026-11-02' },
  });
  tab('Giảng viên');
  const dialog = screen.getByRole('alertdialog', { name: 'Bỏ thay đổi?' });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Ở lại' }));
  expect(
    screen.getByRole('heading', { name: 'Mốc thời gian' }),
  ).toBeInTheDocument();
  expect(screen.getByLabelText('Kết thúc Báo cáo giữa kỳ')).toHaveValue(
    '2026-11-02',
  );

  tab('Giảng viên');
  fireEvent.click(
    within(screen.getByRole('alertdialog')).getByRole('button', {
      name: 'Bỏ thay đổi',
    }),
  );
  expect(await screen.findByText('Nguyễn Thị Hương')).toBeInTheDocument();

  // Không có thay đổi chưa lưu thì rời tab không hỏi.
  tab('Cấu hình');
  tab('Tiến độ');
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
});

it('closes a dialog with Escape and returns focus to the button that opened it', async () => {
  await renderDetail();
  const opener = screen.getByRole('button', { name: 'Kết thúc đợt' });
  opener.focus();
  fireEvent.click(opener);
  const dialog = screen.getByRole('alertdialog');
  expect(within(dialog).getByRole('button', { name: 'Để sau' })).toHaveFocus();
  fireEvent.keyDown(document, { key: 'Escape' });
  await waitFor(() =>
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument(),
  );
  expect(opener).toHaveFocus();
});

it('keeps Tab inside an open dialog', async () => {
  await renderDetail('r-vb1-hk1', serviceReadyToFinish('r-vb1-hk1'));
  fireEvent.click(screen.getByRole('button', { name: 'Kết thúc đợt' }));
  const dialog = screen.getByRole('alertdialog');
  const confirm = within(dialog).getByRole('button', { name: 'Kết thúc đợt' });
  confirm.focus();
  fireEvent.keyDown(document, { key: 'Tab' });
  expect(within(dialog).getByRole('button', { name: 'Để sau' })).toHaveFocus();
  fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
  expect(confirm).toHaveFocus();
});

it('follows a tab change made by Next navigation', async () => {
  await renderDetail();
  act(() => setUrl('/giao-vu/dot/x?tab=giang-vien'));
  expect(await screen.findByText('Nguyễn Thị Hương')).toBeInTheDocument();
  tabSelected('Giảng viên');
});

it('blocks finishing while topics still wait for results and explains where to publish them', async () => {
  const service = await renderDetail('r-ths-1-2026');
  fireEvent.click(screen.getByRole('button', { name: 'Kết thúc đợt' }));
  const dialog = screen.getByRole('alertdialog', {
    name: 'Kết thúc đợt Thạc sĩ · Đợt 1/2026?',
  });
  expect(dialog).toHaveTextContent('Còn 5 đề tài chưa công bố kết quả.');
  expect(dialog).toHaveTextContent(
    'rồi mới kết thúc được đợt. Đề tài Không có nhóm không tính.',
  );
  expect(within(dialog).getByRole('link', { name: 'Kết quả' })).toHaveAttribute(
    'href',
    '/giao-vu/ket-qua',
  );
  const confirm = within(dialog).getByRole('button', { name: 'Kết thúc đợt' });
  expect(confirm).toBeDisabled();
  fireEvent.click(confirm);
  expect((await service.get('r-ths-1-2026')).status).toBe('Đang diễn ra');
});

it('finishes a round once every topic is settled, after a plain confirmation', async () => {
  const service = await renderDetail(
    'r-vb2-hk1',
    serviceReadyToFinish('r-vb2-hk1'),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Kết thúc đợt' }));
  const dialog = screen.getByRole('alertdialog');
  expect(dialog).toHaveTextContent('không mở lại được');
  expect(dialog).not.toHaveTextContent('chưa công bố kết quả');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Kết thúc đợt' }));
  await waitFor(() =>
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument(),
  );
  expect((await service.get('r-vb2-hk1')).status).toBe('Đã kết thúc');
  expect(
    screen.getByText('Đã kết thúc', { selector: '.rnd-pill' }),
  ).toBeInTheDocument();
  expect(screen.queryByText(/Giai đoạn:/)).not.toBeInTheDocument();
});

it('rejects finishing in the demo service while topics are pending', async () => {
  const service = createRoundService();
  await expect(service.finish('r-vb1-hk1')).rejects.toThrow(
    'Còn 12 đề tài chưa công bố kết quả.',
  );
});

it('shows the derived stage next to the status chip only for running rounds', async () => {
  await renderDetail('r-vb1-hk1');
  expect(screen.getByText('Giai đoạn: Thực hiện')).toBeInTheDocument();
  cleanup();
  await renderDetail('r-ths-1-2026');
  expect(
    screen.getByText('Giai đoạn: Chờ công bố danh sách'),
  ).toBeInTheDocument();
  cleanup();
  await renderDetail('r-vb2-hk2-nhap');
  expect(screen.queryByText(/Giai đoạn:/)).not.toBeInTheDocument();
  cleanup();
  await renderDetail('r-vb1-hk2-2025');
  expect(screen.queryByText(/Giai đoạn:/)).not.toBeInTheDocument();
});

it('reminds to review and publish on the progress tab and jumps to the topics tab', async () => {
  await renderDetail('r-ths-1-2026');
  const callout = screen.getByText(/Việc cần làm:/).closest('div')!;
  expect(callout).toHaveTextContent(
    'đã hết hạn giảng viên gửi đề tài. Xem lại danh sách rồi đóng và công bố để sinh viên đăng ký.',
  );
  fireEvent.click(
    within(callout).getByRole('button', { name: 'Xem và công bố' }),
  );
  await waitFor(() => tabSelected('Đề tài'));
  expect(currentUrl()).toContain('tab=de-tai');
  cleanup();

  resetNavigation('/giao-vu/dot/x');
  await renderDetail('r-vb1-hk1');
  expect(screen.queryByText(/Việc cần làm:/)).not.toBeInTheDocument();
});

it('switches to the topics tab from the header button instead of leaving the page', async () => {
  await renderDetail('r-vb1-hk1');
  expect(
    screen.queryByRole('link', { name: 'Đề tài của đợt' }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Đề tài của đợt' }));
  await waitFor(() => tabSelected('Đề tài'));
});

it('describes the topic list as unpublished until it is published', async () => {
  await renderDetail('r-ths-1-2026');
  expect(
    screen.getByText(/6 đề tài, danh sách chưa công bố cho sinh viên/),
  ).toBeInTheDocument();
  cleanup();
  await renderDetail('r-vb1-hk1');
  expect(
    screen.getByText(/18 đề tài, 12 chưa công bố kết quả/),
  ).toBeInTheDocument();
});

it('opens a draft and deletes it, going back to the list', async () => {
  const service = await renderDetail('r-vb2-hk2-nhap');
  expect(screen.getByRole('button', { name: 'Mở đợt' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Xóa đợt' }));
  const dialog = screen.getByRole('alertdialog', { name: 'Xác nhận xóa đợt' });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Xóa đợt' }));
  await waitFor(() => expect(push).toHaveBeenCalledWith('/giao-vu/dot'));
  await expect(service.get('r-vb2-hk2-nhap')).rejects.toThrow(
    'Không tìm thấy đợt',
  );
});

it('makes a finished round read-only', async () => {
  await renderDetail('r-vb1-hk2-2025');
  tab('Cấu hình');
  expect(screen.getByText(/nên chỉ xem/)).toBeInTheDocument();
  expect(screen.getByLabelText('Bắt đầu Đề cương')).toBeDisabled();
  expect(
    screen.queryByRole('button', { name: 'Lưu và thông báo thay đổi' }),
  ).not.toBeInTheDocument();
  tab('Sinh viên');
  expect(
    screen.queryByRole('button', { name: 'Thêm sinh viên' }),
  ).not.toBeInTheDocument();
});

const fakeEvaluation = (roles: ('Supervisor' | 'Reviewer' | 'Committee')[]) =>
  ({
    listAssignments: async (roundId: string) =>
      roles.map((role) => ({
        roundId,
        role,
        templateId: 't',
        templateName: 't',
      })),
  }) as unknown as EvaluationService;

const renderWithServices = async (
  id: string,
  roles: ('Supervisor' | 'Reviewer' | 'Committee')[] = [
    'Supervisor',
    'Reviewer',
    'Committee',
  ],
) => {
  const roundService = createRoundService();
  render(
    <RoundDetailPage
      roundId={id}
      roundService={roundService}
      topicService={createTopicService({ roundService })}
      evaluationService={fakeEvaluation(roles)}
    />,
  );
  await screen.findByRole('heading', { level: 1 });
};

it('lists six tabs with the topic count and shows the finish button as primary', async () => {
  await renderDetail();
  const names = screen.getAllByRole('tab').map((t) => t.textContent);
  expect(names).toEqual([
    'Tiến độ',
    'Cấu hình',
    expect.stringMatching(/^Giảng viên \(\d+\)$/),
    expect.stringMatching(/^Sinh viên \(\d+\)$/),
    expect.stringMatching(/^Đề tài \(\d+\)$/),
    'Đánh giá',
  ]);
  expect(screen.getByRole('button', { name: 'Kết thúc đợt' })).toHaveClass(
    'rnd-btn-primary',
  );
});

it('shows the round topics with a status filter, search and a link to the topics page', async () => {
  await renderWithServices('r-vb1-hk1');
  tab('Đề tài');
  tabSelected('Đề tài');
  expect(await screen.findByRole('table')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Mở trang Đề tài' })).toHaveAttribute(
    'href',
    '/giao-vu/de-tai?dot=r-vb1-hk1',
  );
  const rowsBefore = screen.getAllByRole('row').length;
  fireEvent.change(screen.getByRole('searchbox', { name: 'Tìm đề tài' }), {
    target: { value: 'zzzz-khong-co' },
  });
  expect(
    screen.getByText('Không có đề tài nào khớp bộ lọc'),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Xóa bộ lọc' }));
  expect(screen.getAllByRole('row')).toHaveLength(rowsBefore);
  const filter = screen.getByRole('combobox', { name: 'Lọc theo trạng thái' });
  fireEvent.change(filter, { target: { value: 'Đang thực hiện' } });
  expect(screen.getAllByRole('row').length).toBeLessThan(rowsBefore);
});

it('summarises forms, reviewers and councils in the evaluation tab', async () => {
  await renderWithServices('r-vb1-hk1', ['Supervisor']);
  tab('Đánh giá');
  expect(await screen.findByText('Đã gán 1/3 vai trò')).toBeInTheDocument();
  expect(
    screen.getByRole('link', { name: /Mở Phiếu đánh giá/ }),
  ).toHaveAttribute('href', '/giao-vu/phieu-danh-gia?dot=r-vb1-hk1');
  expect(
    screen.getByRole('link', { name: /Mở Giảng viên phản biện/ }),
  ).toHaveAttribute('href', '/giao-vu/phan-bien?dot=r-vb1-hk1');
  expect(
    screen.getByRole('link', { name: /Mở Hội đồng bảo vệ/ }),
  ).toHaveAttribute('href', '/giao-vu/hoi-dong?dot=r-vb1-hk1');
});

it('locks the round info and lecturer topic limits once the round is open', async () => {
  await renderDetail();
  tab('Cấu hình');
  expect(
    screen.getByRole('heading', {
      name: 'Số đề tài mỗi giảng viên nhận hướng dẫn',
    }),
  ).toBeInTheDocument();
  expect(
    screen.getAllByText(/Đợt đã mở nên không chỉnh sửa mục này nữa/),
  ).toHaveLength(2);
});

it('edits the program and name of a draft round and saves them', async () => {
  const service = await renderDetail('r-vb2-hk2-nhap');
  tab('Cấu hình');
  const save = screen.getByRole('button', { name: 'Lưu thông tin đợt' });
  expect(save).toBeDisabled();
  expect(
    screen.queryByText(/Đợt đã mở nên không chỉnh sửa/),
  ).not.toBeInTheDocument();
  const label = screen.getByLabelText('Tên đợt');
  fireEvent.change(label, { target: { value: '' } });
  expect(screen.getByText('Nhập học kỳ hoặc khóa.')).toBeInTheDocument();
  expect(save).toBeDisabled();
  fireEvent.change(label, { target: { value: 'HK3 2026–2027' } });
  fireEvent.change(screen.getByLabelText('Chương trình'), {
    target: { value: 'Thạc sĩ' },
  });
  expect(save).toBeEnabled();
  fireEvent.click(save);
  await waitFor(() => expect(save).toBeDisabled());
  const saved = await service.get('r-vb2-hk2-nhap');
  expect(saved.name).toBe('Thạc sĩ · HK3 2026–2027');
  expect(saved.program).toBe('Thạc sĩ');
  expect(
    await screen.findByRole('heading', { level: 1, name: /Thạc sĩ · HK3/ }),
  ).toBeInTheDocument();
});

it('shows a duplicate name error from the service on the name field', async () => {
  await renderDetail('r-vb2-hk2-nhap');
  tab('Cấu hình');
  fireEvent.change(screen.getByLabelText('Tên đợt'), {
    target: { value: 'HK1 2026–2027' },
  });
  fireEvent.change(screen.getByLabelText('Chương trình'), {
    target: { value: 'Văn bằng 1' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu thông tin đợt' }));
  expect(await screen.findByText(/Tên đợt đã tồn tại/)).toBeInTheDocument();
});

it('asks before leaving the config tab with unsaved round info', async () => {
  await renderDetail('r-vb2-hk2-nhap');
  tab('Cấu hình');
  fireEvent.change(screen.getByLabelText('Tên đợt'), {
    target: { value: 'HK9 2030' },
  });
  tab('Giảng viên');
  tabSelected('Cấu hình');
});

it('disables the program and name fields once the round is running', async () => {
  await renderDetail('r-vb1-hk1');
  tab('Cấu hình');
  expect(screen.getByLabelText('Tên đợt')).toBeDisabled();
  expect(screen.getByLabelText('Chương trình')).toBeDisabled();
  expect(
    screen.queryByRole('button', { name: 'Lưu thông tin đợt' }),
  ).not.toBeInTheDocument();
});

it('blocks opening from the detail page and jumps to the config tab', async () => {
  await renderDetail('r-vb2-hk2-nhap');
  fireEvent.click(screen.getByRole('button', { name: 'Mở đợt' }));
  const dialog = screen.getByRole('dialog');
  expect(within(dialog).getByRole('alert')).toHaveTextContent(
    'Đề cương: chưa đặt ngày',
  );
  expect(within(dialog).getByRole('button', { name: 'Mở đợt' })).toBeDisabled();
  fireEvent.click(
    within(dialog).getByRole('button', { name: 'Đi tới tab Cấu hình' }),
  );
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  await waitFor(() => tabSelected('Cấu hình'));
});

it('edits the lecturer topic limits of a draft round and saves them', async () => {
  const service = await renderDetail('r-vb2-hk2-nhap');
  tab('Cấu hình');
  const save = screen.getByRole('button', { name: 'Lưu số đề tài' });
  expect(save).toBeDisabled();
  const min = screen.getByLabelText('Tối thiểu');
  const max = screen.getByLabelText('Tối đa');
  fireEvent.change(min, { target: { value: '6' } });
  fireEvent.change(max, { target: { value: '5' } });
  expect(
    screen.getByText('Số đề tài tối thiểu không được lớn hơn tối đa.'),
  ).toBeInTheDocument();
  expect(save).toBeDisabled();
  fireEvent.change(min, { target: { value: '2' } });
  expect(save).toBeEnabled();
  fireEvent.click(save);
  await waitFor(() => expect(save).toBeDisabled());
  const saved = await service.get('r-vb2-hk2-nhap');
  expect(saved.lecturerLoadMin).toBe(2);
  expect(saved.lecturerLoadMax).toBe(5);
});
