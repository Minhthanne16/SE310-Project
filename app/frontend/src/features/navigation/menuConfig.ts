import {
  Award,
  BarChart3,
  BookOpen,
  CalendarRange,
  ClipboardList,
  FileSearch,
  FileText,
  FolderOpen,
  History,
  House,
  Inbox,
  Presentation,
  Search,
  Send,
  UserCheck,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { UserRole } from '@/types/auth';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export interface NavSection {
  // Nhãn nhóm menu (chữ hoa 11px); không có nhãn với menu một nhóm.
  title?: string;
  items: NavItem[];
}

// Menu theo vai trò, theo docs/DESIGN/02-thiet-ke-dung-chung.md và route gợi ý
// trong 01-sitemap.md. Ẩn menu không phải phân quyền; quyền kiểm tra ở backend.
export const ROLE_MENUS: Record<UserRole, NavSection[]> = {
  Student: [
    {
      title: 'Khóa luận',
      items: [
        { href: '/sv', label: 'Trang chủ', icon: House },
        { href: '/sv/dang-ky', label: 'Đăng ký đề tài', icon: Search },
        {
          href: '/sv/don-dang-ky',
          label: 'Đơn đăng ký của tôi',
          icon: FileText,
        },
        { href: '/sv/de-tai', label: 'Đề tài của tôi', icon: FolderOpen },
      ],
    },
  ],
  Lecturer: [
    {
      title: 'Đề tài',
      items: [
        { href: '/gv', label: 'Trang chủ', icon: House },
        { href: '/gv/de-tai', label: 'Đề tài của tôi', icon: BookOpen },
        { href: '/gv/de-xuat', label: 'Đề xuất từ SV', icon: Inbox },
        { href: '/gv/lich-su', label: 'Lịch sử đề tài', icon: History },
      ],
    },
    {
      title: 'Đánh giá',
      items: [
        { href: '/gv/huong-dan', label: 'Hướng dẫn', icon: Users },
        { href: '/gv/phan-bien', label: 'Phản biện', icon: FileSearch },
        { href: '/gv/hoi-dong', label: 'Hội đồng', icon: Presentation },
        { href: '/gv/thong-bao/gui', label: 'Gửi thông báo', icon: Send },
      ],
    },
  ],
  AcademicAffairs: [
    {
      title: 'Quản lý',
      items: [
        { href: '/giao-vu', label: 'Trang chủ', icon: House },
        { href: '/giao-vu/dot', label: 'Đợt khóa luận', icon: CalendarRange },
        {
          href: '/giao-vu/phieu-danh-gia',
          label: 'Phiếu đánh giá',
          icon: ClipboardList,
        },
        { href: '/giao-vu/nguoi-dung', label: 'Người dùng', icon: Users },
        { href: '/giao-vu/de-tai', label: 'Đề tài', icon: BookOpen },
      ],
    },
    {
      title: 'Đánh giá',
      items: [
        {
          href: '/giao-vu/phan-bien',
          label: 'Giảng viên phản biện',
          icon: UserCheck,
        },
        {
          href: '/giao-vu/hoi-dong',
          label: 'Hội đồng bảo vệ',
          icon: Presentation,
        },
        { href: '/giao-vu/ket-qua', label: 'Kết quả', icon: Award },
        { href: '/giao-vu/thong-ke', label: 'Thống kê', icon: BarChart3 },
        { href: '/giao-vu/thong-bao/gui', label: 'Gửi thông báo', icon: Send },
      ],
    },
  ],
};

// Trang chủ khớp chính xác; mục khác khớp cả màn con (ví dụ chi tiết đề tài).
export function isNavItemActive(
  item: NavItem,
  pathname: string,
  homeHref: string,
): boolean {
  if (item.href === homeHref) return pathname === homeHref;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function findNavItem(
  role: UserRole,
  pathname: string,
): NavItem | undefined {
  return ROLE_MENUS[role]
    .flatMap((section) => section.items)
    .find((item) => item.href === pathname);
}
