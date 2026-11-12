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
  downloadUrl: '/api/submissions/s1/file',
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
  versions: [],
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
): SubmissionService => ({
  list: vi.fn().mockResolvedValue(initial),
  submit,
});

const pdf = (name = 'bao-cao.pdf', size = 1000, type = 'application/pdf') => {
  const file = new File(['%PDF-1.7'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

const section = async (name: string) =>
  within(await screen.findByRole('region', { name }));

it('rejects a non-PDF or oversized file before any upload', async () => {
  const submit = vi.fn();
  render(
    <SubmissionPanel topicId="t1" service={service(data([kind()]), submit)} />,
  );
  const midterm = await section('Báo cáo giữa kỳ');
  const input = midterm.getByLabelText('Tệp báo cáo (PDF, tối đa 20 MB)');

  fireEvent.change(input, {
    target: { files: [pdf('bao-cao.docx', 1000, 'application/msword')] },
  });
  expect(midterm.getByRole('alert')).toHaveTextContent(
    'Tệp không phải PDF. Chỉ nhận tệp PDF.',
  );
  expect(input).toHaveAttribute('aria-invalid', 'true');

  fireEvent.change(input, {
    target: { files: [pdf('to.pdf', 20 * 1024 * 1024 + 1)] },
  });
  expect(midterm.getByRole('alert')).toHaveTextContent('Tệp vượt quá 20 MB');
  fireEvent.click(midterm.getByRole('button', { name: /Nộp báo cáo giữa kỳ/ }));
  expect(submit).not.toHaveBeenCalled();
});

it('submits a valid PDF and shows the new version with its late label', async () => {
  const after = data([
    kind({
      window: 'late',
      versions: [
        version({ id: 's2', version: 2, isLate: true, note: 'Sửa chương 2' }),
        version({ isLatest: false }),
      ],
    }),
  ]);
  const submit = vi.fn().mockResolvedValue(after);
  render(
    <SubmissionPanel
      topicId="t1"
      service={service(
        data([kind({ window: 'late', versions: [version()] })]),
        submit,
      )}
    />,
  );
  const midterm = await section('Báo cáo giữa kỳ');
  expect(
    midterm.getByText(/Bài nộp bây giờ sẽ được gắn nhãn “Nộp trễ”/),
  ).toBeInTheDocument();

  const file = pdf();
  fireEvent.change(midterm.getByLabelText(/Tệp báo cáo/), {
    target: { files: [file] },
  });
  fireEvent.change(midterm.getByLabelText(/Ghi chú thay đổi/), {
    target: { value: 'Sửa chương 2' },
  });
  fireEvent.click(
    midterm.getByRole('button', { name: /Nộp bản mới báo cáo giữa kỳ/ }),
  );

  await waitFor(() =>
    expect(submit).toHaveBeenCalledWith('t1', 'midterm', file, 'Sửa chương 2'),
  );
  expect(await midterm.findByRole('status')).toHaveTextContent(
    'Đã nộp bản 2 (nộp trễ).',
  );
  const items = midterm.getAllByRole('listitem');
  expect(items).toHaveLength(2);
  expect(items[0]).toHaveTextContent('Bản 2');
  expect(items[0]).toHaveTextContent('Mới nhất');
  expect(items[0]).toHaveTextContent('Nộp trễ');
  expect(items[1]).toHaveTextContent('Bản 1');
  expect(
    midterm.getByRole('link', { name: 'Tải bản 1 Báo cáo giữa kỳ' }),
  ).toHaveAttribute('href', '/api/submissions/s1/file');
});

it('requires a change note for the final report', async () => {
  const submit = vi.fn();
  render(
    <SubmissionPanel
      topicId="t1"
      service={service(data([finalKind()]), submit)}
    />,
  );
  const final = await section('Báo cáo cuối kỳ');
  fireEvent.change(final.getByLabelText(/Tệp báo cáo/), {
    target: { files: [pdf()] },
  });
  fireEvent.click(final.getByRole('button', { name: /Nộp báo cáo cuối kỳ/ }));

  expect(final.getByRole('alert')).toHaveTextContent(
    'Nhập ghi chú thay đổi cho bản báo cáo cuối kỳ.',
  );
  expect(submit).not.toHaveBeenCalled();
});

it('keeps the form and shows the server reason when the upload fails', async () => {
  const submit = vi
    .fn()
    .mockRejectedValue(
      new ApiError('Tệp không phải PDF hợp lệ. Chỉ nhận tệp PDF.', 400),
    );
  render(
    <SubmissionPanel topicId="t1" service={service(data([kind()]), submit)} />,
  );
  const midterm = await section('Báo cáo giữa kỳ');
  fireEvent.change(midterm.getByLabelText(/Tệp báo cáo/), {
    target: { files: [pdf('gia.pdf')] },
  });
  fireEvent.click(midterm.getByRole('button', { name: /Nộp báo cáo giữa kỳ/ }));

  expect(await midterm.findByRole('alert')).toHaveTextContent(
    'Tệp không phải PDF hợp lệ',
  );
  expect(midterm.queryByRole('status')).not.toBeInTheDocument();
  expect(midterm.getByText('Chưa có bản nào được nộp.')).toBeInTheDocument();
});

it('shows versions read-only with the reason when submission is closed', async () => {
  render(
    <SubmissionPanel
      topicId="t1"
      service={service(
        data([
          kind({
            window: 'closed',
            canSubmit: false,
            blockedReason:
              'Đã hết hạn nộp trễ báo cáo giữa kỳ (hết ngày 30/09/2026).',
            versions: [version()],
          }),
        ]),
      )}
    />,
  );
  const midterm = await section('Báo cáo giữa kỳ');

  expect(midterm.getByText('Đã hết hạn nộp')).toBeInTheDocument();
  expect(
    midterm.getByText(/Đã hết hạn nộp trễ báo cáo giữa kỳ/),
  ).toBeInTheDocument();
  expect(midterm.queryByLabelText(/Tệp báo cáo/)).not.toBeInTheDocument();
  expect(midterm.getByRole('link', { name: /Tải bản 1/ })).toBeInTheDocument();
});

it('offers a retry when the list cannot be loaded', async () => {
  const list = vi
    .fn()
    .mockRejectedValueOnce(new ApiError('Không tìm thấy đề tài.', 404))
    .mockResolvedValueOnce(data([kind()]));
  render(<SubmissionPanel topicId="t1" service={{ list, submit: vi.fn() }} />);

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Không tìm thấy đề tài.',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
  expect(
    await screen.findByRole('region', { name: 'Báo cáo giữa kỳ' }),
  ).toBeInTheDocument();
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
