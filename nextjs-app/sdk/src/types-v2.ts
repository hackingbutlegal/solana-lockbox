/**
 * Type definitions for Lockbox v2.0 Password Manager
 */

import { PublicKey } from '@solana/web3.js';

/**
 * Subscription tiers for storage capacity
 */
export enum SubscriptionTier {
  Free = 0,
  Basic = 1,
  Premium = 2,
  Enterprise = 3,
}

/**
 * Password entry types
 */
export enum PasswordEntryType {
  Login = 0,
  CreditCard = 1,
  SecureNote = 2,
  Identity = 3,
  ApiKey = 4,
  SshKey = 5,
  CryptoWallet = 6,
}

/**
 * Storage types for chunks
 */
export enum StorageType {
  Passwords = 0,
  SharedItems = 1,
  SearchIndex = 2,
  AuditLogs = 3,
}

/**
 * Storage chunk metadata
 */
export interface StorageChunkInfo {
  chunkAddress: PublicKey;
  chunkIndex: number;
  maxCapacity: number;
  sizeUsed: number;
  dataType: StorageType;
  createdAt: number;
  lastModified: number;
}

/**
 * Password entry metadata header
 */
export interface DataEntryHeader {
  entryId: number;
  offset: number;
  size: number;
  entryType: PasswordEntryType;
  category: number;
  titleHash: number[];
  createdAt: number;
  lastModified: number;
  accessCount: number;
  flags: number;
}

/**
 * Master lockbox account structure
 */
export interface MasterLockbox {
  owner: PublicKey;
  totalEntries: number;
  storageChunksCount: number;
  subscriptionTier: SubscriptionTier;
  lastAccessed: number;
  subscriptionExpires: number;
  totalCapacity: number;
  storageUsed: number;
  storageChunks: StorageChunkInfo[];
  encryptedIndex: Uint8Array;
  nextEntryId: number;
  categoriesCount: number;
  createdAt: number;
  bump: number;
}

/**
 * Storage chunk account structure
 */
export interface StorageChunk {
  masterLockbox: PublicKey;
  owner: PublicKey;
  chunkIndex: number;
  maxCapacity: number;
  currentSize: number;
  dataType: StorageType;
  encryptedData: Uint8Array;
  entryHeaders: DataEntryHeader[];
  entryCount: number;
  createdAt: number;
  lastModified: number;
  bump: number;
}

/**
 * Base fields common to all password entries
 */
export interface BasePasswordEntry {
  id?: number;
  type: PasswordEntryType;
  title: string;
  notes?: string;
  category?: number;
  tags?: string[];
  favorite?: boolean;
  archived?: boolean;
  createdAt?: Date;
  lastModified?: Date;
  accessCount?: number;
}

/**
 * Login/Website password entry
 */
export interface LoginEntry extends BasePasswordEntry {
  type: PasswordEntryType.Login;
  username: string;
  password: string;
  url?: string;
  totpSecret?: string; // For 2FA
}

/**
 * Credit card entry
 */
export interface CreditCardEntry extends BasePasswordEntry {
  type: PasswordEntryType.CreditCard;
  cardNumber: string;
  cardHolder: string;
  cardExpiry: string; // MM/YY format
  cardCvv: string;
  billingAddress?: string;
  zipCode?: string;
}

/**
 * Secure note entry
 */
export interface SecureNoteEntry extends BasePasswordEntry {
  type: PasswordEntryType.SecureNote;
  content: string;
}

/**
 * Identity entry (personal information)
 */
export interface IdentityEntry extends BasePasswordEntry {
  type: PasswordEntryType.Identity;
  fullName: string;
  email?: string;
  phone?: string;
  address?: string;
  dateOfBirth?: string;
  ssn?: string; // Encrypted, obviously
  passportNumber?: string;
  driversLicense?: string;
}

/**
 * API key entry
 */
export interface ApiKeyEntry extends BasePasswordEntry {
  type: PasswordEntryType.ApiKey;
  apiKey: string;
  apiSecret?: string;
  apiEndpoint?: string;
  documentation?: string;
}

/**
 * SSH key entry
 */
export interface SshKeyEntry extends BasePasswordEntry {
  type: PasswordEntryType.SshKey;
  username: string;
  hostname: string;
  port?: number;
  sshPublicKey?: string;
  sshPrivateKey: string;
  passphrase?: string;
}

/**
 * Cryptocurrency wallet entry
 */
export interface CryptoWalletEntry extends BasePasswordEntry {
  type: PasswordEntryType.CryptoWallet;
  walletName: string;
  walletAddress: string;
  privateKey?: string;
  seedPhrase?: string;
  network?: string; // e.g., "Ethereum", "Bitcoin", "Solana"
}

/**
 * Discriminated union of all password entry types
 */
export type PasswordEntry =
  | LoginEntry
  | CreditCardEntry
  | SecureNoteEntry
  | IdentityEntry
  | ApiKeyEntry
  | SshKeyEntry
  | CryptoWalletEntry;

/**
 * Type guard functions for runtime type checking
 */
export function isLoginEntry(entry: PasswordEntry): entry is LoginEntry {
  return entry.type === PasswordEntryType.Login;
}

export function isCreditCardEntry(entry: PasswordEntry): entry is CreditCardEntry {
  return entry.type === PasswordEntryType.CreditCard;
}

export function isSecureNoteEntry(entry: PasswordEntry): entry is SecureNoteEntry {
  return entry.type === PasswordEntryType.SecureNote;
}

export function isIdentityEntry(entry: PasswordEntry): entry is IdentityEntry {
  return entry.type === PasswordEntryType.Identity;
}

export function isApiKeyEntry(entry: PasswordEntry): entry is ApiKeyEntry {
  return entry.type === PasswordEntryType.ApiKey;
}

export function isSshKeyEntry(entry: PasswordEntry): entry is SshKeyEntry {
  return entry.type === PasswordEntryType.SshKey;
}

export function isCryptoWalletEntry(entry: PasswordEntry): entry is CryptoWalletEntry {
  return entry.type === PasswordEntryType.CryptoWallet;
}

/**
 * Category for organizing passwords
 */
export interface PasswordCategory {
  id: number;
  name: string;
  icon?: string;
  color?: string;
}

/**
 * Search result
 */
export interface SearchResult {
  entry: PasswordEntry;
  chunkIndex: number;
  score: number;
}

/**
 * Subscription tier information
 */
export interface TierInfo {
  tier: SubscriptionTier;
  name: string;
  maxCapacity: number; // in bytes
  monthlyCost: number; // in lamports
  maxEntries: number; // approximate
  features: string[];
}

export const TIER_INFO: Record<SubscriptionTier, TierInfo> = {
  [SubscriptionTier.Free]: {
    tier: SubscriptionTier.Free,
    name: 'Free',
    maxCapacity: 1024, // 1KB
    monthlyCost: 0,
    maxEntries: 10,
    features: ['1KB storage', '~10 passwords', 'Basic encryption'],
  },
  [SubscriptionTier.Basic]: {
    tier: SubscriptionTier.Basic,
    name: 'Basic',
    maxCapacity: 10240, // 10KB
    monthlyCost: 1_000_000, // 0.001 SOL
    maxEntries: 100,
    features: ['10KB storage', '~100 passwords', 'Categories', 'Search'],
  },
  [SubscriptionTier.Premium]: {
    tier: SubscriptionTier.Premium,
    name: 'Premium',
    maxCapacity: 102400, // 100KB
    monthlyCost: 10_000_000, // 0.01 SOL
    maxEntries: 1000,
    features: ['100KB storage', '~1,000 passwords', 'Secure sharing', 'Audit logs', '2FA support'],
  },
  [SubscriptionTier.Enterprise]: {
    tier: SubscriptionTier.Enterprise,
    name: 'Enterprise',
    maxCapacity: 1048576, // 1MB
    monthlyCost: 100_000_000, // 0.1 SOL
    maxEntries: 10000,
    features: ['1MB+ storage', 'Unlimited passwords', 'Team management', 'API access', 'Custom branding'],
  },
};

/**
 * Password health analysis
 */
export interface PasswordHealth {
  weak: number;
  reused: number;
  old: number;
  compromised: number;
  score: number; // 0-100
}

/**
 * V2 Client options
 */
export interface LockboxV2ClientOptions {
  connection: any; // Connection
  wallet: any; // Wallet adapter
  programId?: PublicKey;
  feeReceiver?: PublicKey;
}

/**
 * Error codes for v2
 */
export enum LockboxV2Error {
  MaxChunksReached = 6007,
  ChunkNotFound = 6008,
  MaxEntriesPerChunk = 6009,
  InsufficientChunkCapacity = 6010,
  EntryNotFound = 6011,
  InvalidEntryOffset = 6012,
  InvalidTierUpgrade = 6013,
  SubscriptionExpired = 6014,
  InsufficientStorageCapacity = 6015,
  IncorrectPaymentAmount = 6016,
  Unauthorized = 6004,
  InvalidDataSize = 6017,
  CooldownNotElapsed = 6005,
  InvalidChunkIndex = 6018,
  CannotDowngrade = 6019,
  InvalidEntryType = 6020,
  SearchIndexFull = 6021,
  CategoryLimitReached = 6022,
  InvalidCategory = 6023,
  ChunkAlreadyExists = 6024,
  NotInitialized = 6025,
  DataCorruption = 6026,
}
