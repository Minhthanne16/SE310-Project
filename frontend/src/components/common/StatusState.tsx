import React from 'react';
import Link from 'next/link';
import { Construction, SearchX } from 'lucide-react';

// Hai biến thể của artboard Trang404: mục chưa làm và không tìm thấy trang.
export type StatusVariant = 'building' | 'notFound';

interface StatusStateProps {
  variant: StatusVariant;
  title?: string;
  description?: string;
  action?: { href: string; label: string };
}

const DEFAULTS: Record<StatusVariant, { title: string; description: string }> =
  {
    building: {
      title: 'Đang xây dựng',
      description: 'Mục này chưa được làm. Vui lòng quay lại sau.',
    },
    notFound: {
      title: 'Không tìm thấy trang',
      description: 'Đường dẫn không tồn tại hoặc đã được đổi.',
    },
  };

export const StatusState: React.FC<StatusStateProps> = ({
  variant,
  title,
  description,
  action,
}) => {
  const Icon = variant === 'building' ? Construction : SearchX;
  return (
    <section className="status-state" aria-labelledby="status-state-title">
      <Icon size={28} aria-hidden="true" />
      <h2 id="status-state-title">{title ?? DEFAULTS[variant].title}</h2>
      <p>{description ?? DEFAULTS[variant].description}</p>
      {action && (
        <Link className="status-state-action" href={action.href}>
          {action.label}
        </Link>
      )}
    </section>
  );
};
