import { neutralizeFormula } from '@/lib/csv';

// Bảng xuất ra tệp .xlsx: một sheet, hàng đầu là tiêu đề.
export interface XlsxTable {
  sheetName: string;
  header: string[];
  rows: string[][];
}

export const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// Tên sheet Excel: tối đa 31 ký tự, không chứa [ ] : * ? / \.
export function safeSheetName(name: string): string {
  const cleaned = name.replace(/[[\]:*?/\\]/g, ' ').trim();
  return (cleaned || 'Danh sách').slice(0, 31);
}

// Tên tệp từ tên đợt: bỏ dấu, chữ thường, nối bằng gạch ngang.
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Ô văn bản an toàn: chuỗi bắt đầu bằng = + - @ (hoặc tab/CR) thêm dấu ' phía
// trước và luôn ghi là chuỗi, không bao giờ là công thức.
export const safeCell = neutralizeFormula;

// exceljs chỉ tải khi cần (import động) để không nằm trong gói chính.
export async function buildXlsxBuffer(table: XlsxTable): Promise<ArrayBuffer> {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(safeSheetName(table.sheetName));
  const header = sheet.addRow(table.header.map(safeCell));
  header.font = { bold: true };
  for (const row of table.rows) sheet.addRow(row.map(safeCell));
  sheet.columns.forEach((column, index) => {
    const longest = Math.max(
      table.header[index]?.length ?? 0,
      ...table.rows.map((r) => (r[index] ?? '').length),
    );
    column.width = Math.min(60, Math.max(10, longest + 2));
  });
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  return (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
}

export async function downloadXlsx(
  fileName: string,
  table: XlsxTable,
): Promise<void> {
  const blob = new Blob([await buildXlsxBuffer(table)], { type: XLSX_MIME });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

// ---- Đọc cột đầu tiên của tệp .xlsx / .csv (nhập mã hoặc email) ----

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Mã người dùng: không có khoảng trắng và có ít nhất một chữ số (22520001, CB101).
const CODE = /^(?=.*\d)[A-Za-z0-9._-]+$/;

export const looksLikeCodeOrEmail = (value: string): boolean =>
  EMAIL.test(value) || CODE.test(value);

// Cột đầu tiên của văn bản CSV (hỗ trợ ngoặc kép, dấu , hoặc ;, BOM).
export function parseCsvFirstColumn(text: string): string[] {
  const clean = text.replace(/^\uFEFF/, '');
  const values: string[] = [];
  let cell = '';
  let column = 0;
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') {
        if (column === 0) cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else if (column === 0) cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',' || ch === ';') {
      if (column === 0) values.push(cell);
      cell = '';
      column++;
    } else if (ch === '\n') {
      if (column === 0) values.push(cell);
      cell = '';
      column = 0;
    } else if (ch !== '\r' && column === 0) cell += ch;
  }
  if (column === 0 && cell !== '') values.push(cell);
  return values;
}

// Bỏ ô trống và dòng tiêu đề (ô đầu không giống mã hay email).
export function codesFromColumn(values: string[]): string[] {
  const cells = values.map((v) => v.trim()).filter((v) => v.length > 0);
  if (cells.length > 0 && !looksLikeCodeOrEmail(cells[0])) cells.shift();
  return cells;
}

// Blob.text()/arrayBuffer() có ở trình duyệt hiện đại; FileReader cho môi trường
// còn thiếu (ví dụ jsdom).
function readFile<T extends string | ArrayBuffer>(
  file: File,
  start: (reader: FileReader) => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as T);
    reader.onerror = () =>
      reject(reader.error ?? new Error('Không đọc được tệp.'));
    start(reader);
  });
}

const readText = (file: File): Promise<string> =>
  typeof file.text === 'function'
    ? file.text()
    : readFile<string>(file, (r) => r.readAsText(file));

const readBuffer = (file: File): Promise<ArrayBuffer> =>
  typeof file.arrayBuffer === 'function'
    ? file.arrayBuffer()
    : readFile<ArrayBuffer>(file, (r) => r.readAsArrayBuffer(file));

export async function readCodesFromFile(file: File): Promise<string[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.csv'))
    return codesFromColumn(parseCsvFirstColumn(await readText(file)));
  if (!name.endsWith('.xlsx')) throw new Error('Chỉ nhận tệp .xlsx hoặc .csv.');
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await readBuffer(file));
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];
  const values: string[] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    values.push(row.getCell(1).text ?? '');
  });
  return codesFromColumn(values);
}
