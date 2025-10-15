/**
 * Test script to diagnose closure issues
 *
 * This script will:
 * 1. Check current master lockbox state
 * 2. List all storage chunks
 * 3. Simulate the closure process step-by-step
 * 4. Verify each step completes correctly
 *
 * Run with: npx tsx test-closure.ts <wallet-address>
 */

import { Connection, PublicKey } from '@solana/web3.js';

const PROGRAM_ID = new PublicKey('7JxsHjdReydiz36jwsWuvwwR28qqK6V454VwFJnnSkoB');
const DEVNET_RPC = 'https://api.devnet.solana.com';

function deriveMasterLockboxAddress(owner: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('master_lockbox'), owner.toBuffer()],
    PROGRAM_ID
  );
}

function deriveStorageChunkAddress(masterLockbox: PublicKey, chunkIndex: number): [PublicKey, number] {
  const indexBuffer = Buffer.alloc(2);
  indexBuffer.writeUInt16LE(chunkIndex);

  return PublicKey.findProgramAddressSync(
    [Buffer.from('storage_chunk'), masterLockbox.toBuffer(), indexBuffer],
    PROGRAM_ID
  );
}

async function testClosure(walletAddress: string) {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║          Closure Process Diagnostic Test                       ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  const connection = new Connection(DEVNET_RPC, 'confirmed');
  const ownerPubkey = new PublicKey(walletAddress);

  console.log(`Wallet: ${walletAddress}`);
  console.log(`Network: Devnet\n`);

  // Step 1: Check master lockbox
  console.log('Step 1: Checking master lockbox state...');
  const [masterLockbox] = deriveMasterLockboxAddress(ownerPubkey);
  console.log(`Master Lockbox PDA: ${masterLockbox.toBase58()}`);

  const masterInfo = await connection.getAccountInfo(masterLockbox);

  if (!masterInfo) {
    console.log('❌ Master lockbox does NOT exist');
    console.log('\n→ This means the account has been closed.');
    console.log('→ Checking for orphaned chunks...\n');
  } else {
    console.log('✓ Master lockbox EXISTS');
    console.log(`  Owner: ${PROGRAM_ID.toBase58()}`);
    console.log(`  Lamports: ${masterInfo.lamports / 1e9} SOL`);
    console.log(`  Data length: ${masterInfo.data.length} bytes\n`);

    // Try to deserialize storage chunks from master lockbox
    try {
      const data = masterInfo.data.slice(8); // Skip discriminator
      let offset = 0;

      // Skip owner (32 bytes)
      offset += 32;

      // Skip total_entries (u64, 8 bytes)
      offset += 8;

      // Read storage_chunks_count (u16, 2 bytes)
      const storageChunksCount = data.readUInt16LE(offset);
      offset += 2;

      console.log(`Master lockbox has ${storageChunksCount} chunk(s) registered\n`);
    } catch (error) {
      console.error('Failed to read master lockbox data:', error);
    }
  }

  // Step 2: Scan for storage chunks (both registered and orphaned)
  console.log('Step 2: Scanning for storage chunks...');
  console.log('Checking chunks 0-9...\n');

  const foundChunks: { index: number; address: string; lamports: number; orphaned: boolean }[] = [];

  for (let i = 0; i < 10; i++) {
    const [chunkPDA] = deriveStorageChunkAddress(masterLockbox, i);
    const chunkInfo = await connection.getAccountInfo(chunkPDA);

    if (chunkInfo) {
      const isOrphaned = !masterInfo; // If master doesn't exist, all chunks are orphaned
      foundChunks.push({
        index: i,
        address: chunkPDA.toBase58(),
        lamports: chunkInfo.lamports,
        orphaned: isOrphaned
      });

      const status = isOrphaned ? '⚠️  ORPHANED' : '✓ Registered';
      console.log(`${status} Chunk ${i}`);
      console.log(`  Address: ${chunkPDA.toBase58()}`);
      console.log(`  Rent: ${(chunkInfo.lamports / 1e9).toFixed(4)} SOL`);
      console.log(`  Data length: ${chunkInfo.data.length} bytes\n`);
    }
  }

  if (foundChunks.length === 0) {
    console.log('✓ No storage chunks found\n');
  }

  // Step 3: Summary
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const orphanedChunks = foundChunks.filter(c => c.orphaned);
  const registeredChunks = foundChunks.filter(c => !c.orphaned);

  console.log(`Master Lockbox: ${masterInfo ? 'EXISTS' : 'CLOSED'}`);
  console.log(`Total Chunks Found: ${foundChunks.length}`);
  console.log(`Registered Chunks: ${registeredChunks.length}`);
  console.log(`Orphaned Chunks: ${orphanedChunks.length}`);

  if (orphanedChunks.length > 0) {
    const totalRent = orphanedChunks.reduce((sum, c) => sum + c.lamports, 0);
    console.log(`\n⚠️  Total Rent Locked in Orphaned Chunks: ${(totalRent / 1e9).toFixed(4)} SOL`);
    console.log('\nOrphaned chunk indices:', orphanedChunks.map(c => c.index).join(', '));
  }

  // Step 4: Diagnosis
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('DIAGNOSIS');
  console.log('═══════════════════════════════════════════════════════════════\n');

  if (!masterInfo && orphanedChunks.length > 0) {
    console.log('🔴 PROBLEM DETECTED:');
    console.log('   Master lockbox has been closed, but storage chunks still exist.');
    console.log('   This indicates the closure process did NOT close the chunks first.\n');
    console.log('Possible causes:');
    console.log('  1. closeMasterLockbox() loop was skipped or failed');
    console.log('  2. Rust program close_storage_chunk instruction is not working');
    console.log('  3. Transactions were sent but not confirmed properly');
    console.log('  4. Browser console logs should show what happened during closure\n');
  } else if (!masterInfo && orphanedChunks.length === 0) {
    console.log('✅ CLEAN CLOSURE:');
    console.log('   Master lockbox closed and no orphaned chunks found.');
    console.log('   The closure process worked correctly!\n');
  } else if (masterInfo && foundChunks.length > 0) {
    console.log('ℹ️  NORMAL STATE:');
    console.log('   Master lockbox exists with registered chunks.');
    console.log('   Account is active and functional.\n');
  } else if (masterInfo && foundChunks.length === 0) {
    console.log('✅ INITIALIZED STATE:');
    console.log('   Master lockbox exists with no chunks yet.');
    console.log('   Account is initialized and ready to use.\n');
  }

  console.log('═══════════════════════════════════════════════════════════════\n');
}

// Run the test
const walletAddress = process.argv[2];

if (!walletAddress) {
  console.error('Usage: npx tsx test-closure.ts <wallet-address>');
  process.exit(1);
}

testClosure(walletAddress).catch(error => {
  console.error('\n❌ Test failed:', error);
  process.exit(1);
});
