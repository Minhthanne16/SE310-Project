import { ApiError, apiRequest } from '@/api/request';
import { normalizeUserInput } from '@/features/users/userValidation';
import type { ManagedUser, UserImportReport, UserInput } from '@/types/user';

export type DuplicateField = 'userCode' | 'email';

// Trùng mã hoặc email khi thêm/sửa; field cho form biết ô nào cần báo lỗi.
export class DuplicateUserError extends Error {
  readonly field: DuplicateField;

  constructor(field: DuplicateField) {
    super(
      field === 'userCode'
        ? 'Mã người dùng đã tồn tại.'
        : 'Email đã được dùng cho tài khoản khác.',
    );
    this.name = 'DuplicateUserError';
    this.field = field;
  }
}

// Hợp đồng chung của màn Quản lý người dùng. Component chỉ phụ thuộc interface
// này; test giao diện dùng bản giả lập trong src/test/fakeUserService.ts.
export interface UserService {
  list(): Promise<ManagedUser[]>;
  create(input: UserInput): Promise<ManagedUser>;
  update(id: string, input: UserInput): Promise<ManagedUser>;
  setActive(id: string, active: boolean): Promise<ManagedUser>;
  // Chưa có dữ liệu thì xóa, có dữ liệu thì vô hiệu hóa.
  remove(id: string): Promise<'deleted' | 'disabled'>;
  // newPassword bỏ trống nghĩa là đặt về mã người dùng.
  resetPassword(id: string, newPassword?: string): Promise<void>;
  importPreview(file: File): Promise<UserImportReport>;
  importCommit(file: File): Promise<UserImportReport>;
}

const IMPORT_FILE_FIELD = 'file';

function fileForm(file: File): FormData {
  const form = new FormData();
  form.append(IMPORT_FILE_FIELD, file);
  return form;
}

// Ô trống gửi null (API nhận ngày dạng yyyy-MM-dd hoặc null, không nhận chuỗi rỗng).
const blank = (value: string) => value.trim() || null;

function profileBody(input: UserInput) {
  return {
    fullName: input.fullName,
    email: input.email,
    dateOfBirth: blank(input.dateOfBirth),
    className: blank(input.className),
    department: blank(input.department),
    academicTitle: blank(input.academicTitle),
  };
}

// 409 của POST/PUT /api/users trả data.field cho biết ô bị trùng.
async function rethrowDuplicate<T>(request: Promise<T>): Promise<T> {
  try {
    return await request;
  } catch (err: unknown) {
    if (err instanceof ApiError && err.status === 409) {
      const field = (err.data as { field?: unknown } | null)?.field;
      if (field === 'userCode' || field === 'email')
        throw new DuplicateUserError(field);
    }
    throw err;
  }
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  body: JSON.stringify(body),
});

// API thật (docs/decisions/PDR-004, mục Hợp đồng API), chỉ vai trò Giáo vụ.
export function createUserService(): UserService {
  return {
    // GET /api/users → UserDto[]; lọc và phân trang ở client.
    list() {
      return apiRequest<ManagedUser[]>('/users');
    },

    // POST /api/users → 201 UserDto; 409 { field } khi trùng mã/email.
    create(raw) {
      const input = normalizeUserInput(raw);
      return rethrowDuplicate(
        apiRequest<ManagedUser>(
          '/users',
          json('POST', {
            userCode: input.userCode,
            role: input.role,
            ...profileBody(input),
          }),
        ),
      );
    },

    // PUT /api/users/{id} → UserDto; mã và vai trò không đổi nên không gửi.
    update(id, raw) {
      return rethrowDuplicate(
        apiRequest<ManagedUser>(
          `/users/${encodeURIComponent(id)}`,
          json('PUT', profileBody(normalizeUserInput(raw))),
        ),
      );
    },

    // PATCH /api/users/{id}/status { isActive } → UserDto.
    setActive(id, active) {
      return apiRequest<ManagedUser>(
        `/users/${encodeURIComponent(id)}/status`,
        json('PATCH', { isActive: active }),
      );
    },

    // DELETE /api/users/{id} → { result }; máy chủ quyết định theo dữ liệu phát sinh.
    async remove(id) {
      const { result } = await apiRequest<{ result: 'deleted' | 'disabled' }>(
        `/users/${encodeURIComponent(id)}`,
        { method: 'DELETE' },
      );
      return result;
    },

    // POST /api/users/{id}/reset-password { newPassword | null }. Người dùng phải
    // đổi mật khẩu ở lần đăng nhập kế tiếp; phiên đang mở của họ hết hiệu lực.
    async resetPassword(id, newPassword) {
      await apiRequest<ManagedUser>(
        `/users/${encodeURIComponent(id)}/reset-password`,
        json('POST', { newPassword: newPassword ?? null }),
      );
    },

    // POST /api/users/import/preview (multipart, trường "file").
    importPreview(file) {
      return apiRequest<UserImportReport>('/users/import/preview', {
        method: 'POST',
        body: fileForm(file),
      });
    },

    // POST /api/users/import; danh sách được tải lại sau khi nhập.
    importCommit(file) {
      return apiRequest<UserImportReport>('/users/import', {
        method: 'POST',
        body: fileForm(file),
      });
    },
  };
}

export const userService: UserService = createUserService();
