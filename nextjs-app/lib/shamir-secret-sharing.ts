/**
 * # Shamir Secret Sharing Implementation
 *
 * This module implements Shamir's Secret Sharing scheme for social recovery.
 * It allows splitting a secret (master encryption key) into N shares where
 * any M shares can reconstruct the original secret.
 *
 * ## Algorithm
 *
 * Shamir's Secret Sharing is based on polynomial interpolation in a finite field.
 * The secret is the constant term (a₀) of a random polynomial of degree M-1:
 *
 * f(x) = a₀ + a₁x + a₂x² + ... + a_{M-1}x^{M-1} (mod p)
 *
 * where p is a prime number larger than the secret and number of shares.
 *
 * ## Security Properties
 *
 * - Information-theoretic security: M-1 shares reveal NOTHING about the secret
 * - Any M shares can perfectly reconstruct the secret
 * - Shares can be public (security relies on threshold)
 * - No cryptographic assumptions needed (unconditional security)
 *
 * ## Usage
 *
 * ```typescript
 * // Split a 32-byte secret into 5 shares with threshold of 3
 * const secret = new Uint8Array(32); // Your master key
 * const shares = splitSecret(secret, 3, 5);
 *
 * // Reconstruct from any 3 shares
 * const reconstructed = reconstructSecret(shares.slice(0, 3));
 * // reconstructed === secret (bitwise identical)
 * ```
 *
 * ## Field Arithmetic
 *
 * We use GF(2^8) (Galois Field of 256 elements) for byte-wise operations.
 * This allows us to work with 8-bit chunks for efficiency.
 *
 * @module shamir-secret-sharing
 */

// ============================================================================
// Galois Field GF(2^8) Arithmetic
// ============================================================================

/**
 * Irreducible polynomial for GF(2^8): x^8 + x^4 + x^3 + x + 1 (0x11b)
 * This is the same polynomial used in AES
 */
const IRREDUCIBLE_POLY = 0x11b;

/**
 * Precomputed lookup tables for multiplication in GF(2^8)
 * These make multiplication O(1) instead of O(n)
 */
let EXP_TABLE: Uint8Array | null = null;
let LOG_TABLE: Uint8Array | null = null;

/**
 * Initialize lookup tables for GF(2^8) arithmetic
 * Based on generator element α = 0x02
 */
function initializeTables(): void {
  if (EXP_TABLE && LOG_TABLE) return; // Already initialized

  EXP_TABLE = new Uint8Array(512); // Extended to handle all operations
  LOG_TABLE = new Uint8Array(256);

  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP_TABLE[i] = x;
    LOG_TABLE[x] = i;

    // Multiply by generator (0x02) with reduction
    x = (x << 1) ^ (x & 0x80 ? IRREDUCIBLE_POLY : 0);
  }

  // Extend exp table for easier computation
  for (let i = 255; i < 512; i++) {
    EXP_TABLE[i] = EXP_TABLE[i - 255];
  }
}

/**
 * Multiply two elements in GF(2^8)
 *
 * @param a - First operand (0-255)
 * @param b - Second operand (0-255)
 * @returns Product in GF(2^8)
 */
function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  if (!LOG_TABLE || !EXP_TABLE) initializeTables();

  const logSum = LOG_TABLE![a] + LOG_TABLE![b];
  return EXP_TABLE![logSum];
}

/**
 * Divide two elements in GF(2^8)
 *
 * @param a - Dividend
 * @param b - Divisor (must be non-zero)
 * @returns Quotient in GF(2^8)
 */
function gfDiv(a: number, b: number): number {
  if (b === 0) throw new Error('Division by zero in GF(2^8)');
  if (a === 0) return 0;
  if (!LOG_TABLE || !EXP_TABLE) initializeTables();

  const logDiff = (LOG_TABLE![a] - LOG_TABLE![b] + 255) % 255;
  return EXP_TABLE![logDiff];
}

/**
 * Evaluate polynomial at x in GF(2^8) using Horner's method
 *
 * f(x) = a₀ + a₁x + a₂x² + ... + aₙxⁿ
 * Evaluated as: a₀ + x(a₁ + x(a₂ + x(...)))
 *
 * @param coefficients - Polynomial coefficients [a₀, a₁, ..., aₙ]
 * @param x - Point to evaluate at
 * @returns f(x) in GF(2^8)
 */
function evaluatePolynomial(coefficients: Uint8Array, x: number): number {
  let result = 0;
  for (let i = coefficients.length - 1; i >= 0; i--) {
    result = gfMul(result, x) ^ coefficients[i];
  }
  return result;
}

/**
 * Lagrange interpolation to find constant term of polynomial
 *
 * Given points (x₁, y₁), (x₂, y₂), ..., (xₘ, yₘ), finds f(0)
 * where f is the unique polynomial of degree < m passing through all points.
 *
 * f(0) = Σ yᵢ * Lᵢ(0)
 * where Lᵢ(0) = Π_{j≠i} (-xⱼ) / (xᵢ - xⱼ)
 *
 * @param shares - Array of (x, y) points
 * @returns f(0) - the constant term (secret byte)
 */
function lagrangeInterpolate(shares: Array<{ x: number; y: number }>): number {
  let secret = 0;

  for (let i = 0; i < shares.length; i++) {
    let numerator = 1;
    let denominator = 1;

    for (let j = 0; j < shares.length; j++) {
      if (i !== j) {
        numerator = gfMul(numerator, shares[j].x);
        denominator = gfMul(denominator, shares[i].x ^ shares[j].x);
      }
    }

    const lagrangeCoeff = gfDiv(numerator, denominator);
    secret ^= gfMul(shares[i].y, lagrangeCoeff);
  }

  return secret;
}

// ============================================================================
// Shamir Secret Sharing Core Functions
// ============================================================================

/**
 * Share data structure
 */
export interface Share {
  /** Share index (1 to N) - MUST be non-zero */
  index: number;

  /** Share data (same length as secret) */
  data: Uint8Array;
}

/**
 * Split a secret into N shares with M-of-N threshold
 *
 * Creates N shares where any M shares can reconstruct the secret,
 * but M-1 shares reveal nothing.
 *
 * @param secret - Secret to split (typically 32 bytes for master key)
 * @param threshold - Minimum shares needed to reconstruct (M)
 * @param totalShares - Total number of shares to create (N)
 * @returns Array of N shares
 *
 * @throws {Error} If threshold or totalShares are invalid
 * @throws {Error} If secret is empty
 *
 * @example
 * ```typescript
 * const secret = crypto.getRandomValues(new Uint8Array(32));
 * const shares = splitSecret(secret, 3, 5);
 * // Any 3 of the 5 shares can reconstruct the secret
 * ```
 */
export function splitSecret(
  secret: Uint8Array,
  threshold: number,
  totalShares: number
): Share[] {
  // Validate inputs
  if (threshold < 2 || threshold > 255) {
    throw new Error('Threshold must be between 2 and 255');
  }
  if (totalShares < threshold || totalShares > 255) {
    throw new Error('Total shares must be between threshold and 255');
  }
  if (secret.length === 0) {
    throw new Error('Secret cannot be empty');
  }

  // Initialize GF(2^8) tables
  initializeTables();

  // Create shares array
  const shares: Share[] = [];

  // Process each byte of the secret independently
  for (let byteIndex = 0; byteIndex < secret.length; byteIndex++) {
    // Generate random polynomial coefficients
    // f(x) = a₀ + a₁x + a₂x² + ... + a_{M-1}x^{M-1}
    // where a₀ is the secret byte
    const coefficients = new Uint8Array(threshold);
    coefficients[0] = secret[byteIndex]; // Constant term is secret

    // Random coefficients for x, x², ..., x^{M-1}
    // SECURITY: Must use cryptographically secure randomness
    for (let i = 1; i < threshold; i++) {
      const randomByte = new Uint8Array(1);
      crypto.getRandomValues(randomByte);
      coefficients[i] = randomByte[0];
    }

    // Evaluate polynomial at x = 1, 2, ..., N to create shares
    for (let shareIndex = 1; shareIndex <= totalShares; shareIndex++) {
      const shareValue = evaluatePolynomial(coefficients, shareIndex);

      if (byteIndex === 0) {
        // Initialize share
        shares.push({
          index: shareIndex,
          data: new Uint8Array(secret.length),
        });
      }

      shares[shareIndex - 1].data[byteIndex] = shareValue;
    }
  }

  return shares;
}

/**
 * Reconstruct secret from M-of-N shares
 *
 * Uses Lagrange interpolation to recover the original secret from
 * any M shares (where M is the threshold used during splitting).
 *
 * @param shares - Array of at least M shares
 * @returns Reconstructed secret
 *
 * @throws {Error} If shares array is invalid
 * @throws {Error} If shares have inconsistent lengths
 * @throws {Error} If duplicate share indices detected
 *
 * @example
 * ```typescript
 * const original = new Uint8Array([1, 2, 3, 4]);
 * const shares = splitSecret(original, 2, 3);
 *
 * // Reconstruct from any 2 shares
 * const reconstructed = reconstructSecret([shares[0], shares[2]]);
 * // reconstructed is bitwise identical to original
 * ```
 */
export function reconstructSecret(shares: Share[]): Uint8Array {
  // Validate inputs
  if (!shares || shares.length === 0) {
    throw new Error('At least one share is required');
  }

  // Validate all shares have same length
  const secretLength = shares[0].data.length;
  for (const share of shares) {
    if (share.data.length !== secretLength) {
      throw new Error('All shares must have the same length');
    }
    if (share.index < 1 || share.index > 255) {
      throw new Error(`Invalid share index: ${share.index}`);
    }
  }

  // Check for duplicate indices
  const indices = new Set(shares.map((s) => s.index));
  if (indices.size !== shares.length) {
    throw new Error('Duplicate share indices detected');
  }

  // Initialize GF(2^8) tables
  initializeTables();

  // Reconstruct each byte independently
  const secret = new Uint8Array(secretLength);

  for (let byteIndex = 0; byteIndex < secretLength; byteIndex++) {
    // Collect (x, y) points for this byte
    const points = shares.map((share) => ({
      x: share.index,
      y: share.data[byteIndex],
    }));

    // Use Lagrange interpolation to find f(0)
    secret[byteIndex] = lagrangeInterpolate(points);
  }

  return secret;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Verify that shares can reconstruct the original secret
 *
 * Useful for testing and validation.
 *
 * @param secret - Original secret
 * @param shares - Shares to verify
 * @param threshold - Minimum shares needed
 * @returns true if reconstruction works correctly
 */
export function verifyShares(
  secret: Uint8Array,
  shares: Share[],
  threshold: number
): boolean {
  if (shares.length < threshold) {
    return false;
  }

  try {
    // Try reconstructing with exactly threshold shares
    const testShares = shares.slice(0, threshold);
    const reconstructed = reconstructSecret(testShares);

    // Compare byte-by-byte
    if (reconstructed.length !== secret.length) {
      return false;
    }

    for (let i = 0; i < secret.length; i++) {
      if (reconstructed[i] !== secret[i]) {
        return false;
      }
    }

    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Serialize share to base64 for storage/transmission
 *
 * Format: index(1 byte) | data(N bytes)
 *
 * @param share - Share to serialize
 * @returns Base64 string
 */
export function serializeShare(share: Share): string {
  const buffer = new Uint8Array(1 + share.data.length);
  buffer[0] = share.index;
  buffer.set(share.data, 1);
  return btoa(String.fromCharCode(...buffer));
}

/**
 * Deserialize share from base64
 *
 * @param encoded - Base64-encoded share
 * @returns Deserialized share
 */
export function deserializeShare(encoded: string): Share {
  const buffer = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));

  if (buffer.length < 2) {
    throw new Error('Invalid share: too short');
  }

  return {
    index: buffer[0],
    data: buffer.slice(1),
  };
}

/**
 * Generate cryptographically secure random bytes
 *
 * Uses Web Crypto API for strong randomness.
 *
 * @param length - Number of bytes
 * @returns Random bytes
 */
export function randomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

// ============================================================================
// Exports
// ============================================================================

export { Share as ShamirShare };

export default {
  splitSecret,
  reconstructSecret,
  verifyShares,
  serializeShare,
  deserializeShare,
  randomBytes,
};
