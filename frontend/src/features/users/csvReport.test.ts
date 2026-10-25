import { expect, it } from 'vitest';
import type { UserImportRow } from '@/types/user';
import { buildErrorReportCsv, escapeCsvCell } from './csvReport';

const row = (overrides: Partial<UserImportRow>): UserImportRow => ({
  rowNumber: 2,
  userCode: 'A1',
  fullName: 'An',
  email: 'a@x.vn',
  role: 'Student',
  dateOfBirth: null,
  className: null,
  department: null,
  academicTitle: null,
  errors: [],
  ...overrides,
});

it('neutralises formula injection for every leading character', () => {
  for (const lead of ['=', '+', '-', '@', '\t']) {
    expect(escapeCsvCell(`${lead}SUM(A1)`).replace(/^"/, '')).toMatch(/^'/);
  }
  expect(escapeCsvCell('\rcmd')).toBe('"\'\rcmd"');
});

it('quotes cells containing commas and quotes', () => {
  expect(escapeCsvCell('a,"b"')).toBe('"a,""b"""');
  expect(escapeCsvCell('bình thường')).toBe('bình thường');
});

it('writes only error rows with escaped values', () => {
  const csv = buildErrorReportCsv([
    row({ rowNumber: 2 }),
    row({
      rowNumber: 3,
      fullName: '=HYPERLINK("http://x")',
      errors: ['Email không hợp lệ.', 'Thiếu lớp.'],
    }),
  ]);
  const lines = csv.trim().split('\r\n');
  expect(lines).toHaveLength(2);
  expect(lines[1]).toContain('"\'=HYPERLINK(""http://x"")"');
  expect(lines[1]).toContain('Email không hợp lệ.; Thiếu lớp.');
});

it('handles null and undefined cells', () => {
  expect(escapeCsvCell(null)).toBe('');
  expect(escapeCsvCell(undefined)).toBe('');
});

it('escapes an errors column that starts with a formula character', () => {
  const csv = buildErrorReportCsv([row({ errors: ['=1+1'] })]);
  expect(csv.trim().split('\r\n')[1].endsWith(",'=1+1")).toBe(true);
});
