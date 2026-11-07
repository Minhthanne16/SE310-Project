'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ApiError } from '@/api/request';
import { Download, FileText, FileUp, X } from 'lucide-react';
import { buildCsv, downloadCsv } from '@/lib/csv';
import { xlsxToCsvFile } from '@/lib/xlsx';
import { downloadErrorReport } from '@/features/users/csvReport';
import type { UserService } from '@/features/users/services/userService';
import type { UserImportReport } from '@/types/user';
import { useDialogFocus } from '@/lib/useDialogFocus';

interface UserImportDialogProps {
  userService: UserService;
  onClose: () => void;
  // Gọi sau khi đã nhập ít nhất một dòng; trang đóng hộp thoại và tải lại danh sách.
  onImported: (report: UserImportReport, fileName: string) => void;
}

type Step = 'choose' | 'preview' | 'done';
// Giáo vụ chọn định dạng trước khi chọn tệp; Excel được đổi sang CSV ở trình duyệt
// rồi gửi qua cùng API nhập CSV (PDR-055), nên quy tắc và báo cáo giống hệt.
type ImportFormat = 'xlsx' | 'csv';

const FORMAT: Record<
  ImportFormat,
  { label: string; ext: string; accept: string; inputLabel: string }
> = {
  xlsx: {
    label: 'Excel (.xlsx)',
    ext: '.xlsx',
    accept:
      '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    inputLabel: 'Tệp Excel',
  },
  csv: {
    label: 'CSV (.csv)',
    ext: '.csv',
    accept: '.csv,text/csv',
    inputLabel: 'Tệp CSV',
  },
};

// Giới hạn theo PDR-004 (cũng được backend kiểm tra lại).
const MAX_BYTES = 2 * 1024 * 1024;

const COLUMNS: Array<{
  key: string;
  need: 'must' | 'role' | 'opt';
  label: string;
  desc: string;
}> = [
  {
    key: 'user_code',
    need: 'must',
    label: 'Bắt buộc',
    desc: 'Mã người dùng: MSSV, mã giảng viên hoặc mã giáo vụ; không trùng',
  },
  { key: 'full_name', need: 'must', label: 'Bắt buộc', desc: 'Họ và tên' },
  {
    key: 'email',
    need: 'must',
    label: 'Bắt buộc',
    desc: 'Email trường cấp; không trùng',
  },
  {
    key: 'role',
    need: 'must',
    label: 'Bắt buộc',
    desc: 'Student, Lecturer hoặc AcademicAffairs',
  },
  {
    key: 'date_of_birth',
    need: 'opt',
    label: 'Tùy chọn',
    desc: 'dd/mm/yyyy',
  },
  {
    key: 'class_name',
    need: 'role',
    label: 'SV',
    desc: 'Lớp sinh hoạt, bắt buộc với sinh viên',
  },
  {
    key: 'department',
    need: 'role',
    label: 'GV',
    desc: 'Bộ môn, bắt buộc với giảng viên',
  },
  {
    key: 'academic_title',
    need: 'opt',
    label: 'Tùy chọn',
    desc: 'Học hàm, học vị của giảng viên (TS., ThS.…)',
  },
  {
    key: 'password',
    need: 'role',
    label: 'GV, Giáo vụ',
    desc: 'Mật khẩu đăng nhập, bắt buộc với giảng viên và giáo vụ (8–64 ký tự, có chữ và số, khác mã); để trống với sinh viên. Xóa tệp sau khi nhập.',
  },
];

const STEP_LABEL: Record<Step, string> = {
  choose: 'Bước 1/2 · Chọn file',
  preview: 'Bước 2/2 · Kiểm tra trước khi nhập',
  done: 'Hoàn tất nhập tệp',
};

// Dòng chỉ lỗi vì mã/email đã có trong hệ thống: tính là "Đã có, bỏ qua".
const isExistingRow = (errors: string[]) =>
  errors.length > 0 && errors.every((e) => /đã tồn tại/i.test(e));

function downloadTemplate() {
  downloadCsv(
    'mau-nhap-nguoi-dung.csv',
    buildCsv(
      COLUMNS.map((c) => c.key),
      [
        [
          '22520123',
          'Nguyễn Văn A',
          '22520123@truong.edu.vn',
          'Student',
          '12/03/2004',
          'KTPM2022.1',
          '',
          '',
          '',
        ],
      ],
    ),
  );
}

interface Problem {
  title: string;
  hint?: string;
}

// Nhập Excel/CSV hai bước: chọn định dạng và tệp (tự kiểm tra ngay) → xem trước (từng dòng, không
// ghi) → nhập các dòng hợp lệ, bỏ qua dòng lỗi và cho tải báo cáo lỗi.
export const UserImportDialog: React.FC<UserImportDialogProps> = ({
  userService,
  onClose,
  onImported,
}) => {
  const [step, setStep] = useState<Step>('choose');
  const [format, setFormat] = useState<ImportFormat>('csv');
  // Tệp CSV gửi lên máy chủ (Excel đã đổi sang CSV) và tên tệp người dùng chọn.
  const [file, setFile] = useState<File | null>(null);
  const [sourceName, setSourceName] = useState('');
  const [report, setReport] = useState<UserImportReport | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const busyRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chooseRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useDialogFocus<HTMLDivElement>({
    initialFocusRef: chooseRef,
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busyRef.current) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const run = async (action: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setProblem(null);
    try {
      await action();
    } catch (err: unknown) {
      setProblem({
        title:
          err instanceof Error && err.message
            ? err.message
            : 'Không xử lý được tệp. Thử lại sau.',
      });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const preview = (picked: File) =>
    run(async () => {
      setReport(await userService.importPreview(picked));
      setStep('preview');
    });

  const pickFile = (picked: File | null | undefined) => {
    setFile(null);
    setProblem(null);
    if (!picked) return;
    if (!picked.name.toLowerCase().endsWith(FORMAT[format].ext)) {
      setProblem(
        format === 'csv'
          ? {
              title: `Tệp "${picked.name}" không phải tệp CSV nên không đọc được.`,
              hint: 'Chọn định dạng Excel (.xlsx) ở trên để nhập thẳng tệp Excel, hoặc lưu tệp dạng CSV UTF-8 (.csv) rồi chọn lại.',
            }
          : {
              title: `Tệp "${picked.name}" không phải tệp Excel .xlsx.`,
              hint: 'Chọn định dạng CSV (.csv) ở trên nếu tệp là CSV, hoặc lưu tệp dạng Sổ làm việc Excel (.xlsx) rồi chọn lại.',
            },
      );
      return;
    }
    if (picked.size > MAX_BYTES) {
      setProblem({
        title: `Tệp "${picked.name}" vượt quá 2 MB.`,
        hint: 'Hãy chia nhỏ tệp rồi nhập lại.',
      });
      return;
    }
    setSourceName(picked.name);
    if (format === 'csv') {
      setFile(picked);
      void preview(picked);
      return;
    }
    void run(async () => {
      const converted = await xlsxToCsvFile(picked);
      setFile(converted);
      setReport(await userService.importPreview(converted));
      setStep('preview');
    });
  };

  const commit = () =>
    run(async () => {
      if (!file) return;
      let result: UserImportReport;
      try {
        result = await userService.importCommit(file);
      } catch (err: unknown) {
        // 409: mã/email vừa bị tạo trùng, không dòng nào được lưu. Xem trước
        // lại để bỏ các dòng "Hợp lệ" đã cũ, vẫn giữ thông báo của backend.
        if (err instanceof ApiError && err.status === 409) {
          try {
            setReport(await userService.importPreview(file));
          } catch {
            // Giữ báo cáo cũ; thông báo 409 vẫn hiển thị bên dưới.
          }
        }
        throw err;
      }
      setReport(result);
      setStep('done');
      // Không dòng nào được nhập thì không báo thành công.
      if (result.importedRows > 0) onImported(result, sourceName || file.name);
    });

  const backToChoose = () => {
    setStep('choose');
    setFile(null);
    setReport(null);
    setProblem(null);
  };

  const rows = report?.rows ?? [];
  const existingCount = rows.filter((r) => isExistingRow(r.errors)).length;
  const badRows = rows.filter(
    (r) => r.errors.length > 0 && !isExistingRow(r.errors),
  );
  const errorRows = rows.filter((r) => r.errors.length > 0);

  return (
    <div className="usr-overlay usr-overlay-center">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-title"
        className="usr-modal usr-modal-lg"
      >
        <div className="usr-dialog-head">
          <div className="usr-dialog-title">
            <h2 id="import-title">Nhập người dùng từ Excel hoặc CSV</h2>
            <span style={{ fontWeight: 600 }}>{STEP_LABEL[step]}</span>
          </div>
          <button
            type="button"
            className="usr-close"
            aria-label="Đóng"
            onClick={onClose}
            disabled={busy}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        {problem && (
          <div
            role="alert"
            className={`usr-alert${problem.hint ? ' usr-alert-file' : ''}`}
          >
            {problem.hint ? <b>{problem.title}</b> : problem.title}
            {problem.hint && <span>{problem.hint}</span>}
          </div>
        )}

        {step === 'choose' && (
          <>
            <div role="group" aria-label="Định dạng tệp" className="usr-format">
              <span className="usr-format-label">Định dạng tệp</span>
              {(['xlsx', 'csv'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={format === f}
                  className="usr-role-btn"
                  disabled={busy}
                  onClick={() => {
                    setFormat(f);
                    setProblem(null);
                  }}
                >
                  {FORMAT[f].label}
                </button>
              ))}
            </div>
            <div
              className={`usr-drop${problem?.hint ? ' is-bad' : ''}${dragging ? ' is-over' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                if (busyRef.current) return;
                pickFile(e.dataTransfer.files?.[0]);
              }}
            >
              <FileUp size={32} strokeWidth={1.8} aria-hidden="true" />
              <span className="usr-drop-title">
                Kéo thả file {FORMAT[format].ext} vào đây
              </span>
              <span className="usr-drop-hint">
                {format === 'csv'
                  ? 'UTF-8, dòng đầu là tên cột, tối đa 2.000 dòng mỗi lần'
                  : 'Đọc trang tính đầu tiên, dòng đầu là tên cột, tối đa 2.000 dòng mỗi lần'}
              </span>
              <input
                ref={fileInputRef}
                id="import-file"
                type="file"
                className="usr-visually-hidden"
                accept={FORMAT[format].accept}
                aria-label={FORMAT[format].inputLabel}
                tabIndex={-1}
                onChange={(e) => {
                  pickFile(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
              <button
                ref={chooseRef}
                type="button"
                className="usr-btn usr-btn-primary"
                disabled={busy}
                onClick={() => fileInputRef.current?.click()}
              >
                Chọn file
              </button>
            </div>

            <div className="usr-section">
              <div className="usr-section-head">
                <span className="usr-section-title">Cột trong file</span>
                <button
                  type="button"
                  className="usr-text-link"
                  onClick={downloadTemplate}
                >
                  <Download size={15} aria-hidden="true" />
                  Tải file mẫu
                </button>
              </div>
              <div className="usr-cols">
                {COLUMNS.map((c) => (
                  <div key={c.key} className="usr-col">
                    <span className="usr-col-key">{c.key}</span>
                    <span
                      className={`usr-col-req${c.need === 'must' ? ' usr-col-req-must' : ''}${c.need === 'role' ? ' usr-col-req-role' : ''}`}
                    >
                      {c.label}
                    </span>
                    <span className="usr-col-desc">{c.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {step !== 'choose' && report && (
          <>
            {step === 'done' && (
              <p className="usr-note" role="status">
                {report.importedRows === 0
                  ? `Không có dòng nào được nhập, bỏ qua ${report.errorRows} dòng lỗi.`
                  : `Đã nhập ${report.importedRows} dòng hợp lệ, bỏ qua ${report.errorRows} dòng lỗi.`}
              </p>
            )}

            <div className="usr-file">
              <FileText size={22} strokeWidth={1.8} aria-hidden="true" />
              <span className="usr-file-info">
                <span className="usr-file-name">{file?.name}</span>
                <span className="usr-file-meta">
                  {report.totalRows} dòng dữ liệu
                  {file
                    ? ` · ${Math.max(1, Math.round(file.size / 1024))} KB`
                    : ''}
                </span>
              </span>
              {step === 'preview' && (
                <button
                  type="button"
                  className="usr-btn usr-btn-xs"
                  onClick={backToChoose}
                  disabled={busy}
                >
                  Chọn file khác
                </button>
              )}
            </div>

            <div className="usr-summary">
              <div className="usr-summary-card">
                <span>Tạo mới</span>
                <span>{report.validRows}</span>
              </div>
              <div className="usr-summary-card usr-summary-skip">
                <span>Đã có, bỏ qua</span>
                <span>{existingCount}</span>
              </div>
              <div className="usr-summary-card usr-summary-bad">
                <span>Dòng lỗi</span>
                <span>{badRows.length}</span>
              </div>
            </div>

            {errorRows.length > 0 && (
              <div className="usr-section">
                <div className="usr-section-head">
                  <span className="usr-section-title">
                    Dòng lỗi sẽ không được nhập
                  </span>
                  <button
                    type="button"
                    className="usr-text-link"
                    onClick={() => downloadErrorReport(report.rows)}
                  >
                    <Download size={15} aria-hidden="true" />
                    Tải báo cáo lỗi
                  </button>
                </div>
                {badRows.length > 0 && (
                  <div className="usr-err-table-scroll">
                    <table className="usr-err-table">
                      <thead>
                        <tr>
                          <th scope="col">Dòng</th>
                          <th scope="col">Mã</th>
                          <th scope="col">Họ tên</th>
                          <th scope="col">Lỗi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {badRows.map((row) => (
                          <tr key={row.rowNumber}>
                            <td className="usr-tabular">{row.rowNumber}</td>
                            <td>{row.userCode || '(trống)'}</td>
                            <td>{row.fullName}</td>
                            <td className="usr-err-msg">
                              <ul>
                                {row.errors.map((message) => (
                                  <li key={message}>{message}</li>
                                ))}
                              </ul>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <span className="usr-hint-small">
                  Sửa các dòng này trong file rồi nhập lại; những dòng đã nhập
                  sẽ được nhận ra là &quot;Đã có&quot; và bỏ qua.
                </span>
              </div>
            )}
          </>
        )}

        <div className="usr-actions usr-modal-foot">
          {step === 'done' ? (
            <button
              type="button"
              className="usr-btn usr-btn-primary"
              onClick={onClose}
            >
              Đóng
            </button>
          ) : (
            <>
              <button
                type="button"
                className="usr-btn"
                onClick={onClose}
                disabled={busy}
              >
                Hủy
              </button>
              {step === 'choose' ? (
                <button
                  type="button"
                  className="usr-btn usr-btn-primary"
                  disabled
                  aria-busy={busy}
                >
                  {busy ? 'Đang kiểm tra...' : 'Kiểm tra file'}
                </button>
              ) : (
                <button
                  type="button"
                  className="usr-btn usr-btn-primary"
                  disabled={!report || report.validRows === 0 || busy}
                  aria-busy={busy}
                  onClick={commit}
                >
                  {busy
                    ? 'Đang nhập...'
                    : `Nhập ${report?.validRows ?? 0} người dùng`}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
