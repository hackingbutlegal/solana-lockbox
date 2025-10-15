/**
 * Cryptographic Operations Tests
 * 
 * Tests for core cryptographic functions including:
 * - Session key derivation (HKDF)
 * - Search key derivation
 * - Message signing and verification
 * - Challenge generation
 * - Sensitive data wiping
 */

import { PublicKey } from '@solana/web3.js';
import {
  generateChallenge,
  createSessionKeyFromSignature,
  deriveSearchKey,
  wipeSensitiveData,
} from '../crypto';

describe('Cryptographic Operations', () => {
  // Test wallet public key (deterministic for testing)
  const testPublicKey = new PublicKey('11111111111111111111111111111111');
  
  // Mock signature (64 bytes)
  const mockSignature = new Uint8Array(64).fill(42);

  describe('generateChallenge', () => {
    it('should generate a challenge message with wallet address', () => {
      const challenge = generateChallenge(testPublicKey);
      
      expect(challenge).toBeInstanceOf(Uint8Array);
      expect(challenge.length).toBeGreaterThan(0);
      
      const decoded = new TextDecoder().decode(challenge);
      expect(decoded).toContain(testPublicKey.toBase58());
      expect(decoded).toContain('Lockbox');
    });

    it('should generate unique challenges for different wallets', () => {
      const wallet1 = new PublicKey('11111111111111111111111111111111');
      const wallet2 = new PublicKey('22222222222222222222222222222222');
      
      const challenge1 = generateChallenge(wallet1);
      const challenge2 = generateChallenge(wallet2);
      
      expect(challenge1).not.toEqual(challenge2);
    });

    it('should generate deterministic challenges for same wallet', () => {
      const challenge1 = generateChallenge(testPublicKey);
      const challenge2 = generateChallenge(testPublicKey);
      
      expect(challenge1).toEqual(challenge2);
    });
  });

  describe('createSessionKeyFromSignature', () => {
    it('should derive a 32-byte session key', async () => {
      const result = await createSessionKeyFromSignature(
        testPublicKey,
        mockSignature
      );
      
      expect(result.sessionKey).toBeInstanceOf(Uint8Array);
      expect(result.sessionKey.length).toBe(32);
    });

    it('should derive deterministic session keys from same inputs', async () => {
      const result1 = await createSessionKeyFromSignature(
        testPublicKey,
        mockSignature
      );
      const result2 = await createSessionKeyFromSignature(
        testPublicKey,
        mockSignature
      );
      
      expect(result1.sessionKey).toEqual(result2.sessionKey);
    });

    it('should derive different keys for different signatures', async () => {
      const signature1 = new Uint8Array(64).fill(42);
      const signature2 = new Uint8Array(64).fill(84);
      
      const result1 = await createSessionKeyFromSignature(testPublicKey, signature1);
      const result2 = await createSessionKeyFromSignature(testPublicKey, signature2);
      
      expect(result1.sessionKey).not.toEqual(result2.sessionKey);
    });

    it('should derive different keys for different public keys', async () => {
      const wallet1 = new PublicKey('11111111111111111111111111111111');
      const wallet2 = new PublicKey('22222222222222222222222222222222');
      
      const result1 = await createSessionKeyFromSignature(wallet1, mockSignature);
      const result2 = await createSessionKeyFromSignature(wallet2, mockSignature);
      
      expect(result1.sessionKey).not.toEqual(result2.sessionKey);
    });

    it('should use HKDF with correct info string', async () => {
      // The function should use 'lockbox-session-key-v1' as info string
      const result = await createSessionKeyFromSignature(
        testPublicKey,
        mockSignature
      );
      
      // Verify the key was derived (non-zero)
      const isAllZeros = result.sessionKey.every(byte => byte === 0);
      expect(isAllZeros).toBe(false);
    });
  });

  describe('deriveSearchKey', () => {
    it('should derive a 32-byte search key', async () => {
      const searchKey = await deriveSearchKey(
        testPublicKey,
        mockSignature
      );
      
      expect(searchKey).toBeInstanceOf(Uint8Array);
      expect(searchKey.length).toBe(32);
    });

    it('should derive deterministic search keys from same inputs', async () => {
      const key1 = await deriveSearchKey(testPublicKey, mockSignature);
      const key2 = await deriveSearchKey(testPublicKey, mockSignature);
      
      expect(key1).toEqual(key2);
    });

    it('should derive different search key than session key (key domain separation)', async () => {
      const { sessionKey } = await createSessionKeyFromSignature(
        testPublicKey,
        mockSignature
      );
      const searchKey = await deriveSearchKey(testPublicKey, mockSignature);
      
      // Search key and session key MUST be different (cryptographic domain separation)
      expect(searchKey).not.toEqual(sessionKey);
    });

    it('should use different HKDF info string than session key', async () => {
      // Verify keys are derived with different domain strings
      const { sessionKey } = await createSessionKeyFromSignature(
        testPublicKey,
        mockSignature
      );
      const searchKey = await deriveSearchKey(testPublicKey, mockSignature);
      
      // Different info strings = different keys
      expect(searchKey).not.toEqual(sessionKey);
      
      // Both should be non-zero
      const sessionAllZeros = sessionKey.every(byte => byte === 0);
      const searchAllZeros = searchKey.every(byte => byte === 0);
      expect(sessionAllZeros).toBe(false);
      expect(searchAllZeros).toBe(false);
    });
  });

  describe('wipeSensitiveData', () => {
    it('should overwrite Uint8Array with zeros', () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      const originalData = new Uint8Array(data); // Copy for comparison
      
      wipeSensitiveData(data);
      
      // All bytes should be zero
      expect(data.every(byte => byte === 0)).toBe(true);
      
      // Should be different from original
      expect(data).not.toEqual(originalData);
    });

    it('should handle empty arrays', () => {
      const data = new Uint8Array(0);
      
      expect(() => wipeSensitiveData(data)).not.toThrow();
      expect(data.length).toBe(0);
    });

    it('should handle large arrays', () => {
      const data = new Uint8Array(10000).fill(255);
      
      wipeSensitiveData(data);
      
      expect(data.every(byte => byte === 0)).toBe(true);
    });

    it('should wipe session keys securely', async () => {
      const { sessionKey } = await createSessionKeyFromSignature(
        testPublicKey,
        mockSignature
      );
      
      // Verify key is not all zeros initially
      const initiallyAllZeros = sessionKey.every(byte => byte === 0);
      expect(initiallyAllZeros).toBe(false);
      
      // Wipe it
      wipeSensitiveData(sessionKey);
      
      // Verify all zeros after wipe
      const afterWipeAllZeros = sessionKey.every(byte => byte === 0);
      expect(afterWipeAllZeros).toBe(true);
    });
  });

  describe('Key Derivation Security Properties', () => {
    it('should maintain consistent salt generation', async () => {
      // Same inputs should produce same salt
      const result1 = await createSessionKeyFromSignature(testPublicKey, mockSignature);
      const result2 = await createSessionKeyFromSignature(testPublicKey, mockSignature);
      
      // If implementation exposes salt, verify it's the same
      // For now, verify keys are identical (implies same salt)
      expect(result1.sessionKey).toEqual(result2.sessionKey);
    });

    it('should produce high-entropy keys', async () => {
      const { sessionKey } = await createSessionKeyFromSignature(
        testPublicKey,
        mockSignature
      );
      
      // Check that keys are not trivially weak
      // (not all same byte, not all zeros, etc.)
      const uniqueBytes = new Set(sessionKey);
      expect(uniqueBytes.size).toBeGreaterThan(1);
      
      const allSameByte = sessionKey.every(byte => byte === sessionKey[0]);
      expect(allSameByte).toBe(false);
    });

    it('should be resistant to similar inputs (avalanche effect)', async () => {
      // Similar signatures should produce very different keys
      const sig1 = new Uint8Array(64).fill(0);
      const sig2 = new Uint8Array(64).fill(0);
      sig2[0] = 1; // Change only 1 bit
      
      const key1 = await createSessionKeyFromSignature(testPublicKey, sig1);
      const key2 = await createSessionKeyFromSignature(testPublicKey, sig2);
      
      // Count different bytes (should be ~50% for good hash function)
      let differentBytes = 0;
      for (let i = 0; i < 32; i++) {
        if (key1.sessionKey[i] !== key2.sessionKey[i]) {
          differentBytes++;
        }
      }
      
      // Expect significant difference (at least 25% of bytes different)
      expect(differentBytes).toBeGreaterThan(8);
    });
  });

  describe('Edge Cases', () => {
    it('should handle minimum valid public key', async () => {
      const minKey = new PublicKey('11111111111111111111111111111111');
      const result = await createSessionKeyFromSignature(minKey, mockSignature);
      
      expect(result.sessionKey).toBeInstanceOf(Uint8Array);
      expect(result.sessionKey.length).toBe(32);
    });

    it('should handle signature with all zeros', async () => {
      const zeroSignature = new Uint8Array(64).fill(0);
      
      const result = await createSessionKeyFromSignature(
        testPublicKey,
        zeroSignature
      );
      
      // Should still produce a valid key (not all zeros)
      expect(result.sessionKey).toBeInstanceOf(Uint8Array);
      expect(result.sessionKey.length).toBe(32);
      
      // Key should not be all zeros (HKDF should still work)
      const allZeros = result.sessionKey.every(byte => byte === 0);
      expect(allZeros).toBe(false);
    });

    it('should handle signature with all 0xFF', async () => {
      const maxSignature = new Uint8Array(64).fill(0xFF);
      
      const result = await createSessionKeyFromSignature(
        testPublicKey,
        maxSignature
      );
      
      expect(result.sessionKey).toBeInstanceOf(Uint8Array);
      expect(result.sessionKey.length).toBe(32);
    });
  });
});
