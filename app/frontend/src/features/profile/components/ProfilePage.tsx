'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { KeyRound, LogOut, Pencil, X } from 'lucide-react';
import { ChangePasswordDialog } from '@/features/auth/components/ChangePasswordDialog';
import { ROLE_LABEL } from '@/features/auth/roles';
import { useSession } from '@/features/auth/session/SessionProvider';
import { initials } from '@/features/navigation/initials';
import {
  todayIso,
  validateAvatarFile,
  validateProfileInput,
  type ProfileField,
  type ProfileFieldErrors,
} from '@/features/profile/profileValidation';
import {
  profileService as defaultProfileService,
  type ProfileService,
} from '@/features/profile/services/profileService';
import type { CurrentUser } from '@/types/auth';
import type { ProfileInput, UserProfile } from '@/types/profile';
import '@/features/profile/profile.css';

interface ProfilePageProps {
  profileService?: ProfileService;
}

const formatDate = (iso: string | null): string => {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

const formatDateTime = (iso: string): string =>
  new Date(iso).toLocaleString('vi-VN');

const inputFromProfile = (profile: UserProfile): ProfileInput => ({
  dateOfBirth: profile.dateOfBirth ?? '',
  phone: profile.phone,
  secondaryEmail: profile.secondaryEmail,
  avatarFile: null,
  removeAvatar: false,
});

const CODE_LABEL: Record<CurrentUser['role'], string> = {
  Student: 'Mã sinh viên',
  Lecturer: 'Mã giảng viên',
  AcademicAffairs: 'Mã người dùng',
};

const Avatar: React.FC<{
  user: CurrentUser;
  name: string;
  url: string | null;
  small?: boolean;
}> = ({ user, name, url, small }) => {
  const size = small ? ' prf-avatar-sm' : '';
  return url ? (
    <img
      className={`prf-avatar${size}`}
      src={url}
      alt={`Ảnh đại diện của ${name}`}
    />
  ) : (
    <span
      className={`prf-avatar prf-role-${user.role}${size}`}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
};

const Row: React.FC<{ label: React.ReactNode; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <div className="prf-row">
    <dt>{label}</dt>
    <dd>{children}</dd>
  </div>
);

interface EditRowProps {
  field: ProfileField;
  label: string;
  value: string;
  error?: string;
  type?: string;
  max?: string;
  inputMode?: 'tel' | 'email' | 'numeric' | 'text';
  placeholder?: string;
  inputRef?: React.Ref<HTMLInputElement>;
  onChange: (field: ProfileField, value: string) => void;
}

const EditRow: React.FC<EditRowProps> = ({
  field,
  label,
  value,
  error,
  type = 'text',
  max,
  inputMode,
  placeholder,
  inputRef,
  onChange,
}) => {
  const id = `profile-${field}`;
  return (
    <Row label={<label htmlFor={id}>{label}</label>}>
      <input
        ref={inputRef}
        id={id}
        className="prf-input"
        type={type}
        max={max}
        inputMode={inputMode}
        placeholder={placeholder}
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(e) => onChange(field, e.target.value)}
      />
      {error && (
        <span id={`${id}-error`} role="alert" className="prf-field-error">
          {error}
        </span>
      )}
    </Row>
  );
};

const ProfileContent: React.FC<{
  user: CurrentUser;
  profileService: ProfileService;
}> = ({ user, profileService }) => {
  const { authService, logout } = useSession();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [passwordChanged, setPasswordChanged] = useState(false);
  const [values, setValues] = useState<ProfileInput | null>(null);
  const [errors, setErrors] = useState<ProfileFieldErrors>({});
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarName, setAvatarName] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const returnFocusRef = useRef(false);
  // Đồng bộ với state để phím Escape của hộp thoại không hủy luôn form sửa.
  const dialogOpenRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    profileService
      .getProfile(user)
      .then((p) => !cancelled && setProfile(p))
      .catch(
        (err: unknown) =>
          !cancelled &&
          setLoadError(
            err instanceof Error && err.message
              ? err.message
              : 'Không tải được hồ sơ.',
          ),
      );
    return () => {
      cancelled = true;
    };
  }, [profileService, user]);

  // Vào form sửa thì focus ô đầu; thoát thì trả focus về nút "Sửa hồ sơ"
  // (nút chỉ được dựng lại sau khi editing đổi nên phải làm trong effect).
  useEffect(() => {
    if (editing) firstFieldRef.current?.focus();
    else if (returnFocusRef.current) {
      returnFocusRef.current = false;
      editButtonRef.current?.focus();
    }
  }, [editing]);

  // Giải phóng URL xem trước khi đổi ảnh hoặc rời trang.
  useEffect(
    () => () => {
      if (previewUrl && typeof URL.revokeObjectURL === 'function')
        URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  const openDialog = () => {
    dialogOpenRef.current = true;
    setPasswordChanged(false);
    setDialogOpen(true);
  };

  const closeDialog = useCallback(() => {
    dialogOpenRef.current = false;
    setDialogOpen(false);
    triggerRef.current?.focus();
  }, []);

  const stopEditing = useCallback(() => {
    setEditing(false);
    setPreviewUrl(null);
    setAvatarError(null);
    setAvatarName(null);
    setErrors({});
    setFormError(null);
    returnFocusRef.current = true;
  }, []);

  useEffect(() => {
    if (!editing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !savingRef.current && !dialogOpenRef.current)
        stopEditing();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [editing, stopEditing]);

  if (loadError)
    return (
      <section className="status-state" role="alert">
        <h2>Không tải được hồ sơ</h2>
        <p>{loadError}</p>
      </section>
    );
  if (!profile)
    return (
      <p role="status" className="app-muted prf-state">
        Đang tải hồ sơ...
      </p>
    );

  const startEditing = () => {
    setValues(inputFromProfile(profile));
    setErrors({});
    setAvatarError(null);
    setAvatarName(null);
    setFormError(null);
    setPreviewUrl(null);
    setSaved(false);
    setEditing(true);
  };

  const setField = (field: ProfileField, value: string) => {
    setValues((v) => (v ? { ...v, [field]: value } : v));
    setErrors((e) => ({ ...e, [field]: undefined }));
    setFormError(null);
  };

  const chooseAvatar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const problem = validateAvatarFile(file);
    setAvatarError(problem);
    if (problem) {
      // Bỏ tệp bị từ chối khỏi ô chọn; giữ lựa chọn hợp lệ trước đó.
      e.target.value = '';
      return;
    }
    setAvatarName(file.name);
    setValues((v) => (v ? { ...v, avatarFile: file, removeAvatar: false } : v));
    setPreviewUrl(
      typeof URL.createObjectURL === 'function'
        ? URL.createObjectURL(file)
        : null,
    );
  };

  const removeAvatar = () => {
    setValues((v) => (v ? { ...v, avatarFile: null, removeAvatar: true } : v));
    setPreviewUrl(null);
    setAvatarError(null);
    setAvatarName(null);
    if (avatarInputRef.current) avatarInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingRef.current || !values || !editing) return;
    const found = validateProfileInput(values, user.email);
    setErrors(found);
    if (Object.keys(found).length > 0 || avatarError) {
      setFormError(null);
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setFormError(null);
    try {
      setProfile(await profileService.updateProfile(user.id, values));
      setSaved(true);
      stopEditing();
    } catch (err: unknown) {
      setFormError(
        err instanceof Error && err.message
          ? err.message
          : 'Lưu hồ sơ thất bại. Thử lại sau.',
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err: unknown) {
      toast.error(
        err instanceof Error && err.message
          ? err.message
          : 'Đăng xuất thất bại. Thử lại sau.',
      );
    }
  };

  const displayName = user.fullName;
  const removed = editing && values?.removeAvatar;
  const shownAvatar = removed
    ? null
    : editing && previewUrl
      ? previewUrl
      : profile.avatarUrl;

  const readOnlyFields: [string, string][] = [
    [CODE_LABEL[user.role], user.userCode],
    ['Email đăng nhập', user.email],
  ];
  if (user.role === 'Student')
    readOnlyFields.push(['Lớp', profile.className ?? '—']);
  if (user.role === 'Lecturer') {
    readOnlyFields.push(['Học hàm, học vị', profile.academicTitle ?? '—']);
    readOnlyFields.push(['Bộ môn', profile.department ?? '—']);
  }

  const hasFieldErrors = Object.values(errors).some(Boolean);
  const avatarStatus = profile.avatarUrl
    ? 'Đã tải ảnh đại diện'
    : 'Chưa tải ảnh, đang dùng chữ viết tắt';
  const [latestLogin, ...earlierLogins] = profile.lastLogins;

  return (
    <div className="prf-page">
      <div className="prf-head">
        <Avatar user={user} name={displayName} url={shownAvatar} />
        <div className="prf-head-text">
          <h1>{displayName}</h1>
          <div className="prf-badges">
            <span className={`prf-badge prf-role-${user.role}`}>
              {ROLE_LABEL[user.role]}
            </span>
            <span className="prf-badge">{user.userCode}</span>
          </div>
        </div>
      </div>

      <div className="prf-cols">
        <div className="prf-main">
          <section
            className="prf-card"
            aria-labelledby="profile-personal-title"
          >
            <div className="prf-card-head">
              <h2 id="profile-personal-title">Thông tin cá nhân</h2>
              {!editing && (
                <button
                  ref={editButtonRef}
                  type="button"
                  className="prf-btn"
                  onClick={startEditing}
                >
                  <Pencil size={16} aria-hidden="true" />
                  Sửa hồ sơ
                </button>
              )}
            </div>

            {saved && !editing && (
              <div role="status" className="prf-notice prf-notice-ok">
                Đã lưu thông tin cá nhân.
              </div>
            )}
            {editing && (hasFieldErrors || avatarError) && (
              <div role="alert" className="prf-notice prf-notice-err">
                Chưa lưu được. Sửa các mục báo đỏ bên dưới rồi bấm Lưu thay đổi.
              </div>
            )}
            {editing && formError && (
              <div role="alert" className="prf-notice prf-notice-err">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
              <dl className="prf-list">
                <Row label="Họ tên">{displayName}</Row>
                {editing && values ? (
                  <>
                    <EditRow
                      field="dateOfBirth"
                      inputRef={firstFieldRef}
                      label="Ngày sinh"
                      type="date"
                      max={todayIso()}
                      value={values.dateOfBirth}
                      error={errors.dateOfBirth}
                      onChange={setField}
                    />
                    <EditRow
                      field="phone"
                      label="Số điện thoại"
                      type="tel"
                      inputMode="tel"
                      placeholder="Nhập số điện thoại"
                      value={values.phone}
                      error={errors.phone}
                      onChange={setField}
                    />
                    <EditRow
                      field="secondaryEmail"
                      label="Email liên hệ phụ"
                      type="email"
                      inputMode="email"
                      placeholder="ten@gmail.com"
                      value={values.secondaryEmail}
                      error={errors.secondaryEmail}
                      onChange={setField}
                    />
                  </>
                ) : (
                  <>
                    <Row label="Ngày sinh">
                      {formatDate(profile.dateOfBirth)}
                    </Row>
                    <Row label="Số điện thoại">{profile.phone || '—'}</Row>
                    <Row label="Email liên hệ phụ">
                      {profile.secondaryEmail || '—'}
                    </Row>
                  </>
                )}
                <Row
                  label={<label htmlFor="profile-avatar">Ảnh đại diện</label>}
                >
                  <span className="prf-avatar-field">
                    <Avatar
                      user={user}
                      name={displayName}
                      url={shownAvatar}
                      small
                    />
                    {editing && values ? (
                      <>
                        <label
                          className={`prf-file-btn${avatarError ? ' prf-file-btn-err' : ''}`}
                        >
                          Chọn ảnh
                          <input
                            ref={avatarInputRef}
                            id="profile-avatar"
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            aria-invalid={avatarError ? true : undefined}
                            aria-describedby={
                              avatarError
                                ? 'profile-avatar-hint profile-avatar-error'
                                : 'profile-avatar-hint'
                            }
                            onChange={chooseAvatar}
                          />
                        </label>
                        <span
                          id="profile-avatar-hint"
                          className="prf-avatar-hint"
                        >
                          JPG, PNG hoặc WebP, tối đa 2 MB
                        </span>
                        {(profile.avatarUrl || values.avatarFile) &&
                          !values.removeAvatar && (
                            <button
                              type="button"
                              className="prf-btn"
                              onClick={removeAvatar}
                            >
                              <X size={14} aria-hidden="true" />
                              Gỡ ảnh
                            </button>
                          )}
                        {avatarError && (
                          <span
                            id="profile-avatar-error"
                            role="alert"
                            className="prf-avatar-msg prf-avatar-msg-err"
                          >
                            {avatarError}
                          </span>
                        )}
                        {avatarName && !avatarError && (
                          <span className="prf-avatar-msg prf-avatar-msg-ok">
                            Đã chọn {avatarName}. Ảnh được cập nhật khi bấm Lưu
                            thay đổi.
                          </span>
                        )}
                        {values.removeAvatar && (
                          <span className="prf-avatar-msg prf-avatar-hint">
                            Ảnh sẽ được gỡ khi lưu.
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="prf-avatar-status">{avatarStatus}</span>
                    )}
                  </span>
                </Row>
                {readOnlyFields.map(([label, value]) => (
                  <Row key={label} label={label}>
                    {value}
                  </Row>
                ))}
              </dl>

              {editing && (
                <div className="prf-form-foot">
                  <p>
                    Mã, email đăng nhập, vai trò và đơn vị do giáo vụ quản lý.
                    Liên hệ giáo vụ nếu cần chỉnh sửa.
                  </p>
                  <span className="prf-actions">
                    <button
                      type="button"
                      className="prf-btn prf-btn-lg"
                      onClick={stopEditing}
                      disabled={saving}
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      className="prf-btn prf-btn-lg prf-btn-primary"
                      disabled={saving}
                      aria-busy={saving}
                    >
                      {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
                    </button>
                  </span>
                </div>
              )}
            </form>
          </section>

          <section
            className="prf-card prf-card-tight"
            aria-labelledby="profile-security-title"
          >
            <div className="prf-card-head">
              <div>
                <h2 id="profile-security-title">Mật khẩu</h2>
                <p>
                  Đổi mật khẩu đăng nhập. Quên mật khẩu thì dùng &quot;Quên mật
                  khẩu&quot; ở trang đăng nhập.
                </p>
              </div>
              <button
                ref={triggerRef}
                type="button"
                className="prf-btn prf-btn-lg"
                aria-haspopup="dialog"
                onClick={openDialog}
              >
                <KeyRound size={16} aria-hidden="true" />
                Đổi mật khẩu
              </button>
            </div>
            {passwordChanged && (
              <div role="status" className="prf-notice prf-notice-ok">
                Đã đổi mật khẩu. Lần đăng nhập sau dùng mật khẩu mới.
              </div>
            )}
          </section>
        </div>

        <aside className="prf-side">
          {user.role === 'AcademicAffairs' && (
            <section className="prf-card prf-card-side" aria-label="Quyền hạn">
              <h2 className="prf-eyebrow">QUYỀN HẠN</h2>
              <div className="prf-side-row">
                <span>Vai trò</span>
                <span>Thao tác thay mặt Khoa</span>
              </div>
            </section>
          )}
          <section
            className="prf-card prf-card-side"
            aria-label="Hoạt động đăng nhập"
          >
            <h2 className="prf-eyebrow">HOẠT ĐỘNG ĐĂNG NHẬP</h2>
            {latestLogin ? (
              <>
                <div className="prf-side-row">
                  <span>Truy cập gần nhất</span>
                  <span>
                    <time dateTime={latestLogin}>
                      {formatDateTime(latestLogin)}
                    </time>
                  </span>
                </div>
                {earlierLogins.map((iso) => (
                  <div key={iso} className="prf-side-row">
                    <span>Lần đăng nhập trước</span>
                    <span>
                      <time dateTime={iso}>{formatDateTime(iso)}</time>
                    </span>
                  </div>
                ))}
              </>
            ) : (
              <p className="app-muted">Chưa có lịch sử đăng nhập.</p>
            )}
            <button
              type="button"
              className="prf-btn prf-btn-lg prf-btn-danger"
              onClick={handleLogout}
            >
              <LogOut size={16} aria-hidden="true" />
              Đăng xuất
            </button>
          </section>
        </aside>
      </div>

      {dialogOpen && (
        <ChangePasswordDialog
          authService={authService}
          onClose={closeDialog}
          onChanged={() => {
            closeDialog();
            setPasswordChanged(true);
          }}
        />
      )}
    </div>
  );
};

// Hồ sơ cá nhân dùng chung, nhận vai trò từ phiên đăng nhập (một màn thay cho
// ba artboard HoSo, HoSo-GV, HoSo-GiaoVu). Họ tên, mã, email, vai trò và đơn
// vị chỉ xem; ngày sinh, SĐT, email phụ, ảnh do người dùng tự sửa.
export const ProfilePage: React.FC<ProfilePageProps> = ({
  profileService = defaultProfileService,
}) => {
  const { session } = useSession();
  if (session.status !== 'authenticated') return null;

  return <ProfileContent user={session.user} profileService={profileService} />;
};
