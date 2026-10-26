'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { AlertCircle, ImagePlus, KeyRound, Pencil, X } from 'lucide-react';
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

const Avatar: React.FC<{
  user: CurrentUser;
  name: string;
  url: string | null;
}> = ({ user, name, url }) =>
  url ? (
    <img
      className="profile-avatar"
      src={url}
      alt={`Ảnh đại diện của ${name}`}
    />
  ) : (
    <span
      className={`avatar avatar-${user.role} profile-avatar`}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );

interface TextFieldProps {
  field: ProfileField;
  label: string;
  value: string;
  error?: string;
  type?: string;
  max?: string;
  hint?: string;
  inputRef?: React.Ref<HTMLInputElement>;
  onChange: (field: ProfileField, value: string) => void;
}

const TextField: React.FC<TextFieldProps> = ({
  field,
  label,
  value,
  error,
  type = 'text',
  max,
  hint,
  inputRef,
  onChange,
}) => {
  const id = `profile-${field}`;
  const describedBy = [error ? `${id}-error` : null, hint ? `${id}-hint` : null]
    .filter(Boolean)
    .join(' ');
  return (
    <div className="login-field">
      <label htmlFor={id}>{label}</label>
      <input
        ref={inputRef}
        id={id}
        type={type}
        max={max}
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        onChange={(e) => onChange(field, e.target.value)}
      />
      {hint && (
        <p id={`${id}-hint`} className="login-hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="login-field-error">
          {error}
        </p>
      )}
    </div>
  );
};

const ProfileContent: React.FC<{
  user: CurrentUser;
  profileService: ProfileService;
}> = ({ user, profileService }) => {
  const { authService } = useSession();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<ProfileInput | null>(null);
  const [errors, setErrors] = useState<ProfileFieldErrors>({});
  const [avatarError, setAvatarError] = useState<string | null>(null);
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
      <p role="status" className="app-muted">
        Đang tải hồ sơ...
      </p>
    );

  const startEditing = () => {
    setValues(inputFromProfile(profile));
    setErrors({});
    setAvatarError(null);
    setFormError(null);
    setPreviewUrl(null);
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
    if (avatarInputRef.current) avatarInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingRef.current || !values) return;
    const found = validateProfileInput(values, user.email);
    setErrors(found);
    const count = Object.keys(found).length;
    if (count > 0) {
      setFormError(`Còn ${count} mục chưa hợp lệ. Kiểm tra lại rồi lưu.`);
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setFormError(null);
    try {
      setProfile(await profileService.updateProfile(user.id, values));
      toast.success('Đã lưu hồ sơ.');
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

  const displayName = user.fullName;
  const removed = editing && values?.removeAvatar;
  const shownAvatar = removed
    ? null
    : editing && previewUrl
      ? previewUrl
      : profile.avatarUrl;

  const accountFields: [string, string][] = [
    ['Mã người dùng', user.userCode],
    ['Họ tên', user.fullName],
    ['Email', user.email],
    ['Vai trò', ROLE_LABEL[user.role]],
  ];
  if (user.role === 'Student')
    accountFields.push(['Lớp', profile.className ?? '—']);
  if (user.role === 'Lecturer') {
    accountFields.push(['Bộ môn', profile.department ?? '—']);
    accountFields.push(['Học hàm', profile.academicTitle ?? '—']);
  }

  const personalFields: [string, string][] = [
    ['Ngày sinh', formatDate(profile.dateOfBirth)],
    ['Số điện thoại', profile.phone || '—'],
    ['Email phụ', profile.secondaryEmail || '—'],
  ];

  return (
    <>
      <section className="app-card profile-identity" aria-label="Danh tính">
        <Avatar user={user} name={displayName} url={shownAvatar} />
        <div className="profile-identity-text">
          <h2>{displayName}</h2>
          <div className="profile-identity-meta">
            <span className={`app-chip app-chip-${user.role}`}>
              {ROLE_LABEL[user.role]}
            </span>
            <span className="app-muted">{user.userCode}</span>
          </div>
        </div>
      </section>

      <section className="app-card" aria-labelledby="profile-account-title">
        <div className="app-card-header">
          <h2 id="profile-account-title">Thông tin tài khoản</h2>
        </div>
        <dl className="profile-fields">
          {accountFields.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <p className="app-muted">
          Các thông tin này do Giáo vụ quản lý, bạn chỉ xem.
        </p>
      </section>

      <section className="app-card" aria-labelledby="profile-personal-title">
        <div className="app-card-header">
          <h2 id="profile-personal-title">Thông tin cá nhân</h2>
          {!editing && (
            <button
              ref={editButtonRef}
              type="button"
              className="app-button"
              onClick={startEditing}
            >
              <Pencil size={16} aria-hidden="true" />
              Sửa hồ sơ
            </button>
          )}
        </div>

        {editing && values ? (
          <form
            className="login-form profile-form"
            onSubmit={handleSubmit}
            noValidate
          >
            {formError && (
              <div role="alert" className="login-error">
                <AlertCircle size={18} />
                <span>{formError}</span>
              </div>
            )}
            <TextField
              field="dateOfBirth"
              inputRef={firstFieldRef}
              label="Ngày sinh"
              type="date"
              max={todayIso()}
              value={values.dateOfBirth}
              error={errors.dateOfBirth}
              onChange={setField}
            />
            <TextField
              field="phone"
              label="Số điện thoại"
              type="tel"
              value={values.phone}
              error={errors.phone}
              onChange={setField}
            />
            <TextField
              field="secondaryEmail"
              label="Email phụ"
              type="email"
              value={values.secondaryEmail}
              error={errors.secondaryEmail}
              onChange={setField}
            />

            <div className="login-field">
              <label htmlFor="profile-avatar">Ảnh đại diện</label>
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
              <p id="profile-avatar-hint" className="login-hint">
                JPG, PNG hoặc WebP, tối đa 2 MB.
              </p>
              {avatarError && (
                <p id="profile-avatar-error" className="login-field-error">
                  {avatarError}
                </p>
              )}
              {(profile.avatarUrl || values.avatarFile) &&
                !values.removeAvatar && (
                  <button
                    type="button"
                    className="app-button app-button-small profile-avatar-remove"
                    onClick={removeAvatar}
                  >
                    <X size={14} aria-hidden="true" />
                    Gỡ ảnh
                  </button>
                )}
              {values.removeAvatar && (
                <p className="login-hint">
                  <ImagePlus size={14} aria-hidden="true" /> Ảnh sẽ được gỡ khi
                  lưu.
                </p>
              )}
            </div>

            <div className="dialog-actions">
              <button
                type="button"
                className="app-button"
                onClick={stopEditing}
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
                {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </div>
          </form>
        ) : (
          <dl className="profile-fields">
            {personalFields.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      <section className="app-card" aria-labelledby="profile-security-title">
        <div className="app-card-header">
          <h2 id="profile-security-title">Bảo mật</h2>
          <button
            ref={triggerRef}
            type="button"
            className="app-button"
            aria-haspopup="dialog"
            onClick={openDialog}
          >
            <KeyRound size={16} aria-hidden="true" />
            Đổi mật khẩu
          </button>
        </div>
        <div>
          <h3 className="profile-subtitle">Hoạt động đăng nhập</h3>
          {profile.lastLogins.length === 0 ? (
            <p className="app-muted">Chưa có lịch sử đăng nhập.</p>
          ) : (
            <ul className="profile-logins">
              {profile.lastLogins.map((iso, index) => (
                <li key={iso}>
                  <time dateTime={iso}>{formatDateTime(iso)}</time>
                  {index === 0 && (
                    <span className="app-muted"> · gần nhất</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {dialogOpen && (
        <ChangePasswordDialog
          authService={authService}
          onClose={closeDialog}
          onChanged={() => {
            closeDialog();
            toast.success('Đã đổi mật khẩu.');
          }}
        />
      )}
    </>
  );
};

// Hồ sơ cá nhân dùng chung, nhận vai trò từ phiên đăng nhập (một màn thay cho
// ba artboard HoSo, HoSo-GV, HoSo-GiaoVu). Mã, email, vai trò và đơn vị chỉ
// xem (gồm họ tên); ngày sinh, SĐT, email phụ, ảnh do người dùng tự sửa.
export const ProfilePage: React.FC<ProfilePageProps> = ({
  profileService = defaultProfileService,
}) => {
  const { session } = useSession();
  if (session.status !== 'authenticated') return null;

  return (
    <>
      <div className="app-page-heading">
        <h1>Hồ sơ cá nhân</h1>
        <p>
          Xem và sửa thông tin cá nhân, đổi mật khẩu, xem hoạt động đăng nhập.
        </p>
      </div>
      <ProfileContent user={session.user} profileService={profileService} />
    </>
  );
};
