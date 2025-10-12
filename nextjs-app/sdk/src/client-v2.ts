/**
 * Lockbox v2.0 Client - Password Manager
 *
 * Provides a comprehensive interface for the multi-tier password manager.
 */

import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import { Connection, PublicKey, SystemProgram, Keypair } from '@solana/web3.js';
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

export const PROGRAM_ID = new PublicKey('7JxsHjdReydiz36jwsWuvwwR28qqK6V454VwFJnnSkoB');
export const FEE_RECEIVER = PROGRAM_ID;

/**
 * Main client for Lockbox v2.0 Password Manager
 */
export class LockboxV2Client {
  readonly program: Program;
  readonly connection: Connection;
  readonly wallet: any;
  readonly feeReceiver: PublicKey;
  private sessionKey: Uint8Array | null = null;

  constructor(options: LockboxV2ClientOptions) {
    this.connection = options.connection;
    this.wallet = options.wallet;
    this.feeReceiver = options.feeReceiver || FEE_RECEIVER;

    const provider = new AnchorProvider(
      this.connection,
      this.wallet,
      { commitment: 'confirmed' }
    );

    // Note: Program initialization would use IDL when available
    this.program = {} as Program; // Placeholder
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
   * Initialize master lockbox for the user
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
   * List all password entries
   */
  async listPasswords(): Promise<PasswordEntry[]> {
    const master = await this.getMasterLockbox();
    const entries: PasswordEntry[] = [];

    for (const chunkInfo of master.storageChunks) {
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
          console.error(`Failed to retrieve entry ${header.entryId}:`, e);
        }
      }
    }

    return entries;
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
   * Clear session key (logout)
   */
  clearSession(): void {
    this.sessionKey = null;
  }
}

export default LockboxV2Client;
