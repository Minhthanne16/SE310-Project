import { StatusState } from '@/components/common/StatusState';

export default function NotFound() {
  return (
    <div className="app-gate">
      <StatusState
        variant="notFound"
        action={{ href: '/login', label: 'Về trang đăng nhập' }}
      />
    </div>
  );
}
