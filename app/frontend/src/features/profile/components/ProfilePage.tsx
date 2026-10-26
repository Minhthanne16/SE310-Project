'use client';

import React, { useCallback, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { KeyRound } from 'lucide-react';
import { ChangePasswordDialog } from '@/features/auth/components/ChangePasswordDialog';
import { ROLE_LABEL } from '@/features/auth/roles';
import { useSession } from '@/features/auth/session/SessionProvider';

// Hồ sơ cá nhân dùng chung, nhận vai trò từ phiên đăng nhập. Hiện chỉ xem
// thông tin tài khoản và đổi mật khẩu; sửa hồ sơ chưa thuộc phạm vi.
export const ProfilePage: React.FC = () => {
  const { session, authService } = useSession();
  const [dialogOpen, setDialogOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const closeDialog = useCallback(() => {
    setDialogOpen(false);
    triggerRef.current?.focus();
  }, []);

  if (session.status !== 'authenticated') return null;
  const { user } = session;

  const fields: [string, string][] = [
    ['Mã người dùng', user.userCode],
    ['Họ tên', user.fullName],
    ['Email', user.email],
    ['Vai trò', ROLE_LABEL[user.role]],
  ];

  return (
    <>
      <div className="app-page-heading">
        <h1>Hồ sơ cá nhân</h1>
        <p>Mã, email và vai trò do Giáo vụ quản lý.</p>
      </div>

      <section className="app-card" aria-labelledby="profile-account-title">
        <div className="app-card-header">
          <h2 id="profile-account-title">Thông tin tài khoản</h2>
          <button
            ref={triggerRef}
            type="button"
            className="app-button"
            aria-haspopup="dialog"
            onClick={() => setDialogOpen(true)}
          >
            <KeyRound size={16} aria-hidden="true" />
            Đổi mật khẩu
          </button>
        </div>
        <dl className="profile-fields">
          {fields.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <p className="app-muted">Chỉnh sửa thông tin hồ sơ chưa được làm.</p>
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
