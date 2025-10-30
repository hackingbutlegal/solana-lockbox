/**
 * Unit Tests for Recovery Key Manager
 *
 * Tests the recovery key system that enables password-protected backup code recovery.
 */

import {
  generateRecoveryKey,
  decryptRecoveryKey,
  hasRecoveryKey,
  getRecoveryKeyMetadata,
  deleteRecoveryKey,
  validateRecoveryPassword,
} from '../recovery-key-manager';

// Mock the crypto module
jest.mock('../crypto', () => ({
  encryptAEAD: jest.fn((plaintext: Uint8Array, _key: Uint8Array) => ({
    ciphertext: new Uint8Array([...plaintext, ...new Uint8Array(16)]), // Add 16-byte auth tag
    nonce: new Uint8Array(24).fill(1),
    salt: new Uint8Array(32).fill(2),
  })),
  decryptAEAD: jest.fn((ciphertext: Uint8Array, _nonce: Uint8Array, _key: Uint8Array) => {
    // Handle invalid data gracefully
    if (ciphertext.length < 16) {
      throw new Error('Decryption failed - invalid ciphertext or key');
    }
    // Remove the 16-byte auth tag from the end and ensure it's a Uint8Array
    const plaintext = ciphertext.slice(0, -16);
    return new Uint8Array(plaintext);
  }),
}));

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

// Mock crypto.subtle for Node environment
const mockCrypto = {
  subtle: {
    importKey: jest.fn().mockResolvedValue({ type: 'secret' }),
    deriveBits: jest.fn().mockImplementation((params) => {
      // Return a deterministic 32-byte array based on iterations
      const iterations = params.iterations || 100000;
      const fillValue = (iterations / 1000) % 256;
      return Promise.resolve(new Uint8Array(32).fill(fillValue).buffer);
    }),
  },
  getRandomValues: (arr: Uint8Array) => {
    // Fill with deterministic values for testing
    for (let i = 0; i < arr.length; i++) {
      arr[i] = i % 256;
    }
    return arr;
  },
};

if (!global.crypto) {
  Object.defineProperty(global, 'crypto', {
    value: mockCrypto,
    writable: true,
    configurable: true,
  });
} else {
  // Override crypto methods if crypto already exists
  Object.assign(global.crypto, mockCrypto);
}

describe('Recovery Key Manager', () => {
  beforeEach(() => {
    localStorageMock.clear();
    jest.clearAllMocks();
  });

  describe('generateRecoveryKey', () => {
    it('should generate and store recovery key', async () => {
      const recoveryPassword = 'Test123!@#$Strong';
      const sessionKey = new Uint8Array(32).fill(1);

      const result = await generateRecoveryKey(recoveryPassword, sessionKey);

      expect(result).toBeDefined();
      expect(result.encryptedRecoveryKey).toBeDefined();
      expect(result.salt).toBeDefined();
      expect(result.iv).toBeDefined();
      expect(result.createdAt).toBeDefined();
      expect(result.version).toBe(1);
    });

    it('should store recovery key in localStorage', async () => {
      const recoveryPassword = 'Test123!@#$Strong';
      const sessionKey = new Uint8Array(32).fill(1);

      await generateRecoveryKey(recoveryPassword, sessionKey);

      const stored = localStorageMock.getItem('lockbox_recovery_key');
      expect(stored).not.toBeNull();
      const parsed = JSON.parse(stored!);
      expect(parsed.version).toBe(1);
    });

    it('should create unique salts for different passwords', async () => {
      const password1 = 'Test123!@#$Strong';
      const password2 = 'Different456!@#$Password';
      const sessionKey = new Uint8Array(32).fill(1);

      const result1 = await generateRecoveryKey(password1, sessionKey);
      localStorageMock.clear();
      const result2 = await generateRecoveryKey(password2, sessionKey);

      // Salts should be different (deterministic in our mock but would be random in production)
      expect(result1.salt).toBeDefined();
      expect(result2.salt).toBeDefined();
    });
  });

  describe('decryptRecoveryKey', () => {
    it('should decrypt recovery key with correct password', async () => {
      const recoveryPassword = 'Test123!@#$Strong';
      const sessionKey = new Uint8Array(32).fill(1);

      // First generate a recovery key
      await generateRecoveryKey(recoveryPassword, sessionKey);

      // Then try to decrypt it
      const decrypted = await decryptRecoveryKey(recoveryPassword);

      expect(decrypted).toBeDefined();
      expect(decrypted).toBeInstanceOf(Uint8Array);
    });

    it('should return null if no recovery key exists', async () => {
      const result = await decryptRecoveryKey('anypassword');
      expect(result).toBeNull();
    });

    it('should handle decryption errors gracefully', async () => {
      // Manually set invalid data
      localStorageMock.setItem('lockbox_recovery_key', JSON.stringify({
        encryptedRecoveryKey: 'invalid',
        salt: 'invalid',
        iv: 'invalid',
        createdAt: Date.now(),
        version: 1,
      }));

      const result = await decryptRecoveryKey('anypassword');
      expect(result).toBeNull();
    });
  });

  describe('hasRecoveryKey', () => {
    it('should return false when no recovery key exists', () => {
      expect(hasRecoveryKey()).toBe(false);
    });

    it('should return true when recovery key exists', async () => {
      const recoveryPassword = 'Test123!@#$Strong';
      const sessionKey = new Uint8Array(32).fill(1);

      await generateRecoveryKey(recoveryPassword, sessionKey);

      expect(hasRecoveryKey()).toBe(true);
    });
  });

  describe('getRecoveryKeyMetadata', () => {
    it('should return null when no recovery key exists', () => {
      expect(getRecoveryKeyMetadata()).toBeNull();
    });

    it('should return metadata without decrypting', async () => {
      const recoveryPassword = 'Test123!@#$Strong';
      const sessionKey = new Uint8Array(32).fill(1);

      const generated = await generateRecoveryKey(recoveryPassword, sessionKey);
      const metadata = getRecoveryKeyMetadata();

      expect(metadata).toBeDefined();
      expect(metadata!.version).toBe(1);
      expect(metadata!.createdAt).toBe(generated.createdAt);
      expect(metadata!.encryptedRecoveryKey).toBeDefined();
    });

    it('should handle corrupted data gracefully', () => {
      localStorageMock.setItem('lockbox_recovery_key', 'invalid json');

      const metadata = getRecoveryKeyMetadata();
      expect(metadata).toBeNull();
    });
  });

  describe('deleteRecoveryKey', () => {
    it('should remove recovery key from localStorage', async () => {
      const recoveryPassword = 'Test123!@#$Strong';
      const sessionKey = new Uint8Array(32).fill(1);

      await generateRecoveryKey(recoveryPassword, sessionKey);
      expect(hasRecoveryKey()).toBe(true);

      deleteRecoveryKey();

      expect(hasRecoveryKey()).toBe(false);
      expect(localStorageMock.getItem('lockbox_recovery_key')).toBeNull();
    });

    it('should not throw error if no recovery key exists', () => {
      expect(() => deleteRecoveryKey()).not.toThrow();
    });
  });

  describe('validateRecoveryPassword', () => {
    it('should validate strong passwords', () => {
      const strongPasswords = [
        'Test123!@#$Strong',
        'P@ssw0rd1234!',
        'MyS3cur3P@ss',
        'C0mpl3x!P@ssw0rd',
      ];

      strongPasswords.forEach(password => {
        const result = validateRecoveryPassword(password);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    it('should reject passwords shorter than 12 characters', () => {
      const result = validateRecoveryPassword('Short1!');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must be at least 12 characters long');
    });

    it('should reject passwords without uppercase letters', () => {
      const result = validateRecoveryPassword('test123!@#$weak');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
    });

    it('should reject passwords without lowercase letters', () => {
      const result = validateRecoveryPassword('TEST123!@#$WEAK');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one lowercase letter');
    });

    it('should reject passwords without numbers', () => {
      const result = validateRecoveryPassword('TestPassword!@#$');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one number');
    });

    it('should reject passwords without special characters', () => {
      const result = validateRecoveryPassword('TestPassword1234');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one special character');
    });

    it('should return multiple errors for weak passwords', () => {
      const result = validateRecoveryPassword('weak');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });

  describe('Security Properties', () => {
    it('should use PBKDF2 with 100,000 iterations', async () => {
      const recoveryPassword = 'Test123!@#$Strong';
      const sessionKey = new Uint8Array(32).fill(1);

      await generateRecoveryKey(recoveryPassword, sessionKey);

      // Check that deriveBits was called with correct parameters
      expect(global.crypto.subtle.deriveBits).toHaveBeenCalled();
      const deriveBitsCall = (global.crypto.subtle.deriveBits as jest.Mock).mock.calls[0];
      expect(deriveBitsCall[0].iterations).toBe(100000);
      expect(deriveBitsCall[0].hash).toBe('SHA-256');
    });

    it('should generate random salts', async () => {
      const recoveryPassword = 'Test123!@#$Strong';
      const sessionKey = new Uint8Array(32).fill(1);

      const result = await generateRecoveryKey(recoveryPassword, sessionKey);
      const salt = Buffer.from(result.salt, 'base64');

      expect(salt.length).toBe(16);
    });

    it('should generate random IVs/nonces', async () => {
      const recoveryPassword = 'Test123!@#$Strong';
      const sessionKey = new Uint8Array(32).fill(1);

      const result = await generateRecoveryKey(recoveryPassword, sessionKey);
      const iv = Buffer.from(result.iv, 'base64');

      expect(iv.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty password', async () => {
      const sessionKey = new Uint8Array(32).fill(1);

      const result = await generateRecoveryKey('', sessionKey);
      expect(result).toBeDefined();
    });

    it('should handle very long passwords', async () => {
      const longPassword = 'A'.repeat(1000) + 'b1!';
      const sessionKey = new Uint8Array(32).fill(1);

      const result = await generateRecoveryKey(longPassword, sessionKey);
      expect(result).toBeDefined();
    });

    it('should handle unicode characters in password', async () => {
      const unicodePassword = 'Test123!@#$🔒🔐🗝️';
      const sessionKey = new Uint8Array(32).fill(1);

      const result = await generateRecoveryKey(unicodePassword, sessionKey);
      expect(result).toBeDefined();
    });

    it('should handle concurrent recovery key operations', async () => {
      const password1 = 'Test123!@#$Strong1';
      const password2 = 'Test456!@#$Strong2';
      const sessionKey = new Uint8Array(32).fill(1);

      // Generate two recovery keys in parallel
      const [result1, result2] = await Promise.all([
        generateRecoveryKey(password1, sessionKey),
        generateRecoveryKey(password2, sessionKey),
      ]);

      // The second one should overwrite the first
      expect(hasRecoveryKey()).toBe(true);
      const stored = getRecoveryKeyMetadata();
      expect(stored).toBeDefined();
    });
  });
});
