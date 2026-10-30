'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronsUpDown, LogOut, UserRound } from 'lucide-react';
import { ROLE_LABEL } from '@/features/auth/roles';
import { initials } from '@/features/navigation/initials';
import type { CurrentUser } from '@/types/auth';

interface AccountMenuProps {
  user: CurrentUser;
  onLogout: () => void;
  loggingOut?: boolean;
}

// Thẻ tài khoản ở đáy sidebar, mở menu nổi Xem hồ sơ / Đăng xuất.
export const AccountMenu: React.FC<AccountMenuProps> = ({
  user,
  onLogout,
  loggingOut = false,
}) => {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="account-menu" ref={rootRef}>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="Tài khoản"
          className="account-menu-popup"
        >
          <div className="account-menu-head">
            <span
              className={`avatar avatar-lg avatar-${user.role}`}
              aria-hidden="true"
            >
              {initials(user.fullName)}
            </span>
            <span className="account-menu-head-text">
              <strong>{user.fullName}</strong>
              <span>{user.email}</span>
            </span>
          </div>
          <Link
            role="menuitem"
            href="/ho-so"
            className="account-menu-item"
            onClick={() => setOpen(false)}
          >
            <UserRound size={18} aria-hidden="true" />
            Xem hồ sơ
          </Link>
          <button
            type="button"
            role="menuitem"
            className="account-menu-item account-menu-item-danger"
            disabled={loggingOut}
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
          >
            <LogOut size={18} aria-hidden="true" />
            {loggingOut ? 'Đang đăng xuất...' : 'Đăng xuất'}
          </button>
        </div>
      )}
      <button
        ref={triggerRef}
        type="button"
        className="account-card"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`Tài khoản: ${user.fullName}, ${ROLE_LABEL[user.role]}`}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={`avatar avatar-${user.role}`} aria-hidden="true">
          {initials(user.fullName)}
        </span>
        <span className="account-card-text">
          <strong>{user.fullName}</strong>
          <span>{ROLE_LABEL[user.role]}</span>
        </span>
        <ChevronsUpDown size={16} aria-hidden="true" />
      </button>
    </div>
  );
};
