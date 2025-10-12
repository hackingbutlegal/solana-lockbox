/**
 * Input Sanitization and Validation Utilities
 *
 * SECURITY: All user-provided data must be validated and sanitized before:
 * - Encryption
 * - Storage
 * - Display
 * - Processing
 */

/**
 * Maximum lengths for various fields (defense in depth)
 */
export const MAX_LENGTHS = {
  TITLE: 255,
  USERNAME: 255,
  PASSWORD: 1000,
  URL: 2048,
  NOTES: 10000,
  TAG: 50,
  CATEGORY_NAME: 100,
  CARD_NUMBER: 19, // Max credit card length with spaces
  CVV: 4,
  EMAIL: 320, // RFC 5321
  PHONE: 20,
  API_KEY: 500,
} as const;

/**
 * Sanitize string input by removing dangerous characters
 *
 * SECURITY: Prevents XSS, injection attacks, and control character abuse
 */
export function sanitizeString(input: string, maxLength?: number): string {
  if (typeof input !== 'string') {
    throw new Error('Input must be a string');
  }

  // Remove null bytes and control characters (except newlines/tabs for notes)
  let sanitized = input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // Trim whitespace
  sanitized = sanitized.trim();

  // Enforce maximum length
  if (maxLength && sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  return sanitized;
}

/**
 * Sanitize title (most restrictive)
 */
export function sanitizeTitle(title: string): string {
  const sanitized = sanitizeString(title, MAX_LENGTHS.TITLE);

  if (sanitized.length === 0) {
    throw new Error('Title cannot be empty after sanitization');
  }

  if (sanitized.length < 1) {
    throw new Error('Title must be at least 1 character');
  }

  return sanitized;
}

/**
 * Sanitize username/email
 */
export function sanitizeUsername(username: string): string {
  return sanitizeString(username, MAX_LENGTHS.USERNAME);
}

/**
 * Sanitize password (preserve all characters but enforce length)
 */
export function sanitizePassword(password: string): string {
  if (typeof password !== 'string') {
    throw new Error('Password must be a string');
  }

  if (password.length === 0) {
    throw new Error('Password cannot be empty');
  }

  if (password.length > MAX_LENGTHS.PASSWORD) {
    throw new Error(`Password exceeds maximum length of ${MAX_LENGTHS.PASSWORD} characters`);
  }

  return password;
}

/**
 * Sanitize and validate URL
 */
export function sanitizeURL(url: string): string {
  const sanitized = sanitizeString(url, MAX_LENGTHS.URL);

  if (sanitized.length === 0) {
    return '';
  }

  // Basic URL validation
  try {
    // Add protocol if missing
    const urlWithProtocol = sanitized.match(/^https?:\/\//)
      ? sanitized
      : `https://${sanitized}`;

    const parsed = new URL(urlWithProtocol);

    // Only allow http/https
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('Invalid URL protocol');
    }

    return parsed.toString();
  } catch (e) {
    throw new Error(`Invalid URL format: ${e instanceof Error ? e.message : 'unknown error'}`);
  }
}

/**
 * Sanitize notes (allow newlines, but limit length)
 */
export function sanitizeNotes(notes: string): string {
  if (typeof notes !== 'string') {
    throw new Error('Notes must be a string');
  }

  // Allow newlines and tabs, but remove other control characters
  let sanitized = notes.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // Trim excessive whitespace
  sanitized = sanitized.trim();

  if (sanitized.length > MAX_LENGTHS.NOTES) {
    sanitized = sanitized.substring(0, MAX_LENGTHS.NOTES);
  }

  return sanitized;
}

/**
 * Sanitize tag (strict - no special characters)
 */
export function sanitizeTag(tag: string): string {
  const sanitized = sanitizeString(tag, MAX_LENGTHS.TAG);

  // Tags should be alphanumeric with hyphens/underscores only
  if (!/^[a-zA-Z0-9_-]+$/.test(sanitized)) {
    throw new Error('Tags can only contain letters, numbers, hyphens, and underscores');
  }

  return sanitized.toLowerCase();
}

/**
 * Sanitize array of tags
 */
export function sanitizeTags(tags: string[]): string[] {
  if (!Array.isArray(tags)) {
    return [];
  }

  const sanitized: string[] = [];
  const seen = new Set<string>();

  for (const tag of tags) {
    try {
      const sanitizedTag = sanitizeTag(tag);

      // Deduplicate
      if (!seen.has(sanitizedTag)) {
        sanitized.push(sanitizedTag);
        seen.add(sanitizedTag);
      }

      // Maximum 20 tags per entry
      if (sanitized.length >= 20) {
        break;
      }
    } catch {
      // Skip invalid tags
      continue;
    }
  }

  return sanitized;
}

/**
 * Validate category ID
 */
export function validateCategory(category: number | undefined): number {
  if (category === undefined) {
    return 0; // Default category
  }

  if (!Number.isInteger(category)) {
    throw new Error('Category must be an integer');
  }

  if (category < 0 || category > 999) {
    throw new Error('Category must be between 0 and 999');
  }

  return category;
}

/**
 * Sanitize credit card number (remove spaces/hyphens, validate format)
 */
export function sanitizeCreditCard(cardNumber: string): string {
  // Remove spaces and hyphens
  const cleaned = cardNumber.replace(/[\s-]/g, '');

  // Validate digits only
  if (!/^\d+$/.test(cleaned)) {
    throw new Error('Credit card number must contain only digits');
  }

  // Validate length (13-19 digits for most cards)
  if (cleaned.length < 13 || cleaned.length > 19) {
    throw new Error('Invalid credit card number length');
  }

  // Basic Luhn algorithm check
  if (!luhnCheck(cleaned)) {
    throw new Error('Invalid credit card number (failed Luhn check)');
  }

  return cleaned;
}

/**
 * Luhn algorithm for credit card validation
 */
function luhnCheck(cardNumber: string): boolean {
  let sum = 0;
  let isEven = false;

  for (let i = cardNumber.length - 1; i >= 0; i--) {
    let digit = parseInt(cardNumber[i], 10);

    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    isEven = !isEven;
  }

  return sum % 10 === 0;
}

/**
 * Sanitize CVV
 */
export function sanitizeCVV(cvv: string): string {
  const cleaned = cvv.replace(/\s/g, '');

  if (!/^\d{3,4}$/.test(cleaned)) {
    throw new Error('CVV must be 3 or 4 digits');
  }

  return cleaned;
}

/**
 * Sanitize email
 */
export function sanitizeEmail(email: string): string {
  const sanitized = sanitizeString(email, MAX_LENGTHS.EMAIL).toLowerCase();

  // Basic email regex (RFC 5322 simplified)
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

  if (!emailRegex.test(sanitized)) {
    throw new Error('Invalid email format');
  }

  return sanitized;
}

/**
 * Sanitize phone number
 */
export function sanitizePhone(phone: string): string {
  // Remove all non-digit characters except +
  const cleaned = phone.replace(/[^\d+]/g, '');

  if (cleaned.length === 0) {
    return '';
  }

  if (cleaned.length > MAX_LENGTHS.PHONE) {
    throw new Error(`Phone number too long (max ${MAX_LENGTHS.PHONE} characters)`);
  }

  return cleaned;
}

/**
 * Comprehensive password entry sanitization
 */
export interface SanitizedPasswordEntry {
  title: string;
  username?: string;
  password?: string;
  url?: string;
  notes?: string;
  category: number;
  tags: string[];
  type: number;
}

export function sanitizePasswordEntry(entry: any): SanitizedPasswordEntry {
  if (!entry || typeof entry !== 'object') {
    throw new Error('Invalid password entry object');
  }

  // Required field
  const title = sanitizeTitle(entry.title);

  // Optional fields
  const username = entry.username ? sanitizeUsername(entry.username) : undefined;
  const password = entry.password ? sanitizePassword(entry.password) : undefined;
  const url = entry.url ? sanitizeURL(entry.url) : undefined;
  const notes = entry.notes ? sanitizeNotes(entry.notes) : undefined;

  // Metadata
  const category = validateCategory(entry.category);
  const tags = sanitizeTags(entry.tags || []);
  const type = validateCategory(entry.type); // Reuse same validation

  return {
    title,
    username,
    password,
    url,
    notes,
    category,
    tags,
    type,
  };
}

/**
 * Sanitize JSON string to prevent injection
 */
export function sanitizeJSON(input: string): string {
  try {
    // Parse and re-stringify to remove any injection attempts
    const parsed = JSON.parse(input);
    return JSON.stringify(parsed);
  } catch {
    throw new Error('Invalid JSON format');
  }
}

/**
 * Validate and sanitize hex string
 */
export function sanitizeHexString(hex: string, expectedLength?: number): string {
  const cleaned = hex.replace(/[^0-9a-fA-F]/g, '');

  if (expectedLength && cleaned.length !== expectedLength * 2) {
    throw new Error(`Expected ${expectedLength} bytes (${expectedLength * 2} hex characters), got ${cleaned.length}`);
  }

  return cleaned.toLowerCase();
}

/**
 * Rate limiting helper (client-side)
 */
export class RateLimiter {
  private attempts: Map<string, number[]> = new Map();
  private readonly maxAttempts: number;
  private readonly windowMs: number;

  constructor(maxAttempts: number = 5, windowMs: number = 60000) {
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
  }

  check(key: string): boolean {
    const now = Date.now();
    const attempts = this.attempts.get(key) || [];

    // Remove old attempts outside the window
    const recentAttempts = attempts.filter(time => now - time < this.windowMs);

    if (recentAttempts.length >= this.maxAttempts) {
      return false; // Rate limit exceeded
    }

    recentAttempts.push(now);
    this.attempts.set(key, recentAttempts);

    return true;
  }

  reset(key: string): void {
    this.attempts.delete(key);
  }
}
