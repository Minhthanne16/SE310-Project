import { useSyncExternalStore } from 'react';
import { vi } from 'vitest';

// Giả lập next/navigation cho test: URL nằm trong một store nhỏ, push/replace
// đổi URL và thông báo cho useSearchParams/usePathname (không cần popstate).
// Dùng: vi.mock('next/navigation', async () => (await import('@/test/navigationMock')).navigationModule)
let current = '/';
const listeners = new Set<() => void>();

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
const getSnapshot = () => current;

export const setUrl = (url: string) => {
  current = url;
  listeners.forEach((fn) => fn());
};

export const push = vi.fn((url: string) => setUrl(url));
export const replace = vi.fn((url: string) => setUrl(url));
const router = { push, replace };

export const resetNavigation = (url = '/') => {
  push.mockClear();
  replace.mockClear();
  setUrl(url);
};

export const navigationModule = {
  useRouter: () => router,
  usePathname: () => {
    const url = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
    return url.split('?')[0];
  },
  useSearchParams: () => {
    const url = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
    return new URLSearchParams(url.split('?')[1] ?? '');
  },
};

export const currentUrl = () => current;
