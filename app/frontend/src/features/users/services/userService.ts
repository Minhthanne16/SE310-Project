import { apiRequest } from '@/api/request';
import { normalizeUserInput } from '@/features/users/userValidation';
import type { UserRole } from '@/types/auth';
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
// này, nên khi backend có đủ API chỉ cần thay phần cài đặt.
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

const ROLES: UserRole[] = ['Student', 'Lecturer', 'AcademicAffairs'];

const blank = (value: string) => value.trim() || null;

function seedUsers(): ManagedUser[] {
  const base = {
    dateOfBirth: null,
    className: null,
    department: null,
    academicTitle: null,
    isActive: true,
    mustChangePassword: false,
    hasData: false,
  } satisfies Partial<ManagedUser>;
  const rows: Omit<ManagedUser, 'id'>[] = [
    {
      ...base,
      userCode: 'GV001',
      fullName: 'Phạm Minh Châu',
      email: 'chau.pm@truong.edu.vn',
      role: 'AcademicAffairs',
      hasData: true,
    },
    {
      ...base,
      userCode: 'GV002',
      fullName: 'Lê Hoàng Nam',
      email: 'nam.lh@truong.edu.vn',
      role: 'AcademicAffairs',
    },
    {
      ...base,
      userCode: 'CB101',
      fullName: 'Nguyễn Thị Hương',
      email: 'huong.nt@truong.edu.vn',
      role: 'Lecturer',
      department: 'Công nghệ phần mềm',
      academicTitle: 'TS.',
      hasData: true,
    },
    {
      ...base,
      userCode: 'CB102',
      fullName: 'Trần Quốc Bảo',
      email: 'bao.tq@truong.edu.vn',
      role: 'Lecturer',
      department: 'Hệ thống thông tin',
      academicTitle: 'ThS.',
    },
    {
      ...base,
      userCode: 'CB103',
      fullName: 'Vũ Đức Anh',
      email: 'anh.vd@truong.edu.vn',
      role: 'Lecturer',
      department: 'Mạng máy tính',
      academicTitle: 'PGS.TS.',
      mustChangePassword: true,
    },
    {
      ...base,
      userCode: '22520001',
      fullName: 'Nguyễn Văn An',
      email: 'an.nv@truong.edu.vn',
      role: 'Student',
      dateOfBirth: '2004-03-12',
      className: 'KTPM2022',
      hasData: true,
    },
    {
      ...base,
      userCode: '22520002',
      fullName: 'Lê Thị Bình',
      email: 'binh.lt@truong.edu.vn',
      role: 'Student',
      className: 'KTPM2022',
      mustChangePassword: true,
    },
    {
      ...base,
      userCode: '22520003',
      fullName: 'Hoàng Gia Huy',
      email: 'huy.hg@truong.edu.vn',
      role: 'Student',
      className: 'HTTT2022',
      isActive: false,
      hasData: true,
    },
    {
      ...base,
      userCode: '22520004',
      fullName: 'Đỗ Thu Trang',
      email: 'trang.dt@truong.edu.vn',
      role: 'Student',
      className: 'ATTT2022',
    },
  ];
  return rows.map((row, index) => ({ ...row, id: `demo-${index + 1}` }));
}

// DEMO: backend mới có hai endpoint nhập CSV (importPreview/importCommit, gọi
// API thật). Các thao tác còn lại chưa có API nên dùng kho trong bộ nhớ dưới
// đây; dữ liệu mất khi tải lại trang. Endpoint đề xuất cho từng hàm nằm ở chú
// thích bên dưới; khi backend có, thay thân hàm bằng apiRequest tương ứng.
export function createUserService(): UserService {
  let users = seedUsers();
  let nextId = users.length + 1;

  const find = (id: string): ManagedUser => {
    const user = users.find((u) => u.id === id);
    if (!user) throw new Error('Không tìm thấy người dùng.');
    return user;
  };

  const replace = (next: ManagedUser): ManagedUser => {
    users = users.map((u) => (u.id === next.id ? next : u));
    return { ...next };
  };

  // Mã phân biệt hoa thường (chỉ mục duy nhất của backend); email đã được
  // chuẩn hóa viết thường nên so sánh không phân biệt hoa thường.
  const assertUnique = (input: UserInput, exceptId?: string) => {
    const others = users.filter((u) => u.id !== exceptId);
    if (others.some((u) => u.userCode === input.userCode))
      throw new DuplicateUserError('userCode');
    if (others.some((u) => u.email.toLowerCase() === input.email))
      throw new DuplicateUserError('email');
  };

  const addFromInput = (input: UserInput): ManagedUser => {
    const user: ManagedUser = {
      id: `demo-${nextId++}`,
      userCode: input.userCode,
      fullName: input.fullName,
      email: input.email,
      role: input.role,
      dateOfBirth: blank(input.dateOfBirth),
      className: input.role === 'Student' ? blank(input.className) : null,
      department: input.role === 'Lecturer' ? blank(input.department) : null,
      academicTitle:
        input.role === 'Lecturer' ? blank(input.academicTitle) : null,
      isActive: true,
      // Giống backend: tài khoản mới có mật khẩu ban đầu là mã người dùng.
      mustChangePassword: true,
      hasData: false,
    };
    users = [...users, user];
    return { ...user };
  };

  return {
    // Đề xuất: GET /api/users → ApiResponse<UserDto[]> (có lọc/phân trang phía máy chủ).
    async list() {
      return users.map((u) => ({ ...u }));
    },

    // Đề xuất: POST /api/users { ...UserInput } → 201 UserDto; 409 trùng mã/email.
    async create(raw) {
      const input = normalizeUserInput(raw);
      assertUnique(input);
      return addFromInput(input);
    },

    // Đề xuất: PUT /api/users/{id} → 200 UserDto; 409 trùng email. Mã và vai trò giữ nguyên.
    async update(id, raw) {
      const input = normalizeUserInput(raw);
      const current = find(id);
      assertUnique({ ...input, userCode: current.userCode }, id);
      return replace({
        ...current,
        fullName: input.fullName,
        email: input.email,
        dateOfBirth: blank(input.dateOfBirth),
        className: current.role === 'Student' ? blank(input.className) : null,
        department:
          current.role === 'Lecturer' ? blank(input.department) : null,
        academicTitle:
          current.role === 'Lecturer' ? blank(input.academicTitle) : null,
      });
    },

    // Đề xuất: PATCH /api/users/{id}/status { isActive } → 200 UserDto.
    async setActive(id, active) {
      return replace({ ...find(id), isActive: active });
    },

    // Đề xuất: DELETE /api/users/{id} → 200 { result: 'deleted' | 'disabled' };
    // máy chủ quyết định theo dữ liệu phát sinh (hasData).
    async remove(id) {
      const user = find(id);
      if (user.hasData) {
        replace({ ...user, isActive: false });
        return 'disabled';
      }
      users = users.filter((u) => u.id !== id);
      return 'deleted';
    },

    // Đề xuất: POST /api/users/{id}/reset-password { newPassword? } → 204.
    // Sau khi đặt lại, người dùng phải đổi mật khẩu ở lần đăng nhập kế tiếp.
    async resetPassword(id) {
      replace({ ...find(id), mustChangePassword: true });
    },

    // API thật: POST /api/users/import/preview (multipart, trường "file").
    async importPreview(file) {
      return apiRequest<UserImportReport>('/users/import/preview', {
        method: 'POST',
        body: fileForm(file),
      });
    },

    // API thật: POST /api/users/import. Sau khi nhập thành công, thêm các dòng
    // hợp lệ vào kho demo để danh sách khớp với kết quả nhập.
    async importCommit(file) {
      const report = await apiRequest<UserImportReport>('/users/import', {
        method: 'POST',
        body: fileForm(file),
      });
      for (const row of report.rows) {
        if (row.errors.length > 0) continue;
        const role = ROLES.find((r) => r === row.role);
        if (!role) continue;
        try {
          const input = normalizeUserInput({
            userCode: row.userCode,
            fullName: row.fullName,
            email: row.email,
            role,
            dateOfBirth: row.dateOfBirth ?? '',
            className: row.className ?? '',
            department: row.department ?? '',
            academicTitle: row.academicTitle ?? '',
          });
          // Demo: dòng trùng mã/email với người dùng đang có thì bỏ qua, không báo lỗi.
          assertUnique(input);
          addFromInput(input);
        } catch (err: unknown) {
          if (!(err instanceof DuplicateUserError)) throw err;
        }
      }
      return report;
    },
  };
}

export const userService: UserService = createUserService();
