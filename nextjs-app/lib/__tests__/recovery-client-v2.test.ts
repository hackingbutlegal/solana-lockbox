/**
 * Test suite for Recovery Client V2
 *
 * Tests cover:
 * - Cryptographic primitives (encrypt/decrypt, sha256)
 * - Share commitment generation
 * - Recovery setup flow
 * - Challenge generation and verification
 * - Secret reconstruction and proof generation
 * - End-to-end recovery flow
 */

import { PublicKey } from '@solana/web3.js';
import {
  encrypt,
  decrypt,
  sha256,
  computeShareCommitment,
  setupRecovery,
  generateRecoveryChallenge,
  reconstructSecretFromGuardians,
  generateProofOfReconstruction,
  verifyProof,
  serializeRecoverySetup,
  deserializeRecoverySetup,
  GuardianInfo,
  ShareSubmission,
} from '../recovery-client-v2';
import { splitSecret } from '../shamir-secret-sharing';

describe('Recovery Client V2', () => {
  describe('Cryptographic Primitives', () => {
    describe('encrypt/decrypt', () => {
      it('should encrypt and decrypt data correctly', async () => {
        const plaintext = new Uint8Array([1, 2, 3, 4, 5]);
        const key = crypto.getRandomValues(new Uint8Array(32));

        const encrypted = await encrypt(plaintext, key);
        const decrypted = await decrypt(encrypted, key);

        expect(decrypted).toEqual(plaintext);
      });

      it('should produce different ciphertexts for same plaintext', async () => {
        const plaintext = new Uint8Array([1, 2, 3, 4, 5]);
        const key = crypto.getRandomValues(new Uint8Array(32));

        const encrypted1 = await encrypt(plaintext, key);
        const encrypted2 = await encrypt(plaintext, key);

        // Different due to random nonce
        expect(encrypted1).not.toEqual(encrypted2);

        // But both decrypt to same plaintext
        const decrypted1 = await decrypt(encrypted1, key);
        const decrypted2 = await decrypt(encrypted2, key);

        expect(decrypted1).toEqual(plaintext);
        expect(decrypted2).toEqual(plaintext);
      });

      it('should fail decryption with wrong key', async () => {
        const plaintext = new Uint8Array([1, 2, 3, 4, 5]);
        const key1 = crypto.getRandomValues(new Uint8Array(32));
        const key2 = crypto.getRandomValues(new Uint8Array(32));

        const encrypted = await encrypt(plaintext, key1);

        await expect(decrypt(encrypted, key2)).rejects.toThrow();
      });

      it('should include nonce in encrypted output', async () => {
        const plaintext = new Uint8Array([1, 2, 3]);
        const key = crypto.getRandomValues(new Uint8Array(32));

        const encrypted = await encrypt(plaintext, key);

        // Should be: 12 (nonce) + plaintext.length + 16 (auth tag)
        expect(encrypted.length).toBe(12 + plaintext.length + 16);
      });
    });

    describe('sha256', () => {
      it('should produce 32-byte hash', async () => {
        const data = new Uint8Array([1, 2, 3, 4, 5]);
        const hash = await sha256(data);

        expect(hash.length).toBe(32);
      });

      it('should be deterministic', async () => {
        const data = new Uint8Array([1, 2, 3, 4, 5]);

        const hash1 = await sha256(data);
        const hash2 = await sha256(data);

        expect(hash1).toEqual(hash2);
      });

      it('should produce different hashes for different inputs', async () => {
        const data1 = new Uint8Array([1, 2, 3]);
        const data2 = new Uint8Array([1, 2, 4]);

        const hash1 = await sha256(data1);
        const hash2 = await sha256(data2);

        expect(hash1).not.toEqual(hash2);
      });
    });

    describe('computeShareCommitment', () => {
      it('should compute valid commitment', async () => {
        const shareData = new Uint8Array(32);
        const guardianPubkey = new PublicKey('11111111111111111111111111111111');

        const commitment = await computeShareCommitment(shareData, guardianPubkey);

        expect(commitment.length).toBe(32);
      });

      it('should be deterministic for same inputs', async () => {
        const shareData = new Uint8Array(32);
        const guardianPubkey = new PublicKey('11111111111111111111111111111111');

        const commitment1 = await computeShareCommitment(shareData, guardianPubkey);
        const commitment2 = await computeShareCommitment(shareData, guardianPubkey);

        expect(commitment1).toEqual(commitment2);
      });

      it('should produce different commitments for different shares', async () => {
        const shareData1 = new Uint8Array(32);
        shareData1[0] = 1;
        const shareData2 = new Uint8Array(32);
        shareData2[0] = 2;
        const guardianPubkey = new PublicKey('11111111111111111111111111111111');

        const commitment1 = await computeShareCommitment(shareData1, guardianPubkey);
        const commitment2 = await computeShareCommitment(shareData2, guardianPubkey);

        expect(commitment1).not.toEqual(commitment2);
      });

      it('should produce different commitments for different guardians', async () => {
        const shareData = new Uint8Array(32);
        const guardian1 = new PublicKey('11111111111111111111111111111111');
        const guardian2 = new PublicKey('11111111111111111111111111111112');

        const commitment1 = await computeShareCommitment(shareData, guardian1);
        const commitment2 = await computeShareCommitment(shareData, guardian2);

        expect(commitment1).not.toEqual(commitment2);
      });
    });
  });

  describe('Recovery Setup', () => {
    it('should setup recovery with valid inputs', async () => {
      const masterSecret = crypto.getRandomValues(new Uint8Array(32));
      const guardians: GuardianInfo[] = [
        { pubkey: new PublicKey('11111111111111111111111111111111'), shareIndex: 1 },
        { pubkey: new PublicKey('11111111111111111111111111111112'), shareIndex: 2 },
        { pubkey: new PublicKey('11111111111111111111111111111113'), shareIndex: 3 },
      ];
      const threshold = 2;

      const setup = await setupRecovery(masterSecret, guardians, threshold);

      expect(setup.guardianCommitments).toHaveLength(3);
      expect(setup.encryptedShares).toHaveLength(3);
      expect(setup.masterSecretHash).toHaveLength(32);

      // Verify each guardian has commitment and encrypted share
      for (let i = 0; i < guardians.length; i++) {
        expect(setup.guardianCommitments[i].pubkey).toEqual(guardians[i].pubkey);
        expect(setup.guardianCommitments[i].shareIndex).toBe(i + 1);
        expect(setup.guardianCommitments[i].commitment).toHaveLength(32);

        expect(setup.encryptedShares[i].guardian).toEqual(guardians[i].pubkey);
        expect(setup.encryptedShares[i].encrypted).toBeTruthy();
      }
    });

    it('should reject master secret that is not 32 bytes', async () => {
      const masterSecret = crypto.getRandomValues(new Uint8Array(16)); // Wrong size
      const guardians: GuardianInfo[] = [
        { pubkey: new PublicKey('11111111111111111111111111111111'), shareIndex: 1 },
        { pubkey: new PublicKey('11111111111111111111111111111112'), shareIndex: 2 },
      ];

      await expect(setupRecovery(masterSecret, guardians, 2)).rejects.toThrow(
        'Master secret must be 32 bytes'
      );
    });

    it('should reject invalid threshold', async () => {
      const masterSecret = crypto.getRandomValues(new Uint8Array(32));
      const guardians: GuardianInfo[] = [
        { pubkey: new PublicKey('11111111111111111111111111111111'), shareIndex: 1 },
        { pubkey: new PublicKey('11111111111111111111111111111112'), shareIndex: 2 },
      ];

      await expect(setupRecovery(masterSecret, guardians, 1)).rejects.toThrow(
        'Invalid threshold'
      );
      await expect(setupRecovery(masterSecret, guardians, 3)).rejects.toThrow(
        'Invalid threshold'
      );
    });

    it('should reject more than 10 guardians', async () => {
      const masterSecret = crypto.getRandomValues(new Uint8Array(32));
      // Generate valid base58 public keys
      const guardians: GuardianInfo[] = Array.from({ length: 11 }, (_, i) => ({
        pubkey: PublicKey.unique(),
        shareIndex: i + 1,
      }));

      await expect(setupRecovery(masterSecret, guardians, 6)).rejects.toThrow(
        'Maximum 10 guardians allowed'
      );
    });

    it('should compute master secret hash correctly', async () => {
      const masterSecret = crypto.getRandomValues(new Uint8Array(32));
      const guardians: GuardianInfo[] = [
        { pubkey: new PublicKey('11111111111111111111111111111111'), shareIndex: 1 },
        { pubkey: new PublicKey('11111111111111111111111111111112'), shareIndex: 2 },
      ];

      const setup = await setupRecovery(masterSecret, guardians, 2);
      const expectedHash = await sha256(masterSecret);

      expect(setup.masterSecretHash).toEqual(expectedHash);
    });
  });

  describe('Challenge Generation and Verification', () => {
    it('should generate recovery challenge', async () => {
      const challenge = await generateRecoveryChallenge();

      expect(challenge.encrypted).toHaveLength(32);
      expect(challenge.hash).toHaveLength(32);
    });

    it('should generate different challenges each time', async () => {
      const challenge1 = await generateRecoveryChallenge();
      const challenge2 = await generateRecoveryChallenge();

      expect(challenge1.encrypted).not.toEqual(challenge2.encrypted);
      expect(challenge1.hash).not.toEqual(challenge2.hash);
    });

    it('should verify valid proof', async () => {
      const challenge = await generateRecoveryChallenge();

      // The proof should be the plaintext that hashes to challenge.hash
      // For now, the challenge.encrypted IS the plaintext (TODO: encrypt)
      const proof = challenge.encrypted;

      const isValid = await verifyProof(proof, challenge.hash);

      expect(isValid).toBe(true);
    });

    it('should reject invalid proof', async () => {
      const challenge = await generateRecoveryChallenge();
      const wrongProof = crypto.getRandomValues(new Uint8Array(32));

      const isValid = await verifyProof(wrongProof, challenge.hash);

      expect(isValid).toBe(false);
    });
  });

  describe('Secret Reconstruction and Proof Generation', () => {
    it('should reconstruct secret from guardian shares', () => {
      const masterSecret = crypto.getRandomValues(new Uint8Array(32));

      // Split secret using Shamir
      const shares = splitSecret(masterSecret, 3, 5);

      // Simulate guardians providing shares
      const submissions: ShareSubmission[] = [
        {
          guardianPubkey: new PublicKey('11111111111111111111111111111111'),
          shareData: shares[0].data,
        },
        {
          guardianPubkey: new PublicKey('11111111111111111111111111111112'),
          shareData: shares[1].data,
        },
        {
          guardianPubkey: new PublicKey('11111111111111111111111111111113'),
          shareData: shares[2].data,
        },
      ];

      const reconstructed = reconstructSecretFromGuardians(submissions);

      expect(reconstructed).toEqual(masterSecret);
    });

    it('should generate proof of reconstruction', async () => {
      const masterSecret = crypto.getRandomValues(new Uint8Array(32));
      const challengePlaintext = crypto.getRandomValues(new Uint8Array(32));

      // Encrypt challenge with master secret
      const encryptedChallenge = await encrypt(challengePlaintext, masterSecret);

      // Requester reconstructs secret and generates proof
      const proof = await generateProofOfReconstruction(
        encryptedChallenge,
        masterSecret
      );

      // Proof should be the decrypted challenge
      expect(proof).toEqual(challengePlaintext);
    });

    it('should fail proof generation with wrong secret', async () => {
      const masterSecret = crypto.getRandomValues(new Uint8Array(32));
      const wrongSecret = crypto.getRandomValues(new Uint8Array(32));
      const challengePlaintext = crypto.getRandomValues(new Uint8Array(32));

      const encryptedChallenge = await encrypt(challengePlaintext, masterSecret);

      // Try to decrypt with wrong secret
      await expect(
        generateProofOfReconstruction(encryptedChallenge, wrongSecret)
      ).rejects.toThrow();
    });
  });

  describe('End-to-End Recovery Flow', () => {
    it('should complete full recovery flow', async () => {
      // 1. Owner sets up recovery
      const masterSecret = crypto.getRandomValues(new Uint8Array(32));
      const guardians: GuardianInfo[] = [
        { pubkey: new PublicKey('11111111111111111111111111111111'), shareIndex: 1 },
        { pubkey: new PublicKey('11111111111111111111111111111112'), shareIndex: 2 },
        { pubkey: new PublicKey('11111111111111111111111111111113'), shareIndex: 3 },
        { pubkey: new PublicKey('11111111111111111111111111111114'), shareIndex: 4 },
        { pubkey: new PublicKey('11111111111111111111111111111115'), shareIndex: 5 },
      ];
      const threshold = 3;

      const setup = await setupRecovery(masterSecret, guardians, threshold);

      // 2. Generate challenge (encrypted with master secret)
      const challengePlaintext = crypto.getRandomValues(new Uint8Array(32));
      const encryptedChallenge = await encrypt(challengePlaintext, masterSecret);
      const challengeHash = await sha256(challengePlaintext);

      // 3. Guardians receive encrypted shares (off-chain)
      // Simulate: decode the base64 shares
      const shares = guardians.map((g, i) => {
        const encoded = setup.encryptedShares[i].encrypted;
        const decoded = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
        return {
          guardianPubkey: g.pubkey,
          shareData: decoded,
        };
      });

      // 4. Requester collects M shares from guardians (off-chain)
      const submittedShares = shares.slice(0, threshold);

      // 5. Requester reconstructs secret
      const reconstructedSecret = reconstructSecretFromGuardians(submittedShares);

      // Verify reconstruction worked
      expect(reconstructedSecret).toEqual(masterSecret);

      // 6. Requester generates proof by decrypting challenge
      const proof = await generateProofOfReconstruction(
        encryptedChallenge,
        reconstructedSecret
      );

      // 7. Verify proof matches challenge hash
      const isValid = await verifyProof(proof, challengeHash);

      expect(isValid).toBe(true);
      expect(proof).toEqual(challengePlaintext);
    });

    it('should fail with insufficient shares', async () => {
      const masterSecret = crypto.getRandomValues(new Uint8Array(32));
      const guardians: GuardianInfo[] = [
        { pubkey: new PublicKey('11111111111111111111111111111111'), shareIndex: 1 },
        { pubkey: new PublicKey('11111111111111111111111111111112'), shareIndex: 2 },
        { pubkey: new PublicKey('11111111111111111111111111111113'), shareIndex: 3 },
      ];
      const threshold = 3;

      const setup = await setupRecovery(masterSecret, guardians, threshold);

      // Decode shares
      const shares = guardians.map((g, i) => ({
        guardianPubkey: g.pubkey,
        shareData: Uint8Array.from(
          atob(setup.encryptedShares[i].encrypted),
          (c) => c.charCodeAt(0)
        ),
      }));

      // Try with only 2 shares (need 3)
      const submittedShares = shares.slice(0, 2);
      const reconstructed = reconstructSecretFromGuardians(submittedShares);

      // Should NOT match original (insufficient shares)
      expect(reconstructed).not.toEqual(masterSecret);
    });
  });

  describe('Serialization', () => {
    it('should serialize and deserialize recovery setup', async () => {
      const masterSecret = crypto.getRandomValues(new Uint8Array(32));
      const guardians: GuardianInfo[] = [
        { pubkey: new PublicKey('11111111111111111111111111111111'), shareIndex: 1 },
        { pubkey: new PublicKey('11111111111111111111111111111112'), shareIndex: 2 },
      ];

      const setup = await setupRecovery(masterSecret, guardians, 2);
      const serialized = serializeRecoverySetup(setup);
      const deserialized = deserializeRecoverySetup(serialized);

      // Verify structure is preserved
      expect(deserialized.guardianCommitments).toHaveLength(2);
      expect(deserialized.encryptedShares).toHaveLength(2);
      expect(deserialized.masterSecretHash).toEqual(setup.masterSecretHash);

      // Verify commitments match
      for (let i = 0; i < 2; i++) {
        expect(deserialized.guardianCommitments[i].pubkey.toString()).toBe(
          setup.guardianCommitments[i].pubkey.toString()
        );
        expect(deserialized.guardianCommitments[i].shareIndex).toBe(
          setup.guardianCommitments[i].shareIndex
        );
        expect(deserialized.guardianCommitments[i].commitment).toEqual(
          setup.guardianCommitments[i].commitment
        );
      }
    });
  });
});
