'use client';

import '@/features/users/users.css';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FileUp, Plus, Search } from 'lucide-react';
import { ROLE_LABEL } from '@/features/auth/roles';
import { useSession } from '@/features/auth/session/SessionProvider';
import { downloadErrorReport } from '@/features/users/csvReport';
import { ResetPasswordDialog } from '@/features/users/components/ResetPasswordDialog';
import { UserConfirmDialog } from '@/features/users/components/UserConfirmDialog';
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
  type UserImportRow,
  type UserStatus,
} from '@/types/user';

interface UserManagementPageProps {
  userService?: UserService;
}

type Dialog = {
  kind: 'reset' | 'remove' | 'reactivate';
  userId: string;
} | null;

interface Notice {
  text: string;
  // Dòng lỗi của lần nhập CSV vừa xong, để tải báo cáo.
  errorRows?: UserImportRow[];
}

const PAGE_SIZE = 10;
const ROLES: UserRole[] = ['Student', 'Lecturer', 'AcademicAffairs'];
const STATUSES: UserStatus[] = ['active', 'pending', 'disabled'];

const formatDate = (iso: string | null) => {
  if (!iso) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
};

const orgOf = (u: ManagedUser) => {
  if (u.role === 'Student') return u.className || '—';
  if (u.role === 'Lecturer')
    return u.department
      ? u.department + (u.academicTitle ? ` · ${u.academicTitle}` : '')
      : '—';
  return '—';
};

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
  const [notice, setNotice] = useState<Notice | null>(null);
  // Tài khoản vừa tạo trong phiên, tô nền nhạt trong bảng.
  const [freshIds, setFreshIds] = useState<ReadonlySet<string>>(new Set());

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

  const stats = useMemo(
    () => ({
      Student: users.filter((u) => u.role === 'Student').length,
      Lecturer: users.filter((u) => u.role === 'Lecturer').length,
      AcademicAffairs: users.filter((u) => u.role === 'AcademicAffairs').length,
      pending: users.filter((u) => getUserStatus(u) === 'pending').length,
    }),
    [users],
  );

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

  const handleSaved = (
    saved: ManagedUser,
    mode: 'create' | 'edit',
    keepOpen = false,
  ) => {
    setUsers((list) =>
      mode === 'create'
        ? [...list, saved]
        : list.map((u) => (u.id === saved.id ? saved : u)),
    );
    if (mode === 'create') setFreshIds((ids) => new Set(ids).add(saved.id));
    if (!keepOpen) setDrawer(null);
    setNotice({
      text:
        mode === 'create'
          ? `Đã tạo tài khoản ${saved.userCode}. Mật khẩu ban đầu là mã người dùng.`
          : `Đã lưu thông tin ${saved.fullName}.`,
    });
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
        setNotice({ text: `Đã xóa tài khoản ${user.userCode}.` });
      } else {
        setUsers((list) =>
          list.map((u) => (u.id === user.id ? { ...u, isActive: false } : u)),
        );
        setNotice({
          text: `Đã vô hiệu hóa tài khoản ${user.userCode}. Dữ liệu liên quan vẫn được giữ.`,
        });
      }
      setDialog(null);
      setDrawer(null);
    });

  const confirmReactivate = (user: ManagedUser) =>
    runDialogAction(async () => {
      const updated = await userService.setActive(user.id, true);
      setUsers((list) => list.map((u) => (u.id === user.id ? updated : u)));
      setNotice({
        text: `Đã kích hoạt lại tài khoản ${user.userCode}. Người dùng đăng nhập lại được bằng mật khẩu hiện tại.`,
      });
      setDialog(null);
      setDrawer(null);
    });

  const who = (u: ManagedUser) =>
    `${u.fullName} · ${u.userCode} · ${ROLE_LABEL[u.role]}`;

  const roleTabs: Array<{ value: UserRole | ''; label: string }> = [
    { value: '', label: 'Tất cả' },
    ...ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] })),
  ];

  const openAdd = () => {
    setNotice(null);
    setDrawer({ mode: 'create' });
  };
  const openImport = () => {
    setNotice(null);
    setImportOpen(true);
  };

  return (
    <div className="usr-page">
      <div className="usr-head">
        <div className="usr-head-text">
          <h1>Người dùng</h1>
          <p>
            Tài khoản sinh viên, giảng viên và giáo vụ. Giáo vụ tạo tài khoản
            trước khi ghi danh vào đợt; mật khẩu ban đầu là mã người dùng và
            người dùng phải đổi ở lần đăng nhập đầu.
          </p>
        </div>
        <div className="usr-head-actions">
          <button
            type="button"
            className="usr-btn usr-btn-lg"
            aria-haspopup="dialog"
            onClick={openImport}
          >
            <FileUp size={16} aria-hidden="true" />
            Nhập CSV
          </button>
          <button
            type="button"
            className="usr-btn usr-btn-lg usr-btn-primary"
            aria-haspopup="dialog"
            onClick={openAdd}
          >
            <Plus size={16} aria-hidden="true" />
            Thêm người dùng
          </button>
        </div>
      </div>

      {notice && (
        <div role="status" className="usr-notice">
          <span>{notice.text}</span>
          {notice.errorRows && notice.errorRows.length > 0 && (
            <button
              type="button"
              className="usr-link-button"
              onClick={() => downloadErrorReport(notice.errorRows ?? [])}
            >
              Tải báo cáo dòng lỗi (.csv)
            </button>
          )}
        </div>
      )}

      {!loading && !loadError && (
        <div className="usr-stats">
          <div className="usr-stat">
            <span className="usr-stat-label">Sinh viên</span>
            <span className="usr-stat-value">
              {stats.Student.toLocaleString('vi-VN')}
            </span>
          </div>
          <div className="usr-stat">
            <span className="usr-stat-label">Giảng viên</span>
            <span className="usr-stat-value">
              {stats.Lecturer.toLocaleString('vi-VN')}
            </span>
          </div>
          <div className="usr-stat">
            <span className="usr-stat-label">Giáo vụ</span>
            <span className="usr-stat-value">
              {stats.AcademicAffairs.toLocaleString('vi-VN')}
            </span>
          </div>
          <div className="usr-stat usr-stat-warn">
            <span className="usr-stat-label">Chưa đăng nhập lần đầu</span>
            <span className="usr-stat-value">
              {stats.pending.toLocaleString('vi-VN')}
            </span>
          </div>
        </div>
      )}

      <div className="usr-filters">
        <div role="group" aria-label="Lọc theo vai trò" className="usr-tabs">
          {roleTabs.map((tab) => (
            <button
              key={tab.value || 'all'}
              type="button"
              className="usr-tab"
              aria-pressed={roleFilter === tab.value}
              onClick={() => {
                setRoleFilter(tab.value);
                setPage(1);
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="usr-filter-right">
          <label className="usr-search">
            <Search size={16} aria-hidden="true" />
            <input
              type="search"
              aria-label="Tìm người dùng"
              placeholder="Tìm theo mã, họ tên, email"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <select
            className="usr-select"
            aria-label="Trạng thái tài khoản"
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
      </div>

      {loading ? (
        <p role="status" className="app-muted">
          Đang tải danh sách người dùng...
        </p>
      ) : loadError ? (
        <section className="status-state" role="alert">
          <h2>Không tải được danh sách</h2>
          <p>{loadError}</p>
          <button type="button" className="usr-btn" onClick={() => void load()}>
            Thử lại
          </button>
        </section>
      ) : (
        <div className="usr-table-box">
          <div className="usr-table-scroll">
            <table className="usr-table" aria-label="Danh sách người dùng">
              <thead>
                <tr>
                  <th scope="col">Mã</th>
                  <th scope="col">Họ tên · Email</th>
                  <th scope="col">Vai trò</th>
                  <th scope="col">Lớp / Bộ môn · Học hàm</th>
                  <th scope="col">Ngày sinh</th>
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
                    <tr
                      key={user.id}
                      className={freshIds.has(user.id) ? 'usr-row-new' : ''}
                    >
                      <td className="usr-code">{user.userCode}</td>
                      <td>
                        <span className="usr-person">
                          <span className="usr-name">
                            {user.fullName}
                            {isSelf(user) && (
                              <span className="usr-me">Bạn</span>
                            )}
                          </span>
                          <span className="usr-email">{user.email}</span>
                        </span>
                      </td>
                      <td>
                        <span className={`usr-role usr-role-${user.role}`}>
                          {ROLE_LABEL[user.role]}
                        </span>
                      </td>
                      <td>{orgOf(user)}</td>
                      <td className="usr-tabular">
                        {formatDate(user.dateOfBirth)}
                      </td>
                      <td>
                        <span className={`usr-status usr-status-${status}`}>
                          {USER_STATUS_LABEL[status]}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="usr-btn usr-btn-sm"
                          aria-haspopup="dialog"
                          aria-label={`Sửa ${user.fullName}`}
                          onClick={() => {
                            setNotice(null);
                            setDrawer({ mode: 'edit', userId: user.id });
                          }}
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
          {filtered.length === 0 && (
            <div className="usr-empty">
              {users.length === 0
                ? 'Chưa có người dùng nào. Thêm thủ công hoặc nhập từ tệp CSV.'
                : 'Không có người dùng nào khớp bộ lọc.'}
            </div>
          )}
          <nav className="usr-table-foot" aria-label="Phân trang">
            <span>
              Hiển thị {visible.length} trên {filtered.length} người dùng
            </span>
            <span className="usr-pager">
              <button
                type="button"
                className="usr-btn usr-btn-sm"
                disabled={currentPage <= 1}
                onClick={() => setPage(currentPage - 1)}
              >
                Trước
              </button>
              <span>
                Trang {currentPage} / {pageCount}
              </span>
              <button
                type="button"
                className="usr-btn usr-btn-sm"
                disabled={currentPage >= pageCount}
                onClick={() => setPage(currentPage + 1)}
              >
                Sau
              </button>
            </span>
          </nav>
        </div>
      )}

      <p className="usr-footnote">
        Tài khoản đã có dữ liệu (đề tài, phiếu chấm, bài nộp) không xóa được,
        chỉ vô hiệu hóa; tài khoản đã vô hiệu hóa có thể kích hoạt lại trong màn
        hình Sửa. Mã người dùng và email không được trùng.
      </p>

      {drawer && (drawer.mode === 'create' || editingUser) && (
        <UserFormDrawer
          // key để form khởi tạo lại khi chuyển sang người dùng khác.
          key={editingUser?.id ?? 'create'}
          user={editingUser}
          users={users}
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
          onDone={(custom) => {
            setNotice({
              text: `Đã đặt lại mật khẩu cho ${dialogUser.fullName}${custom ? '.' : ' về mã người dùng.'}`,
            });
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
        <UserConfirmDialog
          title={
            dialogUser.hasData ? 'Vô hiệu hóa tài khoản?' : 'Xóa tài khoản?'
          }
          who={who(dialogUser)}
          description={
            dialogUser.hasData
              ? 'Tài khoản đã có dữ liệu nên không xóa được. Hệ thống sẽ vô hiệu hóa: người dùng không đăng nhập được, dữ liệu dưới đây vẫn được giữ.'
              : 'Tài khoản chưa phát sinh dữ liệu (đề tài, nhóm, bài nộp, điểm, hội đồng) và sẽ bị xóa vĩnh viễn khỏi hệ thống.'
          }
          items={
            dialogUser.hasData
              ? [
                  'Đề tài, nhóm, bài nộp, điểm hoặc hội đồng đã gắn với tài khoản',
                ]
              : undefined
          }
          confirmLabel={dialogUser.hasData ? 'Vô hiệu hóa' : 'Xóa tài khoản'}
          danger
          busy={busy}
          error={actionError}
          onCancel={closeDialog}
          onConfirm={() => void confirmRemove(dialogUser)}
        />
      )}

      {dialog?.kind === 'reactivate' && dialogUser && (
        <UserConfirmDialog
          title={`Kích hoạt lại tài khoản ${dialogUser.userCode}?`}
          who={who(dialogUser)}
          description="Người dùng đăng nhập lại được bằng mật khẩu hiện tại. Dữ liệu đã có vẫn giữ nguyên."
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
          onImported={(report, fileName) => {
            const errorRows = report.rows.filter((r) => r.errors.length > 0);
            setNotice({
              text:
                `Đã nhập ${report.importedRows} người dùng từ ${fileName}` +
                (errorRows.length > 0
                  ? `; ${errorRows.length} dòng đã có hoặc lỗi không được nhập.`
                  : '.'),
              errorRows,
            });
            setImportOpen(false);
            void load();
          }}
        />
      )}
    </div>
  );
};
