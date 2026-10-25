import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ApiError } from '@/api/request';
import { SessionProvider } from '@/features/auth/session/SessionProvider';
import type { AuthService } from '@/features/auth/services/authService';
import {
  createUserService,
  type UserService,
} from '@/features/users/services/userService';
import type { CurrentUser } from '@/types/auth';
import type { UserImportReport } from '@/types/user';
import { UserManagementPage } from './UserManagementPage';

afterEach(cleanup);

// Trùng mã GV001 trong dữ liệu demo: đây là tài khoản của chính Giáo vụ.
const me: CurrentUser = {
  id: 'real-guid',
  userCode: 'GV001',
  fullName: 'Phạm Minh Châu',
  email: 'chau.pm@truong.edu.vn',
  role: 'AcademicAffairs',
  mustChangePassword: false,
};

const fakeAuth = (): AuthService => ({
  login: vi.fn(),
  getCurrentUser: vi.fn().mockResolvedValue(me),
  sendActivationCode: vi.fn(),
  changeInitialPassword: vi.fn(),
  changePassword: vi.fn(),
  logout: vi.fn(),
});

const renderPage = async (service: UserService = createUserService()) => {
  render(
    <SessionProvider authService={fakeAuth()}>
      <UserManagementPage userService={service} />
    </SessionProvider>,
  );
  await screen.findByText('Nguyễn Văn An');
  return service;
};

const edit = (name: string) =>
  fireEvent.click(screen.getByRole('button', { name: `Sửa ${name}` }));

const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

it('lists users and filters by role, status and search', async () => {
  await renderPage();
  expect(
    screen.getByRole('heading', { name: 'Quản lý người dùng' }),
  ).toBeInTheDocument();
  expect(screen.getByText('Hoàng Gia Huy')).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('Lọc theo vai trò'), {
    target: { value: 'Lecturer' },
  });
  expect(screen.getByText('Nguyễn Thị Hương')).toBeInTheDocument();
  expect(screen.queryByText('Nguyễn Văn An')).not.toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('Lọc theo vai trò'), {
    target: { value: '' },
  });
  fireEvent.change(screen.getByLabelText('Lọc theo trạng thái'), {
    target: { value: 'disabled' },
  });
  expect(screen.getByText('Hoàng Gia Huy')).toBeInTheDocument();
  expect(screen.queryByText('Nguyễn Văn An')).not.toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('Lọc theo trạng thái'), {
    target: { value: '' },
  });
  fireEvent.change(screen.getByLabelText('Tìm kiếm'), {
    target: { value: 'khong-co-ai' },
  });
  expect(screen.getByText('Không có người dùng phù hợp')).toBeInTheDocument();
});

it('shows required-field errors and the role-specific fields in the add drawer', async () => {
  await renderPage();
  fireEvent.click(screen.getByRole('button', { name: 'Thêm' }));
  const drawer = screen.getByRole('dialog', { name: 'Thêm người dùng' });
  expect(within(drawer).getByLabelText(/Lớp/)).toBeInTheDocument();

  fireEvent.click(
    within(drawer).getByRole('button', { name: 'Thêm người dùng' }),
  );
  expect(screen.getByText('Nhập mã người dùng.')).toBeInTheDocument();
  expect(screen.getByLabelText(/Mã người dùng/)).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  expect(screen.getByText('Nhập lớp của sinh viên.')).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('Vai trò'), {
    target: { value: 'Lecturer' },
  });
  expect(screen.getByLabelText(/Bộ môn/)).toBeInTheDocument();
  expect(screen.getByLabelText('Học hàm')).toBeInTheDocument();
  expect(screen.queryByLabelText(/Lớp/)).not.toBeInTheDocument();
});

it('reports duplicate code and duplicate email from the service', async () => {
  await renderPage();
  fireEvent.click(screen.getByRole('button', { name: 'Thêm' }));
  type('Mã người dùng *', '22520001');
  type('Họ tên *', 'Người Trùng');
  type('Email *', 'moi@truong.edu.vn');
  type('Lớp *', 'KTPM2024');
  fireEvent.click(screen.getByRole('button', { name: 'Thêm người dùng' }));
  expect(await screen.findByText('Mã người dùng đã tồn tại.')).toBeVisible();

  type('Mã người dùng *', '22529999');
  type('Email *', 'AN.NV@truong.edu.vn');
  fireEvent.click(screen.getByRole('button', { name: 'Thêm người dùng' }));
  expect(
    await screen.findByText('Email đã được dùng cho tài khoản khác.'),
  ).toBeVisible();

  type('Email *', 'moi@truong.edu.vn');
  fireEvent.click(screen.getByRole('button', { name: 'Thêm người dùng' }));
  expect(await screen.findByText('22529999')).toBeInTheDocument();
});

it('blocks the signed-in staff member from disabling or deleting themselves', async () => {
  await renderPage();
  edit('Phạm Minh Châu');
  expect(screen.getByRole('button', { name: 'Vô hiệu hóa' })).toBeDisabled();
  expect(
    screen.getByText(/không thể xóa hoặc vô hiệu hóa chính tài khoản/),
  ).toBeInTheDocument();
});

it('deletes a user without data after confirmation', async () => {
  await renderPage();
  edit('Đỗ Thu Trang');
  fireEvent.click(screen.getByRole('button', { name: 'Xóa người dùng' }));
  const confirm = screen.getByRole('alertdialog');
  expect(within(confirm).getByRole('button', { name: 'Hủy' })).toHaveFocus();
  fireEvent.click(
    within(confirm).getByRole('button', { name: 'Xóa người dùng' }),
  );
  await waitFor(() =>
    expect(screen.queryByText('Đỗ Thu Trang')).not.toBeInTheDocument(),
  );
});

it('disables a user with data, then reactivates them', async () => {
  await renderPage();
  edit('Nguyễn Văn An');
  fireEvent.click(screen.getByRole('button', { name: 'Vô hiệu hóa' }));
  fireEvent.click(
    within(screen.getByRole('alertdialog')).getByRole('button', {
      name: 'Vô hiệu hóa',
    }),
  );
  await waitFor(() =>
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument(),
  );
  expect(screen.getByText('Nguyễn Văn An')).toBeInTheDocument();

  edit('Nguyễn Văn An');
  fireEvent.click(screen.getByRole('button', { name: 'Kích hoạt lại' }));
  fireEvent.click(
    within(screen.getByRole('alertdialog')).getByRole('button', {
      name: 'Kích hoạt lại',
    }),
  );
  await waitFor(() =>
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument(),
  );
  expect(
    screen.queryByRole('button', { name: 'Kích hoạt lại' }),
  ).not.toBeInTheDocument();
});

it('resets a password to a custom value only when it follows the rules', async () => {
  const service = await renderPage();
  const reset = vi.spyOn(service, 'resetPassword');
  edit('Lê Thị Bình');
  fireEvent.click(screen.getByRole('button', { name: 'Đặt lại mật khẩu' }));
  fireEvent.click(screen.getByLabelText('Nhập mật khẩu mới'));
  type('Mật khẩu mới', 'abc');
  type('Nhập lại mật khẩu mới', 'abc');
  const dialog = screen.getByRole('dialog', { name: 'Đặt lại mật khẩu' });
  fireEvent.click(
    within(dialog).getByRole('button', { name: 'Đặt lại mật khẩu' }),
  );
  expect(reset).not.toHaveBeenCalled();

  type('Mật khẩu mới', 'matkhau123');
  type('Nhập lại mật khẩu mới', 'matkhau123');
  fireEvent.click(
    within(dialog).getByRole('button', { name: 'Đặt lại mật khẩu' }),
  );
  await waitFor(() =>
    expect(reset).toHaveBeenCalledWith(expect.any(String), 'matkhau123'),
  );
});

const importReport: UserImportReport = {
  totalRows: 2,
  validRows: 1,
  errorRows: 1,
  importedRows: 0,
  rows: [
    {
      rowNumber: 2,
      userCode: '23520100',
      fullName: 'Phan Mai',
      email: 'mai.p@truong.edu.vn',
      role: 'Student',
      dateOfBirth: null,
      className: 'KTPM2023',
      department: null,
      academicTitle: null,
      errors: [],
    },
    {
      rowNumber: 3,
      userCode: 'bad code',
      fullName: '=cmd',
      email: 'x',
      role: 'Student',
      dateOfBirth: null,
      className: null,
      department: null,
      academicTitle: null,
      errors: ['Email không hợp lệ.'],
    },
  ],
};

it('previews a CSV with per-row errors, then imports the valid rows', async () => {
  const service = createUserService();
  const importPreview = vi.fn().mockResolvedValue(importReport);
  const importCommit = vi
    .fn()
    .mockResolvedValue({ ...importReport, importedRows: 1 });
  await renderPage({ ...service, importPreview, importCommit });

  fireEvent.click(screen.getByRole('button', { name: 'Nhập CSV' }));
  const dialog = screen.getByRole('dialog', { name: 'Nhập người dùng từ CSV' });

  // Sai định dạng: không phải .csv.
  const input = within(dialog).getByLabelText('Tệp CSV');
  fireEvent.change(input, {
    target: { files: [new File(['x'], 'danh-sach.xlsx')] },
  });
  expect(within(dialog).getByRole('alert')).toHaveTextContent('.csv');
  expect(
    within(dialog).getByRole('button', { name: 'Xem trước' }),
  ).toBeDisabled();

  const file = new File(['user_code'], 'danh-sach.csv', { type: 'text/csv' });
  fireEvent.change(input, { target: { files: [file] } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Xem trước' }));

  expect(await within(dialog).findByText('Email không hợp lệ.')).toBeVisible();
  expect(importPreview).toHaveBeenCalledWith(file);
  expect(
    within(dialog).getByRole('button', { name: 'Tải báo cáo lỗi' }),
  ).toBeInTheDocument();

  fireEvent.click(
    within(dialog).getByRole('button', { name: 'Nhập 1 dòng hợp lệ' }),
  );
  expect(
    await within(dialog).findByText(/Đã nhập 1 dòng hợp lệ, bỏ qua 1 dòng lỗi/),
  ).toBeVisible();
  expect(importCommit).toHaveBeenCalledWith(file);
});

const pickCsv = async (service: Partial<UserService>) => {
  await renderPage({ ...createUserService(), ...service });
  fireEvent.click(screen.getByRole('button', { name: 'Nhập CSV' }));
  const dialog = screen.getByRole('dialog', { name: 'Nhập người dùng từ CSV' });
  const file = new File(['user_code'], 'a.csv', { type: 'text/csv' });
  fireEvent.change(within(dialog).getByLabelText('Tệp CSV'), {
    target: { files: [file] },
  });
  return { dialog, file };
};

it('focuses the file input when the import dialog opens', async () => {
  const { dialog } = await pickCsv({});
  expect(within(dialog).getByLabelText('Tệp CSV')).toHaveFocus();
});

it('shows a file-level error when the preview is rejected', async () => {
  const importPreview = vi
    .fn()
    .mockRejectedValue(new ApiError('Tệp không phải UTF-8.', 400));
  const { dialog } = await pickCsv({ importPreview });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Xem trước' }));
  expect(await within(dialog).findByRole('alert')).toHaveTextContent(
    'Tệp không phải UTF-8.',
  );
  expect(
    within(dialog).getByRole('button', { name: 'Xem trước' }),
  ).toBeInTheDocument();
});

it('re-previews after a 409 on commit and drops stale valid rows', async () => {
  const stale = importReport;
  const fresh: UserImportReport = {
    ...importReport,
    validRows: 0,
    errorRows: 2,
    rows: importReport.rows.map((r) => ({
      ...r,
      errors: r.errors.length ? r.errors : ['Mã người dùng đã tồn tại.'],
    })),
  };
  const importPreview = vi
    .fn()
    .mockResolvedValueOnce(stale)
    .mockResolvedValueOnce(fresh);
  const importCommit = vi
    .fn()
    .mockRejectedValue(
      new ApiError('Mã vừa bị trùng. Hãy xem trước lại.', 409),
    );
  const { dialog } = await pickCsv({ importPreview, importCommit });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Xem trước' }));
  fireEvent.click(
    await within(dialog).findByRole('button', { name: 'Nhập 1 dòng hợp lệ' }),
  );

  expect(await within(dialog).findByRole('alert')).toHaveTextContent(
    'Mã vừa bị trùng',
  );
  await waitFor(() => expect(importPreview).toHaveBeenCalledTimes(2));
  expect(within(dialog).queryByText('Hợp lệ')).not.toBeInTheDocument();
  // validRows = 0 nên không còn nhập được.
  expect(
    within(dialog).getByRole('button', { name: 'Nhập 0 dòng hợp lệ' }),
  ).toBeDisabled();
});

it('shows a commit error, a Hủy button and resets the file on going back', async () => {
  const importPreview = vi.fn().mockResolvedValue(importReport);
  const importCommit = vi
    .fn()
    .mockRejectedValue(new ApiError('Lỗi nhập.', 400));
  const { dialog } = await pickCsv({ importPreview, importCommit });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Xem trước' }));
  fireEvent.click(
    await within(dialog).findByRole('button', { name: 'Nhập 1 dòng hợp lệ' }),
  );
  expect(await within(dialog).findByRole('alert')).toHaveTextContent(
    'Lỗi nhập.',
  );
  expect(within(dialog).getByRole('button', { name: 'Hủy' })).toBeEnabled();

  fireEvent.click(
    within(dialog).getByRole('button', { name: 'Chọn tệp khác' }),
  );
  expect(
    within(dialog).getByRole('button', { name: 'Xem trước' }),
  ).toBeDisabled();
});

it('does not announce success when nothing was imported, and shows unknown roles as text', async () => {
  const report: UserImportReport = {
    ...importReport,
    validRows: 1,
    rows: [{ ...importReport.rows[0], role: 'toString' }],
  };
  const importPreview = vi.fn().mockResolvedValue(report);
  const importCommit = vi
    .fn()
    .mockResolvedValue({ ...report, importedRows: 0 });
  const { dialog } = await pickCsv({ importPreview, importCommit });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Xem trước' }));
  expect(await within(dialog).findByText('toString')).toBeInTheDocument();
  fireEvent.click(
    within(dialog).getByRole('button', { name: 'Nhập 1 dòng hợp lệ' }),
  );
  expect(
    await within(dialog).findByText(/Không có dòng nào được nhập/),
  ).toBeVisible();
  expect(within(dialog).getByText('Phan Mai')).toBeInTheDocument();
});
