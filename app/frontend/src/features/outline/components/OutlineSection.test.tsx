import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { OutlineService } from '@/features/outline/services/outlineService';
import { outlineFileError } from '@/features/outline/services/outlineService';
import type {
  Outline,
  OutlineSubmission,
  RevisionRequest,
} from '@/types/outline';
import { OutlineSection, outlineStage } from './OutlineSection';

afterEach(cleanup);

const version = (
  no: number,
  overrides: Partial<OutlineSubmission> = {},
): OutlineSubmission => ({
  id: `s${no}`,
  versionNo: no,
  fileName: `de-cuong-v${no}.pdf`,
  sizeBytes: 2048,
  note: `Ghi chú lần ${no}`,
  submittedBy: 'Nguyễn Văn An',
  submittedAt: `2026-09-1${no}T03:00:00Z`,
  late: false,
  reviewComment: null,
  reviewedBy: null,
  reviewedAt: null,
  addressedRequestIds: [],
  ...overrides,
});

const request = (
  id: string,
  overrides: Partial<RevisionRequest> = {},
): RevisionRequest => ({
  id,
  content: `Nội dung ${id}`,
  createdBy: 'Trần Thị Bình',
  createdAt: '2026-09-16T04:00:00Z',
  raisedOnVersionNo: 1,
  status: 'open',
  resolvedBy: null,
  resolvedAt: null,
  addressedInVersions: [],
  canResolve: false,
  ...overrides,
});

const outline = (overrides: Partial<Outline> = {}): Outline => ({
  topicId: 't1',
  topicCode: 'DT-001',
  topicTitle: 'Hệ thống gợi ý',
  viewerRole: 'member',
  deadline: '2026-09-20',
  lateDeadline: '',
  approvedAt: null,
  approvedBy: null,
  approvedVersionNo: null,
  currentSubmissionId: null,
  canSubmit: true,
  submitBlockedReason: null,
  canReview: false,
  canApprove: false,
  approveBlockedReason: null,
  submissions: [],
  requests: [],
  ...overrides,
});

const service = (
  initial: Outline,
  overrides: Partial<OutlineService> = {},
): OutlineService => ({
  topic: vi.fn(),
  get: vi.fn().mockResolvedValue(initial),
  submit: vi.fn(),
  comment: vi.fn(),
  createRequest: vi.fn(),
  resolveRequest: vi.fn(),
  approve: vi.fn(),
  ...overrides,
});

const pdf = (name = 'de-cuong.pdf', size = 10) =>
  new File([new Uint8Array(size)], name, { type: 'application/pdf' });

it('checks PDF and the 20 MB limit before uploading', () => {
  expect(outlineFileError(null)).toBe('Chọn tệp PDF đề cương.');
  expect(
    outlineFileError(new File(['x'], 'a.docx', { type: 'application/msword' })),
  ).toBe('Tệp không phải PDF.');
  const big = pdf();
  Object.defineProperty(big, 'size', { value: 20 * 1024 * 1024 + 1 });
  expect(outlineFileError(big)).toBe('Tệp vượt quá 20 MB.');
  const exact = pdf();
  Object.defineProperty(exact, 'size', { value: 20 * 1024 * 1024 });
  expect(outlineFileError(exact)).toBeNull();
});

it('lets a member submit a PDF with a note and shows the new version', async () => {
  const after = outline({
    submissions: [version(1)],
    currentSubmissionId: 's1',
  });
  const svc = service(outline(), { submit: vi.fn().mockResolvedValue(after) });
  render(<OutlineSection topicId="t1" service={svc} />);

  fireEvent.click(await screen.findByRole('button', { name: 'Nộp đề cương' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Chọn tệp PDF đề cương.',
  );
  expect(svc.submit).not.toHaveBeenCalled();

  const file = pdf();
  fireEvent.change(screen.getByLabelText('Tệp PDF (tối đa 20 MB)'), {
    target: { files: [file] },
  });
  fireEvent.change(screen.getByLabelText('Ghi chú thay đổi (không bắt buộc)'), {
    target: { value: 'Bản đầu' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Nộp đề cương' }));

  await waitFor(() =>
    expect(svc.submit).toHaveBeenCalledWith('t1', file, 'Bản đầu'),
  );
  expect(await screen.findByText('Đã nộp đề cương.')).toBeInTheDocument();
  const versions = screen.getByRole('list', { name: 'Các phiên bản đề cương' });
  expect(within(versions).getByText('Lần 1')).toBeInTheDocument();
  expect(
    within(versions).getByRole('link', { name: 'Tải de-cuong-v1.pdf (Lần 1)' }),
  ).toHaveAttribute('href', '/api/topics/t1/outline/submissions/s1/file');
});

it('shows students the open requests and that the next version answers all of them', async () => {
  const svc = service(
    outline({
      submissions: [version(1)],
      currentSubmissionId: 's1',
      requests: [request('r1'), request('r2')],
    }),
  );
  render(<OutlineSection topicId="t1" service={svc} />);

  expect(
    await screen.findByText('Yêu cầu chỉnh sửa (2 đang mở)'),
  ).toBeInTheDocument();
  expect(screen.getByText('Nội dung r1')).toBeInTheDocument();
  expect(screen.getByRole('note')).toHaveTextContent(
    'Phiên bản mới xử lý cho cả 2 yêu cầu đang mở',
  );
  // Nhóm không đóng được yêu cầu.
  expect(
    screen.queryByRole('button', { name: 'Xác nhận hoàn tất' }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: /Duyệt/ }),
  ).not.toBeInTheDocument();
});

it('shows why a member cannot submit any more', async () => {
  const svc = service(
    outline({
      canSubmit: false,
      submitBlockedReason: 'Đã hết hạn nộp đề cương (20/09/2026).',
    }),
  );
  render(<OutlineSection topicId="t1" service={svc} />);
  expect(await screen.findByRole('note')).toHaveTextContent(
    'Đã hết hạn nộp đề cương (20/09/2026).',
  );
  expect(
    screen.queryByRole('button', { name: 'Nộp đề cương' }),
  ).not.toBeInTheDocument();
});

it('lets the supervisor raise and resolve requests, and blocks approval while any is open', async () => {
  const open = outline({
    viewerRole: 'supervisor',
    canSubmit: false,
    canReview: true,
    canApprove: false,
    approveBlockedReason: 'Còn 1 yêu cầu chỉnh sửa chưa hoàn tất.',
    submissions: [version(2, { addressedRequestIds: ['r1'] }), version(1)],
    currentSubmissionId: 's2',
    requests: [request('r1', { addressedInVersions: [2], canResolve: true })],
  });
  const resolved = outline({
    ...open,
    canApprove: true,
    approveBlockedReason: null,
    requests: [
      request('r1', {
        status: 'resolved',
        resolvedBy: 'Trần Thị Bình',
        resolvedAt: '2026-09-17T03:00:00Z',
        addressedInVersions: [2],
      }),
    ],
  });
  const created = outline({
    ...open,
    requests: [request('r9', { raisedOnVersionNo: 2 }), ...open.requests],
  });
  const svc = service(open, {
    createRequest: vi.fn().mockResolvedValue(created),
    resolveRequest: vi.fn().mockResolvedValue(resolved),
  });
  render(<OutlineSection topicId="t1" service={svc} />);

  const approve = await screen.findByRole('button', {
    name: 'Duyệt đề cương Lần 2',
  });
  expect(approve).toBeDisabled();
  expect(
    screen.getByText('Còn 1 yêu cầu chỉnh sửa chưa hoàn tất.'),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Nộp đề cương' }),
  ).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Tạo yêu cầu' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Nhập nội dung yêu cầu chỉnh sửa.',
  );
  fireEvent.change(screen.getByLabelText('Yêu cầu chỉnh sửa mới'), {
    target: { value: 'Bổ sung sơ đồ' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Tạo yêu cầu' }));
  await waitFor(() =>
    expect(svc.createRequest).toHaveBeenCalledWith('t1', 'Bổ sung sơ đồ'),
  );
  expect(
    await screen.findByText('Đã tạo yêu cầu chỉnh sửa.'),
  ).toBeInTheDocument();
  // Yêu cầu mới tạo chưa có bản nộp lại nên chưa đóng được.
  expect(
    screen.getByText('Chờ nhóm nộp lại phiên bản mới.'),
  ).toBeInTheDocument();

  const buttons = screen.getAllByRole('button', { name: 'Xác nhận hoàn tất' });
  expect(buttons[0]).toBeDisabled();
  fireEvent.click(buttons[1]);
  await waitFor(() =>
    expect(svc.resolveRequest).toHaveBeenCalledWith('t1', 'r1'),
  );
  expect(await screen.findByText('Đã hoàn tất')).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Duyệt đề cương Lần 2' }),
  ).toBeEnabled();
});

it('approves the current version after confirmation', async () => {
  const ready = outline({
    viewerRole: 'supervisor',
    canSubmit: false,
    canReview: true,
    canApprove: true,
    submissions: [version(1)],
    currentSubmissionId: 's1',
  });
  const approved = outline({
    ...ready,
    canApprove: false,
    approvedAt: '2026-09-18T03:00:00Z',
    approvedBy: 'Trần Thị Bình',
    approvedVersionNo: 1,
  });
  const svc = service(ready, { approve: vi.fn().mockResolvedValue(approved) });
  render(<OutlineSection topicId="t1" service={svc} />);

  fireEvent.click(
    await screen.findByRole('button', { name: 'Duyệt đề cương Lần 1' }),
  );
  const dialog = screen.getByRole('dialog', { name: 'Duyệt đề cương Lần 1?' });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Duyệt Lần 1' }));

  await waitFor(() => expect(svc.approve).toHaveBeenCalledWith('t1', 's1'));
  expect(
    await screen.findByText('Đã duyệt đề cương Lần 1.'),
  ).toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByRole('note')).toHaveTextContent(
    'Trần Thị Bình đã duyệt đề cương Lần 1',
  );
  expect(
    screen.queryByRole('button', { name: /Duyệt đề cương/ }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Tạo yêu cầu' }),
  ).not.toBeInTheDocument();
});

it('shows server rule errors as a toast and keeps the page', async () => {
  const ready = outline({
    viewerRole: 'supervisor',
    canSubmit: false,
    canReview: true,
    canApprove: true,
    submissions: [version(1)],
    currentSubmissionId: 's1',
  });
  const svc = service(ready, {
    approve: vi
      .fn()
      .mockRejectedValue(
        new Error('Chỉ duyệt được phiên bản đề cương mới nhất.'),
      ),
  });
  render(<OutlineSection topicId="t1" service={svc} />);
  fireEvent.click(
    await screen.findByRole('button', { name: 'Duyệt đề cương Lần 1' }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Duyệt Lần 1' }));
  expect(
    await screen.findByText('Chỉ duyệt được phiên bản đề cương mới nhất.'),
  ).toBeInTheDocument();
  expect(screen.getByText('Lần 1')).toBeInTheDocument();
});

it('lets the supervisor comment on a version', async () => {
  const ready = outline({
    viewerRole: 'supervisor',
    canSubmit: false,
    canReview: true,
    submissions: [version(1)],
    currentSubmissionId: 's1',
  });
  const commented = outline({
    ...ready,
    submissions: [
      version(1, {
        reviewComment: 'Rõ ràng',
        reviewedBy: 'Trần Thị Bình',
        reviewedAt: '2026-09-17T03:00:00Z',
      }),
    ],
  });
  const svc = service(ready, { comment: vi.fn().mockResolvedValue(commented) });
  render(<OutlineSection topicId="t1" service={svc} />);

  fireEvent.click(await screen.findByRole('button', { name: 'Nhận xét' }));
  fireEvent.change(screen.getByLabelText('Nhận xét Lần 1'), {
    target: { value: 'Rõ ràng' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu nhận xét' }));
  await waitFor(() =>
    expect(svc.comment).toHaveBeenCalledWith('t1', 's1', 'Rõ ràng'),
  );
  expect(await screen.findByText('Rõ ràng')).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Sửa nhận xét' }),
  ).toBeInTheDocument();
});

it('gives staff a read-only view', async () => {
  const svc = service(
    outline({
      viewerRole: 'staff',
      canSubmit: false,
      submissions: [version(1)],
      currentSubmissionId: 's1',
      requests: [request('r1')],
    }),
  );
  render(<OutlineSection topicId="t1" service={svc} />);
  expect(await screen.findByText('Lần 1')).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Nộp đề cương' }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Tạo yêu cầu' }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Nhận xét' }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Xác nhận hoàn tất' }),
  ).not.toBeInTheDocument();
});

it('names whose turn it is', () => {
  expect(outlineStage(outline()).text).toBe('Chưa nộp');
  expect(outlineStage(outline({ submissions: [version(1)] })).text).toBe(
    'Chờ GVHD xem Lần 1',
  );
  expect(
    outlineStage(
      outline({ submissions: [version(1)], requests: [request('r1')] }),
    ).text,
  ).toBe('Chờ nhóm sửa · 1 yêu cầu mở');
  // Đã nộp lại sau yêu cầu: tới lượt GVHD dù yêu cầu còn mở.
  expect(
    outlineStage(
      outline({
        submissions: [version(2), version(1)],
        requests: [request('r1')],
      }),
    ).text,
  ).toBe('Chờ GVHD xem Lần 2');
  expect(
    outlineStage(
      outline({
        submissions: [version(1)],
        approvedAt: '2026-09-18T03:00:00Z',
        approvedVersionNo: 1,
      }),
    ).chip,
  ).toBe('app-chip-active');
});
