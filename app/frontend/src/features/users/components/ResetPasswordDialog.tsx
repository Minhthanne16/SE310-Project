'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ROLE_LABEL } from '@/features/auth/roles';
import { getNewPasswordRules } from '@/features/auth/passwordRules';
import type { UserService } from '@/features/users/services/userService';
import type { ManagedUser } from '@/types/user';
import { useDialogFocus } from '@/lib/useDialogFocus';

interface ResetPasswordDialogProps {
  user: ManagedUser;
  userService: UserService;
  onClose: () => void;
  // custom = Giáo vụ tự nhập mật khẩu mới; false = đặt về mã người dùng.
  onDone: (custom: boolean) => void;
}

type Mode = 'default' | 'custom';

// Nhãn ngắn theo artboard; quy tắc "khác mã người dùng" giữ nguyên nhãn gốc.
const RULE_LABELS = [
  'Ít nhất 8 ký tự',
  'Có cả chữ và số',
  null,
  'Hai ô khớp nhau',
];

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
  const dialogRef = useDialogFocus<HTMLFormElement>({
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
  ).map((rule, index) => ({
    ...rule,
    label: RULE_LABELS[index] ?? rule.label,
  }));
  const rulesOk = rules.every((r) => r.passed);
  const canSubmit = mode === 'default' || rulesOk;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingRef.current) return;
    setSubmitted(true);
    if (!canSubmit) return;

    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      await userService.resetPassword(
        user.id,
        mode === 'custom' ? next : undefined,
      );
      onDone(mode === 'custom');
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

  const options: Array<{ value: Mode; title: string; desc: string }> = [
    {
      value: 'default',
      title: 'Đặt về mã người dùng',
      desc: `Mật khẩu mới là ${user.userCode}.`,
    },
    {
      value: 'custom',
      title: 'Nhập mật khẩu mới',
      desc: 'Giáo vụ đặt mật khẩu tạm và báo cho người dùng.',
    },
  ];

  return (
    <div className="usr-overlay usr-overlay-center usr-overlay-top">
      <form
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reset-password-title"
        className="usr-modal usr-modal-md"
        onSubmit={handleSubmit}
        noValidate
      >
        <div className="usr-dialog-title" style={{ gap: 4 }}>
          <h2 id="reset-password-title" className="usr-h2-sm">
            Đặt lại mật khẩu
          </h2>
          <span>
            {user.fullName} · {user.userCode} · {ROLE_LABEL[user.role]}
          </span>
        </div>

        {error && (
          <div role="alert" className="usr-alert">
            {error}
          </div>
        )}

        <fieldset className="usr-radios">
          <legend>Cách đặt lại</legend>
          {options.map((o) => (
            <label key={o.value} className="usr-radio">
              <input
                type="radio"
                name="reset-mode"
                checked={mode === o.value}
                onChange={() => setMode(o.value)}
              />
              <span className="usr-radio-text">
                <span className="usr-radio-title">{o.title}</span>
                <span className="usr-radio-desc">{o.desc}</span>
              </span>
            </label>
          ))}
        </fieldset>

        {mode === 'custom' && (
          <div className="usr-pw-fields">
            <div className="usr-pw-row">
              <div className="usr-field">
                <label htmlFor="reset-next-password">Mật khẩu mới</label>
                <input
                  id="reset-next-password"
                  className="usr-input usr-input-sm"
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
              <div className="usr-field">
                <label htmlFor="reset-confirm-password">
                  Nhập lại mật khẩu mới
                </label>
                <input
                  id="reset-confirm-password"
                  className="usr-input usr-input-sm"
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
            </div>
            <ul
              id="reset-password-rules"
              className="usr-rules"
              aria-label="Yêu cầu mật khẩu"
            >
              {rules.map((r) => (
                <li key={r.label} className={r.passed ? 'passed' : undefined}>
                  {r.label}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="usr-note usr-note-soft">
          Người dùng phải đổi mật khẩu ở lần đăng nhập kế tiếp. Hãy báo cho họ
          mật khẩu mới.
        </div>

        <div className="usr-actions">
          <button
            ref={cancelRef}
            type="button"
            className="usr-btn"
            onClick={onClose}
            disabled={saving}
          >
            Hủy
          </button>
          <button
            type="submit"
            className="usr-btn usr-btn-primary"
            disabled={saving || !canSubmit}
            aria-busy={saving}
          >
            {saving ? 'Đang lưu...' : 'Đặt lại mật khẩu'}
          </button>
        </div>
      </form>
    </div>
  );
};
