import type { Metadata } from 'next';
import { StatusState } from '@/components/common/StatusState';

export const metadata: Metadata = {
  title: 'Quên mật khẩu · QLKLTN',
};

// Luồng Quên mật khẩu (liên kết 30 phút) chưa có trong phạm vi hiện tại.
export default function ForgotPassword() {
  return (
    <div className="app-gate">
      <StatusState
        variant="building"
        title="Quên mật khẩu đang xây dựng"
        description="Nếu không đăng nhập được, hãy liên hệ Giáo vụ Khoa để được đặt lại mật khẩu."
        action={{ href: '/login', label: 'Quay lại đăng nhập' }}
      />
    </div>
  );
}
