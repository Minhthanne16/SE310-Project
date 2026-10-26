'use client';

import { useCallback, useEffect, useState } from 'react';

const read = (name: string): string | null =>
  typeof window === 'undefined'
    ? null
    : new URLSearchParams(window.location.search).get(name);

// Giữ một tham số tìm kiếm (?name=...) của URL trong state. Ghi bằng
// window.history (Next.js đồng bộ với router) nên không cần Suspense; nút
// Back/Forward của trình duyệt cập nhật lại giá trị.
export function useUrlParam(
  name: string,
): [string | null, (value: string | null, mode?: 'push' | 'replace') => void] {
  const [value, setValue] = useState<string | null>(() => read(name));

  useEffect(() => {
    const sync = () => setValue(read(name));
    sync();
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, [name]);

  const update = useCallback(
    (next: string | null, mode: 'push' | 'replace' = 'push') => {
      const url = new URL(window.location.href);
      if (next === null) url.searchParams.delete(name);
      else url.searchParams.set(name, next);
      const target = `${url.pathname}${url.search}`;
      if (mode === 'push') window.history.pushState(null, '', target);
      else window.history.replaceState(null, '', target);
      setValue(next);
    },
    [name],
  );

  return [value, update];
}
