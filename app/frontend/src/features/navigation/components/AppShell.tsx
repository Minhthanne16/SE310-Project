'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';
import { AlertCircle, Menu, X } from 'lucide-react';
import { ROLE_HOME } from '@/features/auth/roles';
import type { AuthService } from '@/features/auth/services/authService';
import {
  SessionProvider,
  useSession,
} from '@/features/auth/session/SessionProvider';
import { findNavItem } from '@/features/navigation/menuConfig';
import { initials } from '@/features/navigation/initials';
import { audienceOf } from '@/features/navigation/services/notificationService';
import type { UserRole } from '@/types/auth';
import { NotificationBell } from './NotificationBell';
import { Sidebar } from './Sidebar';
import { TopbarSlotContext, useTopbarSlotValue } from './TopbarSlot';

interface AppShellProps {
  // Khu vực của route (/sv, /gv, /giao-vu). Bỏ trống với trang dùng chung.
  area?: UserRole;
  authService?: AuthService;
  children: React.ReactNode;
}

const SIDEBAR_ID = 'app-sidebar';

// Điều hướng phía client chỉ để trải nghiệm đúng vai trò; quyền thật vẫn do
// backend kiểm tra ở từng API.
const ShellContent: React.FC<Omit<AppShellProps, 'authService'>> = ({
  area,
  children,
}) => {
  const { session, refresh, logout } = useSession();
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [slotElement, setSlotElement] = useState<HTMLElement | null>(null);
  const [slotUsers, setSlotUsers] = useState(0);
  const registerSlot = useCallback(
    (delta: 1 | -1) => setSlotUsers((n) => Math.max(0, n + delta)),
    [],
  );
  const slot = useTopbarSlotValue(slotElement, registerSlot);

  const user = session.status === 'authenticated' ? session.user : null;
  const wrongArea = !!user && !!area && user.role !== area;
  const blocked = !!user && (user.mustChangePassword || wrongArea);

  useEffect(() => {
    if (session.status === 'unauthenticated') router.replace('/login');
    else if (user?.mustChangePassword) router.replace('/login');
    else if (user && wrongArea) router.replace(ROLE_HOME[user.role]);
  }, [session.status, user, wrongArea, router]);

  useEffect(() => setMenuOpen(false), [pathname]);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
    } catch {
      toast.error('Không đăng xuất được. Kiểm tra kết nối rồi thử lại.');
    } finally {
      setLoggingOut(false);
    }
  };

  if (session.status === 'error') {
    return (
      <div className="app-gate" role="alert">
        <AlertCircle size={22} aria-hidden="true" />
        <p>Không kiểm tra được phiên đăng nhập: {session.message}</p>
        <button
          type="button"
          className="app-button"
          onClick={() => void refresh()}
        >
          Thử lại
        </button>
      </div>
    );
  }

  // Chưa có phiên hợp lệ hoặc đang chuyển hướng: không hiện menu nào.
  if (!user || blocked) {
    return (
      <div className="app-gate" role="status" aria-live="polite">
        <span className="app-spinner" aria-hidden="true" />
        <p>Đang kiểm tra phiên đăng nhập...</p>
      </div>
    );
  }

  const current = findNavItem(user.role, pathname);
  const home = ROLE_HOME[user.role];
  const title =
    pathname === home
      ? 'Trang chủ · các đợt khóa luận của bạn'
      : (current?.label ?? (pathname === '/ho-so' ? 'Hồ sơ cá nhân' : ''));

  return (
    <div className="app-shell">
      <Sidebar
        id={SIDEBAR_ID}
        user={user}
        pathname={pathname}
        open={menuOpen}
        loggingOut={loggingOut}
        onNavigate={() => setMenuOpen(false)}
        onLogout={() => void handleLogout()}
      />
      {menuOpen && (
        <div
          className="app-backdrop"
          aria-hidden="true"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <div className="app-main">
        <header className="app-topbar">
          <div className="app-topbar-left">
            <button
              type="button"
              className="app-menu-toggle"
              aria-controls={SIDEBAR_ID}
              aria-expanded={menuOpen}
              aria-label={menuOpen ? 'Đóng menu' : 'Mở menu'}
              onClick={() => setMenuOpen((v) => !v)}
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            {slotUsers === 0 && (
              <span className="app-topbar-title">{title}</span>
            )}
            <div className="app-topbar-slot" ref={setSlotElement} />
          </div>
          <div className="app-topbar-right">
            <NotificationBell audience={audienceOf(user.role)} />
            <span
              className={`avatar avatar-${user.role}`}
              role="img"
              aria-label={user.fullName}
            >
              {initials(user.fullName)}
            </span>
          </div>
        </header>
        <TopbarSlotContext.Provider value={slot}>
          <main className="app-content">{children}</main>
        </TopbarSlotContext.Provider>
      </div>
      <Toaster position="top-right" />
    </div>
  );
};

export const AppShell: React.FC<AppShellProps> = ({
  authService,
  ...props
}) => (
  <SessionProvider authService={authService}>
    <ShellContent {...props} />
  </SessionProvider>
);
