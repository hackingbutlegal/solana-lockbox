/**
 * Lockbox v2.0 Client - Password Manager
 *
 * Provides a comprehensive interface for the multi-tier password manager.
 */

import { Program, AnchorProvider, BN, Idl } from '@coral-xyz/anchor';
import { Connection, PublicKey, SystemProgram, Keypair, TransactionInstruction, Transaction } from '@solana/web3.js';
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
import {
  PROGRAM_ID,
  SIGNATURE_MESSAGE,
  AEAD,
  INSTRUCTION_DISCRIMINATORS,
} from './constants';
import IDL from '../idl/lockbox-v2.json';

export const FEE_RECEIVER = PROGRAM_ID;

/**
 * Main client for Lockbox v2.0 Password Manager
 */
export class LockboxV2Client {
  readonly program: Program;
  readonly connection: Connection;
  readonly wallet: any;
  readonly feeReceiver: PublicKey;

  // Static WeakMap for secure session storage
  private static sessionKeys = new WeakMap<object, Uint8Array>();
  private sessionKeyRef = {}; // Unique object reference for this client instance

  constructor(options: LockboxV2ClientOptions) {
    this.connection = options.connection;
    this.wallet = options.wallet;
    this.feeReceiver = options.feeReceiver || FEE_RECEIVER;

    const provider = new AnchorProvider(
      this.connection,
      this.wallet,
      { commitment: 'confirmed' }
    );

    // Initialize program with IDL
    try {
      this.program = new Program(IDL as unknown as Idl, provider);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to initialize Lockbox v2 program. ` +
        `This may indicate an IDL version mismatch or corrupted IDL file. ` +
        `Error: ${errorMsg}`
      );
    }
  }

  // ============================================================================
  // Session Key Management
  // ============================================================================

  /**
   * Get stored session key from WeakMap
   */
  private getStoredSessionKey(): Uint8Array | null {
    return LockboxV2Client.sessionKeys.get(this.sessionKeyRef) || null;
  }

  /**
   * Store session key in WeakMap
   */
  private setStoredSessionKey(key: Uint8Array): void {
    LockboxV2Client.sessionKeys.set(this.sessionKeyRef, key);
  }

  /**
   * Clear stored session key from WeakMap
   */
  private clearStoredSessionKey(): void {
    LockboxV2Client.sessionKeys.delete(this.sessionKeyRef);
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
    const storedKey = this.getStoredSessionKey();
    if (storedKey) {
      return storedKey;
    }

    const message = util.decodeUTF8(SIGNATURE_MESSAGE);
    const signature = await this.wallet.signMessage(message);

    // Derive session key from signature
    const hash = nacl.hash(signature);
    const sessionKey = hash.slice(0, 32);

    this.setStoredSessionKey(sessionKey);

    return sessionKey;
  }

  /**
   * Encrypt password entry data
   */
  private encryptEntry(entry: PasswordEntry, key: Uint8Array): { ciphertext: Uint8Array; nonce: Uint8Array } {
    const json = JSON.stringify(entry);
    const nonce = nacl.randomBytes(24);
    const messageUint8 = util.decodeUTF8(json);
    const ciphertext = nacl.secretbox(messageUint8, nonce, key);

    return { ciphertext, nonce };
  }

  /**
   * Decrypt password entry data
   */
  private decryptEntry(ciphertext: Uint8Array, key: Uint8Array): PasswordEntry | null {
    // Extract nonce from the first 24 bytes
    const nonce = ciphertext.slice(0, 24);
    const encrypted = ciphertext.slice(24);

    const decrypted = nacl.secretbox.open(encrypted, nonce, key);
    if (!decrypted) {
      return null;
    }

    try {
      return JSON.parse(util.encodeUTF8(decrypted));
    } catch {
      return null;
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
   * Initialize a new master lockbox for the user
   *
   * Creates the main account that coordinates all storage chunks and manages
   * subscription tier, capacity limits, and metadata. This is the first step
   * required before storing any passwords.
   *
   * @returns Transaction signature
   * @throws {Error} If master lockbox already exists
   * @throws {Error} If wallet has insufficient balance for rent
   * @throws {Error} If RPC call fails
   *
   * @example
   * ```typescript
   * const signature = await client.initializeMasterLockbox();
   * console.log('Master lockbox created:', signature);
   * ```
   */
  async initializeMasterLockbox(): Promise<string> {
    const [masterLockbox, bump] = this.getMasterLockboxAddress();

    // Check if already exists
    try {
      await this.connection.getAccountInfo(masterLockbox);
      throw new Error('Master lockbox already initialized');
    } catch (e) {
      // Account doesn't exist, proceed with initialization
    }

    const tx = await (this.program.methods as any)
      .initializeMasterLockbox()
      .accounts({
        masterLockbox,
        owner: this.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return tx;
  }

  /**
   * Initialize a new storage chunk
   */
  async initializeStorageChunk(chunkIndex: number, initialCapacity: number = 1024): Promise<string> {
    const [masterLockbox] = this.getMasterLockboxAddress();
    const [storageChunk] = this.getStorageChunkAddress(chunkIndex);

    const tx = await (this.program.methods as any)
      .initializeStorageChunk(chunkIndex, initialCapacity, StorageType.Passwords)
      .accounts({
        masterLockbox,
        storageChunk,
        owner: this.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return tx;
  }

  // ============================================================================
  // Password Entry Operations
  // ============================================================================

  /**
   * Store a new password entry
   *
   * Encrypts the password entry using XChaCha20-Poly1305 AEAD with a session key
   * derived from the user's wallet signature. The encrypted data is stored on-chain
   * in the appropriate storage chunk based on available capacity.
   *
   * @param entry - Password entry to store (title, username, password, url, notes)
   * @returns Object containing transaction signature and assigned entry ID
   * @throws {Error} If entry data exceeds maximum size
   * @throws {Error} If user has reached subscription tier storage limit
   * @throws {Error} If encryption or RPC call fails
   *
   * @example
   * ```typescript
   * const result = await client.storePassword({
   *   title: 'GitHub',
   *   username: 'myuser',
   *   password: 'secret123',
   *   url: 'https://github.com',
   *   notes: 'Work account',
   *   type: PasswordEntryType.Login,
   *   category: 0
   * });
   * console.log('Entry stored with ID:', result.entryId);
   * ```
   */
  async storePassword(entry: PasswordEntry): Promise<{ txSignature: string; entryId: number }> {
    const sessionKey = await this.getSessionKey();

    // Encrypt the entry
    const { ciphertext, nonce } = this.encryptEntry(entry, sessionKey);

    // Combine nonce + ciphertext for storage
    const combined = new Uint8Array(nonce.length + ciphertext.length);
    combined.set(nonce);
    combined.set(ciphertext, nonce.length);

    // Generate blind index for title
    const titleHash = this.generateTitleHash(entry.title, sessionKey);

    // Get master lockbox to find appropriate chunk
    const master = await this.getMasterLockbox();
    const chunkIndex = this.findChunkWithSpace(master, combined.length);

    if (chunkIndex === -1) {
      // Need to create a new chunk
      await this.initializeStorageChunk(master.storageChunksCount);
    }

    const [masterLockbox] = this.getMasterLockboxAddress();
    const [storageChunk] = this.getStorageChunkAddress(chunkIndex);

    const tx = await (this.program.methods as any)
      .storePasswordEntry(
        chunkIndex,
        Buffer.from(combined),
        entry.type || PasswordEntryType.Login,
        entry.category || 0,
        titleHash
      )
      .accounts({
        masterLockbox,
        storageChunk,
        owner: this.wallet.publicKey,
      })
      .rpc();

    // Fetch updated master to get entry ID
    const updatedMaster = await this.getMasterLockbox();
    const entryId = updatedMaster.nextEntryId - 1;

    return { txSignature: tx, entryId };
  }

  /**
   * Retrieve and decrypt a password entry by ID
   *
   * Fetches the encrypted entry from on-chain storage and decrypts it using the
   * session key derived from the user's wallet signature. The entry's access count
   * is incremented on-chain.
   *
   * @param chunkIndex - Storage chunk index containing the entry
   * @param entryId - Unique entry identifier
   * @returns Decrypted password entry or null if decryption fails
   * @throws {Error} If entry does not exist
   * @throws {Error} If RPC call fails
   *
   * @example
   * ```typescript
   * const entry = await client.retrievePassword(0, 42);
   * if (entry) {
   *   console.log('Password:', entry.password);
   * }
   * ```
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
   * List all password entries
   *
   * Retrieves and decrypts all password entries from all storage chunks.
   * Returns both successfully retrieved entries and any errors encountered.
   *
   * @returns Object containing entries array and errors array
   *
   * @example
   * ```typescript
   * const { entries, errors } = await client.listPasswords();
   * console.log(`Retrieved ${entries.length} entries`);
   * if (errors.length > 0) {
   *   console.error(`Failed to retrieve ${errors.length} entries:`, errors);
   * }
   * ```
   */
  async listPasswords(): Promise<{ entries: PasswordEntry[]; errors: Error[] }> {
    const master = await this.getMasterLockbox();
    const entries: PasswordEntry[] = [];
    const errors: Error[] = [];

    for (const chunkInfo of master.storageChunks) {
      try {
        const chunk = await this.getStorageChunk(chunkInfo.chunkIndex);

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
          } catch (e) {
            const error = e instanceof Error ? e : new Error(String(e));
            error.message = `Failed to retrieve entry ${header.entryId}: ${error.message}`;
            errors.push(error);
          }
        }
      } catch (e) {
        const error = e instanceof Error ? e : new Error(String(e));
        error.message = `Failed to access chunk ${chunkInfo.chunkIndex}: ${error.message}`;
        errors.push(error);
      }
    }

    return { entries, errors };
  }

  // ============================================================================
  // Subscription Management
  // ============================================================================

  /**
   * Upgrade subscription tier
   *
   * Upgrades the user's subscription to a higher tier, increasing storage capacity
   * and feature limits. Payment is made via SOL transfer to the fee receiver.
   * The subscription expires after 30 days and must be renewed.
   *
   * @param newTier - Target subscription tier (Basic, Premium, or Enterprise)
   * @returns Transaction signature
   * @throws {Error} If attempting to downgrade (use downgradeSubscription instead)
   * @throws {Error} If wallet has insufficient SOL balance for payment
   * @throws {Error} If RPC call fails
   *
   * @example
   * ```typescript
   * import { SubscriptionTier } from './types-v2';
   * const signature = await client.upgradeSubscription(SubscriptionTier.Premium);
   * console.log('Upgraded to Premium tier:', signature);
   * ```
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
        { pubkey: this.feeReceiver, isSigner: false, isWritable: true },
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
        { pubkey: this.feeReceiver, isSigner: false, isWritable: true },
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

  // ============================================================================
  // Account Queries
  // ============================================================================

  /**
   * Get master lockbox account
   */
  async getMasterLockbox(): Promise<MasterLockbox> {
    // Check if program is properly initialized
    if (!this.program.account) {
      throw new Error('Program not initialized - IDL not loaded');
    }

    const [masterLockbox] = this.getMasterLockboxAddress();
    return await (this.program.account as any).masterLockbox.fetch(masterLockbox);
  }

  /**
   * Get storage chunk account
   */
  async getStorageChunk(chunkIndex: number): Promise<StorageChunk> {
    // Check if program is properly initialized
    if (!this.program.account) {
      throw new Error('Program not initialized - IDL not loaded');
    }

    const [storageChunk] = this.getStorageChunkAddress(chunkIndex);
    return await (this.program.account as any).storageChunk.fetch(storageChunk);
  }

  /**
   * Check if master lockbox exists
   */
  async exists(): Promise<boolean> {
    // If program not initialized, we can't check
    if (!this.program.account) {
      return false;
    }

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
   * Retry an RPC call with exponential backoff
   *
   * Automatically retries failed RPC calls with exponentially increasing delays.
   * Useful for handling transient network errors and rate limiting.
   *
   * @param fn - Async function to retry
   * @param maxRetries - Maximum number of retry attempts (default: 3)
   * @param backoffMs - Base backoff delay in milliseconds (default: 1000)
   * @returns Result from successful function call
   * @throws {Error} Last error if all retries fail
   *
   * @example
   * ```typescript
   * const account = await this.retryRpcCall(
   *   () => this.connection.getAccountInfo(address),
   *   3,
   *   1000
   * );
   * ```
   */
  private async retryRpcCall<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    backoffMs: number = 1000
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < maxRetries - 1) {
          // Exponential backoff: 1s, 2s, 4s
          await new Promise(resolve => setTimeout(resolve, backoffMs * Math.pow(2, attempt)));
        }
      }
    }

    throw lastError || new Error('RPC call failed after retries');
  }

  /**
   * Clear session key (logout)
   *
   * Removes the cached session key, requiring a new wallet signature on the next
   * encrypted operation. This is important for security when switching accounts
   * or ending a session.
   *
   * WARNING: After calling this method, you will need to sign a message with your
   * wallet again to derive a new session key. Any pending operations using the old
   * session key will fail.
   *
   * @example
   * ```typescript
   * // Clear session when user logs out
   * client.clearSession();
   * console.log('Session cleared - wallet signature required for next operation');
   * ```
   */
  clearSession(): void {
    this.clearStoredSessionKey();
  }
}

export default LockboxV2Client;
