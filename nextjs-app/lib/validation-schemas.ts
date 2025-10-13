/**
 * Comprehensive Validation Schemas using Zod
 *
 * SECURITY: All validation is done CLIENT-SIDE with NO external API calls
 * Uses Zod for type-safe, composable validation schemas
 *
 * Benefits:
 * - Self-contained (no network requests)
 * - Type-safe (TypeScript integration)
 * - Composable (reusable schemas)
 * - Battle-tested (50M+ downloads/month)
 * - Better error messages
 */

import { z } from 'zod';

/**
 * ============================================================================
 * CONSTANTS
 * ============================================================================
 */

export const MAX_LENGTHS = {
  TITLE: 255,
  USERNAME: 255,
  PASSWORD: 1000,
  URL: 2048,
  NOTES: 10000,
  TAG: 50,
  CATEGORY_NAME: 100,
  CARD_NUMBER: 19,
  CVV: 4,
  EMAIL: 320, // RFC 5321
  PHONE: 20,
  API_KEY: 500,
} as const;

/**
 * ============================================================================
 * BASE SCHEMAS
 * ============================================================================
 */

/**
 * Title schema - required, 1-255 characters
 */
export const titleSchema = z
  .string()
  .trim()
  .min(1, 'Title is required')
  .max(MAX_LENGTHS.TITLE, `Title must be less than ${MAX_LENGTHS.TITLE} characters`)
  .transform((val) => {
    // Remove control characters except newlines/tabs
    return val.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  });

/**
 * Username schema - optional, up to 255 characters
 */
export const usernameSchema = z
  .string()
  .trim()
  .max(MAX_LENGTHS.USERNAME, `Username must be less than ${MAX_LENGTHS.USERNAME} characters`)
  .optional()
  .transform((val) => {
    if (!val) return undefined;
    return val.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  });

/**
 * Password schema - preserve all characters, enforce length
 */
export const passwordSchema = z
  .string()
  .min(1, 'Password cannot be empty')
  .max(MAX_LENGTHS.PASSWORD, `Password must be less than ${MAX_LENGTHS.PASSWORD} characters`)
  .optional();

/**
 * Notes schema - allow newlines/tabs, limit length
 */
export const notesSchema = z
  .string()
  .max(MAX_LENGTHS.NOTES, `Notes must be less than ${MAX_LENGTHS.NOTES} characters`)
  .optional()
  .transform((val) => {
    if (!val) return undefined;
    // Allow newlines and tabs, remove other control characters
    return val.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim();
  });

/**
 * ============================================================================
 * URL VALIDATION
 * ============================================================================
 */

/**
 * URL schema with auto-normalization
 * Accepts: "microsoft.com" or "https://microsoft.com"
 * Output: Always normalized to full URL
 */
export const urlSchema = z
  .string()
  .transform((val) => {
    if (!val || val.trim() === '') return '';
    const trimmed = val.trim();
    // Auto-prepend https:// if no protocol
    const hasProtocol = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed);
    return hasProtocol ? trimmed : `https://${trimmed}`;
  })
  .pipe(
    z.union([
      z.literal(''), // Allow empty string
      z.string().url({
        message: 'Please enter a valid URL (e.g., microsoft.com or https://example.com)',
      }),
    ])
  )
  .optional();

/**
 * ============================================================================
 * EMAIL VALIDATION
 * ============================================================================
 */

/**
 * Email schema - RFC 5322 compliant via Zod's built-in validator
 * Zod's email validator is based on the HTML5 spec and handles 99.9% of cases
 */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(MAX_LENGTHS.EMAIL, `Email must be less than ${MAX_LENGTHS.EMAIL} characters`)
  .email('Please enter a valid email address')
  .optional()
  .or(z.literal(''));

/**
 * ============================================================================
 * PHONE NUMBER VALIDATION
 * ============================================================================
 */

/**
 * Phone number schema - international format
 * Allows: +1234567890, (123) 456-7890, 123-456-7890
 * Normalizes to: +1234567890
 */
export const phoneSchema = z
  .string()
  .transform((val) => {
    if (!val) return '';
    // Keep only digits and +
    return val.replace(/[^\d+]/g, '');
  })
  .pipe(
    z.union([
      z.literal(''),
      z
        .string()
        .min(7, 'Phone number too short')
        .max(MAX_LENGTHS.PHONE, `Phone number must be less than ${MAX_LENGTHS.PHONE} characters`)
        .regex(/^\+?\d{7,}$/, 'Invalid phone number format'),
    ])
  )
  .optional();

/**
 * ============================================================================
 * CREDIT CARD VALIDATION
 * ============================================================================
 */

/**
 * Luhn algorithm check for credit card validation
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
 * Credit card number schema with Luhn validation (base schema)
 */
const creditCardBaseSchema = z
  .string()
  .transform((val) => {
    // Remove spaces and hyphens
    return val.replace(/[\s-]/g, '');
  })
  .pipe(
    z
      .string()
      .regex(/^\d+$/, 'Card number must contain only digits')
      .min(13, 'Card number too short')
      .max(19, 'Card number too long')
      .refine((val) => luhnCheck(val), {
        message: 'Invalid card number (failed Luhn check)',
      })
  );

/**
 * Credit card number schema (optional)
 */
export const creditCardSchema = creditCardBaseSchema.optional();

/**
 * Required credit card number schema (for credit card entries)
 */
export const creditCardRequiredSchema = creditCardBaseSchema;

/**
 * CVV schema (base schema)
 */
const cvvBaseSchema = z
  .string()
  .transform((val) => val.replace(/\s/g, ''))
  .pipe(z.string().regex(/^\d{3,4}$/, 'CVV must be 3 or 4 digits'));

/**
 * CVV schema (optional)
 */
export const cvvSchema = cvvBaseSchema.optional();

/**
 * Expiration date schema (base schema)
 */
const expirationDateBaseSchema = z
  .string()
  .regex(/^(0[1-9]|1[0-2])\/(\d{2}|\d{4})$/, 'Expiration date must be in MM/YY or MM/YYYY format');

/**
 * Expiration date schema (optional)
 */
export const expirationDateSchema = expirationDateBaseSchema.optional();

/**
 * ============================================================================
 * TAG VALIDATION
 * ============================================================================
 */

/**
 * Single tag schema - alphanumeric with hyphens/underscores
 */
export const tagSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(MAX_LENGTHS.TAG, `Tag must be less than ${MAX_LENGTHS.TAG} characters`)
  .regex(/^[a-zA-Z0-9_-]+$/, 'Tags can only contain letters, numbers, hyphens, and underscores');

/**
 * Tags array schema - max 20 tags, deduplicated
 */
export const tagsSchema = z
  .array(z.string())
  .transform((tags) => {
    const sanitized: string[] = [];
    const seen = new Set<string>();

    for (const tag of tags) {
      try {
        const result = tagSchema.safeParse(tag);
        if (result.success) {
          const sanitizedTag = result.data;
          if (!seen.has(sanitizedTag)) {
            sanitized.push(sanitizedTag);
            seen.add(sanitizedTag);
          }
        }
        if (sanitized.length >= 20) break;
      } catch {
        continue;
      }
    }

    return sanitized;
  })
  .default([]);

/**
 * ============================================================================
 * CATEGORY VALIDATION
 * ============================================================================
 */

/**
 * Category ID schema - integer 0-999
 */
export const categorySchema = z
  .number()
  .int('Category must be an integer')
  .min(0, 'Category must be at least 0')
  .max(999, 'Category must be at most 999')
  .default(0);

/**
 * ============================================================================
 * HEX STRING VALIDATION
 * ============================================================================
 */

/**
 * Hex string schema with optional length validation
 */
export function hexStringSchema(expectedLength?: number) {
  let schema = z
    .string()
    .transform((val) => val.replace(/[^0-9a-fA-F]/g, '').toLowerCase())
    .pipe(z.string().regex(/^[0-9a-f]*$/, 'Must be a valid hex string'));

  if (expectedLength) {
    schema = schema.pipe(
      z.string().length(expectedLength * 2, `Expected ${expectedLength} bytes (${expectedLength * 2} hex characters)`)
    );
  }

  return schema;
}

/**
 * ============================================================================
 * COMPOSITE SCHEMAS
 * ============================================================================
 */

/**
 * Password entry schema - full validation for password entries
 */
export const passwordEntrySchema = z.object({
  title: titleSchema,
  username: usernameSchema,
  password: passwordSchema,
  url: urlSchema,
  notes: notesSchema,
  email: emailSchema,
  phone: phoneSchema,
  category: categorySchema,
  tags: tagsSchema,
  type: z.number().int().min(0).max(10), // PasswordEntryType enum
  // Additional fields
  totpSecret: z.string().optional(),
});

/**
 * Login entry schema - specific to login credentials
 */
export const loginEntrySchema = passwordEntrySchema.extend({
  type: z.literal(0), // PasswordEntryType.Login
  password: z.string().min(1, 'Password is required'),
  url: urlSchema,
});

/**
 * Credit card entry schema - specific to credit cards
 */
export const creditCardEntrySchema = passwordEntrySchema.extend({
  type: z.literal(1), // PasswordEntryType.CreditCard
  password: creditCardRequiredSchema, // Card number stored in password field (required)
  username: z.string().min(1, 'Cardholder name is required'), // Name
  totpSecret: cvvSchema, // CVV stored in totpSecret field
  email: expirationDateSchema, // Expiration stored in email field
});

/**
 * ============================================================================
 * VALIDATION HELPERS
 * ============================================================================
 */

/**
 * Validate and transform data with a schema
 * Returns { success: true, data: T } or { success: false, error: string }
 */
export function validate<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } {
  try {
    const result = schema.parse(data);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.errors[0];
      return {
        success: false,
        error: firstError ? `${firstError.path.join('.')}: ${firstError.message}` : 'Validation failed',
      };
    }
    return { success: false, error: 'Validation failed' };
  }
}

/**
 * Safe parse - returns result without throwing
 */
export function safeParse<T>(schema: z.ZodSchema<T>, data: unknown) {
  return schema.safeParse(data);
}
