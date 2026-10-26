import { expect, it } from 'vitest';
import type { CurrentUser } from '@/types/auth';
import type { ProfileInput } from '@/types/profile';
import { createProfileService } from './profileService';

const user = (role: CurrentUser['role']): CurrentUser => ({
  id: `id-${role}`,
  userCode: 'U1',
  fullName: 'Lê Thị Bình',
  email: 'binh.lt@truong.edu.vn',
  role,
  mustChangePassword: false,
});

const input = (overrides: Partial<ProfileInput> = {}): ProfileInput => ({
  dateOfBirth: '2000-01-31',
  phone: '0901 234 567',
  secondaryEmail: 'Binh@Mail.com',
  avatarFile: null,
  removeAvatar: false,
  ...overrides,
});

it('seeds role-specific fields from the session user', async () => {
  const service = createProfileService();
  expect(await service.getProfile(user('Student'))).toMatchObject({
    className: 'KTPM2022',
    department: null,
  });
  expect(await service.getProfile(user('Lecturer'))).toMatchObject({
    className: null,
    department: expect.any(String),
    academicTitle: expect.any(String),
  });
  const staff = await service.getProfile(user('AcademicAffairs'));
  expect(staff.className).toBeNull();
  expect(staff.lastLogins.length).toBeGreaterThan(0);
});

it('normalizes and persists edits per user', async () => {
  const service = createProfileService();
  await service.getProfile(user('Student'));
  const saved = await service.updateProfile('id-Student', input());
  expect(saved).toMatchObject({
    phone: '0901234567',
    secondaryEmail: 'binh@mail.com',
    dateOfBirth: '2000-01-31',
  });
  expect((await service.getProfile(user('Student'))).phone).toBe('0901234567');
  expect((await service.getProfile(user('Lecturer'))).phone).toBe('');
});

it('removes the avatar when asked and rejects unknown profiles', async () => {
  const service = createProfileService();
  await service.getProfile(user('Student'));
  const saved = await service.updateProfile(
    'id-Student',
    input({ removeAvatar: true }),
  );
  expect(saved.avatarUrl).toBeNull();
  await expect(service.updateProfile('nobody', input())).rejects.toThrow();
});
