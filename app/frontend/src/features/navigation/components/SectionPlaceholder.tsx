'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { StatusState } from '@/components/ui/StatusState';
import { ROLE_HOME } from '@/features/auth/roles';
import { useSession } from '@/features/auth/session/SessionProvider';
import { findNavItem } from '@/features/navigation/menuConfig';

// Hiển thị cho route của vai trò chưa có trang thật: mục có trong menu là
// "Đang xây dựng", đường dẫn lạ là "Không tìm thấy". Trang thật đặt tại
// app/<vai-trò>/<mục>/page.tsx sẽ tự được ưu tiên hơn route catch-all.
export const SectionPlaceholder: React.FC = () => {
  const { session } = useSession();
  const pathname = usePathname() ?? '';
  if (session.status !== 'authenticated') return null;

  const { user } = session;
  const item = findNavItem(user.role, pathname);
  const home = ROLE_HOME[user.role];

  if (pathname === home) {
    return (
      <>
        <div className="app-page-heading">
          <h1>Chào {user.fullName}</h1>
          <p>Trang chủ hiển thị các đợt khóa luận và việc cần làm của bạn.</p>
        </div>
        <StatusState
          variant="building"
          description="Danh sách đợt, việc cần làm và bảng thông báo chưa được làm. Bạn có thể quay lại sau."
        />
      </>
    );
  }

  return (
    <StatusState
      variant={item ? 'building' : 'notFound'}
      fullPage
      action={{ href: home, label: 'Về trang chủ' }}
    />
  );
};
