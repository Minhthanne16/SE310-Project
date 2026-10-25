import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ROLE_MENUS } from '@/features/navigation/menuConfig';
import type { CurrentUser, UserRole } from '@/types/auth';
import { Sidebar } from './Sidebar';

afterEach(cleanup);

const userWithRole = (role: UserRole): CurrentUser => ({
  id: role,
  userCode: 'X001',
  fullName: 'Nguyễn Văn An',
  email: 'a@truong.edu.vn',
  role,
  mustChangePassword: false,
});

const labels = (role: UserRole) =>
  ROLE_MENUS[role].flatMap((s) => s.items.map((i) => i.href));

const renderSidebar = (role: UserRole, pathname: string) =>
  render(
    <Sidebar
      user={userWithRole(role)}
      pathname={pathname}
      onLogout={vi.fn()}
    />,
  );

describe.each<[UserRole, string, string[]]>([
  ['Student', '/sv', []],
  ['Lecturer', '/gv', ['Đề tài', 'Đánh giá']],
  ['AcademicAffairs', '/giao-vu', ['Quản lý', 'Đánh giá']],
])('menu for %s', (role, home, groups) => {
  it('shows only the links of that role', () => {
    renderSidebar(role, home);
    const nav = screen.getByRole('navigation', { name: 'Điều hướng chính' });
    const hrefs = within(nav)
      .getAllByRole('link')
      .map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(labels(role));
    expect(hrefs.every((h) => h?.startsWith(home))).toBe(true);
    for (const group of groups) {
      expect(within(nav).getByText(group)).toBeInTheDocument();
    }
  });
});

it('marks the current page and keeps the home link exact', () => {
  renderSidebar('Lecturer', '/gv/de-xuat');
  expect(screen.getByRole('link', { name: 'Đề xuất từ SV' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  expect(screen.getByRole('link', { name: 'Trang chủ' })).not.toHaveAttribute(
    'aria-current',
  );
});

it('keeps a section active on its sub pages', () => {
  renderSidebar('AcademicAffairs', '/giao-vu/dot/123');
  expect(screen.getByRole('link', { name: 'Đợt khóa luận' })).toHaveAttribute(
    'aria-current',
    'page',
  );
});

it('opens the account menu with profile and logout', () => {
  const onLogout = vi.fn();
  render(
    <Sidebar
      user={userWithRole('Student')}
      pathname="/sv"
      onLogout={onLogout}
    />,
  );
  const trigger = screen.getByRole('button', {
    name: 'Tài khoản: Nguyễn Văn An, Sinh viên',
  });
  expect(trigger).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(trigger);
  expect(trigger).toHaveAttribute('aria-expanded', 'true');

  const menu = screen.getByRole('menu');
  expect(
    within(menu).getByRole('menuitem', { name: 'Xem hồ sơ' }),
  ).toHaveAttribute('href', '/ho-so');
  fireEvent.click(within(menu).getByRole('menuitem', { name: 'Đăng xuất' }));
  expect(onLogout).toHaveBeenCalled();
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
});
