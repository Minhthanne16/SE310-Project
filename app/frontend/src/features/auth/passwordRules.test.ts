import { describe, expect, it } from 'vitest';
import { getNewPasswordRules, isValidPassword } from './passwordRules';

describe('isValidPassword', () => {
  it('requires at least 8 characters with letters and digits', () => {
    expect(isValidPassword('abc12345')).toBe(true);
    expect(isValidPassword('abc1234')).toBe(false);
    expect(isValidPassword('abcdefgh')).toBe(false);
    expect(isValidPassword('12345678')).toBe(false);
  });
});

describe('getNewPasswordRules', () => {
  it('passes every rule for a valid, confirmed new password', () => {
    const rules = getNewPasswordRules('matkhau123', 'matkhau123', '22520001');
    expect(rules.every((r) => r.passed)).toBe(true);
  });

  it('rejects reusing the initial password and mismatched confirmation', () => {
    const rules = getNewPasswordRules('sv22520001', 'sv2252000', 'sv22520001');
    expect(rules.map((r) => r.passed)).toEqual([true, true, false, false]);
  });
});

describe('getNewPasswordRules for a regular change', () => {
  it('labels and checks the difference from the current password', () => {
    const rules = getNewPasswordRules(
      'matkhau123',
      'matkhau123',
      'matkhau123',
      'Khác mật khẩu hiện tại',
    );
    expect(rules[2]).toEqual({
      label: 'Khác mật khẩu hiện tại',
      passed: false,
    });
  });
});
