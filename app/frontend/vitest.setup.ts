import '@testing-library/jest-dom/vitest';
import { createElement } from 'react';
import { render } from '@testing-library/react';
import toast from 'react-hot-toast';
import { afterEach, beforeEach } from 'vitest';
import { AppToaster } from '@/components/ui/AppToaster';

// jsdom không có matchMedia; react-hot-toast dùng nó để đọc prefers-reduced-motion.
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

// Trong ứng dụng AppShell gắn sẵn AppToaster; test render từng trang riêng lẻ
// nên gắn ở đây để kiểm tra được nội dung toast (toast.success/error).
let toaster: ReturnType<typeof render> | undefined;

beforeEach(() => {
  toaster = render(createElement(AppToaster));
});

afterEach(() => {
  toaster?.unmount();
  toaster = undefined;
  toast.remove();
});
