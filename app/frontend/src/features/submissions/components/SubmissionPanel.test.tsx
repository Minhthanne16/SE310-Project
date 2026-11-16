import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ApiError } from '@/api/request';
import type { SubmissionService } from '@/features/submissions/services/submissionApiService';
import {
  deadlineText,
  fileError,
  formatBytes,
} from '@/features/submissions/submissionUtils';
import type { RevisionRequest } from '@/types/outline';
import type {
  SubmissionKindState,
  SubmissionVersion,
  TopicSubmissions,
} from '@/types/submission';
import { SubmissionPanel } from './SubmissionPanel';

afterEach(cleanup);

const version = (
  overrides: Partial<SubmissionVersion> = {},
): SubmissionVersion => ({
  id: 's1',
  version: 1,
  fileName: 'giua-ky.pdf',
  sizeBytes: 1536 * 1024,
  note: null,
  submittedAt: '2026-09-25T03:00:00Z',
  submittedBy: { id: 'sv1', code: '22520001', name: 'Nguyễn Văn An' },
  isLate: false,
  isLatest: true,
  isFinal: false,
  downloadUrl: '/api/submissions/s1/file',
  reviewComment: null,
  reviewedBy: null,
  reviewedAt: null,
  addressedRequestIds: [],
  ...overrides,
});

const revisionRequest = (
  overrides: Partial<RevisionRequest> = {},
): RevisionRequest => ({
  id: 'req1',
  content: 'Sửa chương 2 phần thực nghiệm',
  createdBy: 'TS. Nguyễn Văn A',
  createdAt: '2026-09-26T04:00:00Z',
  raisedOnVersionNo: 1,
  status: 'open',
  resolvedBy: null,
  resolvedAt: null,
  addressedInVersions: [],
  canResolve: false,
  ...overrides,
});

const kind = (
  overrides: Partial<SubmissionKindState> = {},
): SubmissionKindState => ({
  kind: 'midterm',
  name: 'Báo cáo giữa kỳ',
  deadline: '2026-09-27',
  allowLate: true,
  lateDeadline: '2026-09-30',
  window: 'onTime',
  canSubmit: true,
  blockedReason: null,
  noteRequired: false,
  canReview: false,
  canLock: false,
  lockBlockedReason: null,
  extensionDeadline: '',
  extensionReason: null,
  waitingException: false,
  canGrantExtension: false,
  canMarkIneligible: false,
  ineligibleReason: null,
  versions: [],
  requests: [],
  ...overrides,
});

const data = (kinds: SubmissionKindState[]): TopicSubmissions => ({
  topicId: 't1',
  maxBytes: 20 * 1024 * 1024,
  kinds,
});

const finalKind = (overrides: Partial<SubmissionKindState> = {}) =>
  kind({
    kind: 'final',
    name: 'Báo cáo cuối kỳ',
    deadline: '2026-10-04',
    allowLate: false,
    lateDeadline: '',
    noteRequired: true,
    ...overrides,
  });

const service = (
  initial: TopicSubmissions,
  submit: SubmissionService['submit'] = vi.fn(),
  comment: SubmissionService['comment'] = vi.fn(),
  createRequest: SubmissionService['createRequest'] = vi.fn(),
  resolveRequest: SubmissionService['resolveRequest'] = vi.fn(),
): SubmissionService => ({
  list: vi.fn().mockResolvedValue(initial),
  submit,
  comment,
  createRequest,
  resolveRequest,
  grantExtension: vi.fn(),
  lock: vi.fn(),
  markIneligible: vi.fn(),
});

const pdf = (name = 'bao-cao.pdf', size = 1000, type = 'application/pdf') => {
  const file = new File(['%PDF-1.7'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

const section = async (name: string) =>
  within(await screen.findByRole('region', { name }));

it('renders both report stages and their initial empty states', async () => {
  render(
    <SubmissionPanel
      topicId="t1"
      service={service(data([kind(), finalKind()]))}
    />,
  );

  const midterm = await section('Báo cáo giữa kỳ');
  expect(midterm.getByText('Đang nhận bài')).toBeInTheDocument();
  expect(midterm.getByText('Chưa nộp')).toBeInTheDocument();
  expect(
    midterm.getByText(/Hạn nộp: hết ngày 27\/09\/2026/),
  ).toBeInTheDocument();
  expect(midterm.getByLabelText(/Tệp báo cáo/)).toBeInTheDocument();

  const final = await section('Báo cáo cuối kỳ');
  expect(final.getByText('Chưa nộp')).toBeInTheDocument();
  expect(
    final.getByLabelText(/Ghi chú thay đổi \(bắt buộc\)/),
  ).toBeInTheDocument();
});

it('rejects an empty file selection with an in-field error', async () => {
  render(<SubmissionPanel topicId="t1" service={service(data([kind()]))} />);
  const midterm = await section('Báo cáo giữa kỳ');

  fireEvent.click(midterm.getByRole('button', { name: 'Nộp báo cáo giữa kỳ' }));

  expect(midterm.getByRole('alert')).toHaveTextContent('Chọn tệp PDF để nộp.');
});

it('submits a valid PDF and appends the new version', async () => {
  const next = data([
    kind({
      versions: [version()],
    }),
  ]);
  const submit = vi.fn().mockResolvedValue(next);
  render(
    <SubmissionPanel topicId="t1" service={service(data([kind()]), submit)} />,
  );

  const midterm = await section('Báo cáo giữa kỳ');
  const input = midterm.getByLabelText(/Tệp báo cáo/);
  fireEvent.change(input, { target: { files: [pdf('bao-cao-giua-ky.pdf')] } });
  fireEvent.click(midterm.getByRole('button', { name: 'Nộp báo cáo giữa kỳ' }));

  await waitFor(() => {
    expect(submit).toHaveBeenCalledWith('t1', 'midterm', expect.any(File), '');
  });
  expect(await screen.findByText('Đã nộp bản 1.')).toBeInTheDocument();
  expect(screen.getByText('Bản 1')).toBeInTheDocument();
  expect(screen.getByText('Mới nhất')).toBeInTheDocument();
  expect(screen.getByText('1,5 MB')).toBeInTheDocument();
});

it('enforces a change note on the final report stage', async () => {
  render(
    <SubmissionPanel topicId="t1" service={service(data([finalKind()]))} />,
  );
  const final = await section('Báo cáo cuối kỳ');

  fireEvent.change(final.getByLabelText(/Tệp báo cáo/), {
    target: { files: [pdf('khoa-luan.pdf')] },
  });
  fireEvent.click(final.getByRole('button', { name: 'Nộp báo cáo cuối kỳ' }));

  expect(final.getByRole('alert')).toHaveTextContent(
    'Nhập ghi chú thay đổi cho bản báo cáo cuối kỳ.',
  );
});

it('warns when submitting during the late window and marks late uploads', async () => {
  const lateKind = kind({
    window: 'late',
    versions: [version({ isLate: true })],
  });
  render(<SubmissionPanel topicId="t1" service={service(data([lateKind]))} />);

  const midterm = await section('Báo cáo giữa kỳ');
  expect(midterm.getByText('Nộp trễ')).toBeInTheDocument();
  expect(
    midterm.getByText(/Bài nộp bây giờ sẽ được gắn nhãn “Nộp trễ”/),
  ).toBeInTheDocument();
  expect(
    midterm.getByText('Nộp trễ', { selector: 'span' }),
  ).toBeInTheDocument();
});

it('hides the upload form when submissions are closed or blocked', async () => {
  const closedKind = kind({
    window: 'closed',
    canSubmit: false,
    blockedReason: 'Đã hết hạn nộp trễ báo cáo giữa kỳ (hết ngày 30/09/2026).',
    versions: [version()],
  });
  render(
    <SubmissionPanel topicId="t1" service={service(data([closedKind]))} />,
  );

  const midterm = await section('Báo cáo giữa kỳ');
  expect(midterm.getByText('Đã hết hạn nộp')).toBeInTheDocument();
  expect(
    midterm.getByText(/Đã hết hạn nộp trễ báo cáo giữa kỳ/),
  ).toBeInTheDocument();
  expect(midterm.queryByLabelText(/Tệp báo cáo/)).not.toBeInTheDocument();
  expect(midterm.getByRole('link', { name: /Tải bản 1/ })).toBeInTheDocument();
});

it('allows supervisor to comment on report versions', async () => {
  const next = data([
    kind({
      canReview: true,
      versions: [
        version({
          reviewComment: 'Bổ sung kết quả đo lường',
          reviewedBy: 'GV. Hướng Dẫn',
          reviewedAt: '2026-09-26T05:00:00Z',
        }),
      ],
    }),
  ]);
  const comment = vi.fn().mockResolvedValue(next);
  render(
    <SubmissionPanel
      topicId="t1"
      service={service(
        data([
          kind({
            canReview: true,
            versions: [version()],
          }),
        ]),
        vi.fn(),
        comment,
      )}
    />,
  );

  const midterm = await section('Báo cáo giữa kỳ');
  fireEvent.click(midterm.getByRole('button', { name: 'Nhận xét' }));

  const commentInput = midterm.getByLabelText(/Nhận xét Bản 1/);
  fireEvent.change(commentInput, {
    target: { value: 'Bổ sung kết quả đo lường' },
  });
  fireEvent.click(midterm.getByRole('button', { name: 'Lưu nhận xét' }));

  await waitFor(() => {
    expect(comment).toHaveBeenCalledWith(
      't1',
      's1',
      'Bổ sung kết quả đo lường',
    );
  });
});

it('allows supervisor to create and resolve revision requests', async () => {
  const req = revisionRequest({
    id: 'req-1',
    canResolve: true,
    addressedInVersions: [2],
  });
  const initial = data([
    kind({
      canReview: true,
      versions: [version({ version: 2 })],
      requests: [req],
    }),
  ]);
  const resolve = vi.fn().mockResolvedValue(
    data([
      kind({
        canReview: true,
        versions: [version({ version: 2 })],
        requests: [
          revisionRequest({
            id: 'req-1',
            status: 'resolved',
            resolvedBy: 'GVHD',
            resolvedAt: '2026-09-26T06:00:00Z',
            addressedInVersions: [2],
          }),
        ],
      }),
    ]),
  );

  render(
    <SubmissionPanel
      topicId="t1"
      service={service(initial, vi.fn(), vi.fn(), vi.fn(), resolve)}
    />,
  );

  const midterm = await section('Báo cáo giữa kỳ');
  expect(
    midterm.getByText('Sửa chương 2 phần thực nghiệm'),
  ).toBeInTheDocument();
  expect(midterm.getByText(/Nhóm đã nộp lại: Bản 2/)).toBeInTheDocument();

  const resolveBtn = midterm.getByRole('button', { name: 'Xác nhận hoàn tất' });
  fireEvent.click(resolveBtn);

  await waitFor(() => {
    expect(resolve).toHaveBeenCalledWith('t1', 'req-1');
  });
});

it('offers a retry when the list cannot be loaded', async () => {
  const list = vi
    .fn()
    .mockRejectedValueOnce(new ApiError('Không tìm thấy đề tài.', 404))
    .mockResolvedValueOnce(data([kind()]));
  render(
    <SubmissionPanel topicId="t1" service={{ ...service(data([])), list }} />,
  );

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Không tìm thấy đề tài.',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
  expect(
    await screen.findByRole('region', { name: 'Báo cáo giữa kỳ' }),
  ).toBeInTheDocument();
});

it('shows the private extension and confirms the chosen thesis version', async () => {
  const thesis = kind({
    kind: 'thesis',
    name: 'Bản khóa luận',
    deadline: '2026-11-01',
    extensionDeadline: '2026-11-05',
    extensionReason: 'Cho nhóm nộp bổ sung',
    lateDeadline: '2026-11-05',
    window: 'late',
    canLock: true,
    versions: [
      version({ id: 'thesis-2', version: 2, fileName: 'khoa-luan.pdf' }),
      version({ id: 'thesis-1', isLatest: false }),
    ],
  });
  const locked = data([
    {
      ...thesis,
      canLock: false,
      lockBlockedReason: null,
      versions: thesis.versions.map((v) => ({
        ...v,
        isFinal: v.id === 'thesis-1',
      })),
    },
  ]);
  const lock = vi.fn().mockResolvedValue(locked);
  render(
    <SubmissionPanel
      topicId="t1"
      service={{ ...service(data([thesis])), lock }}
    />,
  );
  const area = await section('Bản khóa luận');
  expect(area.getByRole('note')).toHaveTextContent('05/11/2026');
  expect(area.getByRole('note')).toHaveTextContent('Cho nhóm nộp bổ sung');
  fireEvent.click(area.getByRole('button', { name: 'Chốt bản 1' }));
  fireEvent.click(screen.getByRole('button', { name: 'Chốt bản cuối' }));
  await waitFor(() => expect(lock).toHaveBeenCalledWith('t1', 'thesis-1'));
  expect(await area.findByText('Bản cuối')).toBeInTheDocument();
});

it('shows staff the pending decision without submitting on behalf of the group', async () => {
  const thesis = kind({
    kind: 'thesis',
    name: 'Bản khóa luận',
    deadline: '2026-11-01',
    window: 'closed',
    canSubmit: false,
    waitingException: true,
    canGrantExtension: true,
  });
  const grantExtension = vi.fn().mockResolvedValue(
    data([
      {
        ...thesis,
        canGrantExtension: false,
        extensionDeadline: '2026-11-05',
        extensionReason: 'Lý do hợp lệ',
      },
    ]),
  );
  render(
    <SubmissionPanel
      topicId="t1"
      service={{ ...service(data([thesis])), grantExtension }}
    />,
  );
  const area = await section('Bản khóa luận');
  expect(area.getByRole('note')).toHaveTextContent('chờ Giáo vụ');
  fireEvent.change(area.getByLabelText('Hạn bổ sung'), {
    target: { value: '2026-11-05' },
  });
  fireEvent.change(area.getByLabelText('Lý do quyết định'), {
    target: { value: 'Lý do hợp lệ' },
  });
  fireEvent.click(area.getByRole('button', { name: 'Cấp hạn bổ sung' }));
  await waitFor(() =>
    expect(grantExtension).toHaveBeenCalledWith(
      't1',
      '2026-11-05',
      'Lý do hợp lệ',
    ),
  );
});

it('explains why the thesis cannot be locked while final requests are open', async () => {
  const thesis = kind({
    kind: 'thesis',
    name: 'Bản khóa luận',
    canLock: false,
    lockBlockedReason:
      'Còn 1 yêu cầu chỉnh sửa của báo cáo cuối kỳ chưa được GVHD xác nhận hoàn tất nên chưa chốt được bản cuối.',
    versions: [version({ id: 'thesis-1' })],
  });
  render(<SubmissionPanel topicId="t1" service={service(data([thesis]))} />);
  const area = await section('Bản khóa luận');
  expect(area.getByRole('note')).toHaveTextContent('Còn 1 yêu cầu chỉnh sửa');
  expect(
    area.queryByRole('button', { name: 'Chốt bản 1' }),
  ).not.toBeInTheDocument();
});

it('describes deadlines and validates files', () => {
  expect(deadlineText(kind())).toBe(
    'Hạn nộp: hết ngày 27/09/2026. Cho nộp trễ đến hết ngày 30/09/2026, bài nộp trễ có nhãn “Nộp trễ”.',
  );
  expect(deadlineText(finalKind())).toBe(
    'Hạn nộp: hết ngày 04/10/2026. Mốc này không cho nộp trễ.',
  );
  expect(fileError(null)).toBe('Chọn tệp PDF để nộp.');
  expect(
    fileError({ name: 'a.PDF', size: 20 * 1024 * 1024, type: '' }),
  ).toBeNull();
  expect(fileError({ name: 'a.pdf', size: 10, type: 'image/png' })).toBe(
    'Tệp không phải PDF. Chỉ nhận tệp PDF.',
  );
  expect(formatBytes(1536 * 1024)).toBe('1,5 MB');
});
