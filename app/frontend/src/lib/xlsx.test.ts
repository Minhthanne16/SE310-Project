import { describe, expect, it } from 'vitest';
import {
  codesFromColumn,
  looksLikeCodeOrEmail,
  parseCsvFirstColumn,
  safeCell,
  safeSheetName,
  cellToText,
  xlsxToCsvFile,
  slugify,
} from '@/lib/xlsx';

describe('safeCell', () => {
  it('prefixes formula-looking text with an apostrophe', () => {
    expect(safeCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(safeCell('+1')).toBe("'+1");
    expect(safeCell('-1')).toBe("'-1");
    expect(safeCell('@cmd')).toBe("'@cmd");
    expect(safeCell('\tx')).toBe("'\tx");
    expect(safeCell('Bình thường')).toBe('Bình thường');
    expect(safeCell('')).toBe('');
  });
});

describe('slugify and sheet names', () => {
  it('removes diacritics and joins words with dashes', () => {
    expect(slugify('Văn bằng 1 · HK1 2026–2027')).toBe(
      'van-bang-1-hk1-2026-2027',
    );
    expect(slugify('Đợt Đặc biệt')).toBe('dot-dac-biet');
  });

  it('keeps sheet names valid for Excel', () => {
    expect(safeSheetName('a/b:c')).toBe('a b c');
    expect(safeSheetName('x'.repeat(40))).toHaveLength(31);
    expect(safeSheetName('   ')).toBe('Danh sách');
  });
});

describe('reading codes from a spreadsheet column', () => {
  it('recognises codes and emails but not header text', () => {
    expect(looksLikeCodeOrEmail('22520001')).toBe(true);
    expect(looksLikeCodeOrEmail('CB101')).toBe(true);
    expect(looksLikeCodeOrEmail('an@truong.edu.vn')).toBe(true);
    expect(looksLikeCodeOrEmail('MSSV')).toBe(false);
    expect(looksLikeCodeOrEmail('Mã số')).toBe(false);
    expect(looksLikeCodeOrEmail('Họ tên')).toBe(false);
  });

  it('skips a header row and blank cells, keeps every data row', () => {
    expect(codesFromColumn(['MSSV', '22520001', '', ' 22520002 '])).toEqual([
      '22520001',
      '22520002',
    ]);
    expect(codesFromColumn(['22520001', 'an@x.vn'])).toEqual([
      '22520001',
      'an@x.vn',
    ]);
    expect(codesFromColumn([])).toEqual([]);
  });

  it('takes only the first CSV column, with quotes, BOM and both separators', () => {
    const csv = '﻿MSSV,Họ tên\r\n22520001,"Nguyễn, Văn An"\n"22520002";x\n';
    expect(parseCsvFirstColumn(csv)).toEqual(['MSSV', '22520001', '22520002']);
    expect(parseCsvFirstColumn('a\nb')).toEqual(['a', 'b']);
    expect(parseCsvFirstColumn('"x ""q"" y",z')).toEqual(['x "q" y']);
    expect(parseCsvFirstColumn('')).toEqual([]);
  });
});

describe('xlsx round trip', () => {
  const fileLike = (name: string, buffer: ArrayBuffer) =>
    ({ name, arrayBuffer: async () => buffer }) as unknown as File;

  it('writes formula-looking cells as text and reads the first column back', async () => {
    const { buildXlsxBuffer, readCodesFromFile } = await import('@/lib/xlsx');
    const buffer = await buildXlsxBuffer({
      sheetName: 'Đăng ký',
      header: ['MSSV', 'Họ tên'],
      rows: [
        ['22520001', '=HYPERLINK("http://x")'],
        ['an@truong.edu.vn', '+1'],
      ],
    });
    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const sheet = workbook.worksheets[0];
    expect(sheet.name).toBe('Đăng ký');
    expect(sheet.getRow(2).getCell(2).value).toBe(`'=HYPERLINK("http://x")`);
    expect(sheet.getRow(3).getCell(2).value).toBe("'+1");

    expect(await readCodesFromFile(fileLike('ds.xlsx', buffer))).toEqual([
      '22520001',
      'an@truong.edu.vn',
    ]);
    await expect(readCodesFromFile(fileLike('ds.txt', buffer))).rejects.toThrow(
      'Chỉ nhận tệp .xlsx hoặc .csv.',
    );
  });
});

// jsdom chưa có File.text().
const readAsText = (file: File) =>
  new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsText(file);
  });

describe('xlsxToCsvFile', () => {
  it('turns the first sheet into CSV keeping row numbers, codes, dates and passwords', async () => {
    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Người dùng');
    sheet.addRow([
      'user_code',
      'full_name',
      'role',
      'date_of_birth',
      'password',
    ]);
    sheet.addRow([
      22520001,
      'Nguyễn Văn An',
      'Student',
      new Date(Date.UTC(2004, 2, 12)),
      null,
    ]);
    sheet.addRow([]);
    sheet.addRow(['GV0001', 'Trần, Thị "Bình"', 'Lecturer', null, '-MatKhau1']);
    sheet.addRow([
      'GV0002',
      { richText: [{ text: 'Lê ' }, { text: 'Cường' }] },
      'Lecturer',
      null,
      { formula: '"Mk"&"12345"', result: 'Mk12345' },
    ]);
    const buffer = (await workbook.xlsx.writeBuffer()) as ArrayBuffer;

    const csv = await xlsxToCsvFile(new File([buffer], 'Danh sach.xlsx'));

    expect(csv.name).toBe('Danh sach.csv');
    expect(await readAsText(csv)).toBe(
      [
        'user_code,full_name,role,date_of_birth,password',
        '22520001,Nguyễn Văn An,Student,2004-03-12,',
        ',,,,',
        'GV0001,"Trần, Thị ""Bình""",Lecturer,,-MatKhau1',
        'GV0002,Lê Cường,Lecturer,,Mk12345',
      ].join('\r\n') + '\r\n',
    );
  });

  it('rejects a file that is not a real Excel workbook', async () => {
    await expect(
      xlsxToCsvFile(new File(['khong phai excel'], 'ds.xlsx')),
    ).rejects.toThrow('Không đọc được tệp Excel "ds.xlsx"');
  });
});

it('formats cell values like the user sees them', () => {
  expect(cellToText(12345678901)).toBe('12345678901');
  expect(cellToText(7.5)).toBe('7.5');
  expect(cellToText(true)).toBe('true');
  expect(cellToText(undefined)).toBe('');
  expect(cellToText({ text: 'liên kết', hyperlink: 'http://x' })).toBe(
    'liên kết',
  );
});
