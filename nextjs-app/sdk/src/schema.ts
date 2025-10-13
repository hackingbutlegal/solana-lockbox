/**
 * Schema validation and versioning for password entries
 *
 * CRITICAL: This module ensures backward compatibility when evolving the schema.
 * Never remove or rename fields without adding migration logic.
 *
 * Version History:
 * - v1: Initial versioned schema with checksums
 * - v2: Added compression support for large entries
 *
 * Note on Deduplication:
 * This module does NOT implement storage-level deduplication because:
 * 1. Password entries are unique by nature (different credentials per user)
 * 2. Comparing encrypted content would violate zero-knowledge principles
 * 3. Compression already provides significant storage savings
 * 4. Duplicate detection should happen at UI level before encryption
 */

import { z } from 'zod';
import { PasswordEntryType } from './types-v2';
import crypto from 'crypto';
import pako from 'pako';

// Import enhanced validation schemas from lib
// These provide comprehensive validation rules for all fields
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
  tagsSchema,
  categorySchema,
} from '../../lib/validation-schemas';

/**
 * Current schema version
 * Increment this when making breaking changes to PasswordEntry
 */
export const CURRENT_SCHEMA_VERSION = 2;

/**
 * Compression threshold in bytes
 * Entries larger than this will be automatically compressed
 */
export const COMPRESSION_THRESHOLD = 500; // 500 bytes

/**
 * Zod schema for PasswordEntry validation
 * This ensures runtime type safety for decrypted data
 *
 * Uses enhanced validation schemas from lib/validation-schemas.ts
 * which provide comprehensive validation rules for all fields:
 * - Title: trimming, length limits, control character removal
 * - Email: RFC 5322 compliant, normalization to lowercase
 * - Phone: international format support, normalization
 * - URL: auto-normalization with https://, XSS protection
 * - Credit Card: Luhn algorithm validation
 * - Tags: deduplication, lowercase normalization
 */
export const PasswordEntrySchema = z.object({
  // Core fields (required)
  type: z.nativeEnum(PasswordEntryType),
  title: titleSchema, // Enhanced validation with trimming, length limits

  // Optional fields with enhanced validation
  id: z.number().optional(),
  username: usernameSchema.optional(),
  password: passwordSchema.optional(),
  url: urlSchema.optional(), // Auto-normalizes URLs, adds https://
  notes: notesSchema.optional(),
  category: categorySchema.optional(),
  tags: tagsSchema.optional(), // Deduplicates, normalizes to lowercase
  favorite: z.boolean().optional(),
  archived: z.boolean().optional(),
  createdAt: z.date().optional(),
  lastModified: z.date().optional(),
  accessCount: z.number().optional(),

  // Type-specific fields (Credit Card) with enhanced validation
  cardNumber: creditCardSchema.optional(), // Luhn algorithm validation
  cardExpiry: expirationDateSchema.optional(), // MM/YY or MM/YYYY format
  cardCvv: cvvSchema.optional(), // 3-4 digit validation
  cardHolder: z.string().max(100).optional(),

  // Identity fields with enhanced validation
  fullName: z.string().max(200).optional(),
  email: emailSchema.optional(), // RFC 5322 compliant, lowercase normalization
  phone: phoneSchema.optional(), // International format support
  address: z.string().max(500).optional(),

  // API/SSH key fields
  apiKey: z.string().max(1000).optional(),
  apiSecret: z.string().max(1000).optional(),
  sshPublicKey: z.string().max(10000).optional(),
  sshPrivateKey: z.string().max(10000).optional(),

  // Crypto wallet fields
  walletAddress: z.string().max(200).optional(),
  privateKey: z.string().max(1000).optional(),
  seedPhrase: z.string().max(500).optional(),
});

export type ValidatedPasswordEntry = z.infer<typeof PasswordEntrySchema>;

/**
 * Serialized entry format with versioning and integrity checking
 */
export interface SerializedEntry {
  version: number;
  data: any;
  checksum: string;
  compressed?: boolean; // v2: indicates if data is compressed
}

/**
 * Calculate SHA-256 checksum of data
 */
export function calculateChecksum(data: any): string {
  const json = JSON.stringify(data);
  return crypto.createHash('sha256').update(json, 'utf8').digest('hex');
}

/**
 * Compress data using gzip if it exceeds threshold
 *
 * @param data - String data to compress
 * @returns Compressed data or original if below threshold
 */
function compressIfNeeded(data: string): { data: string; compressed: boolean } {
  const size = new TextEncoder().encode(data).length;

  if (size < COMPRESSION_THRESHOLD) {
    return { data, compressed: false };
  }

  try {
    // Compress using gzip (deflate)
    const compressed = pako.deflate(data, { level: 6 });
    const base64 = Buffer.from(compressed).toString('base64');

    // Only use compression if it actually saves space
    if (base64.length < data.length) {
      console.log(`Compression: ${size} bytes → ${base64.length} bytes (${Math.round((1 - base64.length / size) * 100)}% savings)`);
      return { data: base64, compressed: true };
    }

    return { data, compressed: false };
  } catch (error) {
    console.error('Compression failed, using uncompressed:', error);
    return { data, compressed: false };
  }
}

/**
 * Decompress data if it was compressed
 *
 * @param data - Potentially compressed data
 * @param compressed - Whether data is compressed
 * @returns Decompressed data
 */
function decompressIfNeeded(data: string, compressed: boolean): string {
  if (!compressed) {
    return data;
  }

  try {
    const buffer = Buffer.from(data, 'base64');
    const decompressed = pako.inflate(buffer, { to: 'string' });
    return decompressed;
  } catch (error) {
    console.error('Decompression failed:', error);
    throw new DataCorruptionError('Failed to decompress data');
  }
}

/**
 * Serialize a password entry with version, checksum, and optional compression
 *
 * @param entry - Password entry to serialize
 * @returns Versioned, checksummed, optionally compressed JSON string
 */
export function serializeEntry(entry: ValidatedPasswordEntry): string {
  // Convert Dates to ISO strings for JSON serialization
  const serializable = {
    ...entry,
    createdAt: entry.createdAt?.toISOString(),
    lastModified: entry.lastModified?.toISOString(),
  };

  // Serialize to JSON first
  const json = JSON.stringify(serializable);

  // Compress if beneficial
  const { data, compressed } = compressIfNeeded(json);

  const serialized: SerializedEntry = {
    version: CURRENT_SCHEMA_VERSION,
    data: compressed ? data : serializable, // Store as string if compressed, object if not
    checksum: calculateChecksum(serializable), // Always checksum uncompressed data
    compressed,
  };

  return JSON.stringify(serialized);
}

/**
 * Deserialize and validate a password entry
 *
 * Handles:
 * - Decompression (v2+)
 * - Version checking and migration
 * - Checksum verification
 * - Schema validation
 *
 * @param json - Serialized entry JSON
 * @returns Validated password entry
 * @throws Error if validation fails
 */
export function deserializeEntry(json: string): ValidatedPasswordEntry {
  const parsed = JSON.parse(json);

  // Handle legacy entries without versioning (created before this fix)
  if (!parsed.version) {
    console.warn('Legacy entry detected (no version), attempting to validate as-is');
    return validateAndMigrateEntry(0, parsed);
  }

  const serialized = parsed as SerializedEntry;

  // Decompress if needed (v2+)
  let data = serialized.data;
  if (serialized.compressed && serialized.version >= 2) {
    const decompressed = decompressIfNeeded(data, true);
    data = JSON.parse(decompressed);
  }

  // Verify checksum for data integrity
  const calculatedChecksum = calculateChecksum(data);
  if (calculatedChecksum !== serialized.checksum) {
    throw new DataCorruptionError('Data corruption detected: checksum mismatch');
  }

  // Validate version and migrate if needed
  if (serialized.version !== CURRENT_SCHEMA_VERSION) {
    return validateAndMigrateEntry(serialized.version, data);
  }

  // Parse dates back from ISO strings
  const entry = {
    ...data,
    createdAt: data.createdAt ? new Date(data.createdAt) : undefined,
    lastModified: data.lastModified ? new Date(data.lastModified) : undefined,
  };

  // Validate schema
  return PasswordEntrySchema.parse(entry);
}

/**
 * Migrate entry from old version to current version
 *
 * Add migration logic here when incrementing CURRENT_SCHEMA_VERSION
 *
 * @param version - Source version
 * @param data - Entry data in old format
 * @returns Validated entry in current format
 */
function validateAndMigrateEntry(version: number, data: any): ValidatedPasswordEntry {
  let migratedData = data;

  // Migration from version 0 (legacy, no versioning) to version 1
  if (version === 0) {
    console.log('Migrating legacy entry to version 1');
    // Legacy entries are already in v1 format, just parse dates
    migratedData = {
      ...data,
      createdAt: data.createdAt ? new Date(data.createdAt) : undefined,
      lastModified: data.lastModified ? new Date(data.lastModified) : undefined,
    };
  }

  // Migration from version 1 to version 2 (added compression support)
  if (version === 1) {
    console.log('Migrating entry from v1 to v2 (compression support added)');
    // v1 to v2 is transparent - no data structure changes
    // Just need to parse dates
    migratedData = {
      ...data,
      createdAt: data.createdAt ? new Date(data.createdAt) : undefined,
      lastModified: data.lastModified ? new Date(data.lastModified) : undefined,
    };
  }

  // Future migrations would go here:
  // if (version === 2) { ... migrate to v3 ... }

  // Validate final result
  return PasswordEntrySchema.parse(migratedData);
}

/**
 * Error types for better error handling
 */
export class DataCorruptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DataCorruptionError';
  }
}

export class SchemaValidationError extends Error {
  constructor(message: string, public zodError?: z.ZodError) {
    super(message);
    this.name = 'SchemaValidationError';
  }
}

export class UnsupportedVersionError extends Error {
  constructor(version: number) {
    super(`Unsupported schema version: ${version}. Please update your client.`);
    this.name = 'UnsupportedVersionError';
  }
}

/**
 * Generate a similarity fingerprint for duplicate detection (client-side only)
 *
 * This creates a hash based on key identifying fields (title, username, url)
 * to detect potential duplicates BEFORE encryption.
 *
 * NOTE: This is not for storage deduplication, but for warning users about
 * potentially duplicate entries during creation.
 *
 * @param entry - Password entry to fingerprint
 * @returns SHA-256 hash of normalized identifying fields
 */
export function generateSimilarityFingerprint(entry: ValidatedPasswordEntry): string {
  // Normalize and combine identifying fields
  const identifiers = [
    entry.title.toLowerCase().trim(),
    entry.username?.toLowerCase().trim() || '',
    entry.url?.toLowerCase().trim() || '',
    entry.type.toString(),
  ].join('|');

  return crypto.createHash('sha256').update(identifiers, 'utf8').digest('hex');
}

/**
 * Check if two entries are likely duplicates based on their fingerprints
 *
 * This is a client-side utility for detecting potential duplicates
 * before storing entries.
 *
 * @param entry1 - First entry
 * @param entry2 - Second entry
 * @returns true if entries have matching fingerprints
 */
export function areLikelyDuplicates(
  entry1: ValidatedPasswordEntry,
  entry2: ValidatedPasswordEntry
): boolean {
  return generateSimilarityFingerprint(entry1) === generateSimilarityFingerprint(entry2);
}
