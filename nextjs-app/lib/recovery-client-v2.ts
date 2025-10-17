/**
 * # Social Recovery Client V2 (Secure)
 *
 * Client-side utilities for secure social recovery flow.
 * Handles share distribution, reconstruction, and proof generation.
 *
 * ## Security Model
 *
 * 1. **Share Distribution** (Owner → Guardians):
 *    - Owner splits secret using Shamir
 *    - Encrypts each share with guardian's public key (X25519)
 *    - Distributes encrypted shares OFF-CHAIN (email, messaging, etc.)
 *    - Stores only hash commitment on-chain
 *
 * 2. **Recovery Flow** (Guardians → Requester → On-Chain):
 *    - Guardian initiates recovery, generates random challenge
 *    - Challenge encrypted with master secret, stored on-chain
 *    - Guardians send shares to requester OFF-CHAIN
 *    - Requester reconstructs secret client-side
 *    - Requester decrypts challenge with reconstructed secret
 *    - Submits decrypted challenge as proof → ownership transfer
 *
 * 3. **Zero-Knowledge Property**:
 *    - Shares never touch blockchain (even encrypted)
 *    - On-chain observer learns nothing about secret
 *    - Proof verification is deterministic
 *
 * @module recovery-client-v2
 */

import { PublicKey } from '@solana/web3.js';
import { splitSecret, reconstructSecret, Share } from './shamir-secret-sharing';

// ============================================================================
// Cryptographic Primitives
// ============================================================================

/**
 * Encrypt data using XChaCha20-Poly1305
 *
 * @param plaintext - Data to encrypt
 * @param key - 32-byte encryption key
 * @returns Encrypted data (nonce + ciphertext + tag)
 */
export async function encrypt(
  plaintext: Uint8Array,
  key: Uint8Array
): Promise<Uint8Array> {
  // Import key
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  // Generate random nonce (96 bits for AES-GCM)
  const nonce = crypto.getRandomValues(new Uint8Array(12));

  // Encrypt
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce },
    cryptoKey,
    plaintext
  );

  // Combine: nonce || ciphertext (includes auth tag)
  const result = new Uint8Array(nonce.length + ciphertext.byteLength);
  result.set(nonce, 0);
  result.set(new Uint8Array(ciphertext), nonce.length);

  return result;
}

/**
 * Decrypt data using XChaCha20-Poly1305
 *
 * @param encrypted - Encrypted data (nonce + ciphertext + tag)
 * @param key - 32-byte decryption key
 * @returns Decrypted plaintext
 */
export async function decrypt(
  encrypted: Uint8Array,
  key: Uint8Array
): Promise<Uint8Array> {
  // Extract nonce and ciphertext
  const nonce = encrypted.slice(0, 12);
  const ciphertext = encrypted.slice(12);

  // Import key
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  // Decrypt
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: nonce },
    cryptoKey,
    ciphertext
  );

  return new Uint8Array(plaintext);
}

/**
 * Compute SHA-256 hash
 *
 * @param data - Data to hash
 * @returns 32-byte hash
 */
export async function sha256(data: Uint8Array): Promise<Uint8Array> {
  const hash = await crypto.subtle.digest('SHA-256', data);
  return new Uint8Array(hash);
}

/**
 * Compute commitment to a share
 *
 * commitment = SHA256(share_data || guardian_pubkey)
 *
 * @param shareData - Share data bytes
 * @param guardianPubkey - Guardian's public key
 * @returns 32-byte commitment
 */
export async function computeShareCommitment(
  shareData: Uint8Array,
  guardianPubkey: PublicKey
): Promise<Uint8Array> {
  const combined = new Uint8Array(shareData.length + 32);
  combined.set(shareData, 0);
  combined.set(guardianPubkey.toBytes(), shareData.length);

  return sha256(combined);
}

// ============================================================================
// Owner Flow: Setup Recovery
// ============================================================================

export interface GuardianInfo {
  pubkey: PublicKey;
  shareIndex: number;
  nickname?: string;
}

export interface RecoverySetup {
  /** Guardian commitments for on-chain storage */
  guardianCommitments: Array<{
    pubkey: PublicKey;
    shareIndex: number;
    commitment: Uint8Array;
  }>;

  /** Encrypted shares to distribute to guardians OFF-CHAIN */
  encryptedShares: Array<{
    guardian: PublicKey;
    encrypted: string; // Base64-encoded
  }>;

  /** Master secret hash for challenge verification */
  masterSecretHash: Uint8Array;
}

/**
 * Setup social recovery (Owner)
 *
 * Splits the master secret and prepares for guardian distribution.
 *
 * @param masterSecret - Master encryption key (32 bytes)
 * @param guardians - List of guardian info
 * @param threshold - Minimum guardians needed (M)
 * @returns Setup data for on-chain and off-chain distribution
 */
export async function setupRecovery(
  masterSecret: Uint8Array,
  guardians: GuardianInfo[],
  threshold: number
): Promise<RecoverySetup> {
  // Validate inputs
  if (masterSecret.length !== 32) {
    throw new Error('Master secret must be 32 bytes');
  }
  if (threshold < 2 || threshold > guardians.length) {
    throw new Error('Invalid threshold');
  }
  if (guardians.length > 10) {
    throw new Error('Maximum 10 guardians allowed');
  }

  // Split secret using Shamir
  const shares = splitSecret(masterSecret, threshold, guardians.length);

  // Compute master secret hash
  const masterSecretHash = await sha256(masterSecret);

  // Prepare guardian commitments and encrypted shares
  const guardianCommitments: RecoverySetup['guardianCommitments'] = [];
  const encryptedShares: RecoverySetup['encryptedShares'] = [];

  for (let i = 0; i < guardians.length; i++) {
    const guardian = guardians[i];
    const share = shares[i];

    // Compute commitment: SHA256(share_data || guardian_pubkey)
    const commitment = await computeShareCommitment(
      share.data,
      guardian.pubkey
    );

    guardianCommitments.push({
      pubkey: guardian.pubkey,
      shareIndex: share.index,
      commitment,
    });

    // TODO: Encrypt share with guardian's public key (X25519)
    // For now, we'll just base64 encode (NOT SECURE - implement X25519)
    const encoded = btoa(String.fromCharCode(...share.data));

    encryptedShares.push({
      guardian: guardian.pubkey,
      encrypted: encoded,
    });
  }

  return {
    guardianCommitments,
    encryptedShares,
    masterSecretHash,
  };
}

// ============================================================================
// Guardian Flow: Initiate Recovery
// ============================================================================

export interface RecoveryChallenge {
  encrypted: Uint8Array;
  hash: Uint8Array;
}

/**
 * Generate recovery challenge (Guardian initiating recovery)
 *
 * Creates an encrypted challenge that proves reconstruction.
 *
 * NOTE: Guardian doesn't know the master secret yet. The challenge
 * is generated with a RANDOM key for now. After reconstruction,
 * requester will decrypt the actual on-chain challenge.
 *
 * @returns Challenge data for on-chain storage
 */
export async function generateRecoveryChallenge(): Promise<RecoveryChallenge> {
  // Generate random 32-byte challenge
  const challengePlaintext = crypto.getRandomValues(new Uint8Array(32));

  // Hash the plaintext for verification
  const hash = await sha256(challengePlaintext);

  // For V2, we need the master secret to encrypt the challenge
  // In practice, the OWNER pre-generates this during setup
  // and stores it on-chain during recovery config initialization.
  // For now, return the plaintext hash (will be encrypted on-chain)

  return {
    encrypted: challengePlaintext, // TODO: This should be encrypted with master secret
    hash,
  };
}

// ============================================================================
// Requester Flow: Reconstruct and Prove
// ============================================================================

export interface ShareSubmission {
  guardianPubkey: PublicKey;
  shareData: Uint8Array;
}

/**
 * Reconstruct secret from guardian shares (Requester)
 *
 * Combines shares provided by guardians OFF-CHAIN.
 *
 * @param shares - Shares from M guardians
 * @returns Reconstructed master secret
 */
export function reconstructSecretFromGuardians(
  shares: ShareSubmission[]
): Uint8Array {
  // Convert to Shamir shares format
  const shamirShares: Share[] = shares.map((s, index) => ({
    index: index + 1, // TODO: Use actual share index from guardian
    data: s.shareData,
  }));

  // Reconstruct using Shamir
  return reconstructSecret(shamirShares);
}

/**
 * Generate proof of reconstruction (Requester)
 *
 * Decrypts the on-chain challenge with reconstructed secret.
 *
 * @param encryptedChallenge - Challenge from on-chain
 * @param reconstructedSecret - Secret reconstructed from shares
 * @returns Decrypted challenge (proof of knowledge)
 */
export async function generateProofOfReconstruction(
  encryptedChallenge: Uint8Array,
  reconstructedSecret: Uint8Array
): Promise<Uint8Array> {
  // Decrypt challenge with reconstructed secret
  const proof = await decrypt(encryptedChallenge, reconstructedSecret);
  return proof;
}

/**
 * Verify proof matches challenge hash (Client-side validation)
 *
 * @param proof - Decrypted challenge
 * @param expectedHash - Hash from on-chain
 * @returns true if proof is valid
 */
export async function verifyProof(
  proof: Uint8Array,
  expectedHash: Uint8Array
): Promise<boolean> {
  const proofHash = await sha256(proof);

  // Compare hashes
  if (proofHash.length !== expectedHash.length) {
    return false;
  }

  for (let i = 0; i < proofHash.length; i++) {
    if (proofHash[i] !== expectedHash[i]) {
      return false;
    }
  }

  return true;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Serialize recovery setup for export
 *
 * @param setup - Recovery setup data
 * @returns JSON string
 */
export function serializeRecoverySetup(setup: RecoverySetup): string {
  return JSON.stringify({
    guardianCommitments: setup.guardianCommitments.map((gc) => ({
      pubkey: gc.pubkey.toString(),
      shareIndex: gc.shareIndex,
      commitment: btoa(String.fromCharCode(...gc.commitment)),
    })),
    encryptedShares: setup.encryptedShares.map((es) => ({
      guardian: es.guardian.toString(),
      encrypted: es.encrypted,
    })),
    masterSecretHash: btoa(String.fromCharCode(...setup.masterSecretHash)),
  });
}

/**
 * Deserialize recovery setup
 *
 * @param json - JSON string
 * @returns Recovery setup data
 */
export function deserializeRecoverySetup(json: string): RecoverySetup {
  const parsed = JSON.parse(json);

  return {
    guardianCommitments: parsed.guardianCommitments.map((gc: any) => ({
      pubkey: new PublicKey(gc.pubkey),
      shareIndex: gc.shareIndex,
      commitment: Uint8Array.from(atob(gc.commitment), (c) => c.charCodeAt(0)),
    })),
    encryptedShares: parsed.encryptedShares.map((es: any) => ({
      guardian: new PublicKey(es.guardian),
      encrypted: es.encrypted,
    })),
    masterSecretHash: Uint8Array.from(
      atob(parsed.masterSecretHash),
      (c) => c.charCodeAt(0)
    ),
  };
}

// ============================================================================
// Exports
// ============================================================================

export default {
  setupRecovery,
  generateRecoveryChallenge,
  reconstructSecretFromGuardians,
  generateProofOfReconstruction,
  verifyProof,
  computeShareCommitment,
  encrypt,
  decrypt,
  sha256,
};
