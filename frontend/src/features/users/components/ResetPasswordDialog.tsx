'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Check, Circle } from 'lucide-react';
import { getNewPasswordRules } from '@/features/auth/passwordRules';
import type { UserService } from '@/features/users/services/userService';
import type { ManagedUser } from '@/types/user';
import { useDialogFocus } from '@/lib/useDialogFocus';

interface ResetPasswordDialogProps {
  user: ManagedUser;
  userService: UserService;
  onClose: () => void;
  onDone: () => void;
}

type Mode = 'default' | 'custom';

// Đặt lại mật khẩu cho người dùng: về mã người dùng (mật khẩu ban đầu) hoặc
// nhập mật khẩu mới theo cùng quy tắc mật khẩu của hệ thống.
export const ResetPasswordDialog: React.FC<ResetPasswordDialogProps> = ({
  user,
  userService,
  onClose,
  onDone,
}) => {
  const [mode, setMode] = useState<Mode>('default');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useDialogFocus<HTMLDivElement>({
    initialFocusRef: cancelRef,
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !savingRef.current) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const rules = getNewPasswordRules(
    next,
    confirm,
    user.userCode,
    'Khác mã người dùng',
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingRef.current) return;
    setSubmitted(true);
    if (mode === 'custom' && !rules.every((r) => r.passed)) return;

    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      await userService.resetPassword(
        user.id,
        mode === 'custom' ? next : undefined,
      );
      onDone();
    } catch (err: unknown) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : 'Đặt lại mật khẩu thất bại. Thử lại sau.',
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <div className="dialog-backdrop">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reset-password-title"
        className="dialog"
      >
        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <div className="login-heading">
            <h2 id="reset-password-title">Đặt lại mật khẩu</h2>
            <p>
              Tài khoản {user.fullName} ({user.userCode}). Người dùng phải đổi
              lại mật khẩu ở lần đăng nhập kế tiếp.
            </p>
          </div>

          {error && (
            <div role="alert" className="login-error">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          <fieldset className="app-choice-group">
            <legend>Cách đặt lại</legend>
            <label className="app-choice">
              <input
                type="radio"
                name="reset-mode"
                checked={mode === 'default'}
                onChange={() => setMode('default')}
              />
              <span>
                Về mã người dùng <strong>{user.userCode}</strong>
              </span>
            </label>
            <label className="app-choice">
              <input
                type="radio"
                name="reset-mode"
                checked={mode === 'custom'}
                onChange={() => setMode('custom')}
              />
              <span>Nhập mật khẩu mới</span>
            </label>
          </fieldset>

          {mode === 'custom' && (
            <>
              <div className="login-field">
                <label htmlFor="reset-next-password">Mật khẩu mới</label>
                <input
                  id="reset-next-password"
                  type="password"
                  autoComplete="new-password"
                  value={next}
                  aria-invalid={
                    submitted && !rules.slice(0, 3).every((r) => r.passed)
                      ? true
                      : undefined
                  }
                  aria-describedby="reset-password-rules"
                  onChange={(e) => setNext(e.target.value)}
                />
              </div>
              <div className="login-field">
                <label htmlFor="reset-confirm-password">
                  Nhập lại mật khẩu mới
                </label>
                <input
                  id="reset-confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  aria-invalid={
                    submitted && !rules[3].passed ? true : undefined
                  }
                  aria-describedby="reset-password-rules"
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </div>
              <ul
                id="reset-password-rules"
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
            </>
          )}

          <div className="dialog-actions dialog-actions-split">
            <button
              ref={cancelRef}
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
              {saving ? 'Đang lưu...' : 'Đặt lại mật khẩu'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
