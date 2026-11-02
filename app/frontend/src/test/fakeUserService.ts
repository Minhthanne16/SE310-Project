import {
  DuplicateUserError,
  type UserService,
} from '@/features/users/services/userService';
import { normalizeUserInput } from '@/features/users/userValidation';
import type { ManagedUser, UserInput } from '@/types/user';

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

// Bản giả lập trong bộ nhớ của UserService cho test giao diện, mô phỏng các quy
// tắc của /api/users: trùng mã (phân biệt hoa thường) hoặc email (không phân
// biệt), mã/vai trò không đổi khi sửa, có dữ liệu thì xóa thành vô hiệu hóa.
// Nhập CSV không giả lập: test tự cung cấp importPreview/importCommit.
export function createFakeUserService(): UserService {
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

  const assertUnique = (input: UserInput, exceptId?: string) => {
    const others = users.filter((u) => u.id !== exceptId);
    if (others.some((u) => u.userCode === input.userCode))
      throw new DuplicateUserError('userCode');
    if (others.some((u) => u.email.toLowerCase() === input.email))
      throw new DuplicateUserError('email');
  };

  const notStubbed = () =>
    Promise.reject(new Error('Nhập CSV chưa được giả lập trong test này.'));

  return {
    async list() {
      return users.map((u) => ({ ...u }));
    },

    async create(raw) {
      const input = normalizeUserInput(raw);
      assertUnique(input);
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
        mustChangePassword: true,
        hasData: false,
      };
      users = [...users, user];
      return { ...user };
    },

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

    async setActive(id, active) {
      return replace({ ...find(id), isActive: active });
    },

    async remove(id) {
      const user = find(id);
      if (user.hasData) {
        replace({ ...user, isActive: false });
        return 'disabled';
      }
      users = users.filter((u) => u.id !== id);
      return 'deleted';
    },

    async resetPassword(id) {
      replace({ ...find(id), mustChangePassword: true });
    },

    importPreview: notStubbed,
    importCommit: notStubbed,
  };
}
