/**
 * Password Generator Tests
 *
 * Comprehensive test suite for password generation and strength assessment.
 */

import { PasswordGenerator } from '../lib/password-generator';

describe('PasswordGenerator', () => {
  describe('generate()', () => {
    it('should generate password with default options', () => {
      const password = PasswordGenerator.generate();
      expect(password).toHaveLength(16);
      expect(password).toMatch(/[a-z]/); // Has lowercase
      expect(password).toMatch(/[A-Z]/); // Has uppercase
      expect(password).toMatch(/[0-9]/); // Has numbers
      expect(password).toMatch(/[^a-zA-Z0-9]/); // Has symbols
    });

    it('should generate password with custom length', () => {
      const password = PasswordGenerator.generate({ length: 24 });
      expect(password).toHaveLength(24);
    });

    it('should respect character set options', () => {
      const password = PasswordGenerator.generate({
        length: 12,
        includeUppercase: false,
        includeLowercase: true,
        includeNumbers: false,
        includeSymbols: false,
      });
      expect(password).toMatch(/^[a-z]+$/);
      expect(password).not.toMatch(/[A-Z]/);
      expect(password).not.toMatch(/[0-9]/);
    });

    it('should exclude ambiguous characters when specified', () => {
      const password = PasswordGenerator.generate({
        length: 100,
        excludeAmbiguous: true,
      });
      // Should not contain: 0, O, 1, l, I, i, o
      expect(password).not.toMatch(/[0Ol1Ii]/);
    });

    it('should use custom charset', () => {
      const customCharset = 'ABC123';
      const password = PasswordGenerator.generate({
        length: 20,
        customCharset,
      });
      expect(password).toMatch(/^[ABC123]+$/);
    });

    it('should throw error for invalid length', () => {
      expect(() => PasswordGenerator.generate({ length: 0 })).toThrow();
      expect(() => PasswordGenerator.generate({ length: -1 })).toThrow();
      expect(() => PasswordGenerator.generate({ length: 129 })).toThrow();
    });

    it('should throw error for empty charset', () => {
      expect(() =>
        PasswordGenerator.generate({
          includeUppercase: false,
          includeLowercase: false,
          includeNumbers: false,
          includeSymbols: false,
        })
      ).toThrow('Charset cannot be empty');
    });

    it('should generate unique passwords', () => {
      const passwords = new Set();
      for (let i = 0; i < 100; i++) {
        passwords.add(PasswordGenerator.generate());
      }
      expect(passwords.size).toBe(100); // All unique
    });
  });

  describe('assessStrength()', () => {
    it('should return score 0 for empty password', () => {
      const strength = PasswordGenerator.assessStrength('');
      expect(strength.score).toBe(0);
      expect(strength.label).toBe('No Password');
    });

    it('should assess very weak passwords', () => {
      const strength = PasswordGenerator.assessStrength('123');
      expect(strength.score).toBeLessThanOrEqual(1);
      expect(strength.label).toBe('Very Weak');
    });

    it('should assess weak passwords', () => {
      const strength = PasswordGenerator.assessStrength('password');
      expect(strength.score).toBe(2);
      expect(strength.label).toBe('Weak');
    });

    it('should assess fair passwords', () => {
      const strength = PasswordGenerator.assessStrength('Password1');
      expect(strength.score).toBe(3);
      expect(strength.label).toBe('Fair');
    });

    it('should assess strong passwords', () => {
      const strength = PasswordGenerator.assessStrength('MyP@ssw0rd123');
      expect(strength.score).toBe(4);
      expect(strength.label).toBe('Strong');
    });

    it('should assess very strong passwords', () => {
      const strength = PasswordGenerator.assessStrength('MyV3ry$tr0ng!P@ssw0rd');
      expect(strength.score).toBe(5);
      expect(strength.label).toBe('Very Strong');
    });

    it('should penalize repeated characters', () => {
      const withRepeats = PasswordGenerator.assessStrength('Passssworrrd!!!123');
      const without = PasswordGenerator.assessStrength('Password!@#456');
      expect(withRepeats.score).toBeLessThan(without.score);
    });

    it('should penalize common patterns', () => {
      const strength1 = PasswordGenerator.assessStrength('Password123');
      const strength2 = PasswordGenerator.assessStrength('qwerty123');
      expect(strength1.score).toBeLessThan(4);
      expect(strength2.score).toBeLessThan(4);
    });

    it('should calculate entropy correctly', () => {
      const strength = PasswordGenerator.assessStrength('MyP@ssw0rd123');
      expect(strength.entropy).toBeGreaterThan(50);
      expect(typeof strength.entropy).toBe('number');
    });

    it('should provide helpful suggestions', () => {
      const weak = PasswordGenerator.assessStrength('pass');
      expect(weak.suggestions.length).toBeGreaterThan(0);
      expect(weak.suggestions.some((s) => s.includes('length'))).toBe(true);

      const strong = PasswordGenerator.assessStrength('MyV3ry$tr0ng!P@ssw0rd');
      expect(strong.suggestions.some((s) => s.includes('Excellent'))).toBe(true);
    });
  });

  describe('generateMultiple()', () => {
    it('should generate multiple passwords', () => {
      const passwords = PasswordGenerator.generateMultiple(5);
      expect(passwords).toHaveLength(5);
      passwords.forEach((p) => {
        expect(p.password).toBeDefined();
        expect(p.strength).toBeDefined();
      });
    });

    it('should sort by strength descending', () => {
      const passwords = PasswordGenerator.generateMultiple(10);
      for (let i = 0; i < passwords.length - 1; i++) {
        expect(passwords[i].strength.score).toBeGreaterThanOrEqual(
          passwords[i + 1].strength.score
        );
      }
    });

    it('should generate unique passwords', () => {
      const passwords = PasswordGenerator.generateMultiple(20);
      const uniqueSet = new Set(passwords.map((p) => p.password));
      expect(uniqueSet.size).toBe(20);
    });
  });

  describe('generatePassphrase()', () => {
    it('should generate passphrase with default options', () => {
      const passphrase = PasswordGenerator.generatePassphrase();
      const parts = passphrase.split('-');
      expect(parts.length).toBe(5); // 4 words + 1 number
      expect(parts[parts.length - 1]).toMatch(/^\d{4}$/);
    });

    it('should generate passphrase with custom word count', () => {
      const passphrase = PasswordGenerator.generatePassphrase(6, '-', true);
      const parts = passphrase.split('-');
      expect(parts.length).toBe(7); // 6 words + 1 number
    });

    it('should use custom separator', () => {
      const passphrase = PasswordGenerator.generatePassphrase(4, '_', false);
      expect(passphrase).toContain('_');
      expect(passphrase).not.toContain('-');
    });

    it('should optionally exclude number', () => {
      const passphrase = PasswordGenerator.generatePassphrase(4, '-', false);
      const parts = passphrase.split('-');
      expect(parts.length).toBe(4); // Only words, no number
      expect(parts[parts.length - 1]).not.toMatch(/^\d{4}$/);
    });

    it('should generate memorable passphrases', () => {
      const passphrase = PasswordGenerator.generatePassphrase();
      // Should be longer than a typical password but readable
      expect(passphrase.length).toBeGreaterThan(20);
      // Should contain only alphanumeric and separator
      expect(passphrase).toMatch(/^[a-z0-9-]+$/);
    });
  });

  describe('Edge Cases', () => {
    it('should handle minimum length password', () => {
      const password = PasswordGenerator.generate({ length: 1 });
      expect(password).toHaveLength(1);
    });

    it('should handle maximum length password', () => {
      const password = PasswordGenerator.generate({ length: 128 });
      expect(password).toHaveLength(128);
    });

    it('should handle all character types disabled except one', () => {
      const onlyNumbers = PasswordGenerator.generate({
        length: 10,
        includeUppercase: false,
        includeLowercase: false,
        includeNumbers: true,
        includeSymbols: false,
      });
      expect(onlyNumbers).toMatch(/^\d+$/);
    });

    it('should handle custom charset with single character', () => {
      const password = PasswordGenerator.generate({
        length: 10,
        customCharset: 'A',
      });
      expect(password).toBe('A'.repeat(10));
    });
  });

  describe('Security Properties', () => {
    it('should use crypto.getRandomValues for randomness', () => {
      // Test that different calls produce different results (probabilistic)
      const p1 = PasswordGenerator.generate({ length: 32 });
      const p2 = PasswordGenerator.generate({ length: 32 });
      expect(p1).not.toBe(p2);
    });

    it('should have high entropy for long passwords', () => {
      const password = PasswordGenerator.generate({ length: 32 });
      const strength = PasswordGenerator.assessStrength(password);
      expect(strength.entropy).toBeGreaterThan(150);
    });

    it('should not be predictable', () => {
      // Generate many passwords and check for patterns
      const passwords: string[] = [];
      for (let i = 0; i < 50; i++) {
        passwords.push(PasswordGenerator.generate({ length: 16 }));
      }

      // Check no password appears twice
      const uniqueSet = new Set(passwords);
      expect(uniqueSet.size).toBe(50);

      // Check no obvious sequential patterns
      for (const pass of passwords) {
        expect(pass).not.toMatch(/abcd/i);
        expect(pass).not.toMatch(/1234/);
        expect(pass).not.toMatch(/(.)\1{5}/); // No char repeated 6+ times
      }
    });
  });
});
