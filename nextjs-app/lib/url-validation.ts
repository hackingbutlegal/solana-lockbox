import { z } from 'zod';

/**
 * URL Validation and Normalization Utilities
 *
 * Uses Zod for robust URL validation with smart normalization:
 * - Accepts URLs with or without protocol
 * - Auto-prepends https:// if missing
 * - Validates format using Zod's URL validator
 * - Handles common user input patterns
 */

/**
 * Normalize a URL by auto-prepending https:// if protocol is missing
 *
 * Examples:
 * - "microsoft.com" -> "https://microsoft.com"
 * - "http://example.com" -> "http://example.com" (unchanged)
 * - "https://github.com" -> "https://github.com" (unchanged)
 * - "ftp://files.com" -> "ftp://files.com" (unchanged)
 */
export function normalizeUrl(url: string): string {
  if (!url || url.trim() === '') {
    return '';
  }

  const trimmed = url.trim();

  // Check if URL already has a protocol
  // Matches: http://, https://, ftp://, etc.
  const hasProtocol = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed);

  if (hasProtocol) {
    return trimmed;
  }

  // Auto-prepend https://
  return `https://${trimmed}`;
}

/**
 * Zod schema for URL validation with auto-normalization
 *
 * This accepts both:
 * - Full URLs: "https://example.com"
 * - Domain-only: "example.com" (will be normalized to "https://example.com")
 */
export const urlSchema = z
  .string()
  .transform((val) => normalizeUrl(val))
  .pipe(
    z.string().url({
      message: 'Please enter a valid URL (e.g., microsoft.com or https://microsoft.com)',
    })
  );

/**
 * Validate a URL string and return normalized version or error
 *
 * @param url - The URL to validate
 * @returns { valid: true, url: string } | { valid: false, error: string }
 */
export function validateUrl(url: string): { valid: true; url: string } | { valid: false; error: string } {
  try {
    const normalized = urlSchema.parse(url);
    return { valid: true, url: normalized };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { valid: false, error: error.errors[0]?.message || 'Invalid URL' };
    }
    return { valid: false, error: 'Invalid URL format' };
  }
}

/**
 * Check if a URL is valid (returns boolean)
 */
export function isValidUrl(url: string): boolean {
  const result = validateUrl(url);
  return result.valid;
}

/**
 * Extract hostname from URL
 *
 * Examples:
 * - "https://www.microsoft.com/en-us" -> "www.microsoft.com"
 * - "microsoft.com" -> "microsoft.com" (after normalization)
 * - "" -> null
 */
export function extractHostname(url: string): string | null {
  if (!url || url.trim() === '') {
    return null;
  }

  try {
    const normalized = normalizeUrl(url);
    const urlObj = new URL(normalized);
    return urlObj.hostname;
  } catch {
    return null;
  }
}

/**
 * Extract domain (without subdomain) from URL
 *
 * Examples:
 * - "https://www.microsoft.com" -> "microsoft.com"
 * - "https://mail.google.com" -> "google.com"
 * - "https://github.com" -> "github.com"
 */
export function extractDomain(url: string): string | null {
  const hostname = extractHostname(url);
  if (!hostname) {
    return null;
  }

  // Split by dots and take last 2 parts (handles .com, .co.uk, etc.)
  const parts = hostname.split('.');
  if (parts.length >= 2) {
    return parts.slice(-2).join('.');
  }

  return hostname;
}
