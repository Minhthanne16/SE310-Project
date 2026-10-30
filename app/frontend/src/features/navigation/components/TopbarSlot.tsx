'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

interface TopbarSlotValue {
  element: HTMLElement | null;
  register: (delta: 1 | -1) => void;
}

export const TopbarSlotContext = createContext<TopbarSlotValue | null>(null);

// Cho trang đặt nội dung riêng vào bên trái thanh trên (ví dụ nút "Tất cả
// đợt" và ô Đợt của artboard TrangChu). Khi có nội dung này, tiêu đề mặc định
// của thanh trên được ẩn. Ngoài AppShell (ví dụ trong test) nội dung hiện tại
// chỗ.
export const TopbarContent: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const ctx = useContext(TopbarSlotContext);
  const register = ctx?.register;
  useEffect(() => {
    register?.(1);
    return () => register?.(-1);
  }, [register]);

  if (!ctx) return <>{children}</>;
  return ctx.element ? createPortal(children, ctx.element) : null;
};

export function useTopbarSlotValue(
  element: HTMLElement | null,
  register: (delta: 1 | -1) => void,
) {
  return useMemo(() => ({ element, register }), [element, register]);
}
