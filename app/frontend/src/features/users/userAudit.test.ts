import { expect, it } from 'vitest';
import type { UserAuditEntry } from '@/types/user';
import { describeAuditActor, describeAuditEntry } from './userAudit';

const entry = (overrides: Partial<UserAuditEntry>): UserAuditEntry => ({
  id: 'e1',
  action: 'Created',
  actorUserId: 'staff',
  actorName: 'Lê Văn Cường',
  details: null,
  createdAt: '2026-11-07T08:00:00Z',
  ...overrides,
});

it('lists each changed field with its value before and after', () => {
  expect(
    describeAuditEntry(
      entry({
        action: 'Updated',
        details: {
          fullName: { from: 'Nguyễn Văn An', to: 'Nguyễn Văn Ân' },
          dateOfBirth: { from: null, to: '2004-03-12' },
        },
      }),
    ),
  ).toEqual({
    title: 'Sửa thông tin',
    changes: [
      'Họ tên: Nguyễn Văn An → Nguyễn Văn Ân',
      'Ngày sinh: (trống) → 2004-03-12',
    ],
  });
});

it('names CSV imports, reset modes and avatar changes', () => {
  expect(
    describeAuditEntry(entry({ details: { role: 'Student', source: 'csv' } }))
      .title,
  ).toBe('Tạo tài khoản bằng nhập CSV');
  expect(
    describeAuditEntry(
      entry({ action: 'PasswordReset', details: { mode: 'userCode' } }),
    ).title,
  ).toBe('Đặt lại mật khẩu về mã người dùng');
  expect(
    describeAuditEntry(
      entry({ action: 'Updated', details: { avatar: 'removed' } }),
    ).title,
  ).toBe('Gỡ ảnh đại diện');
  expect(
    describeAuditEntry(entry({ action: 'PasswordResetByLink' })).title,
  ).toBe('Tự đặt lại mật khẩu qua liên kết email');
  expect(describeAuditEntry(entry({ action: 'Khác' })).title).toBe('Khác');
});

it('describes who acted', () => {
  expect(describeAuditActor(entry({ actorUserId: 'u1' }), 'u1')).toBe(
    'Chính chủ tài khoản',
  );
  expect(describeAuditActor(entry({}), 'u1')).toBe('Lê Văn Cường');
  expect(describeAuditActor(entry({ actorName: null }), 'u1')).toBe(
    'Tài khoản đã xóa',
  );
  expect(
    describeAuditActor(
      entry({
        actorName: null,
        actorUserId: '00000000-0000-0000-0000-000000000000',
      }),
      'u1',
    ),
  ).toBe('Hệ thống');
});
