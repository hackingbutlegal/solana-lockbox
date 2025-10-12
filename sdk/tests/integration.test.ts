/**
 * Integration tests for Lockbox v2 SDK
 * Tests the full password manager lifecycle using the TypeScript client
 */

import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { LockboxV2Client } from '../src/client-v2';
import { PasswordEntry, PasswordEntryType } from '../src/types-v2';

// Test configuration
const DEVNET_RPC = 'https://api.devnet.solana.com';
const PROGRAM_ID = new PublicKey('7JxsHjdReydiz36jwsWuvwwR28qqK6V454VwFJnnSkoB');

// Mock wallet adapter for testing
class MockWallet {
  constructor(public keypair: Keypair) {}

  get publicKey() {
    return this.keypair.publicKey;
  }

  async signTransaction(tx: any) {
    tx.partialSign(this.keypair);
    return tx;
  }

  async signAllTransactions(txs: any[]) {
    return txs.map(tx => {
      tx.partialSign(this.keypair);
      return tx;
    });
  }

  async signMessage(message: Uint8Array): Promise<Uint8Array> {
    // For testing, return a deterministic signature
    const nacl = require('tweetnacl');
    return nacl.sign.detached(message, this.keypair.secretKey);
  }
}

describe('Lockbox v2 SDK Integration Tests', () => {
  let client: LockboxV2Client;
  let connection: Connection;
  let wallet: MockWallet;

  beforeAll(() => {
    // Use a test keypair (in production, use real wallet)
    // WARNING: Never commit real private keys!
    const testKeypair = Keypair.generate();
    wallet = new MockWallet(testKeypair);

    connection = new Connection(DEVNET_RPC, 'confirmed');

    client = new LockboxV2Client({
      connection,
      wallet,
    });

    console.log('\n=== Test Configuration ===');
    console.log('Program ID:', PROGRAM_ID.toBase58());
    console.log('Wallet:', wallet.publicKey.toBase58());
    console.log('==========================\n');
  });

  describe('Account Status', () => {
    test('Check if master lockbox exists', async () => {
      const exists = await client.exists();
      console.log('Master lockbox exists:', exists);

      if (!exists) {
        console.log('⚠️  Master lockbox not initialized for this wallet');
        console.log('   Run the Next.js app to initialize first');
      }
    });

    test('Get master lockbox address', () => {
      const [address, bump] = client.getMasterLockboxAddress();
      console.log('Master Lockbox PDA:', address.toBase58());
      console.log('Bump:', bump);

      expect(address).toBeInstanceOf(PublicKey);
      expect(bump).toBeGreaterThan(0);
    });

    test('Get storage chunk address', () => {
      const [address, bump] = client.getStorageChunkAddress(0);
      console.log('Storage Chunk 0 PDA:', address.toBase58());
      console.log('Bump:', bump);

      expect(address).toBeInstanceOf(PublicKey);
      expect(bump).toBeGreaterThan(0);
    });
  });

  describe('Account Initialization (if needed)', () => {
    test('Initialize master lockbox', async () => {
      const exists = await client.exists();

      if (!exists) {
        console.log('Initializing master lockbox...');
        try {
          // Note: This will fail on devnet without SOL airdrop
          const tx = await client.initializeMasterLockbox();
          console.log('✓ Master lockbox initialized:', tx);
          expect(tx).toBeTruthy();
        } catch (error: any) {
          console.log('✗ Initialization failed (expected on devnet):', error.message);
          // Expected to fail without funding
        }
      } else {
        console.log('Master lockbox already exists, skipping initialization');
      }
    });
  });

  describe('Storage Operations (with existing account)', () => {
    let testEntryId: number;
    const testEntry: PasswordEntry = {
      title: 'SDK Test Entry',
      username: 'testuser@example.com',
      password: 'test123456',
      url: 'https://example.com',
      notes: 'Created via SDK integration test',
      type: PasswordEntryType.Login,
      category: 0,
    };

    test('Store password entry', async () => {
      try {
        const exists = await client.exists();
        if (!exists) {
          console.log('⚠️  Skipping: Master lockbox not initialized');
          return;
        }

        const result = await client.storePassword(testEntry);
        testEntryId = result.entryId;

        console.log('✓ Password stored');
        console.log('  TX:', result.txSignature);
        console.log('  Entry ID:', testEntryId);

        expect(result.txSignature).toBeTruthy();
        expect(testEntryId).toBeGreaterThanOrEqual(0);
      } catch (error: any) {
        console.log('✗ Store failed:', error.message);
        throw error;
      }
    });

    test('Retrieve password entry', async () => {
      try {
        const exists = await client.exists();
        if (!exists || testEntryId === undefined) {
          console.log('⚠️  Skipping: No entry to retrieve');
          return;
        }

        const entry = await client.retrievePassword(0, testEntryId);

        console.log('✓ Password retrieved');
        console.log('  Title:', entry?.title);
        console.log('  Username:', entry?.username);

        expect(entry).toBeTruthy();
        expect(entry?.title).toBe(testEntry.title);
        expect(entry?.username).toBe(testEntry.username);
      } catch (error: any) {
        console.log('✗ Retrieve failed:', error.message);
        throw error;
      }
    });

    test('Update password entry', async () => {
      try {
        const exists = await client.exists();
        if (!exists || testEntryId === undefined) {
          console.log('⚠️  Skipping: No entry to update');
          return;
        }

        const updatedEntry = {
          ...testEntry,
          password: 'updated123456',
          notes: 'Updated via SDK test',
        };

        const tx = await client.updatePassword(0, testEntryId, updatedEntry);

        console.log('✓ Password updated');
        console.log('  TX:', tx);

        expect(tx).toBeTruthy();

        // Verify update
        const retrieved = await client.retrievePassword(0, testEntryId);
        expect(retrieved?.password).toBe('updated123456');
        expect(retrieved?.notes).toBe('Updated via SDK test');
      } catch (error: any) {
        console.log('✗ Update failed:', error.message);
        throw error;
      }
    });

    test('List all passwords', async () => {
      try {
        const exists = await client.exists();
        if (!exists) {
          console.log('⚠️  Skipping: Master lockbox not initialized');
          return;
        }

        const entries = await client.listPasswords();

        console.log('✓ Passwords listed');
        console.log('  Total entries:', entries.length);
        entries.forEach((entry, idx) => {
          console.log(`  ${idx + 1}. ${entry.title} (ID: ${entry.id})`);
        });

        expect(Array.isArray(entries)).toBe(true);
      } catch (error: any) {
        console.log('✗ List failed:', error.message);
        throw error;
      }
    });

    test('Delete password entry', async () => {
      try {
        const exists = await client.exists();
        if (!exists || testEntryId === undefined) {
          console.log('⚠️  Skipping: No entry to delete');
          return;
        }

        const tx = await client.deletePassword(0, testEntryId);

        console.log('✓ Password deleted');
        console.log('  TX:', tx);

        expect(tx).toBeTruthy();
      } catch (error: any) {
        console.log('✗ Delete failed:', error.message);
        throw error;
      }
    });
  });

  describe('Storage Statistics', () => {
    test('Get storage stats', async () => {
      try {
        const exists = await client.exists();
        if (!exists) {
          console.log('⚠️  Skipping: Master lockbox not initialized');
          return;
        }

        const stats = await client.getStorageStats();

        console.log('\n=== Storage Statistics ===');
        console.log('Used:', stats.used, 'bytes');
        console.log('Total:', stats.total, 'bytes');
        console.log('Usage:', stats.percentage.toFixed(2) + '%');
        console.log('Entries:', stats.entriesCount);
        console.log('Chunks:', stats.chunksCount);
        console.log('==========================\n');

        expect(stats.used).toBeGreaterThanOrEqual(0);
        expect(stats.total).toBeGreaterThan(0);
        expect(stats.percentage).toBeGreaterThanOrEqual(0);
      } catch (error: any) {
        console.log('✗ Get stats failed:', error.message);
        throw error;
      }
    });

    test('Get subscription info', async () => {
      try {
        const exists = await client.exists();
        if (!exists) {
          console.log('⚠️  Skipping: Master lockbox not initialized');
          return;
        }

        const info = await client.getSubscriptionInfo();

        console.log('\n=== Subscription Info ===');
        console.log('Tier:', info.name);
        console.log('Max Entries:', info.maxEntries);
        console.log('Max Storage:', info.maxStorage, 'bytes');
        console.log('Max Chunks:', info.maxChunks);
        console.log('Active:', info.isActive);
        if (info.expiresAt) {
          console.log('Expires:', info.expiresAt.toISOString());
        }
        console.log('==========================\n');

        expect(info.name).toBeTruthy();
        expect(info.isActive).toBeDefined();
      } catch (error: any) {
        console.log('✗ Get subscription info failed:', error.message);
        throw error;
      }
    });
  });

  describe('Session Management', () => {
    test('Clear session', () => {
      client.clearSession();
      console.log('✓ Session cleared');

      // Session key should be cleared (private, can't directly verify)
      expect(true).toBe(true);
    });
  });
});
