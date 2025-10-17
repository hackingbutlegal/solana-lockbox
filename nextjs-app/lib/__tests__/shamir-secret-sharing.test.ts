/**
 * Test suite for Shamir Secret Sharing implementation
 *
 * Tests cover:
 * - Basic split/reconstruct functionality
 * - Threshold security properties
 * - Edge cases and error handling
 * - Cryptographic randomness
 * - Serialization/deserialization
 */

import {
  splitSecret,
  reconstructSecret,
  verifyShares,
  serializeShare,
  deserializeShare,
  randomBytes,
  Share,
} from '../shamir-secret-sharing';

describe('Shamir Secret Sharing', () => {
  describe('Basic Functionality', () => {
    it('should split and reconstruct a 32-byte secret', () => {
      const secret = new Uint8Array(32);
      for (let i = 0; i < 32; i++) {
        secret[i] = i;
      }

      const shares = splitSecret(secret, 3, 5);
      const reconstructed = reconstructSecret(shares.slice(0, 3));

      expect(reconstructed).toEqual(secret);
    });

    it('should work with any M of N shares', () => {
      const secret = randomBytes(32);
      const threshold = 3;
      const totalShares = 5;

      const shares = splitSecret(secret, threshold, totalShares);

      // Test all possible combinations of 3 shares from 5
      const combinations = [
        [0, 1, 2],
        [0, 1, 3],
        [0, 1, 4],
        [0, 2, 3],
        [0, 2, 4],
        [0, 3, 4],
        [1, 2, 3],
        [1, 2, 4],
        [1, 3, 4],
        [2, 3, 4],
      ];

      for (const combo of combinations) {
        const selectedShares = combo.map((i) => shares[i]);
        const reconstructed = reconstructSecret(selectedShares);
        expect(reconstructed).toEqual(secret);
      }
    });

    it('should work with minimum threshold (2-of-2)', () => {
      const secret = randomBytes(32);
      const shares = splitSecret(secret, 2, 2);
      const reconstructed = reconstructSecret(shares);

      expect(reconstructed).toEqual(secret);
    });

    it('should work with maximum shares (255)', () => {
      const secret = randomBytes(32);
      const shares = splitSecret(secret, 2, 255);
      const reconstructed = reconstructSecret([shares[0], shares[254]]);

      expect(reconstructed).toEqual(secret);
    });
  });

  describe('Threshold Security', () => {
    it('should fail with fewer than M shares', () => {
      const secret = randomBytes(32);
      const shares = splitSecret(secret, 3, 5);

      // Try with only 2 shares (need 3)
      const twoShares = shares.slice(0, 2);
      const reconstructed = reconstructSecret(twoShares);

      // Reconstruction will produce WRONG result with insufficient shares
      expect(reconstructed).not.toEqual(secret);
    });

    it('should work with exactly M shares', () => {
      const secret = randomBytes(32);
      const shares = splitSecret(secret, 3, 5);
      const reconstructed = reconstructSecret(shares.slice(0, 3));

      expect(reconstructed).toEqual(secret);
    });

    it('should work with more than M shares', () => {
      const secret = randomBytes(32);
      const shares = splitSecret(secret, 3, 5);
      const reconstructed = reconstructSecret(shares.slice(0, 4));

      expect(reconstructed).toEqual(secret);
    });

    it('should produce different shares each time', () => {
      const secret = randomBytes(32);

      const shares1 = splitSecret(secret, 3, 5);
      const shares2 = splitSecret(secret, 3, 5);

      // Shares should be different due to random polynomial
      expect(shares1[0].data).not.toEqual(shares2[0].data);
      expect(shares1[1].data).not.toEqual(shares2[1].data);

      // But both should reconstruct to same secret
      const reconstructed1 = reconstructSecret(shares1.slice(0, 3));
      const reconstructed2 = reconstructSecret(shares2.slice(0, 3));

      expect(reconstructed1).toEqual(secret);
      expect(reconstructed2).toEqual(secret);
    });
  });

  describe('Share Validation', () => {
    it('should validate shares with verifyShares', () => {
      const secret = randomBytes(32);
      const shares = splitSecret(secret, 3, 5);

      expect(verifyShares(secret, shares, 3)).toBe(true);
    });

    it('should detect invalid shares', () => {
      const secret = randomBytes(32);
      const shares = splitSecret(secret, 3, 5);

      // Corrupt a share
      shares[0].data[0] ^= 1;

      expect(verifyShares(secret, shares, 3)).toBe(false);
    });

    it('should fail validation with insufficient shares', () => {
      const secret = randomBytes(32);
      const shares = splitSecret(secret, 3, 5);

      expect(verifyShares(secret, shares.slice(0, 2), 3)).toBe(false);
    });

    it('should detect duplicate share indices', () => {
      const secret = randomBytes(32);
      const shares = splitSecret(secret, 3, 5);

      // Create duplicate index
      shares[1].index = shares[0].index;

      expect(() => reconstructSecret(shares.slice(0, 3))).toThrow(
        'Duplicate share indices detected'
      );
    });

    it('should reject invalid share indices', () => {
      const secret = randomBytes(32);
      const shares = splitSecret(secret, 3, 5);

      // Set invalid index
      shares[0].index = 0;

      expect(() => reconstructSecret(shares.slice(0, 3))).toThrow(
        'Invalid share index'
      );
    });

    it('should reject mismatched share lengths', () => {
      const secret = randomBytes(32);
      const shares = splitSecret(secret, 3, 5);

      // Corrupt share length
      shares[1].data = new Uint8Array(16);

      expect(() => reconstructSecret(shares.slice(0, 3))).toThrow(
        'All shares must have the same length'
      );
    });
  });

  describe('Input Validation', () => {
    it('should reject empty secret', () => {
      const secret = new Uint8Array(0);

      expect(() => splitSecret(secret, 3, 5)).toThrow('Secret cannot be empty');
    });

    it('should reject threshold < 2', () => {
      const secret = randomBytes(32);

      expect(() => splitSecret(secret, 1, 5)).toThrow(
        'Threshold must be between 2 and 255'
      );
    });

    it('should reject threshold > 255', () => {
      const secret = randomBytes(32);

      expect(() => splitSecret(secret, 256, 300)).toThrow(
        'Threshold must be between 2 and 255'
      );
    });

    it('should reject totalShares < threshold', () => {
      const secret = randomBytes(32);

      expect(() => splitSecret(secret, 5, 3)).toThrow(
        'Total shares must be between threshold and 255'
      );
    });

    it('should reject totalShares > 255', () => {
      const secret = randomBytes(32);

      expect(() => splitSecret(secret, 3, 256)).toThrow(
        'Total shares must be between threshold and 255'
      );
    });

    it('should reject empty shares array', () => {
      expect(() => reconstructSecret([])).toThrow('At least one share is required');
    });
  });

  describe('Serialization', () => {
    it('should serialize and deserialize shares', () => {
      const secret = randomBytes(32);
      const shares = splitSecret(secret, 3, 5);

      const serialized = serializeShare(shares[0]);
      const deserialized = deserializeShare(serialized);

      expect(deserialized.index).toBe(shares[0].index);
      expect(deserialized.data).toEqual(shares[0].data);
    });

    it('should work with serialized shares for reconstruction', () => {
      const secret = randomBytes(32);
      const shares = splitSecret(secret, 3, 5);

      // Serialize and deserialize all shares
      const serialized = shares.map(serializeShare);
      const deserialized = serialized.map(deserializeShare);

      const reconstructed = reconstructSecret(deserialized.slice(0, 3));

      expect(reconstructed).toEqual(secret);
    });

    it('should reject invalid serialized share', () => {
      // Use a string with invalid base64 characters
      expect(() => deserializeShare('!!!invalid@@@')).toThrow();
    });

    it('should reject too-short serialized share', () => {
      const shortData = btoa('a');

      expect(() => deserializeShare(shortData)).toThrow('Invalid share: too short');
    });
  });

  describe('Different Secret Sizes', () => {
    it('should work with 1-byte secret', () => {
      const secret = new Uint8Array([42]);
      const shares = splitSecret(secret, 2, 3);
      const reconstructed = reconstructSecret(shares.slice(0, 2));

      expect(reconstructed).toEqual(secret);
    });

    it('should work with 16-byte secret', () => {
      const secret = randomBytes(16);
      const shares = splitSecret(secret, 3, 5);
      const reconstructed = reconstructSecret(shares.slice(0, 3));

      expect(reconstructed).toEqual(secret);
    });

    it('should work with 64-byte secret', () => {
      const secret = randomBytes(64);
      const shares = splitSecret(secret, 3, 5);
      const reconstructed = reconstructSecret(shares.slice(0, 3));

      expect(reconstructed).toEqual(secret);
    });

    it('should work with 128-byte secret', () => {
      const secret = randomBytes(128);
      const shares = splitSecret(secret, 3, 5);
      const reconstructed = reconstructSecret(shares.slice(0, 3));

      expect(reconstructed).toEqual(secret);
    });
  });

  describe('Cryptographic Randomness', () => {
    it('should use crypto.getRandomValues', () => {
      const secret = randomBytes(32);

      // Split multiple times
      const shares1 = splitSecret(secret, 3, 5);
      const shares2 = splitSecret(secret, 3, 5);
      const shares3 = splitSecret(secret, 3, 5);

      // Shares should be different each time (random polynomial coefficients)
      expect(shares1[0].data).not.toEqual(shares2[0].data);
      expect(shares2[0].data).not.toEqual(shares3[0].data);
      expect(shares1[0].data).not.toEqual(shares3[0].data);
    });

    it('should produce statistically random shares', () => {
      const secret = randomBytes(32);
      const shares = splitSecret(secret, 3, 5);

      // Count bit distribution (should be roughly 50/50)
      let zeros = 0;
      let ones = 0;

      for (const share of shares) {
        for (const byte of share.data) {
          for (let bit = 0; bit < 8; bit++) {
            if ((byte >> bit) & 1) {
              ones++;
            } else {
              zeros++;
            }
          }
        }
      }

      const total = zeros + ones;
      const zeroRatio = zeros / total;

      // Should be close to 0.5 (allow 10% deviation)
      expect(zeroRatio).toBeGreaterThan(0.4);
      expect(zeroRatio).toBeLessThan(0.6);
    });
  });

  describe('Edge Cases', () => {
    it('should handle all-zero secret', () => {
      const secret = new Uint8Array(32);
      const shares = splitSecret(secret, 3, 5);
      const reconstructed = reconstructSecret(shares.slice(0, 3));

      expect(reconstructed).toEqual(secret);
    });

    it('should handle all-ones secret', () => {
      const secret = new Uint8Array(32);
      secret.fill(255);

      const shares = splitSecret(secret, 3, 5);
      const reconstructed = reconstructSecret(shares.slice(0, 3));

      expect(reconstructed).toEqual(secret);
    });

    it('should handle sequential pattern', () => {
      const secret = new Uint8Array(32);
      for (let i = 0; i < 32; i++) {
        secret[i] = i;
      }

      const shares = splitSecret(secret, 3, 5);
      const reconstructed = reconstructSecret(shares.slice(0, 3));

      expect(reconstructed).toEqual(secret);
    });

    it('should handle repeated bytes', () => {
      const secret = new Uint8Array(32);
      secret.fill(42);

      const shares = splitSecret(secret, 3, 5);
      const reconstructed = reconstructSecret(shares.slice(0, 3));

      expect(reconstructed).toEqual(secret);
    });
  });

  describe('Performance', () => {
    it('should split 32-byte secret in reasonable time', () => {
      const secret = randomBytes(32);
      const start = performance.now();

      splitSecret(secret, 3, 10);

      const duration = performance.now() - start;

      // Should complete in less than 100ms
      expect(duration).toBeLessThan(100);
    });

    it('should reconstruct secret in reasonable time', () => {
      const secret = randomBytes(32);
      const shares = splitSecret(secret, 3, 10);

      const start = performance.now();

      reconstructSecret(shares.slice(0, 3));

      const duration = performance.now() - start;

      // Should complete in less than 50ms
      expect(duration).toBeLessThan(50);
    });

    it('should handle large secrets efficiently', () => {
      const secret = randomBytes(1024); // 1KB
      const start = performance.now();

      const shares = splitSecret(secret, 3, 5);
      const reconstructed = reconstructSecret(shares.slice(0, 3));

      const duration = performance.now() - start;

      expect(reconstructed).toEqual(secret);
      // Should complete in less than 500ms
      expect(duration).toBeLessThan(500);
    });
  });
});
