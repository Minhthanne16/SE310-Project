'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Các hộp thoại đang mở (trên cùng là phần tử cuối): chỉ hộp trên cùng giữ Tab.
const stack: HTMLElement[] = [];

interface DialogFocusOptions {
  // Phần tử nhận tiêu điểm đầu tiên; mặc định là phần tử focus được đầu tiên.
  initialFocusRef?: RefObject<HTMLElement | null>;
  // Nơi trả tiêu điểm khi phần tử đã mở hộp thoại không còn trong DOM;
  // mặc định là h1 của trang.
  fallbackRef?: RefObject<HTMLElement | null>;
}

// Quản lý tiêu điểm cho hộp thoại/ngăn kéo: nhớ phần tử đang focus trước khi
// mở, chuyển tiêu điểm vào hộp, giữ Tab/Shift+Tab bên trong, và trả tiêu điểm
// khi đóng. Gắn ref trả về vào phần tử role="dialog".
export function useDialogFocus<T extends HTMLElement>(
  options: DialogFocusOptions = {},
): RefObject<T | null> {
  const containerRef = useRef<T>(null);
  // Chụp ở lần render đầu, trước khi autoFocus của ô nhập kịp chuyển tiêu điểm.
  const [previous] = useState<Element | null>(() =>
    typeof document === 'undefined' ? null : document.activeElement,
  );
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    stack.push(container);

    if (!container.contains(document.activeElement)) {
      const target =
        optionsRef.current.initialFocusRef?.current ??
        container.querySelector<HTMLElement>(FOCUSABLE) ??
        container;
      if (target === container && !container.hasAttribute('tabindex'))
        container.setAttribute('tabindex', '-1');
      target.focus();
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || stack[stack.length - 1] !== container) return;
      const items = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE),
      );
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (!container.contains(active)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);

    return () => {
      document.removeEventListener('keydown', onKey);
      const index = stack.lastIndexOf(container);
      if (index >= 0) stack.splice(index, 1);
      const back =
        previous instanceof HTMLElement &&
        previous !== document.body &&
        document.contains(previous)
          ? previous
          : (optionsRef.current.fallbackRef?.current ??
            document.querySelector<HTMLElement>('main h1'));
      if (back) {
        if (!back.matches(FOCUSABLE) && !back.hasAttribute('tabindex'))
          back.setAttribute('tabindex', '-1');
        back.focus();
      }
    };
  }, [previous]);

  return containerRef;
}
