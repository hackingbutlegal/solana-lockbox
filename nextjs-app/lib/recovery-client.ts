/**
 * Recovery Client - Read-Only Lockbox Access
 *
 * This client provides read-only access to passwords using backup codes
 * and recovery keys. It does NOT require wallet connection.
 *
 * Security Model:
 * - Uses recovery key (from recovery password) for decryption
 * - No wallet access = cannot modify data
 * - Fetches data directly from blockchain via RPC
 */

import { Connection, PublicKey } from '@solana/web3.js';
import * as nacl from 'tweetnacl';
import * as util from 'tweetnacl-util';
import { PasswordEntry, MasterLockbox, StorageChunk } from '../sdk/src/types-v2';
import { deserializeEntry, DataCorruptionError, SchemaValidationError } from '../sdk/src/schema';

// Same as in client-v2.ts
const PROGRAM_ID = new PublicKey('7JxsHjdReydiz36jwsWuvwwR28qqK6V454VwFJnnSkoB');
const MASTER_LOCKBOX_SEED = 'master_lockbox';
const STORAGE_CHUNK_SEED = 'storage_chunk';

/**
 * Recovery-specific error for missing recovery key
 */
export class RecoveryKeyRequiredError extends Error {
  constructor() {
    super('Recovery key is required for decryption. Please authenticate with your recovery password.');
    this.name = 'RecoveryKeyRequiredError';
  }
}

/**
 * Recovery Client for read-only password access
 */
export class RecoveryClient {
  private connection: Connection;
  private walletPublicKey: PublicKey;
  private recoveryKey: Uint8Array | null = null;

  constructor(walletPublicKey: PublicKey, rpcUrl: string = 'https://api.devnet.solana.com') {
    this.connection = new Connection(rpcUrl, 'confirmed');
    this.walletPublicKey = walletPublicKey;
  }

  /**
   * Set the recovery key for decryption
   */
  setRecoveryKey(recoveryKey: Uint8Array): void {
    if (recoveryKey.length !== 32) {
      throw new Error('Recovery key must be 32 bytes');
    }
    this.recoveryKey = recoveryKey;
  }

  /**
   * Get master lockbox PDA address
   */
  private getMasterLockboxAddress(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from(MASTER_LOCKBOX_SEED),
        this.walletPublicKey.toBuffer(),
      ],
      PROGRAM_ID
    );
  }

  /**
   * Get storage chunk PDA address
   */
  private getStorageChunkAddress(chunkIndex: number): [PublicKey, number] {
    const indexBuffer = Buffer.alloc(2);
    indexBuffer.writeUInt16LE(chunkIndex, 0);

    return PublicKey.findProgramAddressSync(
      [
        Buffer.from(STORAGE_CHUNK_SEED),
        this.walletPublicKey.toBuffer(),
        indexBuffer,
      ],
      PROGRAM_ID
    );
  }

  /**
   * Fetch master lockbox account data
   */
  async getMasterLockbox(): Promise<MasterLockbox> {
    const [address] = this.getMasterLockboxAddress();
    const accountInfo = await this.connection.getAccountInfo(address);

    if (!accountInfo) {
      throw new Error('Master lockbox not found. Has the account been initialized?');
    }

    // Deserialize master lockbox data (Borsh format)
    const data = accountInfo.data;

    try {
      // Skip discriminator (8 bytes) and start from offset 0 in sliced data
      const slicedData = data.slice(8);
      let offset = 0;

      // Read owner (32 bytes)
      const owner = new PublicKey(slicedData.slice(offset, offset + 32));
      offset += 32;

      // Read total_entries (u64, 8 bytes)
      const totalEntries = Number(slicedData.readBigUInt64LE(offset));
      offset += 8;

      // Read storage_chunks_count (u16, 2 bytes)
      const storageChunksCount = slicedData.readUInt16LE(offset);
      offset += 2;

      // Read subscription_tier (u8, 1 byte)
      const subscriptionTier = slicedData.readUInt8(offset);
      offset += 1;

      // Read last_accessed (i64, 8 bytes)
      const lastAccessed = Number(slicedData.readBigInt64LE(offset));
      offset += 8;

      // Read subscription_expires (i64, 8 bytes)
      const subscriptionExpiry = Number(slicedData.readBigInt64LE(offset));
      offset += 8;

      // Read total_capacity (u64, 8 bytes)
      const totalCapacity = Number(slicedData.readBigUInt64LE(offset));
      offset += 8;

      // Read storage_used (u64, 8 bytes)
      const storageUsed = Number(slicedData.readBigUInt64LE(offset));
      offset += 8;

      // Read storage_chunks vec (4-byte length + items)
      const storageChunksLen = slicedData.readUInt32LE(offset);
      offset += 4;
      const storageChunks = [];

      // Read each StorageChunkInfo
      for (let i = 0; i < storageChunksLen; i++) {
        // chunk_address (32 bytes)
        const chunkAddress = new PublicKey(slicedData.slice(offset, offset + 32));
        offset += 32;

        // chunk_index (u16, 2 bytes)
        const chunkIndex = slicedData.readUInt16LE(offset);
        offset += 2;

        // max_capacity (u32, 4 bytes)
        offset += 4; // Skip

        // size_used (u32, 4 bytes)
        offset += 4; // Skip

        // data_type (u8, 1 byte)
        offset += 1; // Skip

        // created_at (i64, 8 bytes)
        offset += 8; // Skip

        // last_modified (i64, 8 bytes)
        offset += 8; // Skip

        storageChunks.push({ chunkIndex, chunkAddress });
      }

      // Read encrypted_index vec (4-byte length + data)
      const encryptedIndexLen = slicedData.readUInt32LE(offset);
      offset += 4;
      offset += encryptedIndexLen; // Skip encrypted index data

      // Read next_entry_id (u64, 8 bytes)
      const nextEntryId = Number(slicedData.readBigUInt64LE(offset));
      offset += 8;

      // Read categories_count (u32, 4 bytes)
      offset += 4; // Skip

      // Read created_at (i64, 8 bytes)
      const createdAt = Number(slicedData.readBigInt64LE(offset));
      offset += 8;

      // Skip bump (u8, 1 byte) - don't need to read it

      return {
        owner,
        subscriptionTier,
        subscriptionExpiry,
        storageChunks,
        nextEntryId,
        totalEntries,
        createdAt,
        lastAccessed,
      };
    } catch (error) {
      if (error instanceof RangeError) {
        throw new Error('Unable to deserialize master lockbox. This may indicate an empty vault or incompatible data format.');
      }
      throw error;
    }
  }

  /**
   * Fetch storage chunk account data
   */
  async getStorageChunk(chunkIndex: number): Promise<StorageChunk> {
    const [address] = this.getStorageChunkAddress(chunkIndex);
    const accountInfo = await this.connection.getAccountInfo(address);

    if (!accountInfo) {
      throw new Error(`Storage chunk ${chunkIndex} not found`);
    }

    const data = accountInfo.data;
    let offset = 8; // Skip discriminator

    // Read owner (32 bytes)
    const owner = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;

    // Read chunk_index (2 bytes, u16)
    const chunkIndexRead = data.readUInt16LE(offset);
    offset += 2;

    // Read storage_type (1 byte, u8)
    const storageType = data[offset];
    offset += 1;

    // Read entry_headers length (4 bytes, u32)
    const entryHeadersLength = data.readUInt32LE(offset);
    offset += 4;

    // Read entry headers
    const entryHeaders = [];
    for (let i = 0; i < entryHeadersLength; i++) {
      const entryId = Number(data.readBigUInt64LE(offset));
      offset += 8;
      const offset_val = data.readUInt32LE(offset);
      offset += 4;
      const size = data.readUInt32LE(offset);
      offset += 4;
      const createdAt = Number(data.readBigInt64LE(offset));
      offset += 8;
      const lastModified = Number(data.readBigInt64LE(offset));
      offset += 8;
      const accessCount = Number(data.readBigUInt64LE(offset));
      offset += 8;

      entryHeaders.push({
        entryId,
        offset: offset_val,
        size,
        createdAt,
        lastModified,
        accessCount,
      });
    }

    // Read encrypted_data length (4 bytes, u32)
    const encryptedDataLength = data.readUInt32LE(offset);
    offset += 4;

    // Read encrypted_data
    const encryptedData = data.slice(offset, offset + encryptedDataLength);
    offset += encryptedDataLength;

    // Read bytes_used (4 bytes, u32)
    const bytesUsed = data.readUInt32LE(offset);
    offset += 4;

    // Read created_at (8 bytes, i64)
    const createdAt = Number(data.readBigInt64LE(offset));
    offset += 8;

    // Read last_modified (8 bytes, i64)
    const lastModified = Number(data.readBigInt64LE(offset));

    return {
      owner,
      chunkIndex: chunkIndexRead,
      storageType,
      entryHeaders,
      encryptedData,
      bytesUsed,
      createdAt,
      lastModified,
    };
  }

  /**
   * Decrypt a password entry using recovery key
   */
  private decryptEntry(ciphertext: Uint8Array, key: Uint8Array): PasswordEntry | null {
    // Extract nonce from the first 24 bytes
    const nonce = ciphertext.slice(0, 24);
    const encrypted = ciphertext.slice(24);

    const decrypted = nacl.secretbox.open(encrypted, nonce, key);
    if (!decrypted) {
      console.error('Decryption failed: Authentication tag mismatch');
      return null;
    }

    try {
      const json = util.encodeUTF8(decrypted);
      return deserializeEntry(json) as PasswordEntry;
    } catch (error) {
      if (error instanceof DataCorruptionError) {
        console.error('Data corruption detected:', error.message);
        throw error;
      } else if (error instanceof SchemaValidationError) {
        console.error('Schema validation failed:', error.message);
        throw error;
      } else {
        console.error('Unknown error during decryption:', error);
        throw new Error('Failed to deserialize password entry');
      }
    }
  }

  /**
   * List all passwords (read-only)
   */
  async listPasswords(): Promise<{
    entries: PasswordEntry[];
    errors: Array<{ entryId: number; chunkIndex: number; error: string }>;
  }> {
    if (!this.recoveryKey) {
      throw new RecoveryKeyRequiredError();
    }

    const master = await this.getMasterLockbox();
    const entries: PasswordEntry[] = [];
    const errors: Array<{ entryId: number; chunkIndex: number; error: string }> = [];

    // Fetch all chunks in parallel
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
      if (!chunk) continue;

      const chunkInfo = master.storageChunks[i];

      for (const header of chunk.entryHeaders) {
        try {
          // Extract encrypted data
          const encryptedEntry = chunk.encryptedData.slice(
            header.offset,
            header.offset + header.size
          );

          // Decrypt with recovery key
          const entry = this.decryptEntry(encryptedEntry, this.recoveryKey);

          if (entry) {
            entry.id = header.entryId;
            entry.createdAt = new Date(header.createdAt * 1000);
            entry.lastModified = new Date(header.lastModified * 1000);
            entry.accessCount = header.accessCount;
            entries.push(entry);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);

          if (error instanceof DataCorruptionError) {
            errors.push({
              entryId: header.entryId,
              chunkIndex: chunkInfo.chunkIndex,
              error: `Data corruption: ${errorMessage}`,
            });
          } else if (error instanceof SchemaValidationError) {
            errors.push({
              entryId: header.entryId,
              chunkIndex: chunkInfo.chunkIndex,
              error: `Invalid schema: ${errorMessage}`,
            });
          } else {
            errors.push({
              entryId: header.entryId,
              chunkIndex: chunkInfo.chunkIndex,
              error: `Decryption failed: ${errorMessage}`,
            });
          }

          console.error(`Failed to decrypt entry ${header.entryId}:`, error);
        }
      }
    }

    return { entries, errors };
  }

  /**
   * Export passwords to JSON format
   */
  exportToJSON(entries: PasswordEntry[]): string {
    const exportData = {
      exportedAt: new Date().toISOString(),
      version: '2.0',
      source: 'Solana Lockbox Recovery Console',
      totalEntries: entries.length,
      entries: entries.map(entry => ({
        id: entry.id,
        title: entry.title,
        username: entry.username,
        password: entry.password,
        url: entry.url,
        notes: entry.notes,
        category: entry.category,
        tags: entry.tags,
        isFavorite: entry.isFavorite,
        createdAt: entry.createdAt?.toISOString(),
        lastModified: entry.lastModified?.toISOString(),
      })),
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Export passwords to CSV format
   */
  exportToCSV(entries: PasswordEntry[]): string {
    const headers = ['ID', 'Title', 'Username', 'Password', 'URL', 'Notes', 'Category', 'Tags', 'Favorite', 'Created', 'Modified'];
    const rows = entries.map(entry => [
      entry.id?.toString() || '',
      entry.title || '',
      entry.username || '',
      entry.password || '',
      entry.url || '',
      entry.notes?.replace(/\n/g, ' ') || '',
      entry.category || '',
      entry.tags?.join(';') || '',
      entry.isFavorite ? 'Yes' : 'No',
      entry.createdAt?.toISOString() || '',
      entry.lastModified?.toISOString() || '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    return csvContent;
  }

  /**
   * Download file helper
   */
  downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
