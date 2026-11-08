import { normalizePhone } from '@/features/profile/profileValidation';
import type { UserRole } from '@/types/auth';
import type { UserProfile } from '@/types/profile';
import type { ProfileService } from './profileService';

// Chỉ dùng trong test component: giả lập backend bằng bộ nhớ.
export function createFakeProfileService(role: UserRole = 'Student') {
  let profile: UserProfile = {
    fullName: 'Nguyễn Văn An',
    dateOfBirth: role === 'Student' ? '2004-03-12' : null,
    phone: '',
    secondaryEmail: '',
    avatarUrl: null,
    className: role === 'Student' ? 'KTPM2022' : null,
    department: role === 'Lecturer' ? 'Công nghệ phần mềm' : null,
    academicTitle: role === 'Lecturer' ? 'TS.' : null,
    lastLogins: ['2026-11-06T01:00:00.000Z'],
  };
  const service: ProfileService = {
    async getProfile() {
      return { ...profile };
    },
    async updateProfile(input) {
      profile = {
        ...profile,
        fullName: input.fullName.trim(),
        dateOfBirth: input.dateOfBirth || null,
        phone: normalizePhone(input.phone),
        secondaryEmail: input.secondaryEmail.trim().toLowerCase(),
      };
      return { ...profile };
    },
    async uploadAvatar(file) {
      profile = { ...profile, avatarUrl: `/api/profile/avatar?v=${file.name}` };
      return { ...profile };
    },
    async removeAvatar() {
      profile = { ...profile, avatarUrl: null };
      return { ...profile };
    },
  };
  return service;
}
