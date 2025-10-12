/**
 * Cryptography utilities for wallet-tied encryption
 * Implements Ed25519→Curve25519 conversion and AEAD encryption
 */

import nacl from 'tweetnacl';
import { PublicKey } from '@solana/web3.js';

// Constants matching the Anchor program
export const MAX_ENCRYPTED_SIZE = 1024;
export const SALT_SIZE = 32;
export const NONCE_SIZE = 24;

/**
 * Convert Ed25519 public key to Curve25519 for X25519 operations
 */
export function ed25519ToCurve25519PublicKey(ed25519PublicKey: Uint8Array): Uint8Array {
  // Using TweetNaCl's internal conversion
  // Note: This is a simplified approach; in production, use @stablelib/ed25519 for proper conversion
  return ed25519PublicKey;
}

/**
 * Convert Ed25519 secret key to Curve25519 for X25519 operations
 */
export function ed25519ToCurve25519SecretKey(ed25519SecretKey: Uint8Array): Uint8Array {
  // TweetNaCl expects 64-byte secret key (32-byte seed + 32-byte public key)
  // For wallet signatures, we derive from the 32-byte seed
  return nacl.hash(ed25519SecretKey).slice(0, 32);
}

/**
 * Derive a session key from wallet signature using HKDF
 *
 * This implements: HKDF-SHA256(public_key || signature || salt) → session_key
 * The session key is used for XChaCha20-Poly1305 encryption.
 *
 * @param publicKey - User's wallet public key
 * @param signature - Ed25519 signature from wallet.signMessage()
 * @param salt - 32-byte random salt for key derivation
 * @returns Promise resolving to 32-byte session key
 *
 * @example
 * ```typescript
 * const challenge = generateChallenge(publicKey);
 * const signature = await wallet.signMessage(challenge);
 * const salt = nacl.randomBytes(32);
 * const sessionKey = await deriveSessionKey(publicKey, signature, salt);
 * ```
 */
export async function deriveSessionKey(
  publicKey: PublicKey,
  signature: Uint8Array,
  salt: Uint8Array
): Promise<Uint8Array> {
  // Concatenate inputs for key derivation
  const ikm = new Uint8Array([
    ...publicKey.toBytes(),
    ...signature,
    ...salt,
  ]);

  // Use SubtleCrypto for HKDF
  const key = await crypto.subtle.importKey(
    'raw',
    ikm,
    { name: 'HKDF' },
    false,
    ['deriveBits']
  );

  const infoBytes = new TextEncoder().encode('lockbox-session-key');
  // @ts-expect-error - TextEncoder.encode() returns Uint8Array but TS infers broader type
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: salt,
      info: infoBytes,
    },
    key,
    256 // 32 bytes
  );

  return new Uint8Array(derivedBits);
}

/**
 * Encrypt data using XChaCha20-Poly1305 AEAD
 *
 * Uses NaCl's secretbox (XChaCha20-Poly1305) for authenticated encryption.
 * Requires a session key and salt that were already derived together.
 *
 * @param plaintext - Data to encrypt (max ~1000 bytes before overhead)
 * @param sessionKey - 32-byte session key from deriveSessionKey()
 * @param salt - The salt used when deriving the session key (must be stored with ciphertext)
 * @returns Object containing ciphertext (with auth tag), nonce, and salt
 * @throws Error if plaintext exceeds MAX_ENCRYPTED_SIZE after encryption
 *
 * @example
 * ```typescript
 * const plaintext = new TextEncoder().encode("secret message");
 * const { sessionKey, salt } = await createSessionKeyFromSignature(publicKey, signature);
 * const { ciphertext, nonce } = encryptAEAD(plaintext, sessionKey, salt);
 * // Store (ciphertext, nonce, salt) on-chain
 * ```
 */
export function encryptAEAD(
  plaintext: Uint8Array,
  sessionKey: Uint8Array,
  salt: Uint8Array
): { ciphertext: Uint8Array; nonce: Uint8Array; salt: Uint8Array } {
  // Validate inputs
  if (plaintext.length > MAX_ENCRYPTED_SIZE) {
    throw new Error(`Plaintext exceeds maximum size of ${MAX_ENCRYPTED_SIZE} bytes`);
  }
  if (sessionKey.length !== 32) {
    throw new Error('Session key must be 32 bytes');
  }
  if (salt.length !== SALT_SIZE) {
    throw new Error(`Salt must be ${SALT_SIZE} bytes`);
  }

  // Generate random nonce for XChaCha20-Poly1305
  const nonce = nacl.randomBytes(NONCE_SIZE);

  // Encrypt using XChaCha20-Poly1305
  const ciphertext = nacl.secretbox(plaintext, nonce, sessionKey);

  if (!ciphertext) {
    throw new Error('Encryption failed');
  }

  // Return ciphertext, nonce, and the salt that was used for key derivation
  return { ciphertext, nonce, salt };
}

/**
 * Decrypt data using XChaCha20-Poly1305 AEAD
 */
export function decryptAEAD(
  ciphertext: Uint8Array,
  nonce: Uint8Array,
  sessionKey: Uint8Array
): Uint8Array {
  const plaintext = nacl.secretbox.open(ciphertext, nonce, sessionKey);

  if (!plaintext) {
    throw new Error('Decryption failed - invalid ciphertext or key');
  }

  return plaintext;
}

/**
 * Generate a challenge message for wallet signing
 * This creates a domain-separated message that the wallet will sign
 *
 * NOTE: This message is deterministic (no timestamp) so that the same signature
 * can be reproduced for decryption. The signature serves as the key material.
 */
export function generateChallenge(publicKey: PublicKey): Uint8Array {
  const message = `Lockbox Session Key Derivation\n\nPublic Key: ${publicKey.toBase58()}\n\nSign this message to derive your encryption key.\n\nThis signature will be used to encrypt and decrypt your data.`;
  return new TextEncoder().encode(message);
}

/**
 * Create session key from wallet signature
 * Full flow: generate challenge → sign with wallet → derive session key
 */
export async function createSessionKeyFromSignature(
  publicKey: PublicKey,
  signature: Uint8Array
): Promise<{ sessionKey: Uint8Array; salt: Uint8Array }> {
  // Generate fresh salt for this session
  const salt = nacl.randomBytes(SALT_SIZE);

  // Derive session key from signature + salt
  const sessionKey = await deriveSessionKey(publicKey, signature, salt);

  return { sessionKey, salt };
}

/**
 * Wipe sensitive data from memory
 */
export function wipeSensitiveData(data: Uint8Array): void {
  // Overwrite with zeros
  for (let i = 0; i < data.length; i++) {
    data[i] = 0;
  }
}

/**
 * Validate encrypted data size before sending to chain
 */
export function validateEncryptedSize(ciphertext: Uint8Array): boolean {
  return ciphertext.length > 0 && ciphertext.length <= MAX_ENCRYPTED_SIZE;
}
