/**
 * Unit Tests for Backup Codes Manager
 *
 * Tests backup code generation, validation, and management.
 */

import {
  generateBackupCodes,
  saveBackupCodes,
  loadBackupCodes,
  hasBackupCodes,
  validateBackupCode,
  markBackupCodeUsed,
  getUnusedCodeCount,
  getBackupCodesStats,
  clearBackupCodes,
  needsSecurityMigration,
  getMigrationMessage,
} from '../backup-codes-manager';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

describe('Backup Codes Manager', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  describe('generateBackupCodes', () => {
    it('should generate default 10 codes', () => {
      const result = generateBackupCodes();

      expect(result.codes).toHaveLength(10);
      expect(result.version).toBe(1);
      expect(result.generatedAt).toBeDefined();
    });

    it('should generate custom number of codes', () => {
      const result = generateBackupCodes({ count: 5 });

      expect(result.codes).toHaveLength(5);
    });

    it('should mark hasRecoveryPassword correctly', () => {
      const withPassword = generateBackupCodes({ hasRecoveryPassword: true });
      const withoutPassword = generateBackupCodes({ hasRecoveryPassword: false });

      expect(withPassword.hasRecoveryPassword).toBe(true);
      expect(withoutPassword.hasRecoveryPassword).toBe(false);
    });

    it('should set recoveryKeyVersion when hasRecoveryPassword is true', () => {
      const result = generateBackupCodes({ hasRecoveryPassword: true });

      expect(result.recoveryKeyVersion).toBe(1);
    });

    it('should not set recoveryKeyVersion when hasRecoveryPassword is false', () => {
      const result = generateBackupCodes({ hasRecoveryPassword: false });

      expect(result.recoveryKeyVersion).toBeUndefined();
    });

    it('should generate codes in correct format', () => {
      const result = generateBackupCodes();

      result.codes.forEach(code => {
        // Format should be XXXX-XXXX (4 chars, dash, 4 chars)
        expect(code.code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
        expect(code.used).toBe(false);
        expect(code.createdAt).toBeDefined();
      });
    });

    it('should generate unique codes', () => {
      const result = generateBackupCodes({ count: 50 });
      const codes = result.codes.map(c => c.code);
      const uniqueCodes = new Set(codes);

      expect(uniqueCodes.size).toBe(codes.length);
    });

    it('should have proper timestamps', () => {
      const before = Date.now();
      const result = generateBackupCodes();
      const after = Date.now();

      const generatedAt = new Date(result.generatedAt).getTime();
      expect(generatedAt).toBeGreaterThanOrEqual(before - 1000); // Allow 1s buffer
      expect(generatedAt).toBeLessThanOrEqual(after + 1000);

      result.codes.forEach(code => {
        const createdAt = new Date(code.createdAt).getTime();
        expect(createdAt).toBeGreaterThanOrEqual(before - 1000);
        expect(createdAt).toBeLessThanOrEqual(after + 1000);
      });
    });
  });

  describe('saveBackupCodes and loadBackupCodes', () => {
    it('should save and load backup codes', () => {
      const codes = generateBackupCodes();
      saveBackupCodes(codes);

      const loaded = loadBackupCodes();

      expect(loaded).toEqual(codes);
    });

    it('should return null when no codes exist', () => {
      const loaded = loadBackupCodes();

      expect(loaded).toBeNull();
    });

    it('should handle malformed data', () => {
      localStorageMock.setItem('lockbox_backup_codes', 'invalid json');

      const loaded = loadBackupCodes();

      expect(loaded).toBeNull();
    });

    it('should clear old version codes', () => {
      const codes = generateBackupCodes();
      codes.version = 0; // Old version
      localStorageMock.setItem('lockbox_backup_codes', JSON.stringify(codes));

      const loaded = loadBackupCodes();

      expect(loaded).toBeNull();
      expect(hasBackupCodes()).toBe(false);
    });
  });

  describe('hasBackupCodes', () => {
    it('should return false when no codes exist', () => {
      expect(hasBackupCodes()).toBe(false);
    });

    it('should return true when codes exist', () => {
      const codes = generateBackupCodes();
      saveBackupCodes(codes);

      expect(hasBackupCodes()).toBe(true);
    });
  });

  describe('validateBackupCode', () => {
    it('should validate correct unused code', () => {
      const codes = generateBackupCodes({ count: 3 });
      saveBackupCodes(codes);

      const isValid = validateBackupCode(codes.codes[0].code);

      expect(isValid).toBe(true);
    });

    it('should reject used codes', () => {
      const codes = generateBackupCodes({ count: 3 });
      codes.codes[0].used = true;
      saveBackupCodes(codes);

      const isValid = validateBackupCode(codes.codes[0].code);

      expect(isValid).toBe(false);
    });

    it('should reject non-existent codes', () => {
      const codes = generateBackupCodes({ count: 3 });
      saveBackupCodes(codes);

      const isValid = validateBackupCode('FAKE-CODE');

      expect(isValid).toBe(false);
    });

    it('should be case-insensitive', () => {
      const codes = generateBackupCodes({ count: 1 });
      saveBackupCodes(codes);

      const code = codes.codes[0].code;
      const isValid = validateBackupCode(code.toLowerCase());

      expect(isValid).toBe(true);
    });

    it('should ignore whitespace and dashes', () => {
      const codes = generateBackupCodes({ count: 1 });
      saveBackupCodes(codes);

      const code = codes.codes[0].code.replace('-', '');
      const isValid = validateBackupCode(code);

      expect(isValid).toBe(true);
    });

    it('should return false when no codes exist', () => {
      const isValid = validateBackupCode('ANY-CODE');

      expect(isValid).toBe(false);
    });
  });

  describe('markBackupCodeUsed', () => {
    it('should mark code as used', () => {
      const codes = generateBackupCodes({ count: 3 });
      saveBackupCodes(codes);

      const code = codes.codes[0].code;
      const marked = markBackupCodeUsed(code);

      expect(marked).toBe(true);

      const loaded = loadBackupCodes();
      expect(loaded!.codes[0].used).toBe(true);
      expect(loaded!.codes[0].usedAt).toBeDefined();
    });

    it('should not mark code twice', () => {
      const codes = generateBackupCodes({ count: 3 });
      saveBackupCodes(codes);

      const code = codes.codes[0].code;
      markBackupCodeUsed(code);
      const secondMark = markBackupCodeUsed(code);

      expect(secondMark).toBe(false);
    });

    it('should return false for non-existent codes', () => {
      const codes = generateBackupCodes({ count: 3 });
      saveBackupCodes(codes);

      const marked = markBackupCodeUsed('FAKE-CODE');

      expect(marked).toBe(false);
    });

    it('should set usedAt timestamp', () => {
      const codes = generateBackupCodes({ count: 1 });
      saveBackupCodes(codes);

      const before = Date.now();
      markBackupCodeUsed(codes.codes[0].code);
      const after = Date.now();

      const loaded = loadBackupCodes();
      const usedAt = loaded!.codes[0].usedAt!;
      const usedAtTime = new Date(usedAt).getTime();

      expect(usedAtTime).toBeGreaterThanOrEqual(before - 1000); // Allow 1s buffer
      expect(usedAtTime).toBeLessThanOrEqual(after + 1000);
    });

    it('should handle normalized code input', () => {
      const codes = generateBackupCodes({ count: 1 });
      saveBackupCodes(codes);

      const code = codes.codes[0].code;
      const marked = markBackupCodeUsed(code.toLowerCase().replace('-', ''));

      expect(marked).toBe(true);
    });
  });

  describe('getUnusedCodeCount', () => {
    it('should return 0 when no codes exist', () => {
      expect(getUnusedCodeCount()).toBe(0);
    });

    it('should count all codes initially', () => {
      const codes = generateBackupCodes({ count: 10 });
      saveBackupCodes(codes);

      expect(getUnusedCodeCount()).toBe(10);
    });

    it('should decrease after marking codes as used', () => {
      const codes = generateBackupCodes({ count: 10 });
      saveBackupCodes(codes);

      markBackupCodeUsed(codes.codes[0].code);
      expect(getUnusedCodeCount()).toBe(9);

      markBackupCodeUsed(codes.codes[1].code);
      expect(getUnusedCodeCount()).toBe(8);
    });

    it('should return 0 when all codes are used', () => {
      const codes = generateBackupCodes({ count: 3 });
      saveBackupCodes(codes);

      codes.codes.forEach(c => markBackupCodeUsed(c.code));

      expect(getUnusedCodeCount()).toBe(0);
    });
  });

  describe('getBackupCodesStats', () => {
    it('should return zero stats when no codes exist', () => {
      const stats = getBackupCodesStats();
      expect(stats.total).toBe(0);
      expect(stats.unused).toBe(0);
      expect(stats.used).toBe(0);
      expect(stats.generatedAt).toBeNull();
    });

    it('should return correct stats', () => {
      const codes = generateBackupCodes({ count: 10 });
      saveBackupCodes(codes);

      const stats = getBackupCodesStats();

      expect(stats.total).toBe(10);
      expect(stats.unused).toBe(10);
      expect(stats.used).toBe(0);
      expect(stats.generatedAt).toBeDefined();
    });

    it('should update stats after use', () => {
      const codes = generateBackupCodes({ count: 10 });
      saveBackupCodes(codes);

      markBackupCodeUsed(codes.codes[0].code);
      markBackupCodeUsed(codes.codes[1].code);

      const stats = getBackupCodesStats();

      expect(stats.total).toBe(10);
      expect(stats.unused).toBe(8);
      expect(stats.used).toBe(2);
    });
  });

  describe('clearBackupCodes', () => {
    it('should remove all backup codes', () => {
      const codes = generateBackupCodes();
      saveBackupCodes(codes);

      clearBackupCodes();

      expect(hasBackupCodes()).toBe(false);
      expect(loadBackupCodes()).toBeNull();
    });

    it('should not throw if no codes exist', () => {
      expect(() => clearBackupCodes()).not.toThrow();
    });
  });

  describe('needsSecurityMigration', () => {
    it('should return false when no codes exist', () => {
      expect(needsSecurityMigration()).toBe(false);
    });

    it('should return true for old codes without recovery password', () => {
      const codes = generateBackupCodes({ hasRecoveryPassword: false });
      saveBackupCodes(codes);

      expect(needsSecurityMigration()).toBe(true);
    });

    it('should return false for new codes with recovery password', () => {
      const codes = generateBackupCodes({ hasRecoveryPassword: true });
      saveBackupCodes(codes);

      expect(needsSecurityMigration()).toBe(false);
    });
  });

  describe('getMigrationMessage', () => {
    it('should return message for old codes', () => {
      const codes = generateBackupCodes({ hasRecoveryPassword: false });
      saveBackupCodes(codes);

      const message = getMigrationMessage();

      expect(message).toBeDefined();
      expect(message!.length).toBeGreaterThan(0);
      expect(message).toContain('regenerate');
    });

    it('should return null for new codes', () => {
      const codes = generateBackupCodes({ hasRecoveryPassword: true });
      saveBackupCodes(codes);

      const message = getMigrationMessage();

      expect(message).toBeNull();
    });

    it('should return null when no codes exist', () => {
      const message = getMigrationMessage();

      expect(message).toBeNull();
    });
  });

  describe('Security Properties', () => {
    it('should generate cryptographically random codes', () => {
      const set1 = generateBackupCodes({ count: 50 });
      const set2 = generateBackupCodes({ count: 50 });

      const codes1 = set1.codes.map(c => c.code);
      const codes2 = set2.codes.map(c => c.code);

      // Sets should be completely different
      const overlap = codes1.filter(c => codes2.includes(c));
      expect(overlap.length).toBe(0);
    });

    it('should use proper character set', () => {
      const codes = generateBackupCodes({ count: 100 });

      codes.codes.forEach(code => {
        // Should only contain alphanumeric and dash
        expect(code.code).toMatch(/^[A-Z0-9-]+$/);
      });
    });

    it('should maintain code immutability', () => {
      const codes = generateBackupCodes();
      const original = JSON.stringify(codes);

      saveBackupCodes(codes);
      const loaded = loadBackupCodes();

      expect(JSON.stringify(loaded)).toBe(original);
    });
  });

  describe('Edge Cases', () => {
    it('should handle generating 1 code', () => {
      const codes = generateBackupCodes({ count: 1 });

      expect(codes.codes).toHaveLength(1);
    });

    it('should handle generating many codes', () => {
      const codes = generateBackupCodes({ count: 100 });

      expect(codes.codes).toHaveLength(100);
      expect(new Set(codes.codes.map(c => c.code)).size).toBe(100);
    });

    it('should handle rapid code validation', () => {
      const codes = generateBackupCodes({ count: 10 });
      saveBackupCodes(codes);

      const start = Date.now();
      for (let i = 0; i < 1000; i++) {
        validateBackupCode(codes.codes[0].code);
      }
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100);
    });

    it('should handle concurrent operations', () => {
      const codes = generateBackupCodes({ count: 10 });
      saveBackupCodes(codes);

      // Try to mark same code multiple times concurrently
      const promises = Array(10).fill(null).map(() =>
        Promise.resolve(markBackupCodeUsed(codes.codes[0].code))
      );

      return Promise.all(promises).then(() => {
        const stats = getBackupCodesStats();
        expect(stats!.used).toBe(1);
      });
    });

    it('should handle special characters in localStorage', () => {
      const codes = generateBackupCodes();
      saveBackupCodes(codes);

      // Verify it survives storage round-trip
      const loaded = loadBackupCodes();
      expect(loaded).toEqual(codes);
    });
  });

  describe('Backward Compatibility', () => {
    it('should handle old format codes', () => {
      // Simulate old format without hasRecoveryPassword field
      const oldCodes = {
        codes: [
          { code: 'ABCD-1234', used: false, createdAt: new Date().toISOString() },
        ],
        generatedAt: new Date().toISOString(),
        version: 1,
      };

      localStorageMock.setItem('lockbox_backup_codes', JSON.stringify(oldCodes));

      const loaded = loadBackupCodes();
      expect(loaded).toBeDefined();
      expect(needsSecurityMigration()).toBe(true);
    });

    it('should detect codes without recoveryKeyVersion', () => {
      const codes = generateBackupCodes({ hasRecoveryPassword: false });
      saveBackupCodes(codes);

      expect(needsSecurityMigration()).toBe(true);
    });
  });
});
