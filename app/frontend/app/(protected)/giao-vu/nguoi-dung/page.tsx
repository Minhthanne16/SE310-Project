import { UserManagementPage } from '@/features/users/components/UserManagementPage';

// Trang thật được ưu tiên hơn route catch-all [...slug]; vai trò Giáo vụ đã
// được layout giao-vu kiểm soát.
export default function Page() {
  return <UserManagementPage />;
}
