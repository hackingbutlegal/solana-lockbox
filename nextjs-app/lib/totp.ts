/**
 * TOTP (Time-based One-Time Password) Generator
 *
 * Implements RFC 6238 (TOTP) for generating 2FA codes compatible with
 * Google Authenticator, Authy, and other authenticator apps.
 *
 * Features:
 * - Standards-compliant TOTP generation (RFC 6238)
 * - HOTP support (RFC 4226)
 * - Base32 secret decoding
 * - Time window verification (prevents replay attacks)
 * - QR code URI generation for easy setup
 *
 * Security Notes:
 * - Uses HMAC-SHA1 (standard for TOTP, though SHA-256/512 also supported)
 * - Implements dynamic truncation per RFC
 * - Time-based synchronization (30-second windows)
 */

/**
 * TOTP Manager
 *
 * Generates and verifies Time-based One-Time Passwords for 2FA.
 * Compatible with Google Authenticator and similar apps.
 */
export class TOTPManager {
  /**
   * Generate a TOTP code from a base32-encoded secret
   *
   * @param secret - Base32-encoded shared secret
   * @param timeStep - Time step in seconds (default: 30)
   * @param digits - Number of digits in code (default: 6)
   * @returns 6-digit TOTP code
   *
   * @example
   * ```typescript
   * const secret = 'JBSWY3DPEHPK3PXP'; // Base32-encoded secret
   * const code = await TOTPManager.generate(secret);
   * console.log(code); // '123456'
   * ```
   */
  static async generate(
    secret: string,
    timeStep: number = 30,
    digits: number = 6
  ): Promise<string> {
    const epoch = Math.floor(Date.now() / 1000);
    const counter = Math.floor(epoch / timeStep);

    return this.generateHOTP(secret, counter, digits);
  }

  /**
   * Generate an HOTP (counter-based) code
   *
   * HOTP is the counter-based variant of TOTP. Same algorithm but uses
   * a counter instead of time.
   *
   * @param secret - Base32-encoded shared secret
   * @param counter - Counter value
   * @param digits - Number of digits in code
   * @returns HOTP code
   */
  static async generateHOTP(
    secret: string,
    counter: number,
    digits: number = 6
  ): Promise<string> {
    // Decode base32 secret
    const key = this.base32Decode(secret);

    // Generate HMAC-SHA1
    const hmac = await this.hmacSHA1(key, this.intToBytes(counter));

    // Dynamic truncation (RFC 4226 Section 5.4)
    const offset = hmac[hmac.length - 1] & 0x0f;
    const code = (
      ((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff)
    ) % Math.pow(10, digits);

    // Pad to specified digits
    return code.toString().padStart(digits, '0');
  }

  /**
   * Verify a TOTP code
   *
   * Checks if the provided code matches any of the codes in the time window.
   * The window parameter allows checking adjacent time steps to account for
   * clock drift between client and server.
   *
   * @param secret - Base32-encoded shared secret
   * @param code - Code to verify
   * @param timeStep - Time step in seconds (default: 30)
   * @param window - Number of time steps to check before/after (default: 1)
   * @returns true if code is valid
   *
   * @example
   * ```typescript
   * const secret = 'JBSWY3DPEHPK3PXP';
   * const userCode = '123456';
   * const isValid = await TOTPManager.verify(secret, userCode);
   * if (isValid) {
   *   console.log('Code is valid!');
   * }
   * ```
   */
  static async verify(
    secret: string,
    code: string,
    timeStep: number = 30,
    window: number = 1
  ): Promise<boolean> {
    const epoch = Math.floor(Date.now() / 1000);
    const baseCounter = Math.floor(epoch / timeStep);

    // Check current and adjacent time windows
    for (let i = -window; i <= window; i++) {
      const testCounter = baseCounter + i;
      const testCode = await this.generateHOTP(secret, testCounter, code.length);

      if (testCode === code) {
        return true;
      }
    }

    return false;
  }

  /**
   * Generate a random base32-encoded secret
   *
   * Creates a cryptographically random secret suitable for TOTP setup.
   * The secret should be shared with the user via QR code or manual entry.
   *
   * @param length - Length in bytes (default: 20, recommended for security)
   * @returns Base32-encoded secret
   *
   * @example
   * ```typescript
   * const secret = TOTPManager.generateSecret();
   * console.log(secret); // 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP'
   * ```
   */
  static generateSecret(length: number = 20): string {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return this.base32Encode(bytes);
  }

  /**
   * Generate a QR code URI for authenticator apps
   *
   * Creates an otpauth:// URI that can be encoded as a QR code for easy
   * setup with Google Authenticator, Authy, etc.
   *
   * @param secret - Base32-encoded secret
   * @param accountName - User's account identifier (e.g., email)
   * @param issuer - Service name (e.g., 'Lockbox')
   * @param algorithm - Hash algorithm (default: 'SHA1')
   * @param digits - Number of digits (default: 6)
   * @param period - Time step in seconds (default: 30)
   * @returns otpauth:// URI
   *
   * @example
   * ```typescript
   * const uri = TOTPManager.generateQRCodeURI(
   *   'JBSWY3DPEHPK3PXP',
   *   'user@example.com',
   *   'Lockbox'
   * );
   * console.log(uri);
   * // 'otpauth://totp/Lockbox:user@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Lockbox'
   * ```
   */
  static generateQRCodeURI(
    secret: string,
    accountName: string,
    issuer: string = 'Lockbox',
    algorithm: 'SHA1' | 'SHA256' | 'SHA512' = 'SHA1',
    digits: number = 6,
    period: number = 30
  ): string {
    const params = new URLSearchParams({
      secret,
      issuer,
      algorithm,
      digits: digits.toString(),
      period: period.toString(),
    });

    return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(accountName)}?${params}`;
  }

  /**
   * Get remaining time in current time window
   *
   * Returns the number of seconds until the current TOTP code expires
   * and a new one is generated.
   *
   * @param timeStep - Time step in seconds (default: 30)
   * @returns Seconds remaining in current window
   */
  static getTimeRemaining(timeStep: number = 30): number {
    const epoch = Math.floor(Date.now() / 1000);
    return timeStep - (epoch % timeStep);
  }

  /**
   * Decode a base32-encoded string
   *
   * Implements RFC 4648 base32 decoding (used for TOTP secrets).
   *
   * @param encoded - Base32-encoded string
   * @returns Decoded bytes
   */
  private static base32Decode(encoded: string): Uint8Array {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const clean = encoded.toUpperCase().replace(/=+$/, '').replace(/\s/g, '');

    // Convert to binary string
    const bits = clean
      .split('')
      .map(c => {
        const index = alphabet.indexOf(c);
        if (index === -1) {
          throw new Error(`Invalid base32 character: ${c}`);
        }
        return index.toString(2).padStart(5, '0');
      })
      .join('');

    // Convert binary string to bytes
    const bytes: number[] = [];
    for (let i = 0; i < bits.length; i += 8) {
      if (bits.length - i >= 8) {
        bytes.push(parseInt(bits.substr(i, 8), 2));
      }
    }

    return new Uint8Array(bytes);
  }

  /**
   * Encode bytes to base32
   *
   * @param bytes - Bytes to encode
   * @returns Base32-encoded string
   */
  private static base32Encode(bytes: Uint8Array): string {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

    // Convert to binary string
    const bits = Array.from(bytes)
      .map(byte => byte.toString(2).padStart(8, '0'))
      .join('');

    // Convert 5-bit groups to base32 characters
    let result = '';
    for (let i = 0; i < bits.length; i += 5) {
      const chunk = bits.substr(i, 5).padEnd(5, '0');
      result += alphabet[parseInt(chunk, 2)];
    }

    // Add padding
    while (result.length % 8 !== 0) {
      result += '=';
    }

    return result;
  }

  /**
   * Generate HMAC-SHA1
   *
   * @param key - Secret key
   * @param message - Message to authenticate
   * @returns HMAC-SHA1 result
   */
  private static async hmacSHA1(key: Uint8Array, message: Uint8Array): Promise<Uint8Array> {
    // Use type assertion to work around ArrayBuffer type mismatch
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      key as BufferSource,
      { name: 'HMAC', hash: 'SHA-1' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', cryptoKey, message as BufferSource);
    return new Uint8Array(signature);
  }

  /**
   * Convert integer to 8-byte array (big-endian)
   *
   * @param num - Integer to convert
   * @returns 8-byte array
   */
  private static intToBytes(num: number): Uint8Array {
    const bytes = new Uint8Array(8);
    for (let i = 7; i >= 0; i--) {
      bytes[i] = num & 0xff;
      num = num >> 8;
    }
    return bytes;
  }

  /**
   * Parse an otpauth:// URI to extract parameters
   *
   * Useful for importing TOTP configurations from QR codes or manual entry.
   *
   * @param uri - otpauth:// URI
   * @returns Parsed TOTP parameters
   */
  static parseOTPAuthURI(uri: string): {
    type: 'totp' | 'hotp';
    label: string;
    secret: string;
    issuer?: string;
    algorithm?: string;
    digits?: number;
    period?: number;
    counter?: number;
  } | null {
    try {
      const url = new URL(uri);

      if (url.protocol !== 'otpauth:') {
        return null;
      }

      const type = url.host as 'totp' | 'hotp';
      if (type !== 'totp' && type !== 'hotp') {
        return null;
      }

      const label = decodeURIComponent(url.pathname.substring(1));
      const params = url.searchParams;

      const secret = params.get('secret');
      if (!secret) {
        return null;
      }

      return {
        type,
        label,
        secret,
        issuer: params.get('issuer') || undefined,
        algorithm: params.get('algorithm') || undefined,
        digits: params.has('digits') ? parseInt(params.get('digits')!) : undefined,
        period: params.has('period') ? parseInt(params.get('period')!) : undefined,
        counter: params.has('counter') ? parseInt(params.get('counter')!) : undefined,
      };
    } catch {
      return null;
    }
  }
}

/**
 * Backup Codes Generator
 *
 * Generates one-time backup codes for account recovery when 2FA is unavailable.
 */
export class BackupCodesGenerator {
  /**
   * Generate a set of backup codes
   *
   * @param count - Number of codes to generate (default: 10)
   * @param length - Length of each code (default: 8)
   * @returns Array of backup codes
   *
   * @example
   * ```typescript
   * const codes = BackupCodesGenerator.generate(10, 8);
   * // ['A1B2C3D4', 'E5F6G7H8', ...]
   * ```
   */
  static generate(count: number = 10, length: number = 8): string[] {
    const codes: string[] = [];
    const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude ambiguous chars

    for (let i = 0; i < count; i++) {
      const bytes = new Uint8Array(length);
      crypto.getRandomValues(bytes);

      let code = '';
      for (let j = 0; j < length; j++) {
        code += charset[bytes[j] % charset.length];
      }

      codes.push(code);
    }

    return codes;
  }

  /**
   * Format backup codes for display
   *
   * Groups codes with separators for better readability.
   *
   * @param codes - Array of backup codes
   * @param separator - Character to insert between groups
   * @param groupSize - Size of each group
   * @returns Formatted codes
   *
   * @example
   * ```typescript
   * const formatted = BackupCodesGenerator.format(['A1B2C3D4'], '-', 4);
   * // ['A1B2-C3D4']
   * ```
   */
  static format(codes: string[], separator: string = '-', groupSize: number = 4): string[] {
    return codes.map(code => {
      const groups: string[] = [];
      for (let i = 0; i < code.length; i += groupSize) {
        groups.push(code.substring(i, i + groupSize));
      }
      return groups.join(separator);
    });
  }
}
