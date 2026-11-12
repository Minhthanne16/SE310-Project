import type { SubmissionKindState } from '@/types/submission';

// PDR-039/040. Backend kiểm tra lại nội dung tệp; phần này chỉ để báo sớm.
export const MAX_SUBMISSION_BYTES = 20 * 1024 * 1024;
export const MAX_NOTE_LENGTH = 500;
export const NOT_PDF_MESSAGE = 'Tệp không phải PDF. Chỉ nhận tệp PDF.';
export const TOO_LARGE_MESSAGE =
  'Tệp vượt quá 20 MB. Giảm dung lượng tệp PDF rồi nộp lại.';
export const NOTE_REQUIRED_MESSAGE =
  'Nhập ghi chú thay đổi cho bản báo cáo cuối kỳ.';

export function fileError(
  file: Pick<File, 'name' | 'size' | 'type'> | null,
  maxBytes = MAX_SUBMISSION_BYTES,
): string | null {
  if (!file) return 'Chọn tệp PDF để nộp.';
  const isPdf =
    file.name.toLowerCase().endsWith('.pdf') &&
    (!file.type || file.type === 'application/pdf');
  if (!isPdf) return NOT_PDF_MESSAGE;
  if (file.size === 0) return 'Tệp rỗng. Chọn tệp PDF khác.';
  if (file.size > maxBytes) return TOO_LARGE_MESSAGE;
  return null;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}

// yyyy-MM-dd → dd/MM/yyyy.
export function formatDay(iso: string): string {
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d}/${m}/${y}` : 'chưa đặt';
}

const vnDateTime = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

export const formatSubmittedAt = (iso: string) =>
  vnDateTime.format(new Date(iso));

// Một câu về hạn của mốc, hiển thị cho mọi người xem (PDR-041).
export function deadlineText(kind: SubmissionKindState): string {
  const normal = `Hạn nộp: hết ngày ${formatDay(kind.deadline)}`;
  if (kind.lateDeadline)
    return `${normal}. Cho nộp trễ đến hết ngày ${formatDay(kind.lateDeadline)}, bài nộp trễ có nhãn “Nộp trễ”.`;
  return `${normal}. Mốc này không cho nộp trễ.`;
}

export const WINDOW_LABELS: Record<SubmissionKindState['window'], string> = {
  onTime: 'Đang nhận bài',
  late: 'Đang nhận bài nộp trễ',
  closed: 'Đã hết hạn nộp',
};
