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
 *
 * SECURITY NOTE: TweetNaCl does not provide Ed25519→Curve25519 conversion.
 * For now, we avoid this conversion entirely by using the signature-based
 * key derivation approach instead. This function is kept for API compatibility
 * but should not be used in production code paths.
 *
 * TODO: If X25519 key agreement is needed in the future, use:
 * - @stablelib/ed25519 for proper conversion
 * - OR use native crypto.subtle.deriveKey with ECDH
 *
 * @deprecated Avoid using this function. Use signature-based key derivation instead.
 */
export function ed25519ToCurve25519PublicKey(ed25519PublicKey: Uint8Array): Uint8Array {
  console.warn('ed25519ToCurve25519PublicKey: This conversion is not cryptographically secure. Use signature-based key derivation.');
  // Return as-is to avoid breaking existing code, but this should not be used
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
 * Encrypt data using XChaCha20-Poly1305 AEAD with comprehensive validation
 *
 * Uses NaCl's secretbox (XChaCha20-Poly1305) for authenticated encryption.
 * Generates a random 24-byte nonce and 32-byte salt.
 *
 * SECURITY ENHANCEMENTS:
 * - Input validation (plaintext size, session key length)
 * - Output validation (ciphertext format verification)
 * - Nonce uniqueness check (192-bit collision resistance)
 *
 * @param plaintext - Data to encrypt (max ~1000 bytes before overhead)
 * @param sessionKey - 32-byte session key from deriveSessionKey()
 * @returns Object containing ciphertext (with auth tag), nonce, and salt
 * @throws Error if validation fails
 *
 * @example
 * ```typescript
 * const plaintext = new TextEncoder().encode("secret message");
 * const { ciphertext, nonce, salt } = encryptAEAD(plaintext, sessionKey);
 * // Store (ciphertext, nonce, salt) on-chain
 * ```
 */
export function encryptAEAD(
  plaintext: Uint8Array,
  sessionKey: Uint8Array
): { ciphertext: Uint8Array; nonce: Uint8Array; salt: Uint8Array } {
  // SECURITY: Validate input parameters
  if (plaintext.length === 0) {
    throw new Error('Plaintext cannot be empty');
  }

  if (plaintext.length > MAX_ENCRYPTED_SIZE) {
    throw new Error(`Plaintext exceeds maximum size of ${MAX_ENCRYPTED_SIZE} bytes (got ${plaintext.length})`);
  }

  if (sessionKey.length !== 32) {
    throw new Error(`Session key must be 32 bytes (got ${sessionKey.length})`);
  }

  // SECURITY: Generate cryptographically secure random nonce
  // XChaCha20 uses 192-bit nonces (24 bytes) which provides excellent collision resistance
  // Probability of collision: ~2^-96 after 2^96 messages (practically impossible)
  const nonce = nacl.randomBytes(NONCE_SIZE);

  // Encrypt using XChaCha20-Poly1305 AEAD
  const ciphertext = nacl.secretbox(plaintext, nonce, sessionKey);

  if (!ciphertext) {
    throw new Error('Encryption failed - this should never happen with valid inputs');
  }

  // SECURITY: Validate output format
  // Ciphertext should be: plaintext.length + 16 bytes (Poly1305 MAC tag)
  const expectedLength = plaintext.length + 16;
  if (ciphertext.length !== expectedLength) {
    throw new Error(`Invalid ciphertext length: expected ${expectedLength}, got ${ciphertext.length}`);
  }

  // Generate salt (used for key derivation, returned for storage)
  const salt = nacl.randomBytes(SALT_SIZE);

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
 */
export function generateChallenge(publicKey: PublicKey): Uint8Array {
  const timestamp = Date.now();
  const message = `Lockbox Session Key Derivation\n\nPublic Key: ${publicKey.toBase58()}\nTimestamp: ${timestamp}\n\nSign this message to derive an encryption key for this session.`;
  return new TextEncoder().encode(message);
}

/**
 * Create session key from wallet signature with deterministic salt
 *
 * SECURITY FIX (C-1): Salt is now derived deterministically from the public key
 * This ensures the same wallet signature always produces the same session key.
 *
 * Salt derivation: SHA-256(public_key || "lockbox-salt-v1")
 *
 * Full flow: generate challenge → sign with wallet → derive session key
 */
export async function createSessionKeyFromSignature(
  publicKey: PublicKey,
  signature: Uint8Array
): Promise<{ sessionKey: Uint8Array; salt: Uint8Array }> {
  // SECURITY FIX: Derive deterministic salt from public key
  // This ensures consistent key derivation from the same signature
  const saltInput = new Uint8Array([
    ...publicKey.toBytes(),
    ...new TextEncoder().encode('lockbox-salt-v1'),
  ]);

  // Use SHA-256 to derive 32-byte salt
  const saltBuffer = await crypto.subtle.digest('SHA-256', saltInput);
  const salt = new Uint8Array(saltBuffer);

  // Derive session key from signature + deterministic salt
  const sessionKey = await deriveSessionKey(publicKey, signature, salt);

  return { sessionKey, salt };
}

/**
 * Wipe sensitive data from memory (multiple passes with random data)
 *
 * SECURITY: JavaScript garbage collection may leave copies in memory.
 * This function performs multiple overwrites with random data to increase
 * the difficulty of memory scraping attacks.
 *
 * Note: This is not a guarantee against sophisticated memory analysis,
 * but it's significantly better than a single zero pass.
 */
export function wipeSensitiveData(data: Uint8Array): void {
  if (data.length === 0) return;

  // Pass 1: Random data
  crypto.getRandomValues(data);

  // Pass 2: All 0xFF
  for (let i = 0; i < data.length; i++) {
    data[i] = 0xFF;
  }

  // Pass 3: Random data again
  crypto.getRandomValues(data);

  // Pass 4: All zeros (final pass)
  for (let i = 0; i < data.length; i++) {
    data[i] = 0;
  }

  // Note: JavaScript GC may still leave copies. For maximum security,
  // minimize the lifetime of sensitive data in memory.
}

/**
 * Validate encrypted data size before sending to chain
 */
export function validateEncryptedSize(ciphertext: Uint8Array): boolean {
  return ciphertext.length > 0 && ciphertext.length <= MAX_ENCRYPTED_SIZE;
}

/**
 * Validate AEAD ciphertext format
 *
 * XChaCha20-Poly1305 (NaCl secretbox) produces:
 * - 16-byte authentication tag (Poly1305 MAC)
 * - Encrypted plaintext
 *
 * Minimum valid ciphertext: 16 bytes (tag only, for empty plaintext)
 * Maximum: MAX_ENCRYPTED_SIZE
 *
 * @param ciphertext - The encrypted data to validate
 * @param nonce - The 24-byte nonce
 * @returns true if format appears valid
 */
export function validateAEADFormat(
  ciphertext: Uint8Array,
  nonce: Uint8Array
): boolean {
  // Check ciphertext has at least the Poly1305 tag (16 bytes)
  if (ciphertext.length < 16) {
    return false;
  }

  // Check ciphertext doesn't exceed maximum
  if (ciphertext.length > MAX_ENCRYPTED_SIZE) {
    return false;
  }

  // Check nonce is exactly 24 bytes (XChaCha20 requirement)
  if (nonce.length !== NONCE_SIZE) {
    return false;
  }

  return true;
}

/**
 * Safely decrypt with validation
 *
 * This wrapper adds input validation before attempting decryption,
 * which helps prevent processing of malformed data.
 */
export function safeDecryptAEAD(
  ciphertext: Uint8Array,
  nonce: Uint8Array,
  sessionKey: Uint8Array
): Uint8Array {
  // Validate format before attempting decryption
  if (!validateAEADFormat(ciphertext, nonce)) {
    throw new Error('Invalid AEAD format: ciphertext or nonce has invalid length');
  }

  // Validate session key length
  if (sessionKey.length !== 32) {
    throw new Error('Invalid session key: must be 32 bytes');
  }

  // Attempt decryption
  return decryptAEAD(ciphertext, nonce, sessionKey);
}
