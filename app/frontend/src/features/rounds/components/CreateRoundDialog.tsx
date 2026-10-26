'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import {
  validateRoundInput,
  type RoundField,
  type RoundFieldErrors,
} from '@/features/rounds/roundValidation';
import {
  DuplicateRoundNameError,
  RoundValidationError,
  type RoundService,
} from '@/features/rounds/services/roundService';
import { ROUND_PROGRAMS, type Round, type RoundInput } from '@/types/round';
import { useDialogFocus } from '@/lib/useDialogFocus';

interface CreateRoundDialogProps {
  roundService: RoundService;
  // Đợt hiện có, dùng cho ô "Sao chép từ đợt cũ".
  rounds: Round[];
  onClose: () => void;
  onCreated: (round: Round) => void;
}

// Tạo đợt mới (03: Danh sách đợt): thiếu thông tin, trùng tên đợt, sao chép từ
// đợt cũ. Lỗi theo ô hiện sau khi bấm Tạo đợt.
export const CreateRoundDialog: React.FC<CreateRoundDialogProps> = ({
  roundService,
  rounds,
  onClose,
  onCreated,
}) => {
  const [values, setValues] = useState<RoundInput>({
    name: '',
    program: '',
    periodLabel: '',
    copyFromId: '',
  });
  const [errors, setErrors] = useState<RoundFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const dialogRef = useDialogFocus<HTMLDivElement>();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !savingRef.current) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const setField = (field: RoundField | 'copyFromId', value: string) => {
    setValues((v) => ({ ...v, [field]: value }));
    if (field !== 'copyFromId')
      setErrors((e) => ({ ...e, [field]: undefined }));
    setFormError(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingRef.current) return;
    const found = validateRoundInput(values);
    setErrors(found);
    const count = Object.keys(found).length;
    if (count > 0) {
      setFormError(
        `Thiếu thông tin: còn ${count} trường chưa hợp lệ. Điền đủ thông tin bắt buộc.`,
      );
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setFormError(null);
    try {
      const created = await roundService.create({
        ...values,
        copyFromId: values.copyFromId || undefined,
      });
      onCreated(created);
    } catch (err: unknown) {
      if (err instanceof DuplicateRoundNameError) {
        setErrors({ name: err.message });
        setFormError('Trùng tên đợt. Đặt tên khác rồi tạo lại.');
      } else if (err instanceof RoundValidationError) {
        setErrors(err.fields);
      } else {
        setFormError(
          err instanceof Error && err.message
            ? err.message
            : 'Tạo đợt thất bại. Thử lại sau.',
        );
      }
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const fieldProps = (field: RoundField) => ({
    'aria-invalid': errors[field] ? (true as const) : undefined,
    'aria-describedby': errors[field] ? `round-${field}-error` : undefined,
  });
  const fieldError = (field: RoundField) =>
    errors[field] && (
      <p id={`round-${field}-error`} className="login-field-error">
        {errors[field]}
      </p>
    );

  return (
    <div className="dialog-backdrop">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-round-title"
        className="dialog"
      >
        <form className="login-form" onSubmit={submit} noValidate>
          <div className="login-heading">
            <h2 id="create-round-title">Tạo đợt mới</h2>
            <p>Đợt mới ở trạng thái Nháp, chỉ giáo vụ thấy đến khi mở đợt.</p>
          </div>
          {formError && (
            <div role="alert" className="login-error">
              <AlertCircle size={18} />
              <span>{formError}</span>
            </div>
          )}
          <div className="login-field">
            <label htmlFor="round-name">
              Tên đợt<span aria-hidden="true"> *</span>
            </label>
            <input
              id="round-name"
              type="text"
              value={values.name}
              autoFocus
              required
              placeholder="Ví dụ: Văn bằng 1 · HK2 2026–2027"
              onChange={(e) => setField('name', e.target.value)}
              {...fieldProps('name')}
            />
            {fieldError('name')}
          </div>
          <div className="login-field">
            <label htmlFor="round-program">
              Chương trình<span aria-hidden="true"> *</span>
            </label>
            <select
              id="round-program"
              className="app-select"
              value={values.program}
              onChange={(e) => setField('program', e.target.value)}
              {...fieldProps('program')}
            >
              <option value="">Chọn chương trình</option>
              {ROUND_PROGRAMS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            {fieldError('program')}
          </div>
          <div className="login-field">
            <label htmlFor="round-period">
              Học kỳ / Khóa<span aria-hidden="true"> *</span>
            </label>
            <input
              id="round-period"
              type="text"
              value={values.periodLabel}
              required
              placeholder="Ví dụ: HK2 2026–2027"
              onChange={(e) => setField('periodLabel', e.target.value)}
              {...fieldProps('periodLabel')}
            />
            {fieldError('periodLabel')}
          </div>
          <div className="login-field">
            <label htmlFor="round-copy">Sao chép từ đợt cũ</label>
            <select
              id="round-copy"
              className="app-select"
              value={values.copyFromId ?? ''}
              onChange={(e) => setField('copyFromId', e.target.value)}
            >
              <option value="">Không sao chép</option>
              {rounds.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <p className="login-hint">
              Sao chép cấu hình mốc và danh sách giảng viên; không sao chép ngày
              và sinh viên.
            </p>
          </div>
          <div className="dialog-actions dialog-actions-split">
            <button
              type="button"
              className="app-button"
              onClick={onClose}
              disabled={saving}
            >
              Hủy
            </button>
            <button
              type="submit"
              className="app-button app-button-primary"
              disabled={saving}
              aria-busy={saving}
            >
              {saving ? 'Đang tạo...' : 'Tạo đợt'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
