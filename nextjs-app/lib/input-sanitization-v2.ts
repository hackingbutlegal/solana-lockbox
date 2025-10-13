/**
 * Input Sanitization v2 - Using Zod Validation Schemas
 *
 * MIGRATION: This replaces input-sanitization.ts with Zod-based validation
 * All validation is CLIENT-SIDE with NO external API calls
 *
 * Benefits over v1:
 * - Type-safe with better TypeScript integration
 * - Composable schemas (DRY principle)
 * - Better error messages
 * - Consistent validation across the app
 * - Industry standard (Zod has 50M+ downloads/month)
 */

import {
  titleSchema,
  usernameSchema,
  passwordSchema,
  urlSchema,
  notesSchema,
  emailSchema,
  phoneSchema,
  creditCardSchema,
  cvvSchema,
  expirationDateSchema,
  tagSchema,
  tagsSchema,
  categorySchema,
  hexStringSchema,
  passwordEntrySchema,
  validate,
  MAX_LENGTHS,
} from './validation-schemas';

/**
 * ============================================================================
 * EXPORT CONSTANTS
 * ============================================================================
 */

export { MAX_LENGTHS };

/**
 * ============================================================================
 * INDIVIDUAL FIELD SANITIZERS (for backwards compatibility)
 * ============================================================================
 */

/**
 * Sanitize title
 */
export function sanitizeTitle(title: string): string {
  const result = validate(titleSchema, title);
  if (!result.success) {
    throw new Error(result.error);
  }
  return result.data;
}

/**
 * Sanitize username
 */
export function sanitizeUsername(username: string): string {
  const result = validate(usernameSchema, username);
  if (!result.success) {
    throw new Error(result.error);
  }
  return result.data || '';
}

/**
 * Sanitize password
 */
export function sanitizePassword(password: string): string {
  const result = validate(passwordSchema, password);
  if (!result.success) {
    throw new Error(result.error);
  }
  return result.data || '';
}

/**
 * Sanitize URL
 */
export function sanitizeURL(url: string): string {
  const result = validate(urlSchema, url);
  if (!result.success) {
    throw new Error(result.error);
  }
  return result.data || '';
}

/**
 * Sanitize notes
 */
export function sanitizeNotes(notes: string): string {
  const result = validate(notesSchema, notes);
  if (!result.success) {
    throw new Error(result.error);
  }
  return result.data || '';
}

/**
 * Sanitize email
 */
export function sanitizeEmail(email: string): string {
  const result = validate(emailSchema, email);
  if (!result.success) {
    throw new Error(result.error);
  }
  return result.data || '';
}

/**
 * Sanitize phone number
 */
export function sanitizePhone(phone: string): string {
  const result = validate(phoneSchema, phone);
  if (!result.success) {
    throw new Error(result.error);
  }
  return result.data || '';
}

/**
 * Sanitize credit card number
 */
export function sanitizeCreditCard(cardNumber: string): string {
  const result = validate(creditCardSchema, cardNumber);
  if (!result.success) {
    throw new Error(result.error);
  }
  return result.data || '';
}

/**
 * Sanitize CVV
 */
export function sanitizeCVV(cvv: string): string {
  const result = validate(cvvSchema, cvv);
  if (!result.success) {
    throw new Error(result.error);
  }
  return result.data || '';
}

/**
 * Sanitize tag
 */
export function sanitizeTag(tag: string): string {
  const result = validate(tagSchema, tag);
  if (!result.success) {
    throw new Error(result.error);
  }
  return result.data;
}

/**
 * Sanitize tags array
 */
export function sanitizeTags(tags: string[]): string[] {
  const result = validate(tagsSchema, tags);
  if (!result.success) {
    return []; // Return empty array on validation failure
  }
  return result.data;
}

/**
 * Validate category ID
 */
export function validateCategory(category: number | undefined): number {
  const result = validate(categorySchema, category);
  if (!result.success) {
    return 0; // Return default category on validation failure
  }
  return result.data;
}

/**
 * Sanitize hex string
 */
export function sanitizeHexString(hex: string, expectedLength?: number): string {
  const schema = hexStringSchema(expectedLength);
  const result = validate(schema, hex);
  if (!result.success) {
    throw new Error(result.error);
  }
  return result.data;
}

/**
 * ============================================================================
 * COMPREHENSIVE PASSWORD ENTRY SANITIZATION
 * ============================================================================
 */

export interface SanitizedPasswordEntry {
  title: string;
  username?: string;
  password?: string;
  url?: string;
  notes?: string;
  email?: string;
  phone?: string;
  category: number;
  tags: string[];
  type: number;
  totpSecret?: string;
}

/**
 * Sanitize complete password entry using Zod schema
 */
export function sanitizePasswordEntry(entry: any): SanitizedPasswordEntry {
  const result = validate(passwordEntrySchema, entry);

  if (!result.success) {
    throw new Error(result.error);
  }

  return result.data;
}

/**
 * ============================================================================
 * UTILITY FUNCTIONS
 * ============================================================================
 */

/**
 * Sanitize JSON string to prevent injection
 */
export function sanitizeJSON(input: string): string {
  try {
    const parsed = JSON.parse(input);
    return JSON.stringify(parsed);
  } catch {
    throw new Error('Invalid JSON format');
  }
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
    const recentAttempts = attempts.filter((time) => now - time < this.windowMs);

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

/**
 * ============================================================================
 * MIGRATION NOTES
 * ============================================================================
 *
 * To migrate from input-sanitization.ts to input-sanitization-v2.ts:
 *
 * 1. Replace imports:
 *    OLD: import { sanitizeTitle } from './lib/input-sanitization';
 *    NEW: import { sanitizeTitle } from './lib/input-sanitization-v2';
 *
 * 2. All function signatures remain the same - drop-in replacement
 *
 * 3. Better error messages automatically
 *
 * 4. More robust validation with Zod
 *
 * 5. No external API calls - all validation is client-side
 */
