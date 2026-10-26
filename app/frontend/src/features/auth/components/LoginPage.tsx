'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, Check, Circle, Eye, EyeOff } from 'lucide-react';
import { ApiError } from '@/api/request';
import { getNewPasswordRules } from '@/features/auth/passwordRules';
import { ROLE_HOME } from '@/features/auth/roles';
import {
  authService as defaultAuthService,
  type AuthService,
} from '@/features/auth/services/authService';
import type { CurrentUser } from '@/types/auth';

interface LoginPageProps {
  authService?: AuthService;
  onAuthenticated?: (user: CurrentUser) => void;
}

type Step = 'login' | 'changePassword';

interface FieldErrors {
  email?: string;
  password?: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const errorMessage = (err: unknown, fallback: string) =>
  err instanceof Error && err.message ? err.message : fallback;

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  });

export const LoginPage: React.FC<LoginPageProps> = ({
  authService = defaultAuthService,
  onAuthenticated,
}) => {
  const router = useRouter();
  const [step, setStep] = useState<Step>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [activationCode, setActivationCode] = useState('');
  const [codeNotice, setCodeNotice] = useState<string | null>(null);
  const [resendAt, setResendAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Chặn gửi lặp ngay cả khi người dùng bấm nhanh trước khi state cập nhật.
  const submittingRef = useRef(false);

  const finish = (user: CurrentUser) =>
    onAuthenticated
      ? onAuthenticated(user)
      : router.replace(ROLE_HOME[user.role]);

  // Người đã có phiên hợp lệ không cần thấy form đăng nhập.
  useEffect(() => {
    let cancelled = false;
    authService
      .getCurrentUser()
      .then((user) => {
        if (!cancelled && user && !user.mustChangePassword) finish(user);
      })
      .catch(() => {
        // Không kiểm tra được phiên thì vẫn cho đăng nhập bình thường.
      });
    return () => {
      cancelled = true;
    };
  }, [authService]); // finish chỉ đọc router/props ổn định, không cần chạy lại

  const resendSeconds =
    resendAt === null ? 0 : Math.max(0, Math.ceil((resendAt - now) / 1000));

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [resendSeconds]);

  const resetToLogin = (message: string | null) => {
    setStep('login');
    setPassword('');
    setCodeNotice(null);
    setResendAt(null);
    setError(message);
  };

  const sendCode = async () => {
    try {
      setError(null);
      const sent = await authService.sendActivationCode();
      setResendAt(new Date(sent.resendAvailableAt).getTime());
      setNow(Date.now());
      setCodeNotice(
        `Đã gửi mã 6 chữ số tới ${email.trim()}. Mã có hiệu lực đến ${formatTime(sent.expiresAt)}.`,
      );
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) {
        resetToLogin('Phiên đăng nhập đã hết hạn. Đăng nhập lại để tiếp tục.');
        return;
      }
      setError(errorMessage(err, 'Không gửi được mã'));
    }
  };

  const validateLogin = (): FieldErrors => {
    const errors: FieldErrors = {};
    const trimmed = email.trim();
    if (!trimmed) errors.email = 'Nhập email.';
    else if (!EMAIL_PATTERN.test(trimmed))
      errors.email = 'Email không đúng định dạng.';
    if (!password) errors.password = 'Nhập mật khẩu.';
    return errors;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;
    const errors = validateLogin();
    setFieldErrors(errors);
    if (errors.email || errors.password) {
      setError(null);
      return;
    }
    submittingRef.current = true;
    try {
      setLoading(true);
      setError(null);
      const result = await authService.login(email.trim(), password);
      if (result === 'mustChangePassword') {
        setNewPassword('');
        setConfirmPassword('');
        setActivationCode('');
        setStep('changePassword');
        void sendCode();
        return;
      }
      const user = await authService.getCurrentUser();
      if (!user) {
        setError('Không mở được phiên đăng nhập. Thử lại.');
        return;
      }
      finish(user);
    } catch (err: unknown) {
      setError(errorMessage(err, 'Đăng nhập thất bại. Thử lại sau.'));
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  const rules = getNewPasswordRules(newPassword, confirmPassword, password);
  const rulesPassed = rules.every((r) => r.passed);
  const codeValid = /^[0-9]{6}$/.test(activationCode);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rulesPassed || !codeValid || submittingRef.current) return;
    submittingRef.current = true;
    try {
      setLoading(true);
      setError(null);
      await authService.changeInitialPassword(
        password,
        newPassword,
        activationCode,
      );
      const user = await authService.getCurrentUser();
      if (!user) {
        resetToLogin('Đã đổi mật khẩu. Đăng nhập lại bằng mật khẩu mới.');
        return;
      }
      finish(user);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) {
        resetToLogin('Phiên đăng nhập đã hết hạn. Đăng nhập lại để tiếp tục.');
        return;
      }
      setError(errorMessage(err, 'Đổi mật khẩu thất bại'));
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await authService.logout();
    } catch {
      // Cookie hết hạn theo thời gian sống của token nếu không gọi được API.
    }
    resetToLogin(null);
  };

  const describedBy = (...ids: (string | false | null | undefined)[]) =>
    ids.filter(Boolean).join(' ') || undefined;

  return (
    <div className="login-page">
      <section className="login-brand">
        <div className="login-brand-logo">
          <span>Q</span>
          QLKLTN
        </div>
        <div className="login-brand-copy">
          <h1>
            Khóa luận tốt nghiệp, <em>gọn trong một nơi.</em>
          </h1>
          <p>
            Đăng ký đề tài, nộp đề cương và khóa luận, chấm điểm và nhận kết
            quả.
          </p>
        </div>
        <div className="login-brand-footer">
          <span>Khoa Công nghệ Phần mềm</span>
        </div>
      </section>

      <main className="login-main">
        <div className="login-column">
          {step === 'login' ? (
            <form className="login-form" onSubmit={handleLogin} noValidate>
              <div className="login-heading">
                <h2>Đăng nhập</h2>
                <p>Dùng email do trường cấp.</p>
              </div>

              {error && (
                <div id="login-error" role="alert" className="login-error">
                  <AlertCircle size={18} />
                  <span>{error}</span>
                </div>
              )}

              <div className="login-field">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  autoComplete="username"
                  placeholder="ten.ho@truong.edu.vn"
                  value={email}
                  aria-invalid={!!error || !!fieldErrors.email}
                  aria-describedby={describedBy(
                    fieldErrors.email && 'email-error',
                    error && 'login-error',
                  )}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError(null);
                    setFieldErrors((f) => ({ ...f, email: undefined }));
                  }}
                />
                {fieldErrors.email && (
                  <p id="email-error" className="login-field-error">
                    {fieldErrors.email}
                  </p>
                )}
              </div>

              <div className="login-field">
                <div className="login-field-row">
                  <label htmlFor="password">Mật khẩu</label>
                  <Link href="/quen-mat-khau">Quên mật khẩu?</Link>
                </div>
                <div className="login-password">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Tối thiểu 8 ký tự, gồm chữ và số"
                    value={password}
                    aria-invalid={!!error || !!fieldErrors.password}
                    aria-describedby={describedBy(
                      fieldErrors.password && 'password-error',
                      error && 'login-error',
                    )}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError(null);
                      setFieldErrors((f) => ({ ...f, password: undefined }));
                    }}
                  />
                  <button
                    type="button"
                    className="login-password-toggle"
                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {fieldErrors.password && (
                  <p id="password-error" className="login-field-error">
                    {fieldErrors.password}
                  </p>
                )}
              </div>

              <button
                type="submit"
                className="login-submit"
                disabled={loading}
                aria-busy={loading}
              >
                {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
              </button>

              <p className="login-note">
                Lần đầu đăng nhập? Mật khẩu ban đầu là mã người dùng của bạn (mã
                sinh viên hoặc mã giảng viên). Hệ thống sẽ yêu cầu bạn đổi mật
                khẩu trước khi vào. Chưa có tài khoản? Tài khoản do Giáo vụ cấp,
                hãy liên hệ Giáo vụ Khoa.
              </p>
            </form>
          ) : (
            <form className="login-form" onSubmit={handleChangePassword}>
              <div className="login-heading">
                <span className="login-badge">Lần đăng nhập đầu tiên</span>
                <h2>Đổi mật khẩu để tiếp tục</h2>
                <p>
                  Tài khoản {email} đang dùng mật khẩu ban đầu. Nhập mã xác thực
                  đã gửi tới email và đặt mật khẩu mới để vào hệ thống. Bước này
                  không bỏ qua được.
                </p>
              </div>

              {error && (
                <div id="change-error" role="alert" className="login-error">
                  <AlertCircle size={18} />
                  <span>{error}</span>
                </div>
              )}

              <div className="login-field">
                <div className="login-field-row">
                  <label htmlFor="activation-code">Mã xác thực</label>
                  <button
                    type="button"
                    className="login-link-button"
                    onClick={sendCode}
                    disabled={resendSeconds > 0}
                    aria-label="Gửi lại mã"
                  >
                    {resendSeconds > 0
                      ? `Gửi lại mã (${resendSeconds}s)`
                      : 'Gửi lại mã'}
                  </button>
                </div>
                <input
                  id="activation-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="6 chữ số"
                  value={activationCode}
                  aria-invalid={
                    activationCode.length > 0 && !codeValid ? true : undefined
                  }
                  aria-describedby={describedBy(
                    'activation-format',
                    codeNotice && 'activation-notice',
                    error && 'change-error',
                  )}
                  onChange={(e) => {
                    setActivationCode(e.target.value.replace(/[^0-9]/g, ''));
                    setError(null);
                  }}
                />
                <p id="activation-format" className="login-hint">
                  Mã gồm đúng 6 chữ số.
                </p>
                {codeNotice && (
                  <p
                    id="activation-notice"
                    role="status"
                    className="login-hint"
                  >
                    {codeNotice}
                  </p>
                )}
              </div>

              <div className="login-field">
                <label htmlFor="new-password">Mật khẩu mới</label>
                <input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  aria-describedby="password-rules"
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <div className="login-field">
                <label htmlFor="confirm-password">Nhập lại mật khẩu mới</label>
                <input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  aria-invalid={
                    confirmPassword.length > 0 &&
                    confirmPassword !== newPassword
                      ? true
                      : undefined
                  }
                  aria-describedby="password-rules"
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>

              <ul
                id="password-rules"
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
                disabled={!rulesPassed || !codeValid || loading}
                aria-busy={loading}
              >
                {loading ? 'Đang đổi mật khẩu...' : 'Đổi mật khẩu và tiếp tục'}
              </button>

              <span className="login-switch">
                Không phải tài khoản của bạn?{' '}
                <button type="button" onClick={handleLogout}>
                  Đăng xuất
                </button>
              </span>
            </form>
          )}
        </div>
      </main>
    </div>
  );
};
