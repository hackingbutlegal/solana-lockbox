/**
 * Fix orphaned storage chunk
 *
 * This script handles the case where a storage chunk account exists
 * but isn't registered in the master lockbox metadata.
 */

import { Connection, PublicKey, Transaction, TransactionInstruction, Keypair } from '@solana/web3.js';
import { AnchorProvider, Wallet } from '@coral-xyz/anchor';

const PROGRAM_ID = new PublicKey('7JxsHjdReydiz36jwsWuvwwR28qqK6V454VwFJnnSkoB');
const RPC_URL = 'https://api.devnet.solana.com';

// Instruction discriminator for close_storage_chunk (if it exists)
// Since we don't have this instruction, we'll need to work around it

async function main() {
  const connection = new Connection(RPC_URL, 'confirmed');
  const walletPubkey = new PublicKey('465Av5qxktim1iN9p54k41MbRGPe2nqCfyVYwB2EF84J');

  // Find PDAs
  const [masterLockbox] = PublicKey.findProgramAddressSync(
    [Buffer.from('master_lockbox'), walletPubkey.toBuffer()],
    PROGRAM_ID
  );

  const indexBuffer = Buffer.alloc(2);
  indexBuffer.writeUInt16LE(0);
  const [storageChunk0] = PublicKey.findProgramAddressSync(
    [Buffer.from('storage_chunk'), masterLockbox.toBuffer(), indexBuffer],
    PROGRAM_ID
  );

  console.log('Checking accounts...');
  console.log('Master lockbox:', masterLockbox.toBase58());
  console.log('Storage chunk 0:', storageChunk0.toBase58());

  // Check master lockbox state
  const masterData = await connection.getAccountInfo(masterLockbox);
  if (!masterData) {
    console.error('Master lockbox not found!');
    return;
  }

  const data = masterData.data.slice(8); // Skip discriminator
  const storageChunksCount = data.readUInt16LE(40 + 8); // offset to storage_chunks_count
  const vecLength = data.readUInt32LE(40 + 8 + 2 + 1 + 8 + 8 + 8 + 8); // offset to vec length

  console.log('\nMaster lockbox state:');
  console.log('  storage_chunks_count:', storageChunksCount);
  console.log('  storage_chunks vec length:', vecLength);

  // Check chunk state
  const chunkData = await connection.getAccountInfo(storageChunk0);
  if (!chunkData) {
    console.log('\n✓ Storage chunk 0 does not exist - ready to create!');
    console.log('\nTo fix: Just try to store a password again in the UI.');
    console.log('The client will detect that no chunk exists and create it properly.');
  } else {
    console.log('\n✗ Storage chunk 0 EXISTS but is not registered in master lockbox!');
    console.log('  Balance:', chunkData.lamports / 1e9, 'SOL');
    console.log('  Size:', chunkData.data.length, 'bytes');
    console.log('\nThis is an orphaned chunk. Unfortunately, we cannot close it without');
    console.log('a close_storage_chunk instruction in the program.');
    console.log('\nWorkaround: Create a new master lockbox with a different wallet,');
    console.log('or contact the program admin to add a close instruction and upgrade.');

    // The only way to recover is to:
    // 1. Add a close_storage_chunk instruction to the program
    // 2. Upgrade the program
    // 3. Close the orphaned chunk
    // 4. Recreate it properly

    console.log('\n=== IMMEDIATE FIX ===');
    console.log('Since this is devnet, the easiest solution is to close and recreate');
    console.log('the master lockbox. Run these commands:');
    console.log('\n1. Close master lockbox (if close instruction exists):');
    console.log('   // Use the UI or SDK to call closeMasterLockbox()');
    console.log('\n2. Initialize fresh:');
    console.log('   // Use the UI to initialize a new master lockbox');
  }
}

main().catch(console.error);
