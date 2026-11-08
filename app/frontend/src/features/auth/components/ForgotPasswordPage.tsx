'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, Check, Circle, MailCheck } from 'lucide-react';
import '@/features/auth/auth.css';
import { AuthBrand } from '@/features/auth/components/AuthBrand';
import {
  passwordResetService as defaultService,
  ResetLinkError,
  type PasswordResetService,
} from '@/features/auth/services/passwordResetService';

interface ForgotPasswordPageProps {
  passwordResetService?: PasswordResetService;
}

// Các màn theo DESIGN 03 · Quên mật khẩu; "Email không tồn tại" bị bỏ theo PDR-037.
type View =
  | { kind: 'checking' }
  | { kind: 'request' }
  | { kind: 'sent'; email: string }
  | { kind: 'reset'; token: string }
  | { kind: 'expired' | 'used' | 'invalid' }
  | { kind: 'done' };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESEND_SECONDS = 60;
export const NEUTRAL_MESSAGE =
  'Nếu email thuộc hệ thống, bạn sẽ nhận liên kết đặt lại mật khẩu.';

const errorMessage = (err: unknown, fallback: string) =>
  err instanceof Error && err.message ? err.message : fallback;

// Token nằm sau dấu # nên không gửi lên máy chủ hay vào Referer; đọc xong thì xóa khỏi thanh địa chỉ.
function takeTokenFromHash(): string | null {
  const token = new URLSearchParams(window.location.hash.slice(1)).get('token');
  if (token)
    window.history.replaceState(
      null,
      '',
      window.location.pathname + window.location.search,
    );
  return token;
}

const LINK_PROBLEM: Record<
  'expired' | 'used' | 'invalid',
  { title: string; text: string }
> = {
  expired: {
    title: 'Liên kết đã hết hạn',
    text: 'Liên kết đặt lại mật khẩu chỉ có hiệu lực 30 phút. Hãy yêu cầu liên kết mới.',
  },
  used: {
    title: 'Liên kết đã được dùng',
    text: 'Mỗi liên kết chỉ dùng được một lần. Nếu bạn chưa đổi mật khẩu, hãy yêu cầu liên kết mới.',
  },
  invalid: {
    title: 'Liên kết không còn hiệu lực',
    text: 'Liên kết không đúng hoặc tài khoản đã thay đổi sau khi liên kết được gửi. Hãy yêu cầu liên kết mới.',
  },
};

export const ForgotPasswordPage: React.FC<ForgotPasswordPageProps> = ({
  passwordResetService = defaultService,
}) => {
  const [view, setView] = useState<View>({ kind: 'checking' });
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resendAt, setResendAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const submittingRef = useRef(false);
  // Token đã đọc từ # (undefined: chưa đọc). Ref giữ qua lần chạy effect thứ hai của
  // React StrictMode, khi # đã bị xóa khỏi thanh địa chỉ.
  const tokenRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    let current = 0;
    const openLink = (token: string) => {
      const run = ++current;
      setError(null);
      setView({ kind: 'checking' });
      passwordResetService
        .checkLink(token)
        .then((status) => {
          if (run !== current) return;
          setView(
            status === 'valid' ? { kind: 'reset', token } : { kind: status },
          );
        })
        .catch((err: unknown) => {
          if (run !== current) return;
          // Không kiểm tra được thì vẫn cho nhập; máy chủ kiểm tra lại khi lưu.
          setView({ kind: 'reset', token });
          setError(errorMessage(err, 'Không kiểm tra được liên kết.'));
        });
    };

    if (tokenRef.current === undefined) tokenRef.current = takeTokenFromHash();
    if (tokenRef.current) openLink(tokenRef.current);
    else setView({ kind: 'request' });

    // Dán liên kết vào tab đang mở trang này chỉ đổi phần # nên không tải lại trang.
    const onHashChange = () => {
      const pasted = takeTokenFromHash();
      if (!pasted) return;
      tokenRef.current = pasted;
      openLink(pasted);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => {
      current++;
      window.removeEventListener('hashchange', onHashChange);
    };
  }, [passwordResetService]);

  useEffect(() => {
    if (resendAt === null) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [resendAt]);

  const resendSeconds =
    resendAt === null ? 0 : Math.max(0, Math.ceil((resendAt - now) / 1000));

  const backToRequest = () => {
    setError(null);
    setView({ kind: 'request' });
  };

  const sendLink = async (address: string) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      await passwordResetService.requestLink(address);
      const at = Date.now();
      setNow(at);
      setResendAt(at + RESEND_SECONDS * 1000);
      setView({ kind: 'sent', email: address });
    } catch (err: unknown) {
      setError(errorMessage(err, 'Không gửi được yêu cầu. Thử lại sau.'));
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  const handleRequest = (e: React.FormEvent) => {
    e.preventDefault();
    const address = email.trim();
    if (!address) return setEmailError('Nhập email.');
    if (!EMAIL_PATTERN.test(address))
      return setEmailError('Email không đúng định dạng.');
    void sendLink(address);
  };

  const rules = [
    { label: 'Tối thiểu 8 ký tự', passed: newPassword.length >= 8 },
    {
      label: 'Có cả chữ và số',
      passed: /[a-zA-Z]/.test(newPassword) && /[0-9]/.test(newPassword),
    },
    {
      label: 'Hai lần nhập khớp nhau',
      passed: newPassword !== '' && newPassword === confirmPassword,
    },
  ];
  const rulesPassed = rules.every((r) => r.passed);

  const handleReset = async (e: React.FormEvent, token: string) => {
    e.preventDefault();
    if (!rulesPassed || submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      await passwordResetService.resetPassword(token, newPassword);
      setView({ kind: 'done' });
    } catch (err: unknown) {
      if (err instanceof ResetLinkError) setView({ kind: err.status });
      else setError(errorMessage(err, 'Không đặt lại được mật khẩu.'));
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  const errorBox = error && (
    <div id="forgot-error" role="alert" className="login-error">
      <AlertCircle size={18} />
      <span>{error}</span>
    </div>
  );

  const contactNote = (
    <p className="auth-note">
      Không nhận được thư, tài khoản đã bị vô hiệu hóa, chưa kích hoạt lần đầu
      hoặc không còn dùng được email này? Liên hệ Giáo vụ Khoa để được đặt lại
      mật khẩu.
    </p>
  );

  return (
    <div className="login-page auth-page">
      <AuthBrand />
      <main className="login-main">
        <div className="auth-column">
          <Link href="/login" className="auth-back">
            ← Quay lại đăng nhập
          </Link>

          {view.kind === 'checking' && (
            <p role="status" className="login-hint">
              Đang kiểm tra liên kết...
            </p>
          )}

          {view.kind === 'request' && (
            <form className="login-form" onSubmit={handleRequest} noValidate>
              <div className="login-heading">
                <h2>Quên mật khẩu</h2>
                <p>
                  Nhập email đăng nhập. Nếu email thuộc hệ thống, bạn sẽ nhận
                  liên kết đặt lại mật khẩu có hiệu lực 30 phút.
                </p>
              </div>
              {errorBox}
              <div className="login-field">
                <label htmlFor="forgot-email">Email</label>
                <input
                  id="forgot-email"
                  type="email"
                  autoComplete="username"
                  placeholder="ten.ho@truong.edu.vn"
                  value={email}
                  aria-invalid={!!emailError}
                  aria-describedby={
                    emailError ? 'forgot-email-error' : undefined
                  }
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setEmailError(null);
                    setError(null);
                  }}
                />
                {emailError && (
                  <p id="forgot-email-error" className="login-field-error">
                    {emailError}
                  </p>
                )}
              </div>
              <button
                type="submit"
                className="login-submit"
                disabled={loading}
                aria-busy={loading}
              >
                {loading ? 'Đang gửi...' : 'Gửi liên kết đặt lại'}
              </button>
              {contactNote}
            </form>
          )}

          {view.kind === 'sent' && (
            <section className="auth-building" aria-labelledby="sent-title">
              <MailCheck size={28} aria-hidden="true" />
              <h2 id="sent-title">Kiểm tra hộp thư</h2>
              <p role="status">{NEUTRAL_MESSAGE}</p>
              <p>
                Thư được gửi tới {view.email}. Xem cả mục Thư rác. Liên kết có
                hiệu lực 30 phút và chỉ dùng được một lần.
              </p>
              {errorBox}
              <button
                type="button"
                className="login-submit"
                disabled={resendSeconds > 0 || loading}
                onClick={() => void sendLink(view.email)}
              >
                {resendSeconds > 0
                  ? `Gửi lại liên kết (${resendSeconds}s)`
                  : 'Gửi lại liên kết'}
              </button>
              <button
                type="button"
                className="login-link-button"
                onClick={backToRequest}
              >
                Dùng email khác
              </button>
              {contactNote}
            </section>
          )}

          {view.kind === 'reset' && (
            <form
              className="login-form"
              onSubmit={(e) => void handleReset(e, view.token)}
            >
              <div className="login-heading">
                <h2>Đặt mật khẩu mới</h2>
                <p>
                  Mật khẩu mới phải khác mã người dùng. Sau khi đổi, mọi phiên
                  đăng nhập cũ sẽ bị đăng xuất.
                </p>
              </div>
              {errorBox}
              <div className="login-field">
                <label htmlFor="reset-new-password">Mật khẩu mới</label>
                <input
                  id="reset-new-password"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  aria-describedby="reset-rules"
                  onChange={(e) => setNewPassword(e.target.value)}
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
                  value={confirmPassword}
                  aria-invalid={
                    confirmPassword.length > 0 &&
                    confirmPassword !== newPassword
                      ? true
                      : undefined
                  }
                  aria-describedby="reset-rules"
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              <ul
                id="reset-rules"
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
              <button
                type="submit"
                className="login-submit"
                disabled={!rulesPassed || loading}
                aria-busy={loading}
              >
                {loading ? 'Đang lưu...' : 'Đặt mật khẩu mới'}
              </button>
            </form>
          )}

          {(view.kind === 'expired' ||
            view.kind === 'used' ||
            view.kind === 'invalid') && (
            <section className="auth-building" aria-labelledby="link-title">
              <h2 id="link-title">{LINK_PROBLEM[view.kind].title}</h2>
              <p>{LINK_PROBLEM[view.kind].text}</p>
              <button
                type="button"
                className="login-submit"
                onClick={backToRequest}
              >
                Gửi liên kết mới
              </button>
            </section>
          )}

          {view.kind === 'done' && (
            <section className="auth-building" aria-labelledby="done-title">
              <h2 id="done-title">Đã đổi mật khẩu</h2>
              <p role="status">
                Mật khẩu mới đã được lưu. Đăng nhập lại bằng mật khẩu mới.
              </p>
              <Link href="/login" className="auth-primary-link">
                Đăng nhập
              </Link>
            </section>
          )}
        </div>
      </main>
    </div>
  );
};
