'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Ban, KeyRound, Lock, RotateCcw, Trash2, X } from 'lucide-react';
import { ROLE_LABEL } from '@/features/auth/roles';
import {
  DuplicateUserError,
  type UserService,
} from '@/features/users/services/userService';
import {
  findDuplicateErrors,
  normalizeUserInput,
  validateUserInput,
  type UserField,
  type UserFieldErrors,
} from '@/features/users/userValidation';
import type { UserRole } from '@/types/auth';
import type { ManagedUser, UserInput } from '@/types/user';
import { useDialogFocus } from '@/lib/useDialogFocus';

interface UserFormDrawerProps {
  // user có giá trị = sửa; không có = thêm mới.
  user?: ManagedUser;
  // Danh sách đã tải, dùng để báo trùng mã/email kèm tài khoản đang giữ.
  users?: ManagedUser[];
  userService: UserService;
  // Tài khoản của chính Giáo vụ đang đăng nhập: không được xóa/vô hiệu hóa.
  isSelf?: boolean;
  // Tạm bỏ qua phím Escape khi có hộp thoại xác nhận nằm trên ngăn kéo.
  escapeDisabled?: boolean;
  onClose: () => void;
  // keepOpen: "Lưu và thêm tiếp", ngăn kéo ở lại với form trống.
  onSaved: (
    user: ManagedUser,
    mode: 'create' | 'edit',
    keepOpen?: boolean,
  ) => void;
  onResetPassword?: () => void;
  onRemove?: () => void;
  onReactivate?: () => void;
}

const ROLES: UserRole[] = ['Student', 'Lecturer', 'AcademicAffairs'];

const CODE_PLACEHOLDER: Record<UserRole, string> = {
  Student: 'MSSV, ví dụ 22520123',
  Lecturer: 'Mã giảng viên',
  AcademicAffairs: 'Mã giáo vụ',
};

const CREATE_FAILED =
  'Chưa tạo được tài khoản. Vui lòng bổ sung hoặc sửa các mục được đánh dấu bên dưới.';
const UPDATE_FAILED =
  'Chưa lưu được thay đổi. Vui lòng sửa các mục được đánh dấu bên dưới.';

const emptyInput = (role: UserRole = 'Student'): UserInput => ({
  userCode: '',
  fullName: '',
  email: '',
  role,
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
  hint?: string;
  placeholder?: string;
  type?: string;
  readOnly?: boolean;
  required?: boolean;
  wide?: boolean;
  autoFocus?: boolean;
  onChange: (field: UserField, value: string) => void;
}

const TextField: React.FC<TextFieldProps> = ({
  field,
  label,
  value,
  error,
  hint,
  placeholder,
  type = 'text',
  readOnly,
  required,
  wide,
  autoFocus,
  onChange,
}) => {
  const id = `user-${field}`;
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={`usr-field${wide ? ' usr-field-wide' : ''}`}>
      <label htmlFor={id}>
        {label}
        {required && <span className="usr-req"> *</span>}
      </label>
      <input
        id={id}
        className="usr-input"
        type={type}
        value={value}
        placeholder={placeholder}
        readOnly={readOnly}
        autoFocus={autoFocus}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        onChange={(e) => onChange(field, e.target.value)}
      />
      {error ? (
        <p id={`${id}-error`} className="usr-field-error">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="usr-field-hint">
            {hint}
          </p>
        )
      )}
    </div>
  );
};

// Ngăn kéo thêm/sửa người dùng (rộng tối đa 560px). Trường theo vai trò: sinh
// viên có lớp, giảng viên có bộ môn và học hàm. Khi sửa, mã và vai trò chỉ đọc,
// kèm các hành động của tài khoản (đặt lại mật khẩu, xóa/vô hiệu hóa, kích
// hoạt lại) ở chân ngăn kéo.
export const UserFormDrawer: React.FC<UserFormDrawerProps> = ({
  user,
  users = [],
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
  const drawerRef = useDialogFocus<HTMLElement>();
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

  const pickRole = (next: UserRole) => {
    if (editing || next === values.role) return;
    setValues((v) => ({ ...v, role: next }));
    setErrors({});
    setFormError(null);
  };

  const submit = async (keepOpen: boolean) => {
    if (savingRef.current) return;
    const found: UserFieldErrors = {
      ...findDuplicateErrors(
        values,
        users.filter((u) => u.id !== user?.id),
        { checkCode: !editing },
      ),
      ...validateUserInput(values),
    };
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setFormError(editing ? UPDATE_FAILED : CREATE_FAILED);
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
      onSaved(saved, editing ? 'edit' : 'create', keepOpen);
      if (keepOpen) {
        setValues(emptyInput(values.role));
        setErrors({});
        document.getElementById('user-userCode')?.focus();
      }
    } catch (err: unknown) {
      if (err instanceof DuplicateUserError) {
        setErrors({ [err.field]: err.message });
        setFormError(editing ? UPDATE_FAILED : CREATE_FAILED);
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
  const disabledAccount = !!user && !user.isActive;
  const canRemove = !!user && (user.isActive || !user.hasData);

  return (
    <div className="usr-overlay">
      <aside
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-drawer-title"
        className="usr-drawer"
      >
        <div className="usr-dialog-head">
          <div className="usr-dialog-title">
            <h2 id="user-drawer-title">
              {user ? 'Sửa người dùng' : 'Thêm người dùng'}
            </h2>
            <p>
              {user
                ? `${user.fullName} · ${ROLE_LABEL[user.role]}`
                : 'Tạo từng tài khoản. Để tạo nhiều tài khoản cùng lúc, dùng Nhập CSV.'}
            </p>
          </div>
          <button
            type="button"
            className="usr-close"
            aria-label="Đóng"
            onClick={onClose}
            disabled={saving}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <form
          className="usr-drawer-form"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void submit(false);
          }}
        >
          {disabledAccount && (
            <div role="note" className="usr-note">
              <Ban size={18} aria-hidden="true" />
              <span>
                Tài khoản đã bị vô hiệu hóa nên người dùng không đăng nhập được.
                Dữ liệu liên quan vẫn được giữ.
              </span>
            </div>
          )}

          {formError && (
            <div role="alert" className="usr-alert">
              {formError}
            </div>
          )}

          <fieldset className="usr-roles">
            <legend>
              Vai trò <span className="usr-req">*</span>
            </legend>
            <div className="usr-roles-row">
              {ROLES.map((r) => (
                <button
                  key={r}
                  type="button"
                  className="usr-role-btn"
                  aria-pressed={r === role}
                  disabled={editing && r !== role}
                  onClick={() => pickRole(r)}
                >
                  {ROLE_LABEL[r]}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="usr-grid">
            <TextField
              field="userCode"
              label="Mã người dùng"
              value={values.userCode}
              error={errors.userCode}
              hint={
                editing
                  ? 'Không đổi được sau khi tạo'
                  : 'Cũng là mật khẩu ban đầu'
              }
              placeholder={CODE_PLACEHOLDER[role]}
              readOnly={editing}
              required
              autoFocus={!editing}
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
            <TextField
              field="fullName"
              label="Họ và tên"
              value={values.fullName}
              error={errors.fullName}
              placeholder="Họ và tên đầy đủ"
              required
              wide
              autoFocus={editing}
              onChange={setField}
            />
            <TextField
              field="email"
              label="Email"
              type="email"
              value={values.email}
              error={errors.email}
              hint="Email trường cấp, dùng để đăng nhập; không trùng"
              placeholder="ten@truong.edu.vn"
              required
              wide
              onChange={setField}
            />
            {role === 'Student' && (
              <TextField
                field="className"
                label="Lớp sinh hoạt"
                value={values.className}
                error={errors.className}
                placeholder="Ví dụ KTPM2022.1"
                required
                wide
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
                  placeholder="Ví dụ Công nghệ phần mềm"
                  required
                  onChange={setField}
                />
                <TextField
                  field="academicTitle"
                  label="Học hàm, học vị"
                  value={values.academicTitle}
                  error={errors.academicTitle}
                  placeholder="GS., PGS., TS., ThS."
                  onChange={setField}
                />
              </>
            )}
          </div>

          <div className="usr-note usr-note-soft">
            <Lock size={18} aria-hidden="true" />
            <span>
              {editing
                ? 'Khi người dùng quên mật khẩu và không nhận được email, giáo vụ bấm Đặt lại mật khẩu: đặt về mã người dùng hoặc nhập mật khẩu mới.'
                : 'Hệ thống tự tạo mã định danh và lưu mật khẩu ban đầu (bằng mã người dùng) dưới dạng mã hóa. Người dùng phải đổi mật khẩu ở lần đăng nhập đầu.'}
            </span>
          </div>

          <div className="usr-drawer-foot">
            {user && (
              <span className="usr-drawer-foot-left">
                <button
                  type="button"
                  className="usr-btn"
                  onClick={onResetPassword}
                >
                  <KeyRound size={16} aria-hidden="true" />
                  Đặt lại mật khẩu
                </button>
                {canRemove && (
                  <button
                    type="button"
                    className="usr-btn usr-btn-danger"
                    onClick={onRemove}
                    disabled={isSelf}
                    title={
                      isSelf
                        ? 'Không xóa được tài khoản đang đăng nhập'
                        : undefined
                    }
                    aria-describedby={isSelf ? 'user-self-note' : undefined}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                    Xóa
                  </button>
                )}
                {disabledAccount && (
                  <button
                    type="button"
                    className="usr-btn usr-btn-success"
                    onClick={onReactivate}
                  >
                    <RotateCcw size={16} aria-hidden="true" />
                    Kích hoạt lại
                  </button>
                )}
              </span>
            )}
            {isSelf && (
              <p id="user-self-note" className="usr-self-note">
                Đây là tài khoản bạn đang đăng nhập nên không xóa hoặc vô hiệu
                hóa được.
              </p>
            )}
            <div className="usr-actions">
              <button
                type="button"
                className="usr-btn"
                onClick={onClose}
                disabled={saving}
              >
                Hủy
              </button>
              {!editing && (
                <button
                  type="button"
                  className="usr-btn usr-btn-outline-ink"
                  onClick={() => void submit(true)}
                  disabled={saving}
                >
                  Lưu và thêm tiếp
                </button>
              )}
              <button
                type="submit"
                className="usr-btn usr-btn-primary"
                disabled={saving}
                aria-busy={saving}
              >
                {saving
                  ? 'Đang lưu...'
                  : editing
                    ? 'Lưu thay đổi'
                    : 'Tạo tài khoản'}
              </button>
            </div>
          </div>
        </form>
      </aside>
    </div>
  );
};
