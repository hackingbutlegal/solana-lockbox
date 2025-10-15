/**
 * Lockbox SDK Constants
 *
 * Centralized constants for the Lockbox password manager.
 * These values must remain consistent across versions for backward compatibility.
 *
 * @packageDocumentation
 */

import { PublicKey } from '@solana/web3.js';

// ============================================================================
// Program IDs
// ============================================================================

/** V2 Program ID (current) - Multi-tier password manager */
export const PROGRAM_ID_V2 = new PublicKey('7JxsHjdReydiz36jwsWuvwwR28qqK6V454VwFJnnSkoB');

/** V1 Program ID (legacy) - Simple 1KB lockbox */
export const PROGRAM_ID_V1 = new PublicKey('5nr7xe1U3k6U6zPEmW3FCbPyXCa7jr7JpudaLKuVNyvZ');

/** Default program ID (v2) */
export const PROGRAM_ID = PROGRAM_ID_V2;

// ============================================================================
// Encryption Constants
// ============================================================================

/** AEAD encryption constants for XChaCha20-Poly1305 */
export const AEAD = {
  /** Minimum AEAD ciphertext size: 24-byte nonce + 16-byte auth tag */
  MIN_SIZE: 40,
  /** XChaCha20 nonce size in bytes */
  NONCE_SIZE: 24,
  /** Poly1305 authentication tag size in bytes */
  TAG_SIZE: 16,
} as const;

/** Maximum encrypted payload size (v1 legacy) */
export const MAX_ENCRYPTED_SIZE = 1024; // 1 KiB

// ============================================================================
// Session Management
// ============================================================================

/** Standard message for wallet signature (DO NOT CHANGE - breaks decryption) */
export const SIGNATURE_MESSAGE = 'Sign to access your Lockbox Password Manager';

/** Session timeout duration in milliseconds */
export const SESSION_TIMEOUT = 15 * 60 * 1000; // 15 minutes

/** Inactivity timeout in milliseconds */
export const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutes

// ============================================================================
// Rate Limiting (V1 Legacy)
// ============================================================================

/** Cooldown period between operations in slots (v1) */
export const COOLDOWN_SLOTS = 10; // ~4 seconds at 400ms/slot

/** Fee per storage operation in lamports (v1) */
export const FEE_LAMPORTS = 1_000_000; // 0.001 SOL

// ============================================================================
// Subscription Tiers (V2)
// ============================================================================

/** Subscription tier storage capacities */
export const SUBSCRIPTION_CAPACITY = {
  FREE: 1024, // 1 KB
  BASIC: 10240, // 10 KB
  PREMIUM: 102400, // 100 KB
  ENTERPRISE: 1048576, // 1 MB
} as const;

/** Subscription tier pricing (SOL per month) */
export const SUBSCRIPTION_PRICING = {
  FREE: 0,
  BASIC: 0.001, // 0.001 SOL/month
  PREMIUM: 0.01, // 0.01 SOL/month
  ENTERPRISE: 0.1, // 0.1 SOL/month
} as const;

/** Maximum chunks per subscription tier */
export const MAX_CHUNKS = {
  FREE: 1,
  BASIC: 2,
  PREMIUM: 10,
  ENTERPRISE: 100,
} as const;

/** Maximum entries per chunk by tier */
export const MAX_ENTRIES_PER_CHUNK = {
  FREE: 10,
  BASIC: 100,
  PREMIUM: 1000,
  ENTERPRISE: 10000,
} as const;

// ============================================================================
// Storage Limits
// ============================================================================

/** Maximum number of storage chunks per vault */
export const MAX_STORAGE_CHUNKS = 100;

/** Maximum number of categories per user */
export const MAX_CATEGORIES = 255;

/** Maximum encrypted category name length */
export const MAX_CATEGORY_NAME_LENGTH = 64;

/** Default chunk size for new allocations */
export const DEFAULT_CHUNK_SIZE = 1024; // 1 KB

/** Maximum chunk expansion per realloc call */
export const MAX_REALLOC_SIZE = 10240; // 10 KB

// ============================================================================
// Account Space Calculations
// ============================================================================

/** MasterLockbox base space (without storage_chunks array) */
export const MASTER_LOCKBOX_BASE_SPACE = 106;

/** Size of a single StorageChunkInfo entry in MasterLockbox */
export const STORAGE_CHUNK_INFO_SIZE = 59;

/** StorageChunk base space (without entries array) */
export const STORAGE_CHUNK_BASE_SPACE = 85;

/** Calculate space for MasterLockbox with N chunks */
export function calculateMasterLockboxSpace(numChunks: number): number {
  return MASTER_LOCKBOX_BASE_SPACE + numChunks * STORAGE_CHUNK_INFO_SIZE;
}

/** Calculate space for StorageChunk with capacity */
export function calculateStorageChunkSpace(capacity: number): number {
  return STORAGE_CHUNK_BASE_SPACE + capacity;
}

// ============================================================================
// PDA Seeds
// ============================================================================

/** Seed for master lockbox PDA derivation */
export const MASTER_LOCKBOX_SEED = 'master_lockbox';

/** Seed for storage chunk PDA derivation */
export const STORAGE_CHUNK_SEED = 'storage_chunk';

/** Seed for category registry PDA derivation */
export const CATEGORY_REGISTRY_SEED = 'category_registry';

// ============================================================================
// Instruction Discriminators (V2)
// ============================================================================

/**
 * Anchor instruction discriminators (first 8 bytes of SHA256("global:<instruction_name>"))
 *
 * WARNING: These values MUST match the deployed program exactly.
 * Incorrect discriminators will cause InstructionFallbackNotFound (0x65) errors.
 */
export const INSTRUCTION_DISCRIMINATORS = {
  initializeMasterLockbox: Buffer.from([0x21, 0xa5, 0x13, 0x5b, 0xd6, 0x53, 0x44, 0x2d]),
  initializeStorageChunk: Buffer.from([0x8e, 0xd6, 0xee, 0x3c, 0x93, 0xee, 0xaa, 0x22]),
  storePasswordEntry: Buffer.from([0x2d, 0x64, 0x17, 0x8d, 0xf4, 0xd7, 0x8a, 0xa0]),
  retrievePasswordEntry: Buffer.from([0x8c, 0xd0, 0x4f, 0x9b, 0xa7, 0x0b, 0x73, 0xbc]),
  updatePasswordEntry: Buffer.from([0x1d, 0x96, 0x9e, 0x9b, 0x6f, 0x88, 0x16, 0x2a]),
  deletePasswordEntry: Buffer.from([0xf5, 0x59, 0xe8, 0xae, 0x78, 0xb3, 0x40, 0x06]),
  upgradeSubscription: Buffer.from([0x55, 0xef, 0x7d, 0xeb, 0xc7, 0xe6, 0xa6, 0xf6]),
  renewSubscription: Buffer.from([0x2d, 0x4b, 0x9a, 0xc2, 0xa0, 0x0a, 0x6f, 0xb7]),
  downgradeSubscription: Buffer.from([0x39, 0x12, 0x7b, 0x76, 0xcb, 0x07, 0xc1, 0x25]),
  expandChunk: Buffer.from([0x8a, 0xf4, 0x12, 0x7b, 0xcd, 0x19, 0xe2, 0x3f]),
  initializeCategoryRegistry: Buffer.from([0x6c, 0x23, 0x8d, 0x45, 0xbc, 0x67, 0xf8, 0x91]),
  createCategory: Buffer.from([0x7e, 0x91, 0x23, 0xab, 0x5d, 0x78, 0xc4, 0x2f]),
  updateCategory: Buffer.from([0x9a, 0x45, 0x67, 0xcd, 0x12, 0x89, 0xef, 0x3b]),
  deleteCategory: Buffer.from([0x2f, 0xbc, 0x89, 0x12, 0x45, 0xde, 0x67, 0x8a]),
  closeMasterLockbox: Buffer.from([0xa1, 0x56, 0xde, 0x23, 0x8c, 0x91, 0x47, 0xbf]),
  closeStorageChunk: Buffer.from([0x79, 0xb6, 0xfd, 0x51, 0x67, 0xd2, 0x2e, 0xe9]),
  forceCloseOrphanedChunk: Buffer.from([0xc3, 0x78, 0x91, 0x24, 0x56, 0xaf, 0xd1, 0x2e]),
} as const;

// ============================================================================
// Error Codes
// ============================================================================

/** Common Anchor error codes */
export const ERROR_CODES = {
  INSTRUCTION_FALLBACK_NOT_FOUND: 0x65, // 101
  ACCOUNT_DID_NOT_DESERIALIZE: 0xbbb, // 3003
  ACCOUNT_DID_NOT_SERIALIZE: 0xbbc, // 3004
  INSTRUCTION_DID_NOT_DESERIALIZE: 0xbbd, // 3005
  CONSTRAINT_VIOLATION: 0x7d0, // 2000
} as const;

// ============================================================================
// Retry Configuration
// ============================================================================

/** Maximum retry attempts for RPC calls */
export const MAX_RETRIES = 3;

/** Base backoff delay in milliseconds */
export const RETRY_BACKOFF_MS = 1000;

/** Whether to skip preflight checks in transactions */
export const SKIP_PREFLIGHT = false;

/** Preflight commitment level */
export const PREFLIGHT_COMMITMENT = 'confirmed' as const;

// ============================================================================
// Transaction Configuration
// ============================================================================

/** Default transaction confirmation commitment level */
export const DEFAULT_COMMITMENT = 'confirmed' as const;

/** Transaction timeout in milliseconds */
export const TRANSACTION_TIMEOUT = 60000; // 60 seconds

/** Blockhash cache time in milliseconds */
export const BLOCKHASH_CACHE_TIME = 30000; // 30 seconds
