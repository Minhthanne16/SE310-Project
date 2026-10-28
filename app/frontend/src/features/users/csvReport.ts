import { downloadCsv, escapeCsvCell } from '@/lib/csv';
import type { UserImportRow } from '@/types/user';

export { escapeCsvCell };

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

// Tải báo cáo về máy.
export function downloadErrorReport(rows: UserImportRow[]): void {
  downloadCsv('bao-cao-loi-nhap-nguoi-dung.csv', buildErrorReportCsv(rows));
}
