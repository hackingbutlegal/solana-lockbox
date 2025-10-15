/**
 * Close orphaned storage chunk using the close_storage_chunk instruction
 */

import { Connection, PublicKey, Transaction, TransactionInstruction, SystemProgram, Keypair } from '@solana/web3.js';
import { AnchorProvider, Wallet } from '@coral-xyz/anchor';

const PROGRAM_ID = new PublicKey('7JxsHjdReydiz36jwsWuvwwR28qqK6V454VwFJnnSkoB');
const RPC_URL = 'https://api.devnet.solana.com';
const WALLET_PUBKEY = new PublicKey('465Av5qxktim1iN9p54k41MbRGPe2nqCfyVYwB2EF84J');

// Discriminator for close_storage_chunk
const CLOSE_STORAGE_CHUNK_DISCRIMINATOR = Buffer.from([0x79, 0xb6, 0xfd, 0x51, 0x67, 0xd2, 0x2e, 0xe9]);

async function main() {
  const connection = new Connection(RPC_URL, 'confirmed');

  // Find PDAs
  const [masterLockbox] = PublicKey.findProgramAddressSync(
    [Buffer.from('master_lockbox'), WALLET_PUBKEY.toBuffer()],
    PROGRAM_ID
  );

  const indexBuffer = Buffer.alloc(2);
  indexBuffer.writeUInt16LE(0); // Chunk index 0
  const [storageChunk0] = PublicKey.findProgramAddressSync(
    [Buffer.from('storage_chunk'), masterLockbox.toBuffer(), indexBuffer],
    PROGRAM_ID
  );

  console.log('=== Close Orphaned Storage Chunk ===\n');
  console.log('Master lockbox:', masterLockbox.toBase58());
  console.log('Storage chunk 0:', storageChunk0.toBase58());
  console.log('Wallet:', WALLET_PUBKEY.toBase58());

  // Check chunk exists
  const chunkInfo = await connection.getAccountInfo(storageChunk0);
  if (!chunkInfo) {
    console.log('\n✓ Storage chunk does not exist - nothing to close!');
    return;
  }

  console.log('\nStorage chunk exists:');
  console.log('  Balance:', chunkInfo.lamports / 1e9, 'SOL');
  console.log('  Size:', chunkInfo.data.length, 'bytes');

  // Build instruction data: discriminator + chunk_index (u16)
  const argsBuffer = Buffer.alloc(2);
  argsBuffer.writeUInt16LE(0); // chunk_index = 0

  const instructionData = Buffer.concat([
    CLOSE_STORAGE_CHUNK_DISCRIMINATOR,
    argsBuffer,
  ]);

  // Build instruction
  const instruction = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: masterLockbox, isSigner: false, isWritable: true },
      { pubkey: storageChunk0, isSigner: false, isWritable: true },
      { pubkey: WALLET_PUBKEY, isSigner: true, isWritable: true },
    ],
    data: instructionData,
  });

  console.log('\n=== Transaction Details ===');
  console.log('Instruction discriminator:', CLOSE_STORAGE_CHUNK_DISCRIMINATOR.toString('hex'));
  console.log('Chunk index:', 0);
  console.log('\nAccounts:');
  console.log('  1. Master Lockbox:', masterLockbox.toBase58(), '(writable)');
  console.log('  2. Storage Chunk:', storageChunk0.toBase58(), '(writable)');
  console.log('  3. Owner:', WALLET_PUBKEY.toBase58(), '(signer, writable)');

  console.log('\n========================================');
  console.log('READY TO CLOSE');
  console.log('========================================');
  console.log('This transaction will:');
  console.log('  1. Close storage chunk 0');
  console.log('  2. Return', chunkInfo.lamports / 1e9, 'SOL to your wallet');
  console.log('  3. Remove chunk from master lockbox registry');
  console.log('\nTo execute, you need to sign this transaction with your wallet.');
  console.log('You can do this by:');
  console.log('  1. Calling closeStorageChunk(0) from the UI');
  console.log('  2. Or using the SDK directly with wallet signing');
}

main().catch(console.error);
