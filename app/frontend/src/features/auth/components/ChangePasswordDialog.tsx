'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Check, Circle } from 'lucide-react';
import { getNewPasswordRules } from '@/features/auth/passwordRules';
import type { AuthService } from '@/features/auth/services/authService';

interface ChangePasswordDialogProps {
  authService: AuthService;
  onClose: () => void;
  onChanged: () => void;
}

interface FieldErrors {
  current?: string;
  confirm?: string;
}

// Popup đổi mật khẩu thông thường trong Hồ sơ cá nhân. Gọi changePassword,
// không dùng luồng change-initial-password của lần đăng nhập đầu.
export const ChangePasswordDialog: React.FC<ChangePasswordDialogProps> = ({
  authService,
  onClose,
  onChanged,
}) => {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstFieldRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !savingRef.current) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const rules = getNewPasswordRules(
    next,
    confirm,
    current,
    'Khác mật khẩu hiện tại',
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingRef.current) return;
    setSubmitted(true);
    const errors: FieldErrors = {};
    if (!current) errors.current = 'Nhập mật khẩu hiện tại.';
    if (confirm !== next) errors.confirm = 'Mật khẩu nhập lại không khớp.';
    setFieldErrors(errors);
    if (errors.current || !rules.every((r) => r.passed)) return;

    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      await authService.changePassword(current, next);
      onChanged();
    } catch (err: unknown) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : 'Đổi mật khẩu thất bại. Thử lại sau.',
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <div className="dialog-backdrop">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="change-password-title"
        className="dialog"
      >
        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <div className="login-heading">
            <h2 id="change-password-title">Đổi mật khẩu</h2>
            <p>Sau khi đổi, dùng mật khẩu mới cho lần đăng nhập sau.</p>
          </div>

          {error && (
            <div
              id="change-password-error"
              role="alert"
              className="login-error"
            >
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          <div className="login-field">
            <label htmlFor="current-password">Mật khẩu hiện tại</label>
            <input
              ref={firstFieldRef}
              id="current-password"
              type="password"
              autoComplete="current-password"
              value={current}
              aria-invalid={!!fieldErrors.current || !!error}
              aria-describedby={
                fieldErrors.current ? 'current-password-error' : undefined
              }
              onChange={(e) => {
                setCurrent(e.target.value);
                setError(null);
                setFieldErrors((f) => ({ ...f, current: undefined }));
              }}
            />
            {fieldErrors.current && (
              <p id="current-password-error" className="login-field-error">
                {fieldErrors.current}
              </p>
            )}
          </div>

          <div className="login-field">
            <label htmlFor="next-password">Mật khẩu mới</label>
            <input
              id="next-password"
              type="password"
              autoComplete="new-password"
              value={next}
              aria-invalid={
                submitted && !rules.slice(0, 3).every((r) => r.passed)
                  ? true
                  : undefined
              }
              aria-describedby="change-password-rules"
              onChange={(e) => {
                setNext(e.target.value);
                setError(null);
              }}
            />
          </div>

          <div className="login-field">
            <label htmlFor="confirm-next-password">Nhập lại mật khẩu mới</label>
            <input
              id="confirm-next-password"
              type="password"
              autoComplete="new-password"
              value={confirm}
              aria-invalid={!!fieldErrors.confirm}
              aria-describedby={
                fieldErrors.confirm
                  ? 'confirm-next-password-error'
                  : 'change-password-rules'
              }
              onChange={(e) => {
                setConfirm(e.target.value);
                setFieldErrors((f) => ({ ...f, confirm: undefined }));
              }}
            />
            {fieldErrors.confirm && (
              <p id="confirm-next-password-error" className="login-field-error">
                {fieldErrors.confirm}
              </p>
            )}
          </div>

          <ul
            id="change-password-rules"
            className="login-rules"
            aria-label="Quy tắc mật khẩu"
          >
            {rules.map((r) => (
              <li key={r.label} className={r.passed ? 'passed' : undefined}>
                {r.passed ? <Check size={15} /> : <Circle size={15} />}
                {r.label}
              </li>
            ))}
          </ul>

          <div className="dialog-actions">
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
              {saving ? 'Đang lưu...' : 'Đổi mật khẩu'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
