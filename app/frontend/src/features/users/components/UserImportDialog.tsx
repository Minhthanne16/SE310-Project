'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ApiError } from '@/api/request';
import { AlertCircle, Download, FileUp } from 'lucide-react';
import { ROLE_LABEL } from '@/features/auth/roles';
import { downloadErrorReport } from '@/features/users/csvReport';
import type { UserService } from '@/features/users/services/userService';
import type { UserRole } from '@/types/auth';
import type { UserImportReport } from '@/types/user';
import { useDialogFocus } from '@/lib/useDialogFocus';

interface UserImportDialogProps {
  userService: UserService;
  onClose: () => void;
  // Gọi sau khi đã nhập để trang tải lại danh sách.
  onImported: (report: UserImportReport) => void;
}

type Step = 'choose' | 'preview' | 'done';

// Giới hạn theo PDR-004 (cũng được backend kiểm tra lại).
const MAX_BYTES = 2 * 1024 * 1024;
const COLUMNS =
  'user_code, full_name, email, role, date_of_birth, class_name, department, academic_title';

// Nhập CSV hai bước: chọn tệp → xem trước (kiểm tra từng dòng, không ghi) →
// nhập các dòng hợp lệ, bỏ qua dòng lỗi và cho tải báo cáo lỗi.
export const UserImportDialog: React.FC<UserImportDialogProps> = ({
  userService,
  onClose,
  onImported,
}) => {
  const [step, setStep] = useState<Step>('choose');
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<UserImportReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useDialogFocus<HTMLDivElement>();

  useEffect(() => {
    fileInputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busyRef.current) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const chooseFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0] ?? null;
    setFile(null);
    setError(null);
    if (!picked) return;
    if (!picked.name.toLowerCase().endsWith('.csv')) {
      setError('Tệp không đúng định dạng. Chỉ nhận tệp .csv (UTF-8).');
      return;
    }
    if (picked.size > MAX_BYTES) {
      setError('Tệp vượt quá 2 MB. Hãy chia nhỏ tệp rồi nhập lại.');
      return;
    }
    setFile(picked);
  };

  const run = async (action: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err: unknown) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : 'Không xử lý được tệp. Thử lại sau.',
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const preview = () =>
    run(async () => {
      if (!file) return;
      setReport(await userService.importPreview(file));
      setStep('preview');
    });

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
      if (result.importedRows > 0) onImported(result);
    });

  const backToChoose = () => {
    setStep('choose');
    setFile(null);
    setReport(null);
    setError(null);
  };

  const errorRows = report?.rows.filter((r) => r.errors.length > 0) ?? [];

  return (
    <div className="dialog-backdrop">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-title"
        className="dialog dialog-wide"
      >
        <div className="login-form">
          <div className="login-heading">
            <h2 id="import-title">Nhập người dùng từ CSV</h2>
            <p>
              {step === 'choose' && 'Bước 1/2: chọn tệp CSV cần nhập.'}
              {step === 'preview' &&
                'Bước 2/2: xem trước và kiểm tra từng dòng.'}
              {step === 'done' && 'Hoàn tất nhập tệp.'}
            </p>
          </div>

          {error && (
            <div role="alert" className="login-error">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          {step === 'choose' && (
            <>
              <div className="login-field">
                <label htmlFor="import-file">Tệp CSV</label>
                <input
                  ref={fileInputRef}
                  id="import-file"
                  type="file"
                  accept=".csv,text/csv"
                  aria-describedby="import-file-hint"
                  onChange={chooseFile}
                />
                <p id="import-file-hint" className="login-hint">
                  UTF-8, tối đa 2 MB và 2000 dòng. Cột: {COLUMNS}. Bắt buộc:
                  user_code, full_name, email, role; class_name với sinh viên,
                  department với giảng viên.
                </p>
              </div>
              <div className="dialog-actions dialog-actions-split">
                <button type="button" className="app-button" onClick={onClose}>
                  Hủy
                </button>
                <button
                  type="button"
                  className="app-button app-button-primary"
                  disabled={!file || busy}
                  aria-busy={busy}
                  onClick={preview}
                >
                  <FileUp size={16} aria-hidden="true" />
                  {busy ? 'Đang kiểm tra...' : 'Xem trước'}
                </button>
              </div>
            </>
          )}

          {step !== 'choose' && report && (
            <>
              <p className="app-import-summary" role="status">
                {step === 'done' && report.importedRows === 0
                  ? `Không có dòng nào được nhập, bỏ qua ${report.errorRows} dòng lỗi.`
                  : step === 'done'
                    ? `Đã nhập ${report.importedRows} dòng hợp lệ, bỏ qua ${report.errorRows} dòng lỗi.`
                    : `${report.totalRows} dòng: ${report.validRows} hợp lệ, ${report.errorRows} lỗi (dòng lỗi sẽ bị bỏ qua).`}
              </p>

              <div className="app-table-scroll app-import-table">
                <table className="app-table">
                  <thead>
                    <tr>
                      <th scope="col">Dòng</th>
                      <th scope="col">Mã</th>
                      <th scope="col">Họ tên</th>
                      <th scope="col">Email</th>
                      <th scope="col">Vai trò</th>
                      <th scope="col">Kết quả</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.rows.map((row) => (
                      <tr key={row.rowNumber}>
                        <td>{row.rowNumber}</td>
                        <td>{row.userCode}</td>
                        <td>{row.fullName}</td>
                        <td>{row.email}</td>
                        <td>
                          {Object.hasOwn(ROLE_LABEL, row.role)
                            ? ROLE_LABEL[row.role as UserRole]
                            : row.role}
                        </td>
                        <td>
                          {row.errors.length === 0 ? (
                            <span className="app-chip app-chip-active">
                              Hợp lệ
                            </span>
                          ) : (
                            <ul className="app-row-errors">
                              {row.errors.map((message) => (
                                <li key={message}>{message}</li>
                              ))}
                            </ul>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="dialog-actions dialog-actions-split">
                {step === 'preview' ? (
                  <div className="dialog-actions">
                    <button
                      type="button"
                      className="app-button"
                      onClick={onClose}
                      disabled={busy}
                    >
                      Hủy
                    </button>
                    <button
                      type="button"
                      className="app-button"
                      onClick={backToChoose}
                      disabled={busy}
                    >
                      Chọn tệp khác
                    </button>
                  </div>
                ) : (
                  <span />
                )}
                <div className="dialog-actions">
                  {errorRows.length > 0 && (
                    <button
                      type="button"
                      className="app-button"
                      onClick={() => downloadErrorReport(report.rows)}
                    >
                      <Download size={16} aria-hidden="true" />
                      Tải báo cáo lỗi
                    </button>
                  )}
                  {step === 'preview' ? (
                    <button
                      type="button"
                      className="app-button app-button-primary"
                      disabled={report.validRows === 0 || busy}
                      aria-busy={busy}
                      onClick={commit}
                    >
                      {busy
                        ? 'Đang nhập...'
                        : `Nhập ${report.validRows} dòng hợp lệ`}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="app-button app-button-primary"
                      onClick={onClose}
                    >
                      Đóng
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
