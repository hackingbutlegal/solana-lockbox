/**
 * Tests for Password Strength Policy System
 */

import {
  PasswordPolicy,
  PolicyPreset,
  POLICY_PRESETS,
  validatePasswordPolicy,
  getPolicyDescription,
  detectPolicyPreset,
  generateCompliantPassword,
  getStrengthIndicator,
  isPolicyStrongerThan,
} from '../password-strength-policy';

describe('Password Strength Policy', () => {
  describe('validatePasswordPolicy', () => {
    test('accepts valid password meeting all requirements', () => {
      const policy: PasswordPolicy = {
        enabled: true,
        minLength: 12,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSymbols: true,
        minStrengthScore: 2,
        preventCommonPasswords: true,
        preventReuse: true,
        customRules: [],
      };

      const result = validatePasswordPolicy('MyP@ssw0rd123!', policy);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('rejects password below minimum length', () => {
      const policy: PasswordPolicy = {
        ...POLICY_PRESETS.standard,
        minLength: 12,
      };

      const result = validatePasswordPolicy('Short1!', policy);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must be at least 12 characters long (currently 7)');
    });

    test('rejects password without uppercase', () => {
      const policy: PasswordPolicy = {
        ...POLICY_PRESETS.standard,
        requireUppercase: true,
      };

      const result = validatePasswordPolicy('mypassword123!', policy);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('uppercase'))).toBe(true);
    });

    test('rejects password without lowercase', () => {
      const policy: PasswordPolicy = {
        ...POLICY_PRESETS.standard,
        requireLowercase: true,
      };

      const result = validatePasswordPolicy('MYPASSWORD123!', policy);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('lowercase'))).toBe(true);
    });

    test('rejects password without numbers', () => {
      const policy: PasswordPolicy = {
        ...POLICY_PRESETS.standard,
        requireNumbers: true,
      };

      const result = validatePasswordPolicy('MyPassword!@#', policy);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('number'))).toBe(true);
    });

    test('rejects password without symbols', () => {
      const policy: PasswordPolicy = {
        ...POLICY_PRESETS.standard,
        requireSymbols: true,
      };

      const result = validatePasswordPolicy('MyPassword123', policy);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('special character'))).toBe(true);
    });

    test('rejects common passwords', () => {
      const policy: PasswordPolicy = {
        ...POLICY_PRESETS.standard,
        preventCommonPasswords: true,
      };

      const result = validatePasswordPolicy('password123', policy);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('too common'))).toBe(true);
    });

    test('warns about sequential characters', () => {
      const policy: PasswordPolicy = POLICY_PRESETS.standard;

      const result = validatePasswordPolicy('MyP@ssw0rd123ABC', policy);

      expect(result.warnings.some(w => w.includes('sequential'))).toBe(true);
    });

    test('warns about repeated characters', () => {
      const policy: PasswordPolicy = POLICY_PRESETS.standard;

      const result = validatePasswordPolicy('MyP@ssw0rd111', policy);

      expect(result.warnings.some(w => w.includes('repeated'))).toBe(true);
    });

    test('allows all passwords when policy disabled', () => {
      const policy: PasswordPolicy = {
        ...POLICY_PRESETS.standard,
        enabled: false,
      };

      const result = validatePasswordPolicy('weak', policy);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('provides helpful suggestions for weak passwords', () => {
      const policy: PasswordPolicy = POLICY_PRESETS.standard;

      const result = validatePasswordPolicy('pass', policy);

      expect(result.isValid).toBe(false);
      expect(result.suggestions.length).toBeGreaterThan(0);
    });
  });

  describe('Policy Presets', () => {
    test('basic preset has lenient requirements', () => {
      const preset = POLICY_PRESETS.basic;

      expect(preset.minLength).toBe(8);
      expect(preset.requireUppercase).toBe(false);
      expect(preset.minStrengthScore).toBe(1);
    });

    test('standard preset has balanced requirements', () => {
      const preset = POLICY_PRESETS.standard;

      expect(preset.minLength).toBe(12);
      expect(preset.requireUppercase).toBe(true);
      expect(preset.requireLowercase).toBe(true);
      expect(preset.requireNumbers).toBe(true);
      expect(preset.requireSymbols).toBe(true);
      expect(preset.minStrengthScore).toBe(2);
    });

    test('strong preset has strict requirements', () => {
      const preset = POLICY_PRESETS.strong;

      expect(preset.minLength).toBe(16);
      expect(preset.minStrengthScore).toBe(3);
    });

    test('paranoid preset has maximum security', () => {
      const preset = POLICY_PRESETS.paranoid;

      expect(preset.minLength).toBe(20);
      expect(preset.minStrengthScore).toBe(4);
    });
  });

  describe('detectPolicyPreset', () => {
    test('detects standard preset', () => {
      const policy = POLICY_PRESETS.standard;
      const detected = detectPolicyPreset(policy);

      expect(detected).toBe('standard');
    });

    test('detects strong preset', () => {
      const policy = POLICY_PRESETS.strong;
      const detected = detectPolicyPreset(policy);

      expect(detected).toBe('strong');
    });

    test('returns custom for modified policies', () => {
      const policy = {
        ...POLICY_PRESETS.standard,
        minLength: 15,
      };
      const detected = detectPolicyPreset(policy);

      expect(detected).toBe('custom');
    });
  });

  describe('generateCompliantPassword', () => {
    test('generates password meeting minimum length', () => {
      const policy: PasswordPolicy = {
        ...POLICY_PRESETS.standard,
        minLength: 16,
      };

      const password = generateCompliantPassword(policy);

      expect(password.length).toBeGreaterThanOrEqual(16);
    });

    test('generates password with required character types', () => {
      const policy: PasswordPolicy = {
        ...POLICY_PRESETS.standard,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSymbols: true,
      };

      const password = generateCompliantPassword(policy);

      expect(/[A-Z]/.test(password)).toBe(true);
      expect(/[a-z]/.test(password)).toBe(true);
      expect(/[0-9]/.test(password)).toBe(true);
      expect(/[^A-Za-z0-9]/.test(password)).toBe(true);
    });

    test('generated password passes policy validation', () => {
      const policy = POLICY_PRESETS.strong;

      const password = generateCompliantPassword(policy);
      const result = validatePasswordPolicy(password, policy);

      expect(result.isValid).toBe(true);
    });
  });

  describe('getPolicyDescription', () => {
    test('describes standard policy correctly', () => {
      const policy = POLICY_PRESETS.standard;
      const description = getPolicyDescription(policy);

      expect(description).toContain('12 characters');
      expect(description).toContain('uppercase');
      expect(description).toContain('lowercase');
      expect(description).toContain('numbers');
      expect(description).toContain('symbols');
    });

    test('describes disabled policy', () => {
      const policy: PasswordPolicy = {
        ...POLICY_PRESETS.standard,
        enabled: false,
      };
      const description = getPolicyDescription(policy);

      expect(description).toContain('No password requirements');
    });
  });

  describe('getStrengthIndicator', () => {
    test('returns correct indicator for very weak password', () => {
      const indicator = getStrengthIndicator(0);

      expect(indicator.label).toBe('Very Weak');
      expect(indicator.color).toBe('#ef4444');
      expect(indicator.percentage).toBe(20);
    });

    test('returns correct indicator for strong password', () => {
      const indicator = getStrengthIndicator(3);

      expect(indicator.label).toBe('Strong');
      expect(indicator.color).toBe('#22c55e');
      expect(indicator.percentage).toBe(80);
    });

    test('returns correct indicator for very strong password', () => {
      const indicator = getStrengthIndicator(4);

      expect(indicator.label).toBe('Very Strong');
      expect(indicator.color).toBe('#10b981');
      expect(indicator.percentage).toBe(100);
    });
  });

  describe('isPolicyStrongerThan', () => {
    test('recognizes stronger policy by length', () => {
      const policy1: PasswordPolicy = {
        ...POLICY_PRESETS.basic,
        minLength: 16,
      };
      const policy2: PasswordPolicy = {
        ...POLICY_PRESETS.basic,
        minLength: 8,
      };

      expect(isPolicyStrongerThan(policy1, policy2)).toBe(true);
      expect(isPolicyStrongerThan(policy2, policy1)).toBe(false);
    });

    test('recognizes stronger policy by requirements', () => {
      const policy1 = POLICY_PRESETS.strong;
      const policy2 = POLICY_PRESETS.basic;

      expect(isPolicyStrongerThan(policy1, policy2)).toBe(true);
    });

    test('recognizes equal policies', () => {
      const policy1 = POLICY_PRESETS.standard;
      const policy2 = POLICY_PRESETS.standard;

      expect(isPolicyStrongerThan(policy1, policy2)).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    test('handles empty password', () => {
      const policy = POLICY_PRESETS.standard;
      const result = validatePasswordPolicy('', policy);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('handles very long password', () => {
      const policy = POLICY_PRESETS.standard;
      const longPassword = 'A'.repeat(1000) + 'b1!';
      const result = validatePasswordPolicy(longPassword, policy);

      expect(result.isValid).toBe(true);
    });

    test('handles unicode characters', () => {
      const policy = POLICY_PRESETS.standard;
      const result = validatePasswordPolicy('MyP@ss✓örd123', policy);

      // Should work, unicode counts as special characters
      expect(result.isValid).toBe(true);
    });

    test('handles policy with no requirements', () => {
      const policy: PasswordPolicy = {
        enabled: true,
        minLength: 1,
        requireUppercase: false,
        requireLowercase: false,
        requireNumbers: false,
        requireSymbols: false,
        minStrengthScore: 0,
        preventCommonPasswords: false,
        preventReuse: false,
        customRules: [],
      };

      const result = validatePasswordPolicy('a', policy);

      expect(result.isValid).toBe(true);
    });
  });

  describe('Multiple Errors', () => {
    test('reports all validation errors', () => {
      const policy = POLICY_PRESETS.strong;
      const result = validatePasswordPolicy('pass', policy);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(3); // Multiple violations
    });

    test('provides multiple suggestions', () => {
      const policy = POLICY_PRESETS.strong;
      const result = validatePasswordPolicy('weak', policy);

      expect(result.suggestions.length).toBeGreaterThan(0);
    });
  });
});
