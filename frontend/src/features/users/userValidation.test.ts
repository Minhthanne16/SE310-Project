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
};

it('ignores fields that belong to another role', () => {
  expect(validateUserInput(base)).toEqual({});
  expect(validateUserInput({ ...base, role: 'Student' })).toHaveProperty(
    'className',
  );
});
