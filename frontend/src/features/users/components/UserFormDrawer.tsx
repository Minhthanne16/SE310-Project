'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, KeyRound, Trash2, UserCheck, X } from 'lucide-react';
import { ROLE_LABEL } from '@/features/auth/roles';
import {
  DuplicateUserError,
  type UserService,
} from '@/features/users/services/userService';
import {
  normalizeUserInput,
  validateUserInput,
  type UserField,
  type UserFieldErrors,
} from '@/features/users/userValidation';
import type { UserRole } from '@/types/auth';
import type { ManagedUser, UserInput } from '@/types/user';

interface UserFormDrawerProps {
  // user có giá trị = sửa; không có = thêm mới.
  user?: ManagedUser;
  userService: UserService;
  // Tài khoản của chính Giáo vụ đang đăng nhập: không được xóa/vô hiệu hóa.
  isSelf?: boolean;
  // Tạm bỏ qua phím Escape khi có hộp thoại xác nhận nằm trên ngăn kéo.
  escapeDisabled?: boolean;
  onClose: () => void;
  onSaved: (user: ManagedUser, mode: 'create' | 'edit') => void;
  onResetPassword?: () => void;
  onRemove?: () => void;
  onReactivate?: () => void;
}

const ROLES: UserRole[] = ['Student', 'Lecturer', 'AcademicAffairs'];

const emptyInput = (): UserInput => ({
  userCode: '',
  fullName: '',
  email: '',
  role: 'Student',
  dateOfBirth: '',
  className: '',
  department: '',
  academicTitle: '',
});

const inputFromUser = (user: ManagedUser): UserInput => ({
  userCode: user.userCode,
  fullName: user.fullName,
  email: user.email,
  role: user.role,
  dateOfBirth: user.dateOfBirth ?? '',
  className: user.className ?? '',
  department: user.department ?? '',
  academicTitle: user.academicTitle ?? '',
});

interface TextFieldProps {
  field: UserField;
  label: string;
  value: string;
  error?: string;
  type?: string;
  readOnly?: boolean;
  required?: boolean;
  autoFocus?: boolean;
  onChange: (field: UserField, value: string) => void;
}

const TextField: React.FC<TextFieldProps> = ({
  field,
  label,
  value,
  error,
  type = 'text',
  readOnly,
  required,
  autoFocus,
  onChange,
}) => {
  const id = `user-${field}`;
  return (
    <div className="login-field">
      <label htmlFor={id}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        readOnly={readOnly}
        autoFocus={autoFocus}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(e) => onChange(field, e.target.value)}
      />
      {error && (
        <p id={`${id}-error`} className="login-field-error">
          {error}
        </p>
      )}
    </div>
  );
};

// Ngăn kéo thêm/sửa người dùng. Trường theo vai trò: sinh viên có lớp, giảng
// viên có bộ môn và học hàm. Khi sửa, mã và vai trò chỉ đọc, kèm các hành động
// của tài khoản (đặt lại mật khẩu, xóa/vô hiệu hóa, kích hoạt lại).
export const UserFormDrawer: React.FC<UserFormDrawerProps> = ({
  user,
  userService,
  isSelf = false,
  escapeDisabled = false,
  onClose,
  onSaved,
  onResetPassword,
  onRemove,
  onReactivate,
}) => {
  const editing = !!user;
  const [values, setValues] = useState<UserInput>(() =>
    user ? inputFromUser(user) : emptyInput(),
  );
  const [errors, setErrors] = useState<UserFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const escapeDisabledRef = useRef(escapeDisabled);
  escapeDisabledRef.current = escapeDisabled;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.key === 'Escape' &&
        !savingRef.current &&
        !escapeDisabledRef.current
      )
        onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const setField = (field: UserField, value: string) => {
    setValues((v) => ({ ...v, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
    setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingRef.current) return;
    const found = validateUserInput(values);
    setErrors(found);
    const count = Object.keys(found).length;
    if (count > 0) {
      setFormError(
        `Còn ${count} trường chưa hợp lệ. Điền đủ thông tin bắt buộc.`,
      );
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setFormError(null);
    try {
      const input = normalizeUserInput(values);
      const saved = user
        ? await userService.update(user.id, input)
        : await userService.create(input);
      onSaved(saved, editing ? 'edit' : 'create');
    } catch (err: unknown) {
      if (err instanceof DuplicateUserError) {
        setErrors({ [err.field]: err.message });
      } else {
        setFormError(
          err instanceof Error && err.message
            ? err.message
            : 'Lưu người dùng thất bại. Thử lại sau.',
        );
      }
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const role = values.role;
  const selfNote =
    'Bạn không thể xóa hoặc vô hiệu hóa chính tài khoản của mình.';

  return (
    <div className="app-drawer-backdrop">
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-drawer-title"
        className="app-drawer"
      >
        <header className="app-drawer-header">
          <h2 id="user-drawer-title">
            {editing ? 'Sửa người dùng' : 'Thêm người dùng'}
          </h2>
          <button
            type="button"
            className="app-icon-button"
            aria-label="Đóng"
            onClick={onClose}
            disabled={saving}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="app-drawer-body">
          <form
            id="user-form"
            className="login-form"
            onSubmit={handleSubmit}
            noValidate
          >
            {formError && (
              <div role="alert" className="login-error">
                <AlertCircle size={18} />
                <span>{formError}</span>
              </div>
            )}

            <div className="login-field">
              <label htmlFor="user-role">Vai trò</label>
              <select
                id="user-role"
                className="app-select"
                value={role}
                disabled={editing}
                onChange={(e) => {
                  setValues((v) => ({
                    ...v,
                    role: e.target.value as UserRole,
                  }));
                  setErrors({});
                  setFormError(null);
                }}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
            </div>

            <TextField
              field="userCode"
              label="Mã người dùng"
              value={values.userCode}
              error={errors.userCode}
              readOnly={editing}
              required
              autoFocus={!editing}
              onChange={setField}
            />
            <TextField
              field="fullName"
              label="Họ tên"
              value={values.fullName}
              error={errors.fullName}
              required
              autoFocus={editing}
              onChange={setField}
            />
            <TextField
              field="email"
              label="Email"
              type="email"
              value={values.email}
              error={errors.email}
              required
              onChange={setField}
            />
            <TextField
              field="dateOfBirth"
              label="Ngày sinh"
              type="date"
              value={values.dateOfBirth}
              error={errors.dateOfBirth}
              onChange={setField}
            />

            {role === 'Student' && (
              <TextField
                field="className"
                label="Lớp"
                value={values.className}
                error={errors.className}
                required
                onChange={setField}
              />
            )}
            {role === 'Lecturer' && (
              <>
                <TextField
                  field="department"
                  label="Bộ môn"
                  value={values.department}
                  error={errors.department}
                  required
                  onChange={setField}
                />
                <TextField
                  field="academicTitle"
                  label="Học hàm"
                  value={values.academicTitle}
                  error={errors.academicTitle}
                  onChange={setField}
                />
              </>
            )}

            {!editing && (
              <p className="login-hint">
                Mật khẩu ban đầu là mã người dùng; người dùng phải đổi mật khẩu
                khi đăng nhập lần đầu.
              </p>
            )}
          </form>

          {user && (
            <section className="app-drawer-section" aria-label="Tài khoản">
              <h3>Tài khoản</h3>
              <div className="app-drawer-actions">
                <button
                  type="button"
                  className="app-button"
                  onClick={onResetPassword}
                >
                  <KeyRound size={16} aria-hidden="true" />
                  Đặt lại mật khẩu
                </button>
                {!user.isActive && (
                  <button
                    type="button"
                    className="app-button"
                    onClick={onReactivate}
                  >
                    <UserCheck size={16} aria-hidden="true" />
                    Kích hoạt lại
                  </button>
                )}
                {(user.isActive || !user.hasData) && (
                  <button
                    type="button"
                    className="app-button app-button-danger"
                    onClick={onRemove}
                    disabled={isSelf}
                    aria-describedby={isSelf ? 'user-self-note' : undefined}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                    {user.hasData ? 'Vô hiệu hóa' : 'Xóa người dùng'}
                  </button>
                )}
              </div>
              {isSelf && (
                <p id="user-self-note" className="login-hint">
                  {selfNote}
                </p>
              )}
              {!isSelf && user.isActive && (
                <p className="login-hint">
                  {user.hasData
                    ? 'Người dùng đã có dữ liệu nên chỉ được vô hiệu hóa, không xóa.'
                    : 'Người dùng chưa có dữ liệu nên có thể xóa hẳn.'}
                </p>
              )}
            </section>
          )}
        </div>

        <footer className="app-drawer-footer">
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
            form="user-form"
            className="app-button app-button-primary"
            disabled={saving}
            aria-busy={saving}
          >
            {saving
              ? 'Đang lưu...'
              : editing
                ? 'Lưu thay đổi'
                : 'Thêm người dùng'}
          </button>
        </footer>
      </aside>
    </div>
  );
};
