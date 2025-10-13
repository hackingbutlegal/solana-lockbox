/**
 * Lockbox v2.0 Client - Password Manager
 *
 * Provides a comprehensive interface for the multi-tier password manager.
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
export const FEE_RECEIVER = PROGRAM_ID;

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
};

/**
 * Main client for Lockbox v2.0 Password Manager
 */
export class LockboxV2Client {
  readonly program: Program;
  readonly connection: Connection;
  readonly wallet: any;
  readonly feeReceiver: PublicKey;
  private sessionKey: Uint8Array | null = null;
  private pendingTransactions: Set<string> = new Set();

  constructor(options: LockboxV2ClientOptions) {
    this.connection = options.connection;
    this.wallet = options.wallet;
    this.feeReceiver = options.feeReceiver || FEE_RECEIVER;

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
      return deserializeEntry(json);
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

    // Check if chunk already exists (from a previous failed transaction)
    const existingChunk = await this.connection.getAccountInfo(storageChunk);
    if (existingChunk) {
      console.log(`[initializeStorageChunk] Chunk ${chunkIndex} already exists at ${storageChunk.toBase58()}, skipping initialization`);
      return 'chunk-already-exists';
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
    transaction.recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash;

    try {
      const signed = await this.wallet.signTransaction(transaction);
      const signature = await this.connection.sendRawTransaction(signed.serialize());

      await this.connection.confirmTransaction(signature, 'confirmed');

      console.log(`[initializeStorageChunk] Chunk ${chunkIndex} created successfully`);

      return signature;
    } catch (error: any) {
      // Check if error is "account already in use" - this can happen with RPC data lag
      const errorMsg = error?.message || String(error);
      if (errorMsg.includes('already in use') || errorMsg.includes('0x0')) {
        console.log(`[initializeStorageChunk] Chunk ${chunkIndex} already exists (caught during transaction), continuing...`);
        return 'chunk-exists-error-caught';
      }
      // Re-throw other errors
      throw error;
    }
  }

  // ============================================================================
  // Password Entry Operations
  // ============================================================================

  /**
   * Store a new password entry
   */
  async storePassword(entry: PasswordEntry): Promise<{ txSignature: string; entryId: number }> {
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
      const entryId = Number(updatedMaster.nextEntryId) - 1;

      console.log(`[storePassword] Entry ID: ${entryId}`);

      return { txSignature: signature, entryId };
    } catch (error: any) {
      console.error('[storePassword] Transaction failed with error:', error);
      console.error('[storePassword] Error name:', error?.name);
      console.error('[storePassword] Error message:', error?.message);
      console.error('[storePassword] Error stack:', error?.stack);

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
      if (error?.logs && error.logs.length > 0) {
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
  }

  /**
   * Retrieve a password entry by ID
   */
  async retrievePassword(chunkIndex: number, entryId: number): Promise<PasswordEntry | null> {
    const sessionKey = await this.getSessionKey();

    const [masterLockbox] = this.getMasterLockboxAddress();
    const [storageChunk] = this.getStorageChunkAddress(chunkIndex);

    const encryptedData = await (this.program.methods as any)
      .retrievePasswordEntry(chunkIndex, new BN(entryId))
      .accounts({
        masterLockbox,
        storageChunk,
        owner: this.wallet.publicKey,
      })
      .view();

    return this.decryptEntry(new Uint8Array(encryptedData), sessionKey);
  }

  /**
   * Update an existing password entry
   */
  async updatePassword(chunkIndex: number, entryId: number, updatedEntry: PasswordEntry): Promise<string> {
    const sessionKey = await this.getSessionKey();

    const { ciphertext, nonce } = this.encryptEntry(updatedEntry, sessionKey);
    const combined = new Uint8Array(nonce.length + ciphertext.length);
    combined.set(nonce);
    combined.set(ciphertext, nonce.length);

    const [masterLockbox] = this.getMasterLockboxAddress();
    const [storageChunk] = this.getStorageChunkAddress(chunkIndex);

    const tx = await (this.program.methods as any)
      .updatePasswordEntry(chunkIndex, new BN(entryId), Buffer.from(combined))
      .accounts({
        masterLockbox,
        storageChunk,
        owner: this.wallet.publicKey,
      })
      .rpc();

    return tx;
  }

  /**
   * Delete a password entry
   */
  async deletePassword(chunkIndex: number, entryId: number): Promise<string> {
    const [masterLockbox] = this.getMasterLockboxAddress();
    const [storageChunk] = this.getStorageChunkAddress(chunkIndex);

    const tx = await (this.program.methods as any)
      .deletePasswordEntry(chunkIndex, new BN(entryId))
      .accounts({
        masterLockbox,
        storageChunk,
        owner: this.wallet.publicKey,
      })
      .rpc();

    return tx;
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

    const tx = await (this.program.methods as any)
      .upgradeSubscription(newTier)
      .accounts({
        masterLockbox,
        owner: this.wallet.publicKey,
        feeReceiver: this.feeReceiver,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return tx;
  }

  /**
   * Renew current subscription
   */
  async renewSubscription(): Promise<string> {
    const [masterLockbox] = this.getMasterLockboxAddress();

    const tx = await (this.program.methods as any)
      .renewSubscription()
      .accounts({
        masterLockbox,
        owner: this.wallet.publicKey,
        feeReceiver: this.feeReceiver,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return tx;
  }

  /**
   * Downgrade to free tier
   */
  async downgradeSubscription(): Promise<string> {
    const [masterLockbox] = this.getMasterLockboxAddress();

    const tx = await (this.program.methods as any)
      .downgradeSubscription()
      .accounts({
        masterLockbox,
        owner: this.wallet.publicKey,
      })
      .rpc();

    return tx;
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
      const totalEntries = Number(data.readBigUInt64LE(offset));
      offset += 8;

      // Read storage_chunks_count (u16, 2 bytes)
      const storageChunksCount = data.readUInt16LE(offset);
      offset += 2;

      // Read subscription_tier (u8, 1 byte)
      const subscriptionTier = data.readUInt8(offset) as SubscriptionTier;
      offset += 1;

      // Read last_accessed (i64, 8 bytes)
      const lastAccessed = Number(data.readBigInt64LE(offset));
      offset += 8;

      // Read subscription_expires (i64, 8 bytes)
      const subscriptionExpires = Number(data.readBigInt64LE(offset));
      offset += 8;

      // Read total_capacity (u64, 8 bytes)
      const totalCapacity = Number(data.readBigUInt64LE(offset));
      offset += 8;

      // Read storage_used (u64, 8 bytes)
      const storageUsed = Number(data.readBigUInt64LE(offset));
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
        const chunkCreatedAt = Number(data.readBigInt64LE(offset));
        offset += 8;

        // last_modified (i64, 8 bytes)
        const lastModified = Number(data.readBigInt64LE(offset));
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
      const nextEntryId = Number(data.readBigUInt64LE(offset));
      offset += 8;

      // Read categories_count (u32, 4 bytes)
      const categoriesCount = data.readUInt32LE(offset);
      offset += 4;

      // Read created_at (i64, 8 bytes)
      const createdAt = Number(data.readBigInt64LE(offset));
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

    // Deserialize account data using Borsh
    // Skip the 8-byte discriminator that Anchor adds
    const data = accountInfo.data.slice(8);

    try {
      const schema = new Map([
        [StorageChunkBorsh, StorageChunkBorsh.schema],
        [DataEntryHeaderBorsh, DataEntryHeaderBorsh.schema],
      ]);

      const deserialized = borsh.deserialize(schema, StorageChunkBorsh, data);

      // Convert Borsh types to our TypeScript types
      return {
        masterLockbox: new PublicKey(deserialized.masterLockbox),
        owner: new PublicKey(deserialized.owner),
        chunkIndex: deserialized.chunkIndex,
        maxCapacity: deserialized.maxCapacity,
        currentSize: deserialized.currentSize,
        dataType: deserialized.dataType as StorageType,
        encryptedData: deserialized.encryptedData,
        entryHeaders: deserialized.entryHeaders.map((header: DataEntryHeaderBorsh) => ({
          entryId: Number(header.entryId),
          offset: header.offset,
          size: header.size,
          entryType: header.entryType as PasswordEntryType,
          category: header.category,
          titleHash: Array.from(header.titleHash),
          createdAt: Number(header.createdAt),
          lastModified: Number(header.lastModified),
          accessCount: header.accessCount,
          flags: header.flags,
        })),
        entryCount: deserialized.entryCount,
        createdAt: Number(deserialized.createdAt),
        lastModified: Number(deserialized.lastModified),
        bump: deserialized.bump,
      } as StorageChunk;
    } catch (error) {
      console.error('Failed to deserialize StorageChunk:', error);
      console.error('Account data length:', accountInfo.data.length);
      console.error('Data after discriminator:', data.length);
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
   * Close master lockbox and reclaim rent
   *
   * Permanently deletes the Master Lockbox account and returns all rent to the owner.
   * This operation is irreversible and will delete all stored passwords.
   *
   * @returns Transaction signature
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

      console.log('✅ Master lockbox closed successfully! Rent reclaimed.');

      // Clear session key since account no longer exists
      this.clearSession();

      return signature;
    } finally {
      // Always remove from pending, even if there's an error
      this.pendingTransactions.delete(operationKey);
    }
  }

  /**
   * Get the master lockbox PDA for easier access
   */
  get masterLockboxPDA(): PublicKey {
    const [pda] = this.getMasterLockboxAddress();
    return pda;
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
