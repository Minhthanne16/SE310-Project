import { afterEach, expect, it, vi } from 'vitest';
import type { CurrentUser } from '@/types/auth';
import { createProfileService } from './profileService';

const originalCreate = URL.createObjectURL;
const originalRevoke = URL.revokeObjectURL;

afterEach(() => {
  URL.createObjectURL = originalCreate;
  URL.revokeObjectURL = originalRevoke;
});

const me: CurrentUser = {
  id: 'id-1',
  userCode: 'U1',
  fullName: 'Lê Thị Bình',
  email: 'binh.lt@truong.edu.vn',
  role: 'Student',
  mustChangePassword: false,
};

const base = {
  dateOfBirth: '',
  phone: '',
  secondaryEmail: '',
  avatarFile: null,
  removeAvatar: false,
};

it('revokes the previous blob avatar when it is replaced or removed', async () => {
  const revoke = vi.fn();
  URL.createObjectURL = vi.fn(() => 'blob:one');
  URL.revokeObjectURL = revoke;
  const service = createProfileService();
  await service.getProfile(me);

  const file = new File(['x'], 'a.png', { type: 'image/png' });
  await service.updateProfile('id-1', { ...base, avatarFile: file });
  expect(revoke).not.toHaveBeenCalled();

  await service.updateProfile('id-1', { ...base, removeAvatar: true });
  expect(revoke).toHaveBeenCalledWith('blob:one');
});
