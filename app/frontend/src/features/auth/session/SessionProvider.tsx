'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  authService as defaultAuthService,
  type AuthService,
} from '@/features/auth/services/authService';
import type { CurrentUser } from '@/types/auth';

// Nguồn trạng thái phiên duy nhất cho các trang sau đăng nhập. Vai trò luôn
// lấy từ backend qua /api/auth/me, UI không có cách tự đặt vai trò.
export type SessionState =
  | { status: 'loading' }
  | { status: 'authenticated'; user: CurrentUser }
  | { status: 'unauthenticated' }
  | { status: 'error'; message: string };

interface SessionContextValue {
  session: SessionState;
  authService: AuthService;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

interface SessionProviderProps {
  authService?: AuthService;
  children: React.ReactNode;
}

export const SessionProvider: React.FC<SessionProviderProps> = ({
  authService = defaultAuthService,
  children,
}) => {
  const [session, setSession] = useState<SessionState>({ status: 'loading' });

  const refresh = useCallback(async () => {
    setSession({ status: 'loading' });
    try {
      const user = await authService.getCurrentUser();
      setSession(
        user
          ? { status: 'authenticated', user }
          : { status: 'unauthenticated' },
      );
    } catch (err: unknown) {
      setSession({
        status: 'error',
        message:
          err instanceof Error ? err.message : 'Không kiểm tra được phiên.',
      });
    }
  }, [authService]);

  // Lỗi khi đăng xuất được ném lại để UI báo; phiên chỉ xóa khi API thành công.
  const logout = useCallback(async () => {
    await authService.logout();
    setSession({ status: 'unauthenticated' });
  }, [authService]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({ session, authService, refresh, logout }),
    [session, authService, refresh, logout],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
};

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession phải nằm trong SessionProvider');
  return value;
}
