'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, SearchX, Wrench } from 'lucide-react';

// Hai biến thể của artboard Trang404: mục chưa làm và không tìm thấy trang.
export type StatusVariant = 'building' | 'notFound';

interface StatusStateProps {
  variant: StatusVariant;
  title?: string;
  description?: string;
  action?: { href: string; label: string };
  // true: bố cục cả trang của Trang404 (chữ 404, tiêu đề h1, hai nút).
  // false: khung viền đứt gọn dùng trong nội dung trang.
  fullPage?: boolean;
}

const DEFAULTS: Record<
  StatusVariant,
  { eyebrow: string; title: string; description: string }
> = {
  building: {
    eyebrow: 'TRANG ĐANG XÂY DỰNG',
    title: 'Trang này chưa được hoàn thiện',
    description:
      'Chức năng này đang trong quá trình phát triển và sẽ có trong phiên bản sau. Bạn có thể quay lại trang trước hoặc về trang chủ.',
  },
  notFound: {
    eyebrow: 'KHÔNG TÌM THẤY TRANG',
    title: 'Không tìm thấy trang bạn cần',
    description:
      'Đường dẫn có thể đã sai, hoặc trang đã được chuyển đi. Kiểm tra lại đường dẫn, hoặc về trang chủ để tiếp tục.',
  },
};

export const StatusState: React.FC<StatusStateProps> = ({
  variant,
  title,
  description,
  action,
  fullPage = false,
}) => {
  const Icon = variant === 'building' ? Wrench : SearchX;
  const text = DEFAULTS[variant];

  if (!fullPage)
    return (
      <section className="status-state" aria-labelledby="status-state-title">
        <Icon size={28} aria-hidden="true" />
        <h2 id="status-state-title">{title ?? text.title}</h2>
        <p>{description ?? text.description}</p>
        {action && (
          <Link className="status-state-action" href={action.href}>
            {action.label}
          </Link>
        )}
      </section>
    );

  return (
    <section className="status-page" aria-labelledby="status-page-title">
      <div className="status-page-art" aria-hidden="true">
        <span className="status-page-code">404</span>
        <span className="status-page-icon">
          <Icon size={28} strokeWidth={1.8} />
        </span>
      </div>
      <span className="status-page-eyebrow">{text.eyebrow}</span>
      <h1 id="status-page-title">{title ?? text.title}</h1>
      <p>{description ?? text.description}</p>
      <div className="status-page-actions">
        <button
          type="button"
          className="status-page-back"
          onClick={() => {
            try {
              window.history.back();
            } catch {
              // Không có lịch sử để quay lại: người dùng dùng nút về trang chủ.
            }
          }}
        >
          <ArrowLeft size={16} strokeWidth={1.8} aria-hidden="true" />
          Quay lại trang trước
        </button>
        {action && (
          <Link className="status-page-home" href={action.href}>
            {action.label}
          </Link>
        )}
      </div>
    </section>
  );
};
