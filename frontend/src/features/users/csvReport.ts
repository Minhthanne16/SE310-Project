import type { UserImportRow } from '@/types/user';

// Chặn CSV formula injection (PDR-004): ô bắt đầu bằng = + - @ hoặc tab/CR
// bị Excel/Sheets hiểu là công thức, nên thêm dấu ' phía trước.
export function escapeCsvCell(value: string | null | undefined): string {
  let text = value ?? '';
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const HEADER = [
  'row_number',
  'user_code',
  'full_name',
  'email',
  'role',
  'date_of_birth',
  'class_name',
  'department',
  'academic_title',
  'errors',
];

// Báo cáo lỗi nhập CSV: chỉ gồm các dòng bị bỏ qua.
export function buildErrorReportCsv(rows: UserImportRow[]): string {
  const lines = rows
    .filter((row) => row.errors.length > 0)
    .map((row) =>
      [
        String(row.rowNumber),
        row.userCode,
        row.fullName,
        row.email,
        row.role,
        row.dateOfBirth,
        row.className,
        row.department,
        row.academicTitle,
        row.errors.join('; '),
      ]
        .map(escapeCsvCell)
        .join(','),
    );
  return [HEADER.join(','), ...lines].join('\r\n') + '\r\n';
}

// Tải báo cáo về máy. BOM giúp Excel đọc đúng tiếng Việt UTF-8.
export function downloadErrorReport(rows: UserImportRow[]): void {
  const blob = new Blob(['﻿', buildErrorReportCsv(rows)], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'bao-cao-loi-nhap-nguoi-dung.csv';
  link.click();
  URL.revokeObjectURL(url);
}
