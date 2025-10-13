/**
 * Input Sanitization - Now using Zod-based validation
 *
 * MIGRATION COMPLETE: This file now re-exports from input-sanitization-v2.ts
 * which uses Zod schemas for better validation.
 *
 * All functions maintain backwards compatibility - same API, better validation.
 */

// Re-export everything from v2
export * from './input-sanitization-v2';
