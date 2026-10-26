'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { FileUp, Plus, Search } from 'lucide-react';
import { ROLE_LABEL } from '@/features/auth/roles';
import { useSession } from '@/features/auth/session/SessionProvider';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ResetPasswordDialog } from '@/features/users/components/ResetPasswordDialog';
import { UserFormDrawer } from '@/features/users/components/UserFormDrawer';
import { UserImportDialog } from '@/features/users/components/UserImportDialog';
import {
  userService as defaultUserService,
  type UserService,
} from '@/features/users/services/userService';
import type { UserRole } from '@/types/auth';
import {
  getUserStatus,
  USER_STATUS_LABEL,
  type ManagedUser,
  type UserStatus,
} from '@/types/user';

interface UserManagementPageProps {
  userService?: UserService;
}

type Dialog = {
  kind: 'reset' | 'remove' | 'reactivate';
  userId: string;
} | null;

const PAGE_SIZE = 10;
const ROLES: UserRole[] = ['Student', 'Lecturer', 'AcademicAffairs'];
const STATUSES: UserStatus[] = ['active', 'pending', 'disabled'];

// Màn Quản lý người dùng của Giáo vụ (docs/DESIGN/03). Lọc và phân trang phía
// client trên danh sách tải một lần từ userService.
export const UserManagementPage: React.FC<UserManagementPageProps> = ({
  userService = defaultUserService,
}) => {
  const { session } = useSession();
  const me = session.status === 'authenticated' ? session.user : null;

  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<UserRole | ''>('');
  const [statusFilter, setStatusFilter] = useState<UserStatus | ''>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [drawer, setDrawer] = useState<
    { mode: 'create' } | { mode: 'edit'; userId: string } | null
  >(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setUsers(await userService.list());
    } catch (err: unknown) {
      setLoadError(
        err instanceof Error && err.message
          ? err.message
          : 'Không tải được danh sách người dùng.',
      );
    } finally {
      setLoading(false);
    }
  }, [userService]);

  useEffect(() => {
    void load();
  }, [load]);

  // Không có id người dùng trong phiên demo trùng với backend, nên so cả mã.
  const isSelf = (user: ManagedUser) =>
    !!me && (user.id === me.id || user.userCode === me.userCode);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return users.filter(
      (u) =>
        (!roleFilter || u.role === roleFilter) &&
        (!statusFilter || getUserStatus(u) === statusFilter) &&
        (!keyword ||
          [u.userCode, u.fullName, u.email].some((v) =>
            v.toLowerCase().includes(keyword),
          )),
    );
  }, [users, roleFilter, statusFilter, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const editingUser =
    drawer?.mode === 'edit'
      ? users.find((u) => u.id === drawer.userId)
      : undefined;
  const dialogUser = dialog
    ? users.find((u) => u.id === dialog.userId)
    : undefined;

  const closeDrawer = useCallback(() => setDrawer(null), []);
  const closeDialog = useCallback(() => {
    setDialog(null);
    setActionError(null);
  }, []);
  const closeImport = useCallback(() => setImportOpen(false), []);

  const handleSaved = (saved: ManagedUser, mode: 'create' | 'edit') => {
    setUsers((list) =>
      mode === 'create'
        ? [...list, saved]
        : list.map((u) => (u.id === saved.id ? saved : u)),
    );
    setDrawer(null);
    toast.success(
      mode === 'create' ? 'Đã thêm người dùng.' : 'Đã lưu thay đổi.',
    );
  };

  // Chạy hành động của hộp thoại xác nhận, báo lỗi ngay trong hộp thoại.
  const runDialogAction = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setActionError(null);
    try {
      await action();
    } catch (err: unknown) {
      setActionError(
        err instanceof Error && err.message
          ? err.message
          : 'Thao tác thất bại. Thử lại sau.',
      );
    } finally {
      setBusy(false);
    }
  };

  const confirmRemove = (user: ManagedUser) =>
    runDialogAction(async () => {
      if (isSelf(user))
        throw new Error('Không thể xóa chính tài khoản của bạn.');
      const result = await userService.remove(user.id);
      if (result === 'deleted') {
        setUsers((list) => list.filter((u) => u.id !== user.id));
        toast.success('Đã xóa người dùng.');
      } else {
        setUsers((list) =>
          list.map((u) => (u.id === user.id ? { ...u, isActive: false } : u)),
        );
        toast.success('Đã vô hiệu hóa người dùng.');
      }
      setDialog(null);
      setDrawer(null);
    });

  const confirmReactivate = (user: ManagedUser) =>
    runDialogAction(async () => {
      const updated = await userService.setActive(user.id, true);
      setUsers((list) => list.map((u) => (u.id === user.id ? updated : u)));
      toast.success('Đã kích hoạt lại người dùng.');
      setDialog(null);
    });

  const removeLabel = (user: ManagedUser) =>
    user.hasData ? 'Vô hiệu hóa' : 'Xóa người dùng';

  return (
    <>
      <div className="app-page-heading">
        <h1>Quản lý người dùng</h1>
        <p>
          Thêm, sửa, nhập CSV, đặt lại mật khẩu và xóa hoặc vô hiệu hóa tài
          khoản.
        </p>
      </div>

      <div className="app-toolbar">
        <div
          className="app-filters"
          role="search"
          aria-label="Lọc vai trò, trạng thái, tìm kiếm"
        >
          <div className="app-search">
            <Search size={16} aria-hidden="true" />
            <input
              type="search"
              aria-label="Tìm kiếm"
              placeholder="Tìm theo mã, họ tên, email"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <select
            className="app-select"
            aria-label="Lọc theo vai trò"
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value as UserRole | '');
              setPage(1);
            }}
          >
            <option value="">Tất cả vai trò</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
          <select
            className="app-select"
            aria-label="Lọc theo trạng thái"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as UserStatus | '');
              setPage(1);
            }}
          >
            <option value="">Tất cả trạng thái</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {USER_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="app-toolbar-actions">
          <button
            type="button"
            className="app-button"
            aria-haspopup="dialog"
            onClick={() => setImportOpen(true)}
          >
            <FileUp size={16} aria-hidden="true" />
            Nhập CSV
          </button>
          <button
            type="button"
            className="app-button app-button-primary"
            aria-haspopup="dialog"
            onClick={() => setDrawer({ mode: 'create' })}
          >
            <Plus size={16} aria-hidden="true" />
            Thêm
          </button>
        </div>
      </div>

      {loading ? (
        <p role="status" className="app-muted">
          Đang tải danh sách người dùng...
        </p>
      ) : loadError ? (
        <section className="status-state" role="alert">
          <h2>Không tải được danh sách</h2>
          <p>{loadError}</p>
          <button
            type="button"
            className="app-button"
            onClick={() => void load()}
          >
            Thử lại
          </button>
        </section>
      ) : filtered.length === 0 ? (
        <section className="status-state app-empty">
          <h2>Không có người dùng phù hợp</h2>
          <p>
            {users.length === 0
              ? 'Chưa có người dùng nào. Thêm thủ công hoặc nhập từ tệp CSV.'
              : 'Thử đổi bộ lọc hoặc từ khóa tìm kiếm.'}
          </p>
        </section>
      ) : (
        <>
          <div className="app-table-scroll">
            <table className="app-table app-user-table">
              <thead>
                <tr>
                  <th scope="col">Mã</th>
                  <th scope="col">Họ tên</th>
                  <th scope="col">Email</th>
                  <th scope="col">Vai trò</th>
                  <th scope="col">Lớp / Bộ môn</th>
                  <th scope="col">Trạng thái</th>
                  <th scope="col">
                    <span className="app-visually-hidden">Thao tác</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((user) => {
                  const status = getUserStatus(user);
                  return (
                    <tr key={user.id}>
                      <td>{user.userCode}</td>
                      <td>{user.fullName}</td>
                      <td>{user.email}</td>
                      <td>
                        <span className={`app-chip app-chip-${user.role}`}>
                          {ROLE_LABEL[user.role]}
                        </span>
                      </td>
                      <td>{user.className ?? user.department ?? '—'}</td>
                      <td>
                        <span className={`app-chip app-chip-${status}`}>
                          {USER_STATUS_LABEL[status]}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="app-button app-button-small"
                          aria-haspopup="dialog"
                          aria-label={`Sửa ${user.fullName}`}
                          onClick={() =>
                            setDrawer({ mode: 'edit', userId: user.id })
                          }
                        >
                          Sửa
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <nav className="app-pagination" aria-label="Phân trang">
            <span className="app-muted">
              {filtered.length} người dùng · Trang {currentPage}/{pageCount}
            </span>
            <div className="app-toolbar-actions">
              <button
                type="button"
                className="app-button app-button-small"
                disabled={currentPage <= 1}
                onClick={() => setPage(currentPage - 1)}
              >
                Trước
              </button>
              <button
                type="button"
                className="app-button app-button-small"
                disabled={currentPage >= pageCount}
                onClick={() => setPage(currentPage + 1)}
              >
                Sau
              </button>
            </div>
          </nav>
        </>
      )}

      {drawer && (drawer.mode === 'create' || editingUser) && (
        <UserFormDrawer
          // key để form khởi tạo lại khi chuyển sang người dùng khác.
          key={editingUser?.id ?? 'create'}
          user={editingUser}
          userService={userService}
          isSelf={!!editingUser && isSelf(editingUser)}
          escapeDisabled={!!dialog}
          onClose={closeDrawer}
          onSaved={handleSaved}
          onResetPassword={() =>
            editingUser && setDialog({ kind: 'reset', userId: editingUser.id })
          }
          onRemove={() =>
            editingUser && setDialog({ kind: 'remove', userId: editingUser.id })
          }
          onReactivate={() =>
            editingUser &&
            setDialog({ kind: 'reactivate', userId: editingUser.id })
          }
        />
      )}

      {dialog?.kind === 'reset' && dialogUser && (
        <ResetPasswordDialog
          user={dialogUser}
          userService={userService}
          onClose={closeDialog}
          onDone={() => {
            toast.success('Đã đặt lại mật khẩu.');
            setUsers((list) =>
              list.map((u) =>
                u.id === dialogUser.id ? { ...u, mustChangePassword: true } : u,
              ),
            );
            closeDialog();
          }}
        />
      )}

      {dialog?.kind === 'remove' && dialogUser && (
        <ConfirmDialog
          title={
            dialogUser.hasData
              ? `Vô hiệu hóa ${dialogUser.fullName}?`
              : `Xóa ${dialogUser.fullName}?`
          }
          description={
            dialogUser.hasData
              ? 'Người dùng đã có dữ liệu nên không thể xóa. Tài khoản sẽ bị vô hiệu hóa và không đăng nhập được; có thể kích hoạt lại sau.'
              : 'Người dùng chưa có dữ liệu. Tài khoản sẽ bị xóa hẳn và không thể khôi phục.'
          }
          cancelLabel={dialogUser.hasData ? 'Giữ hoạt động' : 'Hủy'}
          confirmLabel={removeLabel(dialogUser)}
          danger
          busy={busy}
          error={actionError}
          onCancel={closeDialog}
          onConfirm={() => void confirmRemove(dialogUser)}
        />
      )}

      {dialog?.kind === 'reactivate' && dialogUser && (
        <ConfirmDialog
          title={`Kích hoạt lại ${dialogUser.fullName}?`}
          description="Tài khoản sẽ đăng nhập được trở lại với mật khẩu hiện có."
          cancelLabel="Hủy"
          confirmLabel="Kích hoạt lại"
          busy={busy}
          error={actionError}
          onCancel={closeDialog}
          onConfirm={() => void confirmReactivate(dialogUser)}
        />
      )}

      {importOpen && (
        <UserImportDialog
          userService={userService}
          onClose={closeImport}
          onImported={(report) => {
            toast.success(`Đã nhập ${report.importedRows} người dùng.`);
            void load();
          }}
        />
      )}
    </>
  );
};
