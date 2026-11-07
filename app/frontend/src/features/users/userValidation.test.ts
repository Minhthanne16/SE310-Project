import { expect, it } from 'vitest';
import type { UserInput } from '@/types/user';
import { validateUserInput } from './userValidation';

const base: UserInput = {
  userCode: 'A1',
  fullName: 'An',
  email: 'a@x.vn',
  role: 'AcademicAffairs',
  dateOfBirth: '',
  className: 'x'.repeat(101),
  department: 'y'.repeat(101),
  academicTitle: '',
  password: '',
};

it('ignores fields that belong to another role', () => {
  expect(validateUserInput(base)).toEqual({});
  expect(validateUserInput({ ...base, role: 'Student' })).toHaveProperty(
    'className',
  );
});

it('requires a valid password only when creating a lecturer or staff account', () => {
  const staff = { ...base, className: '', department: '', userCode: 'GVU02' };
  expect(validateUserInput(staff).password).toBeUndefined();
  expect(validateUserInput(staff, { creating: true }).password).toBe(
    'Nhập mật khẩu.',
  );
  expect(
    validateUserInput({ ...staff, password: 'ngan1' }, { creating: true })
      .password,
  ).toBe('Tối thiểu 8 ký tự, có cả chữ và số.');
  expect(
    validateUserInput({ ...staff, password: 'gvu02abc' }, { creating: true })
      .password,
  ).toBeUndefined();
  expect(
    validateUserInput(
      { ...staff, userCode: 'gvu02abc', password: 'GVU02ABC' },
      { creating: true },
    ).password,
  ).toBe('Mật khẩu phải khác mã người dùng.');
  expect(
    validateUserInput(
      { ...staff, role: 'Student', className: 'K1' },
      { creating: true },
    ).password,
  ).toBeUndefined();
});
