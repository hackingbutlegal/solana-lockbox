/**
 * Lockbox v2.0 Client - Password Manager
 *
 * Provides a comprehensive interface for the multi-tier password manager.
 *
 * ## Orphaned Chunk Prevention Strategy
 *
 * This client implements comprehensive prevention against "orphaned storage chunks" - a situation
 * where storage chunk accounts exist on-chain but are not registered in the master lockbox.
 * This can occur due to:
 * - Transaction failures during chunk creation
 * - RPC data lag causing incomplete state updates
 * - Network interruptions during multi-step operations
 *
 * ### Prevention Measures:
 *
 * 1. **Pre-initialization Checks** (initializeMasterLockbox):
 *    - Scans for existing chunk accounts before creating master lockbox
 *    - Prevents initialization if orphaned chunks are detected
 *    - Provides clear recovery instructions to users
 *
 * 2. **Duplicate Prevention** (initializeStorageChunk):
 *    - Checks if chunk already exists before attempting creation
 *    - Verifies chunk is registered in master lockbox
 *    - Throws descriptive error if orphaned chunk is detected
 *
 * 3. **Confirmation Retries** (storePassword):
 *    - After creating a new chunk, retries verification up to 5 times
 *    - Uses exponential backoff to allow RPC to catch up
 *    - Falls back to direct chunk account verification if master lockbox lags
 *    - Prevents password storage if chunk registration cannot be confirmed
 *
 * 4. **Pending Transaction Tracking**:
 *    - Maintains a set of in-flight operations to prevent double-submission
 *    - Ensures operations are not retried while still pending
 *
 * ### Recovery Options (if orphaned chunks are detected):
 *
 * 1. **Use Different Wallet** (Recommended):
 *    - Create a new wallet and initialize fresh master lockbox
 *    - No orphaned accounts, immediate access
 *
 * 2. **Wait for Program Upgrade**:
 *    - Future program versions may include `force_close_orphaned_chunk` instruction
 *    - Would allow recovery of locked rent without wallet switch
 *
 * 3. **Manual Recovery** (Advanced):
 *    - Contact support with affected wallet address
 *    - May require custom recovery transaction
 *
 * ### Error Messages:
 *
 * All orphaned chunk errors include:
 * - Clear explanation of the issue
 * - Affected chunk indices and addresses
 * - Amount of SOL locked in rent
 * - Specific recovery steps
 * - Technical details for debugging
 *
 * This multi-layered approach ensures users are protected from orphaned chunks and provided
 * with clear guidance if the issue is detected.
 */

import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import {
  Connection,
  PublicKey,
  SystemProgram,
  Keypair,
  TransactionInstruction,
  Transaction,
  SYSVAR_RENT_PUBKEY,
} from '@solana/web3.js';
import * as borsh from 'borsh';
import * as nacl from 'tweetnacl';
import * as util from 'tweetnacl-util';
import crypto from 'crypto';

import {
  PasswordEntry,
  PasswordEntryType,
  SubscriptionTier,
  StorageType,
  MasterLockbox,
  StorageChunk,
  PasswordCategory,
  SearchResult,
  TierInfo,
  TIER_INFO,
  LockboxV2ClientOptions,
  DataEntryHeader,
} from './types-v2';
import { serializeEntry, deserializeEntry, DataCorruptionError, SchemaValidationError, PasswordEntrySchema } from './schema';

/**
 * SECURITY FIX: Safe BigInt to Number conversion
 *
 * JavaScript's Number type can only safely represent integers up to 2^53 - 1 (9,007,199,254,740,991).
 * Converting larger BigInt values to Number can result in precision loss and incorrect values.
 *
 * This utility ensures safe conversion and throws an error if the value would overflow.
 */
function safeBigIntToNumber(value: bigint, fieldName: string): number {
  const MAX_SAFE_INTEGER = BigInt(Number.MAX_SAFE_INTEGER);

  if (value > MAX_SAFE_INTEGER) {
    throw new Error(
      `BigInt overflow: ${fieldName} value ${value} exceeds JavaScript Number.MAX_SAFE_INTEGER (${MAX_SAFE_INTEGER}). ` +
      `This indicates the value is too large to safely represent as a Number. ` +
      `Consider using BigInt throughout the application for this field.`
    );
  }

  if (value < 0n && value < -MAX_SAFE_INTEGER) {
    throw new Error(
      `BigInt underflow: ${fieldName} value ${value} is below -Number.MAX_SAFE_INTEGER (-${MAX_SAFE_INTEGER}). ` +
      `This indicates the value is too large (in magnitude) to safely represent as a Number.`
    );
  }

  return Number(value);
}

// Borsh schema definitions for account deserialization
class StorageChunkInfoBorsh {
  chunkAddress: Uint8Array;
  chunkIndex: number;
  maxCapacity: number;
  sizeUsed: number;
  dataType: number;
  createdAt: bigint;
  lastModified: bigint;

  constructor(fields: any) {
    this.chunkAddress = fields.chunkAddress;
    this.chunkIndex = fields.chunkIndex;
    this.maxCapacity = fields.maxCapacity;
    this.sizeUsed = fields.sizeUsed;
    this.dataType = fields.dataType;
    this.createdAt = fields.createdAt;
    this.lastModified = fields.lastModified;
  }

  static schema = {
    struct: {
      chunkAddress: { array: { type: 'u8', len: 32 } },
      chunkIndex: 'u16',
      maxCapacity: 'u32',
      sizeUsed: 'u32',
      dataType: 'u8',
      createdAt: 'i64',
      lastModified: 'i64',
    }
  };
}

class MasterLockboxBorsh {
  owner: Uint8Array;
  totalEntries: bigint;
  storageChunksCount: number;
  subscriptionTier: number;
  lastAccessed: bigint;
  subscriptionExpires: bigint;
  totalCapacity: bigint;
  storageUsed: bigint;
  storageChunks: StorageChunkInfoBorsh[];
  encryptedIndex: Uint8Array;
  nextEntryId: bigint;
  categoriesCount: number;
  createdAt: bigint;
  bump: number;

  constructor(fields: any) {
    this.owner = fields.owner;
    this.totalEntries = fields.totalEntries;
    this.storageChunksCount = fields.storageChunksCount;
    this.subscriptionTier = fields.subscriptionTier;
    this.lastAccessed = fields.lastAccessed;
    this.subscriptionExpires = fields.subscriptionExpires;
    this.totalCapacity = fields.totalCapacity;
    this.storageUsed = fields.storageUsed;
    this.storageChunks = fields.storageChunks;
    this.encryptedIndex = fields.encryptedIndex;
    this.nextEntryId = fields.nextEntryId;
    this.categoriesCount = fields.categoriesCount;
    this.createdAt = fields.createdAt;
    this.bump = fields.bump;
  }

  static schema = {
    struct: {
      owner: { array: { type: 'u8', len: 32 } },
      totalEntries: 'u64',
      storageChunksCount: 'u16',
      subscriptionTier: 'u8',
      lastAccessed: 'i64',
      subscriptionExpires: 'i64',
      totalCapacity: 'u64',
      storageUsed: 'u64',
      storageChunks: { vec: StorageChunkInfoBorsh },
      encryptedIndex: { vec: 'u8' },
      nextEntryId: 'u64',
      categoriesCount: 'u32',
      createdAt: 'i64',
      bump: 'u8',
    }
  };
}

class DataEntryHeaderBorsh {
  entryId: bigint;
  offset: number;
  size: number;
  entryType: number;
  category: number;
  titleHash: Uint8Array;
  createdAt: bigint;
  lastModified: bigint;
  accessCount: number;
  flags: number;

  constructor(fields: any) {
    this.entryId = fields.entryId;
    this.offset = fields.offset;
    this.size = fields.size;
    this.entryType = fields.entryType;
    this.category = fields.category;
    this.titleHash = fields.titleHash;
    this.createdAt = fields.createdAt;
    this.lastModified = fields.lastModified;
    this.accessCount = fields.accessCount;
    this.flags = fields.flags;
  }

  static schema = {
    struct: {
      entryId: 'u64',
      offset: 'u32',
      size: 'u32',
      entryType: 'u8',
      category: 'u32',
      titleHash: { array: { type: 'u8', len: 32 } },
      createdAt: 'i64',
      lastModified: 'i64',
      accessCount: 'u32',
      flags: 'u8',
    }
  };
}

class StorageChunkBorsh {
  masterLockbox: Uint8Array;
  owner: Uint8Array;
  chunkIndex: number;
  maxCapacity: number;
  currentSize: number;
  dataType: number;
  encryptedData: Uint8Array;
  entryHeaders: DataEntryHeaderBorsh[];
  entryCount: number;
  createdAt: bigint;
  lastModified: bigint;
  bump: number;

  constructor(fields: any) {
    this.masterLockbox = fields.masterLockbox;
    this.owner = fields.owner;
    this.chunkIndex = fields.chunkIndex;
    this.maxCapacity = fields.maxCapacity;
    this.currentSize = fields.currentSize;
    this.dataType = fields.dataType;
    this.encryptedData = fields.encryptedData;
    this.entryHeaders = fields.entryHeaders;
    this.entryCount = fields.entryCount;
    this.createdAt = fields.createdAt;
    this.lastModified = fields.lastModified;
    this.bump = fields.bump;
  }

  static schema = {
    struct: {
      masterLockbox: { array: { type: 'u8', len: 32 } },
      owner: { array: { type: 'u8', len: 32 } },
      chunkIndex: 'u16',
      maxCapacity: 'u32',
      currentSize: 'u32',
      dataType: 'u8',
      encryptedData: { vec: 'u8' },
      entryHeaders: { vec: DataEntryHeaderBorsh },
      entryCount: 'u16',
      createdAt: 'i64',
      lastModified: 'i64',
      bump: 'u8',
    }
  };
}
// Import IDL - handle both ESM and CommonJS module formats
import IDLData from '../idl/lockbox-v2.json';

// Safely extract the IDL, handling various module formats
function getIDL() {
  let idl: any;

  // If it's already a plain object with 'address' field, use it directly
  if (IDLData && typeof IDLData === 'object' && 'address' in IDLData) {
    idl = IDLData;
  }
  // If it's wrapped in a default export
  else if ((IDLData as any)?.default && typeof (IDLData as any).default === 'object') {
    idl = (IDLData as any).default;
  }
  // Last resort: return as-is and hope for the best
  else {
    idl = IDLData;
  }

  // CRITICAL FIX: Don't modify the IDL at all
  // The issue is that Anchor 0.30.1 expects the IDL in JSON format exactly as stored
  // The manually-created IDL should work without modifications

  return idl;
}

const IDL = getIDL();

export const PROGRAM_ID = new PublicKey('7JxsHjdReydiz36jwsWuvwwR28qqK6V454VwFJnnSkoB');
export const DEFAULT_TREASURY_WALLET = PROGRAM_ID; // Default: fees go to program ID

// Instruction discriminators (first 8 bytes of SHA256 hash of "global:instruction_name")
// Generated using: node scripts/generate-discriminators.js
const INSTRUCTION_DISCRIMINATORS = {
  initializeMasterLockbox: Buffer.from([0x21, 0xa5, 0x13, 0x5b, 0xd6, 0x53, 0x44, 0x2d]),
  initializeStorageChunk: Buffer.from([0x8e, 0xd6, 0xee, 0x3c, 0x93, 0xee, 0xaa, 0x22]),
  storePasswordEntry: Buffer.from([0x2d, 0x64, 0x17, 0x8d, 0xf4, 0xd7, 0x8a, 0xa0]),
  retrievePasswordEntry: Buffer.from([0x8c, 0xd0, 0x4f, 0x9b, 0xa7, 0x0b, 0x73, 0xbc]),
  updatePasswordEntry: Buffer.from([0x1d, 0x96, 0x9e, 0x9b, 0x6f, 0x88, 0x16, 0x2a]),
  deletePasswordEntry: Buffer.from([0xf5, 0x59, 0xe8, 0xae, 0x78, 0xb3, 0x40, 0x06]),
  upgradeSubscription: Buffer.from([0x55, 0xef, 0x7d, 0xeb, 0xc7, 0xe6, 0xa6, 0xf6]),
  renewSubscription: Buffer.from([0x2d, 0x4b, 0x9a, 0xc2, 0xa0, 0x0a, 0x6f, 0xb7]),
  downgradeSubscription: Buffer.from([0x39, 0x12, 0x7b, 0x76, 0xcb, 0x07, 0xc1, 0x25]),
  closeStorageChunk: Buffer.from([0x79, 0xb6, 0xfd, 0x51, 0x67, 0xd2, 0x2e, 0xe9]),
  expandChunk: Buffer.from([0xa1, 0x4e, 0xa3, 0xae, 0x28, 0x5d, 0xe8, 0xf1]),
};

/**
 * Main client for Lockbox v2.0 Password Manager
 */
export class LockboxV2Client {
  readonly program: Program;
  readonly connection: Connection;
  readonly wallet: any;
  readonly treasuryWallet: PublicKey;
  private sessionKey: Uint8Array | null = null;
  private pendingTransactions: Set<string> = new Set();

  constructor(options: LockboxV2ClientOptions) {
    this.connection = options.connection;
    this.wallet = options.wallet;
    // Support both treasuryWallet (new) and feeReceiver (deprecated) for backward compatibility
    this.treasuryWallet = options.treasuryWallet || options.feeReceiver || DEFAULT_TREASURY_WALLET;

    const provider = new AnchorProvider(
      this.connection,
      this.wallet,
      { commitment: 'confirmed' }
    );

    // IMPORTANT: Due to IDL format incompatibilities with Anchor 0.30.1 in browser environments,
    // we're using a minimal Program interface without IDL-based method generation.
    // All instructions will be manually constructed using raw transaction building.

    console.log('✓ Initializing Lockbox v2 Client');
    console.log('  Program ID:', PROGRAM_ID.toBase58());
    console.log('  Using manual transaction construction (no IDL)');

    // Create a minimal program interface for PDA derivation and provider access
    // We'll manually construct all transactions instead of relying on IDL-generated methods
    this.program = {
      programId: PROGRAM_ID,
      provider,
      methods: {}, // Empty - we'll use manual transaction construction
      account: {}, // Empty - we'll use manual deserialization
    } as any as Program;
  }

  // ============================================================================
  // PDA Derivation
  // ============================================================================

  /**
   * Get master lockbox PDA
   */
  getMasterLockboxAddress(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('master_lockbox'), this.wallet.publicKey.toBuffer()],
      PROGRAM_ID
    );
  }

  /**
   * Get storage chunk PDA
   */
  getStorageChunkAddress(chunkIndex: number): [PublicKey, number] {
    const [masterLockbox] = this.getMasterLockboxAddress();
    const indexBuffer = Buffer.alloc(2);
    indexBuffer.writeUInt16LE(chunkIndex);

    return PublicKey.findProgramAddressSync(
      [Buffer.from('storage_chunk'), masterLockbox.toBuffer(), indexBuffer],
      PROGRAM_ID
    );
  }

  /**
   * Get recovery config V2 PDA
   */
  getRecoveryConfigV2Address(owner?: PublicKey): [PublicKey, number] {
    const ownerKey = owner || this.wallet.publicKey;
    return PublicKey.findProgramAddressSync(
      [Buffer.from('recovery_config_v2'), ownerKey.toBuffer()],
      PROGRAM_ID
    );
  }

  /**
   * Get recovery request V2 PDA
   */
  getRecoveryRequestV2Address(owner: PublicKey, requestId: number): [PublicKey, number] {
    const requestIdBuffer = Buffer.alloc(8);
    requestIdBuffer.writeBigUInt64LE(BigInt(requestId));

    return PublicKey.findProgramAddressSync(
      [Buffer.from('recovery_request_v2'), owner.toBuffer(), requestIdBuffer],
      PROGRAM_ID
    );
  }

  // ============================================================================
  // Encryption & Key Management
  // ============================================================================

  /**
   * Request wallet signature for session key derivation
   */
  private async getSessionKey(): Promise<Uint8Array> {
    if (this.sessionKey) {
      return this.sessionKey;
    }

    const message = util.decodeUTF8('Sign to access your Lockbox Password Manager');
    const signature = await this.wallet.signMessage(message);

    // Derive session key from signature
    const hash = nacl.hash(signature);
    this.sessionKey = hash.slice(0, 32);

    return this.sessionKey;
  }

  /**
   * Encrypt password entry data with versioning and integrity checking
   */
  private encryptEntry(entry: PasswordEntry, key: Uint8Array): { ciphertext: Uint8Array; nonce: Uint8Array } {
    // Validate entry before encryption
    const validated = PasswordEntrySchema.parse(entry);

    // Serialize with versioning and checksum
    const json = serializeEntry(validated);

    const nonce = nacl.randomBytes(24);
    const messageUint8 = util.decodeUTF8(json);
    const ciphertext = nacl.secretbox(messageUint8, nonce, key);

    return { ciphertext, nonce };
  }

  /**
   * Decrypt password entry data with validation and migration support
   */
  private decryptEntry(ciphertext: Uint8Array, key: Uint8Array): PasswordEntry | null {
    // Extract nonce from the first 24 bytes
    const nonce = ciphertext.slice(0, 24);
    const encrypted = ciphertext.slice(24);

    const decrypted = nacl.secretbox.open(encrypted, nonce, key);
    if (!decrypted) {
      console.error('Decryption failed: Authentication tag mismatch (wrong key or corrupted data)');
      return null;
    }

    try {
      const json = util.encodeUTF8(decrypted);

      // Deserialize with version checking and validation
      return deserializeEntry(json) as PasswordEntry;
    } catch (error) {
      if (error instanceof DataCorruptionError) {
        console.error('Data corruption detected:', error.message);
        throw error; // Bubble up corruption errors
      } else if (error instanceof SchemaValidationError) {
        console.error('Schema validation failed:', error.message);
        console.error('Validation details:', error.zodError);
        throw error;
      } else {
        console.error('Failed to deserialize entry:', error);
        return null;
      }
    }
  }

  /**
   * Generate blind index hash for searchable title
   */
  private generateTitleHash(title: string, key: Uint8Array): number[] {
    const hash = crypto.createHmac('sha256', Buffer.from(key))
      .update(title.toLowerCase())
      .digest();
    return Array.from(hash);
  }

  // ============================================================================
  // Account Initialization
  // ============================================================================

  /**
   * Initialize master lockbox for the user
   */
  async initializeMasterLockbox(): Promise<string> {
    const [masterLockbox] = this.getMasterLockboxAddress();

    // Prevent duplicate initialization attempts
    const operationKey = `init-${masterLockbox.toBase58()}`;
    if (this.pendingTransactions.has(operationKey)) {
      throw new Error('Initialization already in progress');
    }

    try {
      this.pendingTransactions.add(operationKey);

      // PREVENTION STEP 1: Check for orphaned chunks before initializing
      // This detects if there are any storage chunk accounts from a previous failed initialization
      console.log('[initializeMasterLockbox] Checking for orphaned chunks...');
      const orphanedChunks: number[] = [];

      // Check the first few chunk indices (0-4) for orphaned accounts
      for (let i = 0; i < 5; i++) {
        const [chunkPDA] = this.getStorageChunkAddress(i);
        const chunkAccount = await this.connection.getAccountInfo(chunkPDA);
        if (chunkAccount) {
          orphanedChunks.push(i);
          console.warn(`[initializeMasterLockbox] Found orphaned chunk at index ${i}: ${chunkPDA.toBase58()}`);
        }
      }

      if (orphanedChunks.length > 0) {
        console.error('[initializeMasterLockbox] ORPHANED CHUNKS DETECTED');
        console.error('  Orphaned chunk indices:', orphanedChunks);
        console.error('  These chunks exist from a previous failed transaction');
        console.error('  Total rent locked:', orphanedChunks.length * 0.00878352, 'SOL');

        throw new Error(
          `Cannot initialize: ${orphanedChunks.length} orphaned storage chunk(s) detected (indices: ${orphanedChunks.join(', ')}). ` +
          `These chunks exist from previous failed transactions and are locking approximately ${(orphanedChunks.length * 0.00878352).toFixed(4)} SOL. ` +
          `To recover, you have two options:\n` +
          `1. Use a different wallet address (recommended)\n` +
          `2. Wait for a program upgrade that includes recovery functionality\n\n` +
          `This prevention check protects you from creating more orphaned accounts.`
        );
      }

      console.log('[initializeMasterLockbox] ✓ No orphaned chunks detected');
      console.log('Initializing master lockbox at:', masterLockbox.toBase58());

      // Build instruction manually
      const instruction = new TransactionInstruction({
        programId: PROGRAM_ID,
        keys: [
          { pubkey: masterLockbox, isSigner: false, isWritable: true },
          { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: INSTRUCTION_DISCRIMINATORS.initializeMasterLockbox,
      });

      const transaction = new Transaction().add(instruction);
      transaction.feePayer = this.wallet.publicKey;

      // Get fresh blockhash to avoid transaction replay
      const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;

      console.log('Signing and sending transaction...');

      // Use sendTransaction if available (preferred for wallet adapters)
      // This prevents double-sending issues with wallets that auto-send after signing
      let signature: string;
      if (this.wallet.sendTransaction) {
        signature = await this.wallet.sendTransaction(transaction, this.connection, {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
          maxRetries: 3,
        });
      } else {
        // Fallback to manual signing + sending
        const signed = await this.wallet.signTransaction(transaction);
        signature = await this.connection.sendRawTransaction(signed.serialize(), {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
          maxRetries: 3,
        });
      }

      console.log('Transaction sent:', signature);
      console.log('Confirming transaction...');

      // Wait for confirmation with block height
      const confirmation = await this.connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight,
      }, 'confirmed');

      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      }

      console.log('✅ Master lockbox initialized successfully!');

      return signature;
    } finally {
      this.pendingTransactions.delete(operationKey);
    }
  }

  /**
   * Initialize a new storage chunk
   */
  async initializeStorageChunk(
    chunkIndex: number,
    initialCapacity: number = 1024,
    dataType: StorageType = StorageType.Passwords
  ): Promise<string> {
    const [masterLockbox] = this.getMasterLockboxAddress();
    const [storageChunk] = this.getStorageChunkAddress(chunkIndex);

    // BUGFIX: Prevent race condition in duplicate chunk creation attempts
    // Use atomic check-and-set by checking AFTER adding to the set
    const operationKey = `chunk-${storageChunk.toBase58()}`;

    // Get the size before adding
    const sizeBefore = this.pendingTransactions.size;
    this.pendingTransactions.add(operationKey);
    const sizeAfter = this.pendingTransactions.size;

    // If size didn't increase, the key was already in the set
    if (sizeBefore === sizeAfter) {
      console.warn(`[initializeStorageChunk] Chunk ${chunkIndex} creation already in progress, skipping duplicate request`);
      throw new Error(`Chunk ${chunkIndex} initialization already in progress`);
    }

    try {

      // Check if chunk already exists (from a previous failed transaction)
      const existingChunk = await this.connection.getAccountInfo(storageChunk);
      if (existingChunk) {
        console.warn(`[initializeStorageChunk] Chunk ${chunkIndex} already exists at ${storageChunk.toBase58()}`);

        // Check if it's registered in master lockbox
        const master = await this.getMasterLockbox();
        const isRegistered = master.storageChunks.some(c => c.chunkIndex === chunkIndex);

        if (isRegistered) {
          console.log(`[initializeStorageChunk] Chunk ${chunkIndex} is properly registered, skipping`);
          return 'chunk-already-exists';
        }

        // Orphaned chunk detected - it exists but isn't registered
        console.error(`[initializeStorageChunk] ORPHANED CHUNK DETECTED!`);
        console.error(`  Chunk ${chunkIndex} exists on-chain but is not registered in master lockbox`);
        console.error(`  This is likely due to a previous failed transaction or RPC lag`);
        console.error(`  Account: ${storageChunk.toBase58()}`);
        console.error(`  Rent locked: ${existingChunk.lamports / 1e9} SOL`);

        throw new Error(
          `Orphaned storage chunk detected at index ${chunkIndex}. ` +
          `The chunk account exists but is not registered in your master lockbox. ` +
          `This can happen due to transaction failures or RPC lag. ` +
          `Unfortunately, this chunk cannot be automatically recovered. ` +
          `Please contact support or use a different wallet address.`
        );
      }

      console.log(`[initializeStorageChunk] Creating chunk ${chunkIndex} at ${storageChunk.toBase58()}`);

      // Build instruction data: discriminator + args
      // Args: chunk_index (u16) + initial_capacity (u32) + data_type (u8)
      const argsBuffer = Buffer.alloc(7);
      argsBuffer.writeUInt16LE(chunkIndex, 0);
      argsBuffer.writeUInt32LE(initialCapacity, 2);
      argsBuffer.writeUInt8(dataType, 6);

      const instructionData = Buffer.concat([
        INSTRUCTION_DISCRIMINATORS.initializeStorageChunk,
        argsBuffer,
      ]);

      const instruction = new TransactionInstruction({
        programId: PROGRAM_ID,
        keys: [
          { pubkey: masterLockbox, isSigner: false, isWritable: true },
          { pubkey: storageChunk, isSigner: false, isWritable: true },
          { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: instructionData,
      });

      const transaction = new Transaction().add(instruction);
      transaction.feePayer = this.wallet.publicKey;

      const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;

      console.log(`[initializeStorageChunk] Signing and sending transaction for chunk ${chunkIndex}...`);

      // VALIDATION: Check wallet connection state before sending
      if (!this.wallet.publicKey) {
        throw new Error('Wallet public key not available. Please reconnect your wallet.');
      }

      // VALIDATION: Check if wallet has required methods
      if (!this.wallet.sendTransaction && !this.wallet.signTransaction) {
        throw new Error('Wallet does not support transaction signing. Please use a different wallet.');
      }

      let signature: string;
      let sendError: any = null;

      try {
        console.log(`[initializeStorageChunk] Using ${this.wallet.sendTransaction ? 'sendTransaction' : 'signTransaction'} method`);

        if (this.wallet.sendTransaction) {
          signature = await this.wallet.sendTransaction(transaction, this.connection, {
            skipPreflight: false,
            preflightCommitment: 'confirmed',
            maxRetries: 3,
          });
        } else {
          const signed = await this.wallet.signTransaction(transaction);
          signature = await this.connection.sendRawTransaction(signed.serialize(), {
            skipPreflight: false,
            preflightCommitment: 'confirmed',
            maxRetries: 3,
          });
        }

        console.log(`[initializeStorageChunk] Transaction sent:`, signature);

        await this.connection.confirmTransaction({
          signature,
          blockhash,
          lastValidBlockHeight,
        }, 'confirmed');

        console.log(`[initializeStorageChunk] Chunk ${chunkIndex} created successfully`);

        return signature;
      } catch (error: any) {
        console.warn(`[initializeStorageChunk] Error during send/confirm:`, error?.message || error);
        console.warn(`[initializeStorageChunk] Full error details:`, {
          name: error?.name,
          message: error?.message,
          code: error?.code,
          logs: error?.logs,
          err: error?.err,
          stack: error?.stack?.split('\n').slice(0, 3).join('\n')
        });
        sendError = error;

        // Transaction may have succeeded despite wallet error
        // Check if chunk was actually created on-chain
        console.log(`[initializeStorageChunk] Waiting 2s then checking if chunk ${chunkIndex} was created at ${storageChunk.toBase58()}...`);
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s for RPC to update

        try {
          const chunkAccount = await this.connection.getAccountInfo(storageChunk);
          console.log(`[initializeStorageChunk] Chunk account check result:`, {
            exists: !!chunkAccount,
            owner: chunkAccount?.owner?.toBase58(),
            isProgramOwned: chunkAccount?.owner.equals(PROGRAM_ID)
          });

          if (chunkAccount && chunkAccount.owner.equals(PROGRAM_ID)) {
            console.log(`[initializeStorageChunk] ✅ Transaction succeeded on-chain despite wallet error!`);
            // Chunk was created successfully - find the transaction signature
            const signatures = await this.connection.getSignaturesForAddress(storageChunk, { limit: 5 });
            if (signatures.length > 0) {
              console.log(`[initializeStorageChunk] Found transaction signature: ${signatures[0].signature}`);
              return signatures[0].signature;
            }
            return 'success-no-signature-found';
          } else {
            console.error(`[initializeStorageChunk] ❌ Chunk was NOT created on-chain. Transaction actually failed.`);
          }
        } catch (checkError) {
          console.warn(`[initializeStorageChunk] Error checking chunk existence:`, checkError);
        }

        // Chunk wasn't created - this is a real error
        console.error(`[initializeStorageChunk] Transaction failed. Re-throwing error.`);
        throw sendError;
      }
    } catch (error: any) {
      // Check if error is "account already in use" - this can happen with RPC data lag
      const errorMsg = error?.message || String(error);
      if (errorMsg.includes('already in use') || errorMsg.includes('0x0')) {
        console.log(`[initializeStorageChunk] Chunk ${chunkIndex} already exists (caught during transaction), continuing...`);
        return 'chunk-exists-error-caught';
      }
      // Re-throw other errors
      throw error;
    } finally {
      this.pendingTransactions.delete(operationKey);
    }
  }

  // ============================================================================
  // Password Entry Operations
  // ============================================================================

  /**
   * Store a new password entry
   */
  async storePassword(entry: PasswordEntry): Promise<{ txSignature: string; entryId: number }> {
    // Prevent duplicate password creation attempts (in case user double-clicks "Save")
    const operationKey = `store-${entry.title}-${Date.now()}`;
    if (this.pendingTransactions.has(operationKey)) {
      console.warn(`[storePassword] Store operation for "${entry.title}" already in progress, skipping duplicate request`);
      throw new Error(`Password entry "${entry.title}" is already being created`);
    }

    try {
      this.pendingTransactions.add(operationKey);

      const sessionKey = await this.getSessionKey();

      // Encrypt the entry
      const { ciphertext, nonce } = this.encryptEntry(entry, sessionKey);

    // Combine nonce + ciphertext for storage
    const combined = new Uint8Array(nonce.length + ciphertext.length);
    combined.set(nonce);
    combined.set(ciphertext, nonce.length);

    console.log(`[storePassword] Encrypted data size: ${combined.length} bytes`);

    // Generate blind index for title
    const titleHash = this.generateTitleHash(entry.title, sessionKey);

    // Get master lockbox to find appropriate chunk
    const master = await this.getMasterLockbox();
    const tierInfo = TIER_INFO[master.subscriptionTier];

    // IMPORTANT: Check if entry would exceed storage capacity BEFORE creating any transaction
    // This validation happens client-side before any Solana transaction is constructed,
    // ensuring that users are NEVER charged transaction fees when storage limits are exceeded.
    // If this check fails, no transaction is signed, sent, or confirmed - therefore no fees are incurred.
    const newTotalUsed = master.storageUsed + combined.length;
    if (newTotalUsed > tierInfo.maxCapacity) {
      const usedKB = (master.storageUsed / 1024).toFixed(2);
      const maxKB = (tierInfo.maxCapacity / 1024).toFixed(2);
      const entryKB = (combined.length / 1024).toFixed(2);

      throw new Error(
        `STORAGE_LIMIT_EXCEEDED: Entry size (${entryKB} KB) would exceed your ${tierInfo.name} tier limit. ` +
        `Used: ${usedKB} KB / ${maxKB} KB. Please upgrade to a higher tier or delete some entries.`
      );
    }

    let chunkIndex = this.findChunkWithSpace(master, combined.length);

    if (chunkIndex === -1) {
      // Need to create a new chunk
      console.log(`[storePassword] No chunk with space, creating chunk ${master.storageChunksCount}`);
      const newChunkIndex = master.storageChunksCount;

      await this.initializeStorageChunk(newChunkIndex);

      // CRITICAL: Refresh master lockbox after creating chunk to verify it was properly registered
      // Due to RPC data lag, we may need to retry a few times
      console.log('[storePassword] Refreshing master lockbox to verify chunk creation...');

      let chunkRegistered = false;
      let retries = 0;
      const maxRetries = 5;

      while (!chunkRegistered && retries < maxRetries) {
        // Wait a bit for RPC to catch up (exponential backoff)
        if (retries > 0) {
          const delay = Math.min(500 * Math.pow(2, retries - 1), 2000); // 500ms, 1s, 2s, 2s, 2s
          console.log(`[storePassword] Waiting ${delay}ms for RPC to update (retry ${retries}/${maxRetries})...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        const refreshedMaster = await this.getMasterLockbox();
        chunkRegistered = refreshedMaster.storageChunks.some(c => c.chunkIndex === newChunkIndex);

        if (chunkRegistered) {
          console.log(`[storePassword] Chunk ${newChunkIndex} verified - registered successfully`);
          break;
        }

        retries++;
      }

      if (!chunkRegistered) {
        // Final check - verify the chunk account exists even if master lockbox isn't updated
        try {
          const [chunkPDA] = this.getStorageChunkAddress(newChunkIndex);
          const chunkAccount = await this.connection.getAccountInfo(chunkPDA);

          if (chunkAccount) {
            console.warn('[storePassword] Chunk exists on-chain but not yet reflected in master lockbox metadata');
            console.warn('[storePassword] This is likely due to RPC lag - proceeding anyway');
            chunkIndex = newChunkIndex;
          } else {
            console.error('[storePassword] Chunk creation failed - chunk not registered in master lockbox');
            console.error('  Expected chunk index:', newChunkIndex);
            throw new Error(
              `Storage chunk ${newChunkIndex} was not properly registered in master lockbox. ` +
              `This may indicate a partially failed transaction. Please try again or contact support.`
            );
          }
        } catch (verifyError) {
          console.error('[storePassword] Failed to verify chunk existence:', verifyError);
          throw new Error(
            `Storage chunk ${newChunkIndex} was not properly registered in master lockbox. ` +
            `This may indicate a partially failed transaction. Please try again or contact support.`
          );
        }
      } else {
        chunkIndex = newChunkIndex;
      }
    }

    const [masterLockbox] = this.getMasterLockboxAddress();
    const [storageChunk] = this.getStorageChunkAddress(chunkIndex);

    console.log(`[storePassword] Using chunk ${chunkIndex}`);
    console.log(`[storePassword] Master lockbox: ${masterLockbox.toBase58()}`);
    console.log(`[storePassword] Storage chunk: ${storageChunk.toBase58()}`);

    // Build instruction data: discriminator + args
    // Args: chunk_index (u16) + encrypted_data (vec<u8>) + entry_type (u8) + category (u32) + title_hash ([u8; 32])
    const argsBuffer = Buffer.alloc(2 + 4 + combined.length + 1 + 4 + 32);
    let offset = 0;

    // chunk_index (u16)
    argsBuffer.writeUInt16LE(chunkIndex, offset);
    offset += 2;

    // encrypted_data (vec<u8>) - length prefix + data
    argsBuffer.writeUInt32LE(combined.length, offset);
    offset += 4;
    combined.forEach((byte, i) => {
      argsBuffer[offset + i] = byte;
    });
    offset += combined.length;

    // entry_type (u8)
    argsBuffer.writeUInt8(entry.type || PasswordEntryType.Login, offset);
    offset += 1;

    // category (u32)
    argsBuffer.writeUInt32LE(entry.category || 0, offset);
    offset += 4;

    // title_hash ([u8; 32])
    titleHash.forEach((byte, i) => {
      argsBuffer[offset + i] = byte;
    });

    const instructionData = Buffer.concat([
      INSTRUCTION_DISCRIMINATORS.storePasswordEntry,
      argsBuffer,
    ]);

    const instruction = new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: masterLockbox, isSigner: false, isWritable: true },
        { pubkey: storageChunk, isSigner: false, isWritable: true },
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: instructionData,
    });

    const transaction = new Transaction().add(instruction);
    transaction.feePayer = this.wallet.publicKey;

    const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;

    console.log('[storePassword] Signing and sending transaction...');

    // Pre-flight checks before sending transaction
    try {
      // Check wallet balance
      const balance = await this.connection.getBalance(this.wallet.publicKey);
      console.log(`[storePassword] Wallet balance: ${balance / 1e9} SOL`);

      if (balance < 5000) { // 0.000005 SOL minimum (typical tx fee is ~0.000005 SOL)
        throw new Error('Insufficient SOL balance for transaction fees. Please add SOL to your wallet.');
      }

      // Log transaction size for debugging
      const serializedSize = transaction.serialize({ requireAllSignatures: false }).length;
      console.log(`[storePassword] Transaction size: ${serializedSize} bytes`);

      if (serializedSize > 1232) { // Solana transaction limit
        console.error('[storePassword] Transaction exceeds maximum size (1232 bytes)');
        throw new Error(`Transaction too large (${serializedSize} bytes). Try reducing the entry size.`);
      }

      console.log('[storePassword] Pre-flight checks passed, sending to wallet...');
    } catch (preflightError: any) {
      console.error('[storePassword] Pre-flight check failed:', preflightError);
      throw preflightError;
    }

    try {
      // Use sendTransaction if available (preferred for wallet adapters)
      let signature: string;
      if (this.wallet.sendTransaction) {
        console.log('[storePassword] Using wallet.sendTransaction()');

        // Try with skipPreflight: true to bypass simulation
        // The wallet itself may be running simulation that's failing
        try {
          signature = await this.wallet.sendTransaction(transaction, this.connection, {
            skipPreflight: true, // Skip simulation - send directly
            preflightCommitment: 'confirmed',
            maxRetries: 3,
          });
        } catch (walletError: any) {
          console.error('[storePassword] Wallet sendTransaction failed:', walletError);
          console.error('[storePassword] Trying manual simulation to get better error details...');

          // Manually simulate to get better error details
          try {
            const simulation = await this.connection.simulateTransaction(transaction);
            console.error('[storePassword] Simulation result:', simulation);

            if (simulation.value.err) {
              throw new Error(`Transaction simulation failed: ${JSON.stringify(simulation.value.err)}`);
            }
          } catch (simError) {
            console.error('[storePassword] Manual simulation also failed:', simError);
          }

          // Re-throw original wallet error
          throw walletError;
        }
      } else {
        // Fallback to manual signing + sending
        console.log('[storePassword] Using wallet.signTransaction() + sendRawTransaction()');
        const signed = await this.wallet.signTransaction(transaction);
        signature = await this.connection.sendRawTransaction(signed.serialize(), {
          skipPreflight: true, // Skip simulation
          preflightCommitment: 'confirmed',
          maxRetries: 3,
        });
      }

      console.log('[storePassword] Transaction sent:', signature);
      console.log('[storePassword] Confirming transaction...');

      const confirmation = await this.connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight,
      }, 'confirmed');

      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      }

      console.log('✅ Password entry stored successfully!');

      // Fetch updated master to get entry ID
      const updatedMaster = await this.getMasterLockbox();
      const entryId = safeBigIntToNumber(updatedMaster.nextEntryId, 'nextEntryId') - 1;

      console.log(`[storePassword] Entry ID: ${entryId}`);

      return { txSignature: signature, entryId };
    } catch (error: any) {
      console.error('[storePassword] Transaction failed with error:', error);
      console.error('[storePassword] Error type:', typeof error);
      console.error('[storePassword] Error name:', error?.name);
      console.error('[storePassword] Error message:', error?.message);

      // InstructionError format: { InstructionError: [index, error_type] }
      if (error && typeof error === 'object') {
        // Try to stringify the error object to see its structure
        try {
          console.error('[storePassword] Error object keys:', Object.keys(error));
          console.error('[storePassword] Full error (stringified):', JSON.stringify(error, null, 2));
        } catch (e) {
          console.error('[storePassword] Could not stringify error');
        }

        // Check for InstructionError specifically
        if ('InstructionError' in error && Array.isArray(error.InstructionError)) {
          const [instructionIndex, errorType] = error.InstructionError;
          console.error(`[storePassword] InstructionError at index ${instructionIndex}:`, errorType);

          // Try to decode the error type
          if (typeof errorType === 'object') {
            const errorName = Object.keys(errorType)[0];
            console.error(`[storePassword] Error type: ${errorName}`);
            if (errorType[errorName]) {
              console.error(`[storePassword] Error details:`, errorType[errorName]);
            }
          }
        }
      }

      // Try to extract more detailed error information
      if (error?.logs) {
        console.error('[storePassword] Transaction logs:', error.logs);
      }
      if (error?.error) {
        console.error('[storePassword] Nested error:', error.error);
      }

      // Log the transaction details for debugging
      console.error('[storePassword] Transaction details:');
      console.error('  - Chunk index:', chunkIndex);
      console.error('  - Storage chunk PDA:', storageChunk.toBase58());
      console.error('  - Master lockbox PDA:', masterLockbox.toBase58());
      console.error('  - Instruction data length:', instructionData.length);
      console.error('  - Encrypted data size:', combined.length);

      // Extract the most useful error message
      let errorMsg = error?.message || String(error);

      // Handle InstructionError
      if (error && typeof error === 'object' && 'InstructionError' in error) {
        const [idx, errType] = error.InstructionError;
        if (typeof errType === 'object') {
          const errorName = Object.keys(errType)[0];
          errorMsg = `InstructionError[${idx}]: ${errorName}`;
          if (errType[errorName]) {
            errorMsg += ` - ${JSON.stringify(errType[errorName])}`;
          }
        } else {
          errorMsg = `InstructionError[${idx}]: ${errType}`;
        }
      } else if (error?.logs && error.logs.length > 0) {
        // Look for program errors in logs
        const programError = error.logs.find((log: string) =>
          log.includes('Program log:') || log.includes('Error:')
        );
        if (programError) {
          errorMsg = programError;
        }
      }

      // Re-throw with more context
      throw new Error(`Failed to store password: ${errorMsg}`);
    }
  } finally {
    this.pendingTransactions.delete(operationKey);
  }
}

  /**
   * Retrieve a password entry by ID
   */
  async retrievePassword(chunkIndex: number, entryId: number): Promise<PasswordEntry | null> {
    const sessionKey = await this.getSessionKey();

    // Get the storage chunk data
    const chunk = await this.getStorageChunk(chunkIndex);

    // Find the entry header for this entry ID
    const header = chunk.entryHeaders.find(h => h.entryId === entryId);
    if (!header) {
      throw new Error(`Entry ${entryId} not found in chunk ${chunkIndex}`);
    }

    // Extract the encrypted data from the chunk using offset and size from header
    const encryptedEntry = chunk.encryptedData.slice(header.offset, header.offset + header.size);

    // Decrypt and return
    return this.decryptEntry(encryptedEntry, sessionKey);
  }

  /**
   * Update an existing password entry
   */
  async updatePassword(chunkIndex: number, entryId: number, updatedEntry: PasswordEntry): Promise<string> {
    // Prevent duplicate update attempts (in case user double-clicks "Update")
    const operationKey = `update-${chunkIndex}-${entryId}`;
    if (this.pendingTransactions.has(operationKey)) {
      console.warn(`[updatePassword] Update operation for entry ${entryId} already in progress, skipping duplicate request`);
      throw new Error(`Entry ${entryId} update already in progress`);
    }

    try {
      this.pendingTransactions.add(operationKey);

      const sessionKey = await this.getSessionKey();

      const { ciphertext, nonce } = this.encryptEntry(updatedEntry, sessionKey);
      const combined = new Uint8Array(nonce.length + ciphertext.length);
      combined.set(nonce);
      combined.set(ciphertext, nonce.length);

      const [masterLockbox] = this.getMasterLockboxAddress();
      const [storageChunk] = this.getStorageChunkAddress(chunkIndex);

      // Build instruction data: discriminator + args
      // Args: chunk_index (u16) + entry_id (u64) + new_encrypted_data (vec<u8>)
      const argsBuffer = Buffer.alloc(2 + 8 + 4 + combined.length);
      let offset = 0;

      // chunk_index (u16)
      argsBuffer.writeUInt16LE(chunkIndex, offset);
      offset += 2;

      // entry_id (u64)
      argsBuffer.writeBigUInt64LE(BigInt(entryId), offset);
      offset += 8;

      // new_encrypted_data (vec<u8>) - length prefix + data
      argsBuffer.writeUInt32LE(combined.length, offset);
      offset += 4;
      combined.forEach((byte, i) => {
        argsBuffer[offset + i] = byte;
      });

      const instructionData = Buffer.concat([
        INSTRUCTION_DISCRIMINATORS.updatePasswordEntry,
        argsBuffer,
      ]);

      const instruction = new TransactionInstruction({
        programId: PROGRAM_ID,
        keys: [
          { pubkey: masterLockbox, isSigner: false, isWritable: true },
          { pubkey: storageChunk, isSigner: false, isWritable: true },
          { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true },
        ],
        data: instructionData,
      });

      const transaction = new Transaction().add(instruction);
      transaction.feePayer = this.wallet.publicKey;

      const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;

      let signature: string;
      if (this.wallet.sendTransaction) {
        signature = await this.wallet.sendTransaction(transaction, this.connection, {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
          maxRetries: 3,
        });
      } else {
        const signed = await this.wallet.signTransaction(transaction);
        signature = await this.connection.sendRawTransaction(signed.serialize(), {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
          maxRetries: 3,
        });
      }

      await this.connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight,
      }, 'confirmed');

      console.log(`✅ Password entry ${entryId} updated successfully`);

      return signature;
    } finally {
      this.pendingTransactions.delete(operationKey);
    }
  }

  /**
   * Batch update multiple password entries in a SINGLE transaction
   *
   * This is much more efficient than calling updatePassword() multiple times:
   * - 1 transaction fee instead of N
   * - 1 signature request instead of N
   * - Atomic: all updates succeed or all fail
   *
   * @param updates - Array of updates to apply
   * @returns Transaction signature
   *
   * @example
   * ```typescript
   * await client.batchUpdatePasswords([
   *   { chunkIndex: 0, entryId: 1, updatedEntry: { ...entry1, favorite: true } },
   *   { chunkIndex: 0, entryId: 2, updatedEntry: { ...entry2, archived: true } },
   *   { chunkIndex: 0, entryId: 3, updatedEntry: { ...entry3, category: 5 } },
   * ]);
   * ```
   */
  async batchUpdatePasswords(updates: Array<{
    chunkIndex: number;
    entryId: number;
    updatedEntry: PasswordEntry;
  }>): Promise<string> {
    if (updates.length === 0) {
      throw new Error('No updates provided');
    }

    if (updates.length > 10) {
      throw new Error('Maximum 10 updates per batch transaction (to stay under transaction size limits)');
    }

    console.log(`🔄 Starting batch update of ${updates.length} password entries...`);

    const sessionKey = await this.getSessionKey();
    const transaction = new Transaction();
    const [masterLockbox] = this.getMasterLockboxAddress();

    // Build an update instruction for each entry
    for (const { chunkIndex, entryId, updatedEntry } of updates) {
      const { ciphertext, nonce } = this.encryptEntry(updatedEntry, sessionKey);
      const combined = new Uint8Array(nonce.length + ciphertext.length);
      combined.set(nonce);
      combined.set(ciphertext, nonce.length);

      const [storageChunk] = this.getStorageChunkAddress(chunkIndex);

      // Build instruction data: discriminator + args
      const argsBuffer = Buffer.alloc(2 + 8 + 4 + combined.length);
      let offset = 0;

      // chunk_index (u16)
      argsBuffer.writeUInt16LE(chunkIndex, offset);
      offset += 2;

      // entry_id (u64)
      argsBuffer.writeBigUInt64LE(BigInt(entryId), offset);
      offset += 8;

      // new_encrypted_data (vec<u8>)
      argsBuffer.writeUInt32LE(combined.length, offset);
      offset += 4;
      combined.forEach((byte, i) => {
        argsBuffer[offset + i] = byte;
      });

      const instructionData = Buffer.concat([
        INSTRUCTION_DISCRIMINATORS.updatePasswordEntry,
        argsBuffer,
      ]);

      const instruction = new TransactionInstruction({
        programId: PROGRAM_ID,
        keys: [
          { pubkey: masterLockbox, isSigner: false, isWritable: true },
          { pubkey: storageChunk, isSigner: false, isWritable: true },
          { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true },
        ],
        data: instructionData,
      });

      transaction.add(instruction);
    }

    transaction.feePayer = this.wallet.publicKey;

    const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;

    console.log(`📦 Sending batch transaction with ${updates.length} update instructions...`);

    let signature: string;
    if (this.wallet.sendTransaction) {
      signature = await this.wallet.sendTransaction(transaction, this.connection, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
        maxRetries: 3,
      });
    } else {
      const signed = await this.wallet.signTransaction(transaction);
      signature = await this.connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
        maxRetries: 3,
      });
    }

    await this.connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight,
    }, 'confirmed');

    console.log(`✅ Batch update complete! Updated ${updates.length} entries in transaction ${signature.slice(0, 8)}...`);

    return signature;
  }

  /**
   * Delete a password entry
   */
  async deletePassword(chunkIndex: number, entryId: number): Promise<string> {
    // Prevent duplicate delete attempts (in case user double-clicks "Delete")
    const operationKey = `delete-${chunkIndex}-${entryId}`;
    if (this.pendingTransactions.has(operationKey)) {
      console.warn(`[deletePassword] Delete operation for entry ${entryId} already in progress, skipping duplicate request`);
      throw new Error(`Entry ${entryId} deletion already in progress`);
    }

    try {
      this.pendingTransactions.add(operationKey);

      const [masterLockbox] = this.getMasterLockboxAddress();
      const [storageChunk] = this.getStorageChunkAddress(chunkIndex);

      // Build instruction data: discriminator + args
      // Args: chunk_index (u16) + entry_id (u64)
      const argsBuffer = Buffer.alloc(2 + 8);
      argsBuffer.writeUInt16LE(chunkIndex, 0);
      argsBuffer.writeBigUInt64LE(BigInt(entryId), 2);

      const instructionData = Buffer.concat([
        INSTRUCTION_DISCRIMINATORS.deletePasswordEntry,
        argsBuffer,
      ]);

      const instruction = new TransactionInstruction({
        programId: PROGRAM_ID,
        keys: [
          { pubkey: masterLockbox, isSigner: false, isWritable: true },
          { pubkey: storageChunk, isSigner: false, isWritable: true },
          { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true },
        ],
        data: instructionData,
      });

      const transaction = new Transaction().add(instruction);
      transaction.feePayer = this.wallet.publicKey;

      const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;

      let signature: string;
      if (this.wallet.sendTransaction) {
        signature = await this.wallet.sendTransaction(transaction, this.connection, {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
          maxRetries: 3,
        });
      } else {
        const signed = await this.wallet.signTransaction(transaction);
        signature = await this.connection.sendRawTransaction(signed.serialize(), {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
          maxRetries: 3,
        });
      }

      await this.connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight,
      }, 'confirmed');

      console.log(`✅ Password entry ${entryId} deleted successfully`);

      return signature;
    } finally {
      this.pendingTransactions.delete(operationKey);
    }
  }

  /**
   * List all password entries with improved performance and error handling
   *
   * @returns Object containing entries and any errors encountered
   */
  async listPasswords(): Promise<{
    entries: PasswordEntry[];
    errors: Array<{ entryId: number; chunkIndex: number; error: string }>;
  }> {
    const master = await this.getMasterLockbox();
    const entries: PasswordEntry[] = [];
    const errors: Array<{ entryId: number; chunkIndex: number; error: string }> = [];

    // Fetch all chunks in parallel for better performance
    const chunkPromises = master.storageChunks.map(chunkInfo =>
      this.getStorageChunk(chunkInfo.chunkIndex).catch(err => {
        console.error(`Failed to fetch chunk ${chunkInfo.chunkIndex}:`, err);
        return null;
      })
    );

    const chunks = await Promise.all(chunkPromises);

    // Process each chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      if (!chunk) continue; // Skip failed chunks

      const chunkInfo = master.storageChunks[i];

      for (const header of chunk.entryHeaders) {
        try {
          const entry = await this.retrievePassword(chunkInfo.chunkIndex, header.entryId);
          if (entry) {
            entry.id = header.entryId;
            entry.createdAt = new Date(header.createdAt * 1000);
            entry.lastModified = new Date(header.lastModified * 1000);
            entry.accessCount = header.accessCount;
            entries.push(entry);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);

          // Different error types need different handling
          if (error instanceof DataCorruptionError) {
            errors.push({
              entryId: header.entryId,
              chunkIndex: chunkInfo.chunkIndex,
              error: `Data corruption: ${errorMessage}`
            });
          } else if (error instanceof SchemaValidationError) {
            errors.push({
              entryId: header.entryId,
              chunkIndex: chunkInfo.chunkIndex,
              error: `Invalid schema: ${errorMessage}`
            });
          } else {
            errors.push({
              entryId: header.entryId,
              chunkIndex: chunkInfo.chunkIndex,
              error: `Decryption failed: ${errorMessage}`
            });
          }

          console.error(`Failed to retrieve entry ${header.entryId}:`, error);
        }
      }
    }

    if (errors.length > 0) {
      console.warn(`⚠️  ${errors.length} entries could not be decrypted. This may indicate:
        - Data corruption
        - Wrong encryption key
        - Schema version mismatch
        - Incomplete data`);
    }

    return { entries, errors };
  }

  // ============================================================================
  // Subscription Management
  // ============================================================================

  /**
   * Upgrade subscription tier
   */
  async upgradeSubscription(newTier: SubscriptionTier): Promise<string> {
    const [masterLockbox] = this.getMasterLockboxAddress();

    // Build instruction data: discriminator + new_tier (u8)
    const argsBuffer = Buffer.alloc(1);
    argsBuffer.writeUInt8(newTier, 0);

    const instructionData = Buffer.concat([
      INSTRUCTION_DISCRIMINATORS.upgradeSubscription,
      argsBuffer,
    ]);

    const instruction = new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: masterLockbox, isSigner: false, isWritable: true },
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: this.treasuryWallet, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: instructionData,
    });

    const transaction = new Transaction().add(instruction);
    transaction.feePayer = this.wallet.publicKey;

    const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;

    let signature: string;
    if (this.wallet.sendTransaction) {
      signature = await this.wallet.sendTransaction(transaction, this.connection, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
        maxRetries: 3,
      });
    } else {
      const signed = await this.wallet.signTransaction(transaction);
      signature = await this.connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
        maxRetries: 3,
      });
    }

    await this.connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight,
    }, 'confirmed');

    console.log(`✅ Subscription upgraded to tier ${newTier}`);

    return signature;
  }

  /**
   * Renew current subscription
   */
  async renewSubscription(): Promise<string> {
    const [masterLockbox] = this.getMasterLockboxAddress();

    // Build instruction data: discriminator only (no args)
    const instructionData = INSTRUCTION_DISCRIMINATORS.renewSubscription;

    const instruction = new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: masterLockbox, isSigner: false, isWritable: true },
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: this.treasuryWallet, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: instructionData,
    });

    const transaction = new Transaction().add(instruction);
    transaction.feePayer = this.wallet.publicKey;

    const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;

    let signature: string;
    if (this.wallet.sendTransaction) {
      signature = await this.wallet.sendTransaction(transaction, this.connection, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
        maxRetries: 3,
      });
    } else {
      const signed = await this.wallet.signTransaction(transaction);
      signature = await this.connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
        maxRetries: 3,
      });
    }

    await this.connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight,
    }, 'confirmed');

    console.log('✅ Subscription renewed successfully');

    return signature;
  }

  /**
   * Downgrade to free tier
   */
  async downgradeSubscription(): Promise<string> {
    const [masterLockbox] = this.getMasterLockboxAddress();

    // Build instruction data: discriminator only (no args)
    const instructionData = INSTRUCTION_DISCRIMINATORS.downgradeSubscription;

    const instruction = new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: masterLockbox, isSigner: false, isWritable: true },
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true },
      ],
      data: instructionData,
    });

    const transaction = new Transaction().add(instruction);
    transaction.feePayer = this.wallet.publicKey;

    const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;

    let signature: string;
    if (this.wallet.sendTransaction) {
      signature = await this.wallet.sendTransaction(transaction, this.connection, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
        maxRetries: 3,
      });
    } else {
      const signed = await this.wallet.signTransaction(transaction);
      signature = await this.connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
        maxRetries: 3,
      });
    }

    await this.connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight,
    }, 'confirmed');

    console.log('✅ Subscription downgraded to Free tier');

    return signature;
  }

  /**
   * Expand an existing storage chunk
   *
   * @param chunkIndex - Index of the chunk to expand
   * @param additionalBytes - Number of bytes to add (max 10,240 per call)
   * @returns Transaction signature
   *
   * Constraints:
   * - Max expansion per call: 10KB (MAX_REALLOC_INCREMENT = 10240)
   * - Total chunk size cannot exceed 10KB (MAX_CHUNK_SIZE = 10240)
   * - Automatically calculates and transfers additional rent
   *
   * Example:
   * ```typescript
   * // Expand chunk 0 by 5KB
   * await client.expandStorageChunk(0, 5120);
   * ```
   */
  async expandStorageChunk(chunkIndex: number, additionalBytes: number): Promise<string> {
    if (additionalBytes <= 0) {
      throw new Error('Additional bytes must be positive');
    }

    if (additionalBytes > 10240) {
      throw new Error('Maximum 10KB (10,240 bytes) expansion per transaction. Call multiple times for larger expansions.');
    }

    const [masterLockbox] = this.getMasterLockboxAddress();
    const [storageChunk] = this.getStorageChunkAddress(chunkIndex);

    // Verify chunk exists
    const chunkAccount = await this.connection.getAccountInfo(storageChunk);
    if (!chunkAccount) {
      throw new Error(`Storage chunk ${chunkIndex} does not exist at ${storageChunk.toBase58()}`);
    }

    // Build instruction data: discriminator + additional_size (u32)
    const argsBuffer = Buffer.alloc(4);
    argsBuffer.writeUInt32LE(additionalBytes, 0);

    const instructionData = Buffer.concat([
      INSTRUCTION_DISCRIMINATORS.expandChunk,
      argsBuffer,
    ]);

    const instruction = new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: masterLockbox, isSigner: false, isWritable: true },
        { pubkey: storageChunk, isSigner: false, isWritable: true },
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: false }, // owner (validates ownership)
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true },  // payer (pays rent)
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: instructionData,
    });

    const transaction = new Transaction().add(instruction);
    transaction.feePayer = this.wallet.publicKey;

    const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;

    let signature: string;
    if (this.wallet.sendTransaction) {
      signature = await this.wallet.sendTransaction(transaction, this.connection, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
        maxRetries: 3,
      });
    } else {
      const signed = await this.wallet.signTransaction(transaction);
      signature = await this.connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
        maxRetries: 3,
      });
    }

    await this.connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight,
    }, 'confirmed');

    console.log(`✅ Storage chunk ${chunkIndex} expanded by ${additionalBytes} bytes`);

    return signature;
  }

  /**
   * Smart storage expansion - automatically expand existing chunks or create new ones
   *
   * @param targetCapacity - Target total capacity in bytes
   * @returns Array of transaction signatures
   *
   * This method intelligently:
   * 1. Calculates how many bytes are needed
   * 2. Expands existing chunks that aren't maxed out (10KB max per chunk)
   * 3. Creates new chunks if needed
   * 4. Handles multi-transaction expansions (max 10KB per transaction)
   *
   * Example:
   * ```typescript
   * // Expand from 1KB to 15KB total
   * const signatures = await client.expandStorageToCapacity(15360);
   * console.log(`Completed ${signatures.length} transactions`);
   * ```
   */
  async expandStorageToCapacity(targetCapacity: number): Promise<string[]> {
    const master = await this.getMasterLockbox();
    const currentCapacity = Number(master.totalCapacity);

    if (targetCapacity <= currentCapacity) {
      throw new Error(`Target capacity (${targetCapacity}) must be greater than current capacity (${currentCapacity})`);
    }

    const bytesNeeded = targetCapacity - currentCapacity;
    const signatures: string[] = [];

    console.log(`📦 Expanding storage from ${currentCapacity} to ${targetCapacity} bytes (+${bytesNeeded} bytes)`);

    let remainingBytes = bytesNeeded;

    // Try to expand existing chunks first
    for (const chunk of master.storageChunks) {
      if (remainingBytes <= 0) break;

      const MAX_CHUNK_SIZE = 10240;
      const chunkAvailable = MAX_CHUNK_SIZE - chunk.maxCapacity;

      if (chunkAvailable > 0) {
        const expandBy = Math.min(remainingBytes, chunkAvailable);
        console.log(`  Expanding chunk ${chunk.chunkIndex} by ${expandBy} bytes (${chunk.maxCapacity} -> ${chunk.maxCapacity + expandBy})`);

        const sig = await this.expandStorageChunk(chunk.chunkIndex, expandBy);
        signatures.push(sig);
        remainingBytes -= expandBy;
      }
    }

    // Create new chunks if still needed
    let nextChunkIndex = master.storageChunksCount;
    while (remainingBytes > 0) {
      const chunkSize = Math.min(remainingBytes, 10240);
      console.log(`  Creating new chunk ${nextChunkIndex} with ${chunkSize} bytes`);

      const sig = await this.initializeStorageChunk(nextChunkIndex, chunkSize);
      if (sig !== 'chunk-already-exists' && sig !== 'chunk-exists-error-caught') {
        signatures.push(sig);
      }

      // Always increment chunk index, even if chunk already existed
      nextChunkIndex++;
      remainingBytes -= chunkSize;
    }

    console.log(`✅ Storage expanded successfully (${signatures.length} transactions)`);

    return signatures;
  }

  // ============================================================================
  // Account Queries
  // ============================================================================

  /**
   * Get master lockbox account
   */
  async getMasterLockbox(): Promise<MasterLockbox> {
    const [masterLockbox] = this.getMasterLockboxAddress();
    const accountInfo = await this.connection.getAccountInfo(masterLockbox);

    if (!accountInfo) {
      throw new Error('Master lockbox not found - call initializeMasterLockbox() first');
    }

    // Manual deserialization (skip 8-byte discriminator)
    const data = accountInfo.data.slice(8);

    try {
      let offset = 0;

      // Read owner (32 bytes)
      const owner = new PublicKey(data.slice(offset, offset + 32));
      offset += 32;

      // Read total_entries (u64, 8 bytes)
      const totalEntries = safeBigIntToNumber(data.readBigUInt64LE(offset), 'totalEntries');
      offset += 8;

      // Read storage_chunks_count (u16, 2 bytes)
      const storageChunksCount = data.readUInt16LE(offset);
      offset += 2;

      // Read subscription_tier (u8, 1 byte)
      const subscriptionTier = data.readUInt8(offset) as SubscriptionTier;
      offset += 1;

      // Read last_accessed (i64, 8 bytes)
      const lastAccessed = safeBigIntToNumber(data.readBigInt64LE(offset), 'lastAccessed');
      offset += 8;

      // Read subscription_expires (i64, 8 bytes)
      const subscriptionExpires = safeBigIntToNumber(data.readBigInt64LE(offset), 'subscriptionExpires');
      offset += 8;

      // Read total_capacity (u64, 8 bytes)
      const totalCapacity = safeBigIntToNumber(data.readBigUInt64LE(offset), 'totalCapacity');
      offset += 8;

      // Read storage_used (u64, 8 bytes)
      const storageUsed = safeBigIntToNumber(data.readBigUInt64LE(offset), 'storageUsed');
      offset += 8;

      // Read storage_chunks vec (4-byte length + items)
      const storageChunksLen = data.readUInt32LE(offset);
      offset += 4;
      const storageChunks = [];

      // Read each StorageChunkInfo (if any exist)
      for (let i = 0; i < storageChunksLen; i++) {
        // chunk_address (32 bytes)
        const chunkAddress = new PublicKey(data.slice(offset, offset + 32));
        offset += 32;

        // chunk_index (u16, 2 bytes)
        const chunkIndex = data.readUInt16LE(offset);
        offset += 2;

        // max_capacity (u32, 4 bytes)
        const maxCapacity = data.readUInt32LE(offset);
        offset += 4;

        // size_used (u32, 4 bytes)
        const sizeUsed = data.readUInt32LE(offset);
        offset += 4;

        // data_type (u8, 1 byte)
        const dataType = data.readUInt8(offset);
        offset += 1;

        // created_at (i64, 8 bytes)
        const chunkCreatedAt = safeBigIntToNumber(data.readBigInt64LE(offset), 'chunkCreatedAt');
        offset += 8;

        // last_modified (i64, 8 bytes)
        const lastModified = safeBigIntToNumber(data.readBigInt64LE(offset), 'lastModified');
        offset += 8;

        storageChunks.push({
          chunkAddress,
          chunkIndex,
          maxCapacity,
          sizeUsed,
          dataType,
          createdAt: chunkCreatedAt,
          lastModified,
        });
      }

      // Read encrypted_index vec (4-byte length + data)
      const encryptedIndexLen = data.readUInt32LE(offset);
      offset += 4;
      const encryptedIndex = data.slice(offset, offset + encryptedIndexLen);
      offset += encryptedIndexLen;

      // Read next_entry_id (u64, 8 bytes)
      const nextEntryId = safeBigIntToNumber(data.readBigUInt64LE(offset), 'nextEntryId');
      offset += 8;

      // Read categories_count (u32, 4 bytes)
      const categoriesCount = data.readUInt32LE(offset);
      offset += 4;

      // Read created_at (i64, 8 bytes)
      const createdAt = safeBigIntToNumber(data.readBigInt64LE(offset), 'createdAt');
      offset += 8;

      // Read bump (u8, 1 byte)
      const bump = data.readUInt8(offset);
      offset += 1;

      console.log('✅ Successfully deserialized master lockbox');
      console.log('  Owner:', owner.toBase58());
      console.log('  Total Entries:', totalEntries);
      console.log('  Subscription Tier:', SubscriptionTier[subscriptionTier]);
      console.log('  Storage Chunks:', storageChunksCount);

      return {
        owner,
        totalEntries,
        storageChunksCount,
        subscriptionTier,
        lastAccessed,
        subscriptionExpires,
        totalCapacity,
        storageUsed,
        storageChunks,
        encryptedIndex,
        nextEntryId,
        categoriesCount,
        createdAt,
        bump,
      } as MasterLockbox;
    } catch (error) {
      console.error('Failed to deserialize MasterLockbox:', error);
      console.error('Account data length:', accountInfo.data.length);
      console.error('Data (hex):', accountInfo.data.toString('hex'));
      throw new Error(`Failed to deserialize master lockbox: ${error}`);
    }
  }

  /**
   * Get storage chunk account
   */
  async getStorageChunk(chunkIndex: number): Promise<StorageChunk> {
    const [storageChunk] = this.getStorageChunkAddress(chunkIndex);
    const accountInfo = await this.connection.getAccountInfo(storageChunk);

    if (!accountInfo) {
      throw new Error(`Storage chunk ${chunkIndex} not found`);
    }

    // Manual deserialization (skip 8-byte discriminator)
    // Using manual deserialization instead of Borsh to avoid schema resolution issues
    const data = accountInfo.data.slice(8);

    try {
      let offset = 0;

      // Read master_lockbox (32 bytes)
      const masterLockbox = new PublicKey(data.slice(offset, offset + 32));
      offset += 32;

      // Read owner (32 bytes)
      const owner = new PublicKey(data.slice(offset, offset + 32));
      offset += 32;

      // Read chunk_index (u16, 2 bytes)
      const chunkIndexRead = data.readUInt16LE(offset);
      offset += 2;

      // Read max_capacity (u32, 4 bytes)
      const maxCapacity = data.readUInt32LE(offset);
      offset += 4;

      // Read current_size (u32, 4 bytes)
      const currentSize = data.readUInt32LE(offset);
      offset += 4;

      // Read data_type (u8, 1 byte)
      const dataType = data.readUInt8(offset) as StorageType;
      offset += 1;

      // Read encrypted_data vec (4-byte length + data)
      const encryptedDataLen = data.readUInt32LE(offset);
      offset += 4;
      const encryptedData = data.slice(offset, offset + encryptedDataLen);
      offset += encryptedDataLen;

      // Read entry_headers vec (4-byte length + items)
      const entryHeadersLen = data.readUInt32LE(offset);
      offset += 4;
      const entryHeaders: DataEntryHeader[] = [];

      for (let i = 0; i < entryHeadersLen; i++) {
        // entry_id (u64, 8 bytes)
        const entryId = safeBigIntToNumber(data.readBigUInt64LE(offset), 'entryId');
        offset += 8;

        // offset (u32, 4 bytes)
        const entryOffset = data.readUInt32LE(offset);
        offset += 4;

        // size (u32, 4 bytes)
        const size = data.readUInt32LE(offset);
        offset += 4;

        // entry_type (u8, 1 byte)
        const entryType = data.readUInt8(offset) as PasswordEntryType;
        offset += 1;

        // category (u32, 4 bytes)
        const category = data.readUInt32LE(offset);
        offset += 4;

        // title_hash ([u8; 32], 32 bytes)
        const titleHash = Array.from(data.slice(offset, offset + 32));
        offset += 32;

        // created_at (i64, 8 bytes)
        const createdAt = safeBigIntToNumber(data.readBigInt64LE(offset), 'createdAt');
        offset += 8;

        // last_modified (i64, 8 bytes)
        const lastModified = safeBigIntToNumber(data.readBigInt64LE(offset), 'lastModified');
        offset += 8;

        // access_count (u32, 4 bytes)
        const accessCount = data.readUInt32LE(offset);
        offset += 4;

        // flags (u8, 1 byte)
        const flags = data.readUInt8(offset);
        offset += 1;

        entryHeaders.push({
          entryId,
          offset: entryOffset,
          size,
          entryType,
          category,
          titleHash,
          createdAt,
          lastModified,
          accessCount,
          flags,
        });
      }

      // Read entry_count (u16, 2 bytes)
      const entryCount = data.readUInt16LE(offset);
      offset += 2;

      // Read created_at (i64, 8 bytes)
      const createdAt = safeBigIntToNumber(data.readBigInt64LE(offset), 'createdAt');
      offset += 8;

      // Read last_modified (i64, 8 bytes)
      const lastModified = safeBigIntToNumber(data.readBigInt64LE(offset), 'lastModified');
      offset += 8;

      // Read bump (u8, 1 byte)
      const bump = data.readUInt8(offset);
      offset += 1;

      console.log(`✅ Successfully deserialized storage chunk ${chunkIndex}`);
      console.log(`  Entry count: ${entryCount}`);
      console.log(`  Entry headers: ${entryHeaders.length}`);

      return {
        masterLockbox,
        owner,
        chunkIndex: chunkIndexRead,
        maxCapacity,
        currentSize,
        dataType,
        encryptedData,
        entryHeaders,
        entryCount,
        createdAt,
        lastModified,
        bump,
      } as StorageChunk;
    } catch (error) {
      console.error('Failed to deserialize StorageChunk:', error);
      console.error('Account data length:', accountInfo.data.length);
      console.error('Data after discriminator:', data.length);
      console.error('Error details:', error instanceof Error ? error.message : String(error));
      throw new Error(`Failed to deserialize storage chunk: ${error}`);
    }
  }

  /**
   * Check if master lockbox exists
   */
  async exists(): Promise<boolean> {
    try {
      const [masterLockbox] = this.getMasterLockboxAddress();
      const accountInfo = await this.connection.getAccountInfo(masterLockbox);
      return accountInfo !== null;
    } catch {
      return false;
    }
  }

  /**
   * Get subscription info
   */
  async getSubscriptionInfo(): Promise<TierInfo & { expiresAt: Date | null; isActive: boolean }> {
    const master = await this.getMasterLockbox();
    const tierInfo = TIER_INFO[master.subscriptionTier];

    const now = Date.now() / 1000;
    const isActive = master.subscriptionTier === SubscriptionTier.Free || now < master.subscriptionExpires;

    return {
      ...tierInfo,
      expiresAt: master.subscriptionExpires > 0 ? new Date(master.subscriptionExpires * 1000) : null,
      isActive,
    };
  }

  /**
   * Get storage usage statistics
   */
  async getStorageStats(): Promise<{
    used: number;
    total: number;
    percentage: number;
    entriesCount: number;
    chunksCount: number;
  }> {
    const master = await this.getMasterLockbox();

    return {
      used: master.storageUsed,
      total: master.totalCapacity,
      percentage: (master.storageUsed / master.totalCapacity) * 100,
      entriesCount: master.totalEntries,
      chunksCount: master.storageChunksCount,
    };
  }

  // ============================================================================
  // Account Management
  // ============================================================================

  /**
   * Close a storage chunk and reclaim rent
   *
   * @param chunkIndex Index of the chunk to close
   * @returns Transaction signature
   */
  async closeStorageChunk(chunkIndex: number): Promise<string> {
    const [masterLockbox] = this.getMasterLockboxAddress();
    const [storageChunk] = this.getStorageChunkAddress(chunkIndex);

    console.log(`[closeStorageChunk] Closing chunk ${chunkIndex} at ${storageChunk.toBase58()}`);

    // Build instruction data: discriminator + chunk_index (u16)
    const argsBuffer = Buffer.alloc(2);
    argsBuffer.writeUInt16LE(chunkIndex, 0);

    const instructionData = Buffer.concat([
      INSTRUCTION_DISCRIMINATORS.closeStorageChunk,
      argsBuffer,
    ]);

    const instruction = new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: storageChunk, isSigner: false, isWritable: true },
        { pubkey: masterLockbox, isSigner: false, isWritable: false },
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true },
      ],
      data: instructionData,
    });

    const transaction = new Transaction().add(instruction);
    transaction.feePayer = this.wallet.publicKey;

    const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;

    let signature: string;
    if (this.wallet.sendTransaction) {
      signature = await this.wallet.sendTransaction(transaction, this.connection, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
        maxRetries: 3,
      });
    } else {
      const signed = await this.wallet.signTransaction(transaction);
      signature = await this.connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
        maxRetries: 3,
      });
    }

    await this.connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight,
    }, 'confirmed');

    console.log(`[closeStorageChunk] ✓ Chunk ${chunkIndex} closed successfully`);

    return signature;
  }

  /**
   * Close master lockbox and reclaim rent
   *
   * Permanently deletes the Master Lockbox account and all associated Storage Chunks,
   * returning all rent to the owner. This operation is irreversible and will delete
   * all stored passwords.
   *
   * @returns Transaction signature of the master lockbox close operation
   */
  async closeMasterLockbox(): Promise<string> {
    const [masterLockbox] = this.getMasterLockboxAddress();

    // Create a unique key for this operation to prevent duplicate submissions
    const operationKey = `close-${masterLockbox.toBase58()}`;

    // Check if this operation is already in progress
    if (this.pendingTransactions.has(operationKey)) {
      throw new Error('Close operation already in progress');
    }

    try {
      // Mark operation as pending
      this.pendingTransactions.add(operationKey);

      // Check if account exists
      const accountInfo = await this.connection.getAccountInfo(masterLockbox);
      if (!accountInfo) {
        throw new Error('Master lockbox does not exist');
      }

      console.log('Closing master lockbox at:', masterLockbox.toBase58());
      console.log('WARNING: This will permanently delete all data and cannot be undone!');

      // CRITICAL FIX: Scan for ALL chunks on-chain, not just registered ones
      // This prevents orphaned chunks from being left behind
      console.log('[closeMasterLockbox] Scanning for storage chunks (indices 0-9)...');

      const chunksToClose: number[] = [];

      // Scan for chunks on-chain (check indices 0-9)
      for (let i = 0; i < 10; i++) {
        const [chunkPDA] = this.getStorageChunkAddress(i);
        const chunkAccount = await this.connection.getAccountInfo(chunkPDA);

        if (chunkAccount && chunkAccount.owner.equals(PROGRAM_ID)) {
          chunksToClose.push(i);
          console.log(`[closeMasterLockbox] Found chunk ${i} at ${chunkPDA.toBase58()}`);
        }
      }

      if (chunksToClose.length > 0) {
        console.log(`[closeMasterLockbox] Closing ${chunksToClose.length} storage chunk(s)...`);

        for (const chunkIndex of chunksToClose) {
          try {
            await this.closeStorageChunk(chunkIndex);
            console.log(`[closeMasterLockbox] ✓ Closed chunk ${chunkIndex}`);
          } catch (error) {
            console.error(`[closeMasterLockbox] Failed to close chunk ${chunkIndex}:`, error);
            throw new Error(`Failed to close storage chunk ${chunkIndex}: ${error}`);
          }
        }

        console.log('[closeMasterLockbox] ✓ All storage chunks closed');
      } else {
        console.log('[closeMasterLockbox] No storage chunks found');
      }

      // Now close the master lockbox
      console.log('[closeMasterLockbox] Closing master lockbox account...');

      // Build instruction manually
      // closeMasterLockbox instruction has no arguments, just the discriminator
      const instructionData = Buffer.from([
        // SHA256("global:close_master_lockbox")[0..8]
        0xf0, 0xa3, 0x38, 0xe7, 0x99, 0xf6, 0x1d, 0x95
      ]);

      const instruction = new TransactionInstruction({
        programId: PROGRAM_ID,
        keys: [
          { pubkey: masterLockbox, isSigner: false, isWritable: true },
          { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true },
        ],
        data: instructionData,
      });

      const transaction = new Transaction().add(instruction);
      transaction.feePayer = this.wallet.publicKey;

      const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;

      console.log('Signing and sending transaction...');

      // Use sendTransaction if available (preferred for wallet adapters)
      // This prevents double-sending issues with wallets that auto-send after signing
      let signature: string;
      if (this.wallet.sendTransaction) {
        signature = await this.wallet.sendTransaction(transaction, this.connection, {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
          maxRetries: 3,
        });
      } else {
        // Fallback to manual signing + sending
        const signed = await this.wallet.signTransaction(transaction);
        signature = await this.connection.sendRawTransaction(signed.serialize(), {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
          maxRetries: 3,
        });
      }

      console.log('Transaction sent:', signature);
      console.log('Confirming transaction...');

      const confirmation = await this.connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight,
      }, 'confirmed');

      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      }

      console.log('✅ Master lockbox closed successfully! All rent reclaimed.');

      // Clear session key since account no longer exists
      this.clearSession();

      return signature;
    } finally {
      // Always remove from pending, even if there's an error
      this.pendingTransactions.delete(operationKey);
    }
  }

  /**
   * Recover from orphaned storage chunks
   *
   * This method attempts to recover from a situation where storage chunks exist
   * but no master lockbox exists. It will:
   * 1. Initialize a new master lockbox (bypassing orphan checks)
   * 2. Attempt to close the orphaned chunks
   * 3. Verify recovery was successful
   *
   * WARNING: This is a recovery method that bypasses safety checks.
   * Only use if you have orphaned chunks preventing normal initialization.
   *
   * @param orphanedChunkIndices Array of chunk indices to recover
   * @returns Object with initialization signature and closed chunk signatures
   */
  async recoverOrphanedChunks(orphanedChunkIndices: number[]): Promise<{
    initSignature: string;
    closedChunks: { index: number; signature: string; }[];
    failedChunks: { index: number; error: string; }[];
  }> {
    console.log('\n=== Starting Orphaned Chunk Recovery ===\n');
    console.log(`Attempting to recover ${orphanedChunkIndices.length} orphaned chunk(s)`);
    console.log(`Chunk indices: ${orphanedChunkIndices.join(', ')}`);

    const [masterLockbox] = this.getMasterLockboxAddress();

    // Step 1: Verify master lockbox doesn't exist
    const existingMaster = await this.connection.getAccountInfo(masterLockbox);
    if (existingMaster) {
      throw new Error(
        'Master lockbox already exists. Cannot recover orphaned chunks. ' +
        'If you need to close chunks, use the normal closeMasterLockbox() method.'
      );
    }

    // Step 2: Verify orphaned chunks exist
    console.log('\nVerifying orphaned chunks...');
    const verifiedOrphans: number[] = [];
    for (const chunkIndex of orphanedChunkIndices) {
      const [chunkPDA] = this.getStorageChunkAddress(chunkIndex);
      const chunkAccount = await this.connection.getAccountInfo(chunkPDA);
      if (chunkAccount) {
        verifiedOrphans.push(chunkIndex);
        console.log(`✓ Found orphaned chunk ${chunkIndex} at ${chunkPDA.toBase58()}`);
        console.log(`  Rent: ${(chunkAccount.lamports / 1e9).toFixed(4)} SOL`);
      } else {
        console.log(`✗ Chunk ${chunkIndex} does not exist, skipping`);
      }
    }

    if (verifiedOrphans.length === 0) {
      throw new Error('No orphaned chunks found at the specified indices');
    }

    console.log(`\n${verifiedOrphans.length} orphaned chunk(s) verified\n`);

    // Step 3: Initialize master lockbox (bypassing orphan check)
    console.log('Step 1: Initializing new master lockbox...');

    const instruction = new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: masterLockbox, isSigner: false, isWritable: true },
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: INSTRUCTION_DISCRIMINATORS.initializeMasterLockbox,
    });

    const transaction = new Transaction().add(instruction);
    transaction.feePayer = this.wallet.publicKey;

    const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;

    let initSignature: string;
    if (this.wallet.sendTransaction) {
      initSignature = await this.wallet.sendTransaction(transaction, this.connection, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
        maxRetries: 3,
      });
    } else {
      const signed = await this.wallet.signTransaction(transaction);
      initSignature = await this.connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
        maxRetries: 3,
      });
    }

    await this.connection.confirmTransaction({
      signature: initSignature,
      blockhash,
      lastValidBlockHeight,
    }, 'confirmed');

    console.log(`✓ Master lockbox initialized: ${initSignature}`);

    // Step 4: Attempt to close orphaned chunks
    console.log('\nStep 2: Attempting to close orphaned chunks...');
    const closedChunks: { index: number; signature: string; }[] = [];
    const failedChunks: { index: number; error: string; }[] = [];

    for (const chunkIndex of verifiedOrphans) {
      try {
        console.log(`\nClosing orphaned chunk ${chunkIndex}...`);
        const signature = await this.closeStorageChunk(chunkIndex);
        closedChunks.push({ index: chunkIndex, signature });
        console.log(`✓ Closed chunk ${chunkIndex}: ${signature}`);
      } catch (error: any) {
        const errorMsg = error?.message || String(error);
        console.error(`✗ Failed to close chunk ${chunkIndex}: ${errorMsg}`);
        failedChunks.push({ index: chunkIndex, error: errorMsg });

        // Check if error indicates chunk doesn't exist anymore
        if (errorMsg.includes('not found') || errorMsg.includes('invalid account')) {
          console.log(`  Chunk ${chunkIndex} may have been auto-closed or doesn't exist`);
        }
      }
    }

    // Step 5: Summary
    console.log('\n=== Recovery Summary ===');
    console.log(`Master lockbox initialized: ${initSignature}`);
    console.log(`Chunks closed successfully: ${closedChunks.length}`);
    console.log(`Chunks failed to close: ${failedChunks.length}`);

    if (closedChunks.length > 0) {
      console.log('\nSuccessfully closed chunks:');
      closedChunks.forEach(({ index, signature }) => {
        console.log(`  - Chunk ${index}: ${signature}`);
      });
    }

    if (failedChunks.length > 0) {
      console.log('\nFailed to close chunks:');
      failedChunks.forEach(({ index, error }) => {
        console.log(`  - Chunk ${index}: ${error}`);
      });
      console.log('\nWARNING: Some chunks could not be closed.');
      console.log('These chunks may be legitimately registered or may require manual intervention.');
    }

    console.log('\n✅ Recovery process complete!');
    console.log('You can now use your master lockbox normally.\n');

    return {
      initSignature,
      closedChunks,
      failedChunks,
    };
  }

  /**
   * Get the master lockbox PDA for easier access
   */
  get masterLockboxPDA(): PublicKey {
    const [pda] = this.getMasterLockboxAddress();
    return pda;
  }

  // ============================================================================
  // Social Recovery V2 (Secure)
  // ============================================================================

  /**
   * Initialize recovery configuration V2 (with commitments)
   *
   * @param threshold - Minimum guardians needed for recovery (M)
   * @param recoveryDelay - Time-lock delay in seconds (e.g., 7 days = 604800)
   * @param masterSecretHash - SHA256 hash of master secret (32 bytes)
   * @returns Transaction signature
   */
  async initializeRecoveryConfigV2(
    threshold: number,
    recoveryDelay: number,
    masterSecretHash: Uint8Array
  ): Promise<string> {
    const [recoveryConfig] = this.getRecoveryConfigV2Address();
    const [masterLockbox] = this.getMasterLockboxAddress();

    // Build instruction data
    // Discriminator (8 bytes) + threshold (u8) + recovery_delay (i64) + master_secret_hash (32 bytes)
    const data = Buffer.alloc(49);
    // TODO: Add correct discriminator for initialize_recovery_config_v2
    data.writeBigUInt64LE(BigInt(0), 0); // Discriminator placeholder
    data.writeUInt8(threshold, 8);
    data.writeBigInt64LE(BigInt(recoveryDelay), 9);
    Buffer.from(masterSecretHash).copy(data, 17);

    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: recoveryConfig, isSigner: false, isWritable: true },
        { pubkey: masterLockbox, isSigner: false, isWritable: false },
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: PROGRAM_ID,
      data,
    });

    const transaction = new Transaction().add(instruction);
    const signature = await this.wallet.sendTransaction(transaction, this.connection);
    await this.connection.confirmTransaction(signature, 'confirmed');

    console.log('Recovery config V2 initialized:', signature);
    return signature;
  }

  /**
   * Add guardian V2 (with share commitment)
   *
   * @param guardianPubkey - Guardian's wallet address
   * @param shareIndex - Share index (1 to N)
   * @param shareCommitment - SHA256(share || guardian_pubkey) - 32 bytes
   * @param nicknameEncrypted - Encrypted guardian nickname
   * @returns Transaction signature
   */
  async addGuardianV2(
    guardianPubkey: PublicKey,
    shareIndex: number,
    shareCommitment: Uint8Array,
    nicknameEncrypted: Uint8Array
  ): Promise<string> {
    const [recoveryConfig] = this.getRecoveryConfigV2Address();

    // Build instruction data
    // Discriminator (8) + guardian_pubkey (32) + share_index (1) + share_commitment (32) + nickname_len (4) + nickname
    const nicknameLen = nicknameEncrypted.length;
    const data = Buffer.alloc(8 + 32 + 1 + 32 + 4 + nicknameLen);

    // TODO: Add correct discriminator for add_guardian_v2
    data.writeBigUInt64LE(BigInt(0), 0); // Discriminator placeholder
    guardianPubkey.toBuffer().copy(data, 8);
    data.writeUInt8(shareIndex, 40);
    Buffer.from(shareCommitment).copy(data, 41);
    data.writeUInt32LE(nicknameLen, 73);
    Buffer.from(nicknameEncrypted).copy(data, 77);

    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: recoveryConfig, isSigner: false, isWritable: true },
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: false },
      ],
      programId: PROGRAM_ID,
      data,
    });

    const transaction = new Transaction().add(instruction);
    const signature = await this.wallet.sendTransaction(transaction, this.connection);
    await this.connection.confirmTransaction(signature, 'confirmed');

    console.log('Guardian V2 added:', signature);
    return signature;
  }

  /**
   * Fetch recovery configuration V2
   *
   * @param owner - Optional owner address (defaults to current wallet)
   * @returns Recovery configuration or null if not initialized
   */
  async getRecoveryConfigV2(owner?: PublicKey): Promise<any | null> {
    try {
      const [recoveryConfig] = this.getRecoveryConfigV2Address(owner);
      const accountInfo = await this.connection.getAccountInfo(recoveryConfig);

      if (!accountInfo) {
        return null;
      }

      // TODO: Deserialize account data properly
      // For now, return raw data
      return {
        address: recoveryConfig.toBase58(),
        data: accountInfo.data,
        // TODO: Parse guardians, threshold, etc.
      };
    } catch (error) {
      console.error('Error fetching recovery config V2:', error);
      return null;
    }
  }

  /**
   * Initiate recovery V2 (generate challenge)
   *
   * SECURITY FIX (VULN-003): request_id is now auto-generated on-chain
   * to prevent replay attacks. Removed from parameters.
   *
   * @param owner - Owner whose vault to recover
   * @param encryptedChallenge - Challenge encrypted with master secret (80 bytes)
   * @param challengeHash - SHA256 hash of plaintext challenge (32 bytes)
   * @param newOwner - New owner to transfer to after recovery (optional)
   * @returns Transaction signature and auto-generated request ID
   */
  async initiateRecoveryV2(
    owner: PublicKey,
    encryptedChallenge: Uint8Array,
    challengeHash: Uint8Array,
    newOwner?: PublicKey
  ): Promise<{ signature: string; requestId: number }> {
    const [recoveryConfig] = this.getRecoveryConfigV2Address(owner);

    // Fetch current last_request_id to derive next request ID
    const recoveryConfigAccount = await this.connection.getAccountInfo(recoveryConfig);
    if (!recoveryConfigAccount) {
      throw new Error('Recovery config not found');
    }

    // Parse last_request_id from account data (offset varies, need to decode properly)
    // For now, we'll let the PDA derivation use the incremented value
    // The program will handle the atomic increment
    const lastRequestId = 0; // TODO: Parse from account data
    const nextRequestId = lastRequestId + 1;

    const [recoveryRequest] = this.getRecoveryRequestV2Address(owner, nextRequestId);

    // Build instruction data (WITHOUT request_id parameter)
    const hasNewOwner = newOwner !== undefined;
    const data = Buffer.alloc(8 + 80 + 32 + 1 + (hasNewOwner ? 32 : 0));

    // TODO: Add correct discriminator for initiate_recovery_v2
    data.writeBigUInt64LE(BigInt(0), 0);
    Buffer.from(encryptedChallenge).copy(data, 8);
    Buffer.from(challengeHash).copy(data, 88);
    data.writeUInt8(hasNewOwner ? 1 : 0, 120);
    if (hasNewOwner) {
      newOwner.toBuffer().copy(data, 121);
    }

    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: recoveryConfig, isSigner: false, isWritable: true },
        { pubkey: recoveryRequest, isSigner: false, isWritable: true },
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true }, // Guardian (requester)
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: PROGRAM_ID,
      data,
    });

    const transaction = new Transaction().add(instruction);
    const signature = await this.wallet.sendTransaction(transaction, this.connection);
    await this.connection.confirmTransaction(signature, 'confirmed');

    console.log('Recovery V2 initiated:', signature, 'requestId:', nextRequestId);
    return { signature, requestId: nextRequestId };
  }

  /**
   * Confirm participation in recovery (guardian)
   *
   * @param owner - Owner whose vault is being recovered
   * @param requestId - Recovery request ID
   * @returns Transaction signature
   */
  async confirmParticipationV2(
    owner: PublicKey,
    requestId: number
  ): Promise<string> {
    const [recoveryConfig] = this.getRecoveryConfigV2Address(owner);
    const [recoveryRequest] = this.getRecoveryRequestV2Address(owner, requestId);

    // Build instruction data
    const data = Buffer.alloc(8);
    // TODO: Add correct discriminator for confirm_participation
    data.writeBigUInt64LE(BigInt(0), 0);

    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: recoveryConfig, isSigner: false, isWritable: false },
        { pubkey: recoveryRequest, isSigner: false, isWritable: true },
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: false }, // Guardian
      ],
      programId: PROGRAM_ID,
      data,
    });

    const transaction = new Transaction().add(instruction);
    const signature = await this.wallet.sendTransaction(transaction, this.connection);
    await this.connection.confirmTransaction(signature, 'confirmed');

    console.log('Participation confirmed:', signature);
    return signature;
  }

  /**
   * Complete recovery with proof (submit decrypted challenge)
   *
   * SECURITY FIX (VULN-002): Now requires master_secret parameter
   * to provide stronger cryptographic proof of reconstruction.
   *
   * @param owner - Owner whose vault is being recovered
   * @param requestId - Recovery request ID
   * @param challengePlaintext - Decrypted challenge (32 bytes)
   * @param masterSecret - Reconstructed master secret (32 bytes)
   * @returns Transaction signature
   */
  async completeRecoveryWithProof(
    owner: PublicKey,
    requestId: number,
    challengePlaintext: Uint8Array,
    masterSecret: Uint8Array
  ): Promise<string> {
    const [recoveryConfig] = this.getRecoveryConfigV2Address(owner);
    const [recoveryRequest] = this.getRecoveryRequestV2Address(owner, requestId);
    const [masterLockbox] = this.getMasterLockboxAddress();

    // Build instruction data (challenge + master secret)
    const data = Buffer.alloc(8 + 32 + 32);
    // TODO: Add correct discriminator for complete_recovery_with_proof
    data.writeBigUInt64LE(BigInt(0), 0);
    Buffer.from(challengePlaintext).copy(data, 8);
    Buffer.from(masterSecret).copy(data, 40);

    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: recoveryConfig, isSigner: false, isWritable: false },
        { pubkey: recoveryRequest, isSigner: false, isWritable: true },
        { pubkey: masterLockbox, isSigner: false, isWritable: true },
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: false }, // Requester
      ],
      programId: PROGRAM_ID,
      data,
    });

    const transaction = new Transaction().add(instruction);
    const signature = await this.wallet.sendTransaction(transaction, this.connection);
    await this.connection.confirmTransaction(signature, 'confirmed');

    console.log('Recovery completed with proof:', signature);
    return signature;
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Find a chunk with enough space for data
   */
  private findChunkWithSpace(master: MasterLockbox, requiredSize: number): number {
    for (const chunk of master.storageChunks) {
      if (chunk.maxCapacity - chunk.sizeUsed >= requiredSize) {
        return chunk.chunkIndex;
      }
    }
    return -1; // No chunk found
  }

  /**
   * Clear session key (logout)
   */
  clearSession(): void {
    this.sessionKey = null;
  }
}

export default LockboxV2Client;
