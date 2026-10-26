'use client';

import { useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

// Một tham số tìm kiếm (?name=...) của URL làm state. Đọc từ useSearchParams
// nên đổi URL bằng liên kết của Next (ví dụ menu "Trang chủ") cũng cập nhật.
// Trang dùng hook này phải nằm trong <Suspense>.
export function useUrlParam(
  name: string,
): [string | null, (value: string | null, mode?: 'push' | 'replace') => void] {
  const params = useSearchParams();
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const value = params?.get(name) ?? null;
  const query = params?.toString() ?? '';

  const update = useCallback(
    (next: string | null, mode: 'push' | 'replace' = 'push') => {
      const search = new URLSearchParams(query);
      if (next === null) search.delete(name);
      else search.set(name, next);
      const qs = search.toString();
      router[mode](qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [name, pathname, query, router],
  );

  return [value, update];
}
