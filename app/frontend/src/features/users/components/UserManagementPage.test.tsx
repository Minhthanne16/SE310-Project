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
  DuplicateUserError,
  type UserService,
} from '@/features/users/services/userService';
import { createFakeUserService } from '@/test/fakeUserService';
import type { CurrentUser } from '@/types/auth';
import type { UserImportReport } from '@/types/user';
import { UserManagementPage } from './UserManagementPage';

afterEach(cleanup);

// Trùng mã GV001 trong dữ liệu giả lập: đây là tài khoản của chính Giáo vụ.
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

const renderPage = async (service: UserService = createFakeUserService()) => {
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
    screen.getByRole('heading', { name: 'Người dùng' }),
  ).toBeInTheDocument();
  expect(screen.getByText('Hoàng Gia Huy')).toBeInTheDocument();
  expect(screen.getByText('Bạn')).toBeInTheDocument();

  const roles = screen.getByRole('group', { name: 'Lọc theo vai trò' });
  expect(within(roles).getByRole('button', { name: 'Tất cả' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  fireEvent.click(within(roles).getByRole('button', { name: 'Giảng viên' }));
  expect(screen.getByText('Nguyễn Thị Hương')).toBeInTheDocument();
  expect(screen.queryByText('Nguyễn Văn An')).not.toBeInTheDocument();

  fireEvent.click(within(roles).getByRole('button', { name: 'Tất cả' }));
  fireEvent.change(screen.getByLabelText('Trạng thái tài khoản'), {
    target: { value: 'disabled' },
  });
  expect(screen.getByText('Hoàng Gia Huy')).toBeInTheDocument();
  expect(screen.queryByText('Nguyễn Văn An')).not.toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('Trạng thái tài khoản'), {
    target: { value: '' },
  });
  fireEvent.change(screen.getByLabelText('Tìm người dùng'), {
    target: { value: 'khong-co-ai' },
  });
  expect(
    screen.getByText('Không có người dùng nào khớp bộ lọc.'),
  ).toBeInTheDocument();
});

it('shows the pending count and the design status labels', async () => {
  await renderPage();
  expect(screen.getByText('Chưa đăng nhập lần đầu')).toBeInTheDocument();
  expect(screen.getAllByText('Chưa đăng nhập').length).toBeGreaterThan(0);
  expect(screen.getAllByText('Đã vô hiệu hóa').length).toBeGreaterThan(0);
});

it('shows required-field errors and the role-specific fields in the add drawer', async () => {
  await renderPage();
  fireEvent.click(screen.getByRole('button', { name: 'Thêm người dùng' }));
  const drawer = screen.getByRole('dialog', { name: 'Thêm người dùng' });
  expect(within(drawer).getByLabelText(/Lớp sinh hoạt/)).toBeInTheDocument();

  fireEvent.click(
    within(drawer).getByRole('button', { name: 'Tạo tài khoản' }),
  );
  expect(screen.getByText('Nhập MSSV.')).toBeInTheDocument();
  expect(screen.getByLabelText(/Mã người dùng/)).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  expect(screen.getByText('Nhập lớp sinh hoạt.')).toBeInTheDocument();
  expect(within(drawer).getByRole('alert')).toHaveTextContent(
    'Chưa tạo được tài khoản.',
  );

  fireEvent.click(within(drawer).getByRole('button', { name: 'Giảng viên' }));
  expect(within(drawer).getByLabelText(/Bộ môn/)).toBeInTheDocument();
  expect(within(drawer).getByLabelText('Học hàm, học vị')).toBeInTheDocument();
  expect(
    within(drawer).queryByLabelText(/Lớp sinh hoạt/),
  ).not.toBeInTheDocument();
});

it('reports duplicate code and duplicate email with the owning account', async () => {
  await renderPage();
  fireEvent.click(screen.getByRole('button', { name: 'Thêm người dùng' }));
  type('Mã người dùng *', '22520001');
  type('Họ và tên *', 'Người Trùng');
  type('Email *', 'moi@truong.edu.vn');
  type('Lớp sinh hoạt *', 'KTPM2024');
  fireEvent.click(screen.getByRole('button', { name: 'Tạo tài khoản' }));
  expect(
    await screen.findByText(
      /MSSV 22520001 đã được dùng cho tài khoản Nguyễn Văn An/,
    ),
  ).toBeVisible();

  type('Mã người dùng *', '22529999');
  type('Email *', 'AN.NV@truong.edu.vn');
  fireEvent.click(screen.getByRole('button', { name: 'Tạo tài khoản' }));
  expect(
    await screen.findByText(
      /Email này đã được dùng cho tài khoản 22520001 · Nguyễn Văn An/,
    ),
  ).toBeVisible();

  type('Email *', 'moi@truong.edu.vn');
  fireEvent.click(screen.getByRole('button', { name: 'Tạo tài khoản' }));
  expect(await screen.findByText('22529999')).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent(
    'Đã tạo tài khoản 22529999. Mật khẩu ban đầu là mã người dùng.',
  );
});

it('shows the service duplicate error when the backend rejects after the pre-check', async () => {
  const service = createFakeUserService();
  const create = vi.fn().mockRejectedValue(new DuplicateUserError('userCode'));
  await renderPage({ ...service, create });
  fireEvent.click(screen.getByRole('button', { name: 'Thêm người dùng' }));
  type('Mã người dùng *', '22529998');
  type('Họ và tên *', 'Người Mới');
  type('Email *', 'nguoimoi@truong.edu.vn');
  type('Lớp sinh hoạt *', 'KTPM2024');
  fireEvent.click(screen.getByRole('button', { name: 'Tạo tài khoản' }));
  expect(await screen.findByText('Mã người dùng đã tồn tại.')).toBeVisible();
});

it('keeps the drawer open with an empty form on "Lưu và thêm tiếp"', async () => {
  await renderPage();
  fireEvent.click(screen.getByRole('button', { name: 'Thêm người dùng' }));
  type('Mã người dùng *', '22529000');
  type('Họ và tên *', 'Người Một');
  type('Email *', 'mot@truong.edu.vn');
  type('Lớp sinh hoạt *', 'KTPM2024');
  fireEvent.click(screen.getByRole('button', { name: 'Lưu và thêm tiếp' }));
  expect(await screen.findByText('Người Một')).toBeInTheDocument();
  const drawer = screen.getByRole('dialog', { name: 'Thêm người dùng' });
  expect(within(drawer).getByLabelText('Mã người dùng *')).toHaveValue('');
});

it('blocks the signed-in staff member from disabling or deleting themselves', async () => {
  await renderPage();
  edit('Phạm Minh Châu');
  expect(screen.getByRole('button', { name: 'Xóa' })).toBeDisabled();
  expect(
    screen.getByText(/không xóa hoặc vô hiệu hóa được/),
  ).toBeInTheDocument();
});

it('deletes a user without data after confirmation', async () => {
  await renderPage();
  edit('Đỗ Thu Trang');
  fireEvent.click(screen.getByRole('button', { name: 'Xóa' }));
  const confirm = screen.getByRole('alertdialog', { name: 'Xóa tài khoản?' });
  expect(within(confirm).getByRole('button', { name: 'Hủy' })).toHaveFocus();
  fireEvent.click(
    within(confirm).getByRole('button', { name: 'Xóa tài khoản' }),
  );
  await waitFor(() =>
    expect(screen.queryByText('Đỗ Thu Trang')).not.toBeInTheDocument(),
  );
});

it('disables a user with data, then reactivates them', async () => {
  await renderPage();
  edit('Nguyễn Văn An');
  fireEvent.click(screen.getByRole('button', { name: 'Xóa' }));
  const confirm = screen.getByRole('alertdialog', {
    name: 'Vô hiệu hóa tài khoản?',
  });
  fireEvent.click(within(confirm).getByRole('button', { name: 'Vô hiệu hóa' }));
  await waitFor(() =>
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument(),
  );
  expect(screen.getByText('Nguyễn Văn An')).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent(
    'Đã vô hiệu hóa tài khoản 22520001',
  );

  edit('Nguyễn Văn An');
  expect(screen.getByRole('note')).toHaveTextContent('đã bị vô hiệu hóa');
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

it('resets a password to the user code without typing anything', async () => {
  const service = await renderPage();
  const reset = vi.spyOn(service, 'resetPassword');
  edit('Lê Thị Bình');
  fireEvent.click(screen.getByRole('button', { name: 'Đặt lại mật khẩu' }));
  const dialog = screen.getByRole('dialog', { name: 'Đặt lại mật khẩu' });
  fireEvent.click(
    within(dialog).getByRole('button', { name: 'Đặt lại mật khẩu' }),
  );
  await waitFor(() =>
    expect(reset).toHaveBeenCalledWith(expect.any(String), undefined),
  );
  expect(await screen.findByRole('status')).toHaveTextContent(
    'Đã đặt lại mật khẩu cho Lê Thị Bình về mã người dùng.',
  );
});

it('resets a password to a custom value only when it follows the rules', async () => {
  const service = await renderPage();
  const reset = vi.spyOn(service, 'resetPassword');
  edit('Lê Thị Bình');
  fireEvent.click(screen.getByRole('button', { name: 'Đặt lại mật khẩu' }));
  fireEvent.click(screen.getByRole('radio', { name: /Nhập mật khẩu mới/ }));
  type('Mật khẩu mới', 'abc');
  type('Nhập lại mật khẩu mới', 'abc');
  const dialog = screen.getByRole('dialog', { name: 'Đặt lại mật khẩu' });
  const submit = within(dialog).getByRole('button', {
    name: 'Đặt lại mật khẩu',
  });
  expect(submit).toBeDisabled();
  fireEvent.click(submit);
  expect(reset).not.toHaveBeenCalled();

  type('Mật khẩu mới', 'matkhau123');
  type('Nhập lại mật khẩu mới', 'matkhau123');
  fireEvent.click(submit);
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
  const service = createFakeUserService();
  const importPreview = vi.fn().mockResolvedValue(importReport);
  const importCommit = vi
    .fn()
    .mockResolvedValue({ ...importReport, importedRows: 1 });
  await renderPage({ ...service, importPreview, importCommit });

  fireEvent.click(screen.getByRole('button', { name: 'Nhập CSV' }));
  const dialog = screen.getByRole('dialog', { name: 'Nhập người dùng từ CSV' });
  expect(within(dialog).getByText('Bước 1/2 · Chọn file')).toBeVisible();

  // Sai định dạng: không phải .csv.
  const input = within(dialog).getByLabelText('Tệp CSV');
  fireEvent.change(input, {
    target: { files: [new File(['x'], 'danh-sach.xlsx')] },
  });
  expect(within(dialog).getByRole('alert')).toHaveTextContent(
    'Tệp "danh-sach.xlsx" không phải tệp CSV nên không đọc được.',
  );
  expect(
    within(dialog).getByRole('button', { name: 'Kiểm tra file' }),
  ).toBeDisabled();
  expect(importPreview).not.toHaveBeenCalled();

  // Chọn đúng tệp thì tự kiểm tra và sang bước 2.
  const file = new File(['user_code'], 'danh-sach.csv', { type: 'text/csv' });
  fireEvent.change(input, { target: { files: [file] } });

  expect(await within(dialog).findByText('Email không hợp lệ.')).toBeVisible();
  expect(importPreview).toHaveBeenCalledWith(file);
  expect(
    within(dialog).getByText('Bước 2/2 · Kiểm tra trước khi nhập'),
  ).toBeVisible();
  expect(within(dialog).getByText('Dòng lỗi sẽ không được nhập')).toBeVisible();
  expect(
    within(dialog).getByRole('button', { name: 'Tải báo cáo lỗi' }),
  ).toBeInTheDocument();

  fireEvent.click(
    within(dialog).getByRole('button', { name: 'Nhập 1 người dùng' }),
  );
  await waitFor(() =>
    expect(
      screen.queryByRole('dialog', { name: 'Nhập người dùng từ CSV' }),
    ).not.toBeInTheDocument(),
  );
  expect(importCommit).toHaveBeenCalledWith(file);
  expect(screen.getByRole('status')).toHaveTextContent(
    'Đã nhập 1 người dùng từ danh-sach.csv',
  );
  expect(
    screen.getByRole('button', { name: 'Tải báo cáo dòng lỗi (.csv)' }),
  ).toBeInTheDocument();
});

const pickCsv = async (service: Partial<UserService>) => {
  await renderPage({ ...createFakeUserService(), ...service });
  fireEvent.click(screen.getByRole('button', { name: 'Nhập CSV' }));
  const dialog = screen.getByRole('dialog', { name: 'Nhập người dùng từ CSV' });
  const file = new File(['user_code'], 'a.csv', { type: 'text/csv' });
  fireEvent.change(within(dialog).getByLabelText('Tệp CSV'), {
    target: { files: [file] },
  });
  return { dialog, file };
};

it('focuses the "Chọn file" button when the import dialog opens', async () => {
  await renderPage();
  fireEvent.click(screen.getByRole('button', { name: 'Nhập CSV' }));
  const dialog = screen.getByRole('dialog', { name: 'Nhập người dùng từ CSV' });
  expect(
    within(dialog).getByRole('button', { name: 'Chọn file' }),
  ).toHaveFocus();
});

it('shows a file-level error when the preview is rejected', async () => {
  const importPreview = vi
    .fn()
    .mockRejectedValue(new ApiError('Tệp không phải UTF-8.', 400));
  const { dialog } = await pickCsv({ importPreview });
  expect(await within(dialog).findByRole('alert')).toHaveTextContent(
    'Tệp không phải UTF-8.',
  );
  expect(
    within(dialog).getByRole('button', { name: 'Chọn file' }),
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
  fireEvent.click(
    await within(dialog).findByRole('button', { name: 'Nhập 1 người dùng' }),
  );

  expect(await within(dialog).findByRole('alert')).toHaveTextContent(
    'Mã vừa bị trùng',
  );
  await waitFor(() => expect(importPreview).toHaveBeenCalledTimes(2));
  // validRows = 0 nên không còn nhập được; dòng trùng tính là "Đã có, bỏ qua".
  expect(
    await within(dialog).findByRole('button', { name: 'Nhập 0 người dùng' }),
  ).toBeDisabled();
  expect(
    within(dialog).getByText('Đã có, bỏ qua').nextSibling,
  ).toHaveTextContent('1');
});

it('shows a commit error, a Hủy button and resets the file on going back', async () => {
  const importPreview = vi.fn().mockResolvedValue(importReport);
  const importCommit = vi
    .fn()
    .mockRejectedValue(new ApiError('Lỗi nhập.', 400));
  const { dialog } = await pickCsv({ importPreview, importCommit });
  fireEvent.click(
    await within(dialog).findByRole('button', { name: 'Nhập 1 người dùng' }),
  );
  expect(await within(dialog).findByRole('alert')).toHaveTextContent(
    'Lỗi nhập.',
  );
  expect(within(dialog).getByRole('button', { name: 'Hủy' })).toBeEnabled();

  fireEvent.click(
    within(dialog).getByRole('button', { name: 'Chọn file khác' }),
  );
  expect(
    within(dialog).getByRole('button', { name: 'Kiểm tra file' }),
  ).toBeDisabled();
});

it('does not announce success when nothing was imported', async () => {
  const importPreview = vi.fn().mockResolvedValue(importReport);
  const importCommit = vi
    .fn()
    .mockResolvedValue({ ...importReport, importedRows: 0 });
  const { dialog } = await pickCsv({ importPreview, importCommit });
  fireEvent.click(
    await within(dialog).findByRole('button', { name: 'Nhập 1 người dùng' }),
  );
  expect(
    await within(dialog).findByText(/Không có dòng nào được nhập/),
  ).toBeVisible();
  expect(
    screen.queryByRole('button', { name: /Tải báo cáo dòng lỗi/ }),
  ).toBeNull();
});
