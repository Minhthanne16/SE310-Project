'use client';

import React from 'react';
import Link from 'next/link';
import { ROLE_HOME } from '@/features/auth/roles';
import { ROLE_MENUS, isNavItemActive } from '@/features/navigation/menuConfig';
import type { CurrentUser } from '@/types/auth';
import { AccountMenu } from './AccountMenu';

interface SidebarProps {
  id?: string;
  user: CurrentUser;
  pathname: string;
  open?: boolean;
  loggingOut?: boolean;
  onNavigate?: () => void;
  onLogout: () => void;
}

// Menu dựng từ vai trò của người dùng đã xác thực (user.role), không nhận vai
// trò từ URL hay input, nên không thể đổi sang menu của vai trò khác.
export const Sidebar: React.FC<SidebarProps> = ({
  id,
  user,
  pathname,
  open = false,
  loggingOut,
  onNavigate,
  onLogout,
}) => {
  const home = ROLE_HOME[user.role];
  return (
    <aside id={id} className={`app-sidebar${open ? ' is-open' : ''}`}>
      <Link href={home} className="app-logo" onClick={onNavigate}>
        <span aria-hidden="true">Q</span>
        QLKLTN
      </Link>

      <nav className="app-nav" aria-label="Điều hướng chính">
        {ROLE_MENUS[user.role].map((section, index) => (
          <div className="app-nav-section" key={section.title ?? index}>
            {section.title && <p className="app-nav-title">{section.title}</p>}
            <ul>
              {section.items.map((item) => {
                const active = isNavItemActive(item, pathname, home);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`app-nav-item${active ? ' is-active' : ''}`}
                      aria-current={active ? 'page' : undefined}
                      onClick={onNavigate}
                    >
                      <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <AccountMenu user={user} onLogout={onLogout} loggingOut={loggingOut} />
    </aside>
  );
};
