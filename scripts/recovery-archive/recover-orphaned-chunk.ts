/**
 * Recovery script for orphaned storage chunks
 *
 * This script attempts to close orphaned storage chunks that prevent
 * master lockbox initialization.
 */

import { Connection, PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';
import { LockboxV2Client } from './sdk/src/client-v2';

const PROGRAM_ID = new PublicKey('7JxsHjdReydiz36jwsWuvwwR28qqK6V454VwFJnnSkoB');
const CLOSE_STORAGE_CHUNK_DISCRIMINATOR = Buffer.from([0x79, 0xb6, 0xfd, 0x51, 0x67, 0xd2, 0x2e, 0xe9]);

/**
 * Derive storage chunk PDA
 */
function deriveStorageChunkAddress(
  masterLockboxAddress: PublicKey,
  chunkIndex: number
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from('storage_chunk'),
      masterLockboxAddress.toBuffer(),
      Buffer.from([chunkIndex]),
    ],
    PROGRAM_ID
  );
}

/**
 * Derive master lockbox PDA
 */
function deriveMasterLockboxAddress(owner: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('master_lockbox'), owner.toBuffer()],
    PROGRAM_ID
  );
}

/**
 * Attempt to close an orphaned storage chunk
 */
async function closeOrphanedChunk(
  connection: Connection,
  wallet: any,
  chunkIndex: number
): Promise<string> {
  console.log(`\n=== Attempting to close orphaned chunk ${chunkIndex} ===\n`);

  const [masterLockbox] = deriveMasterLockboxAddress(wallet.publicKey);
  const [storageChunk] = deriveStorageChunkAddress(masterLockbox, chunkIndex);

  console.log(`Owner: ${wallet.publicKey.toBase58()}`);
  console.log(`Master Lockbox (derived): ${masterLockbox.toBase58()}`);
  console.log(`Storage Chunk ${chunkIndex}: ${storageChunk.toBase58()}`);

  // Check if accounts exist
  const masterInfo = await connection.getAccountInfo(masterLockbox);
  const chunkInfo = await connection.getAccountInfo(storageChunk);

  console.log(`\nMaster Lockbox exists: ${masterInfo !== null}`);
  console.log(`Storage Chunk exists: ${chunkInfo !== null}`);

  if (!chunkInfo) {
    throw new Error(`Storage chunk ${chunkIndex} does not exist at ${storageChunk.toBase58()}`);
  }

  console.log(`Chunk rent balance: ${(chunkInfo.lamports / 1e9).toFixed(4)} SOL`);

  // Build close instruction
  const argsBuffer = Buffer.alloc(2);
  argsBuffer.writeUInt16LE(chunkIndex, 0);

  const instructionData = Buffer.concat([
    CLOSE_STORAGE_CHUNK_DISCRIMINATOR,
    argsBuffer,
  ]);

  console.log(`\nBuilding close instruction...`);
  console.log(`Discriminator: ${CLOSE_STORAGE_CHUNK_DISCRIMINATOR.toString('hex')}`);
  console.log(`Chunk Index: ${chunkIndex}`);

  const instruction = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: masterLockbox, isSigner: false, isWritable: true },
      { pubkey: storageChunk, isSigner: false, isWritable: true },
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
    ],
    data: instructionData,
  });

  const transaction = new Transaction().add(instruction);
  transaction.feePayer = wallet.publicKey;

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  transaction.recentBlockhash = blockhash;

  console.log(`\nSending transaction...`);

  try {
    let signature: string;

    if (wallet.sendTransaction) {
      signature = await wallet.sendTransaction(transaction, connection, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
        maxRetries: 3,
      });
    } else if (wallet.signTransaction) {
      const signed = await wallet.signTransaction(transaction);
      signature = await connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
        maxRetries: 3,
      });
    } else {
      throw new Error('Wallet does not support signing transactions');
    }

    console.log(`Transaction sent: ${signature}`);
    console.log(`Confirming...`);

    await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight,
    }, 'confirmed');

    console.log(`\n✓ Successfully closed orphaned chunk ${chunkIndex}!`);
    console.log(`Transaction: https://explorer.solana.com/tx/${signature}?cluster=devnet`);

    // Verify chunk is closed
    const verifyInfo = await connection.getAccountInfo(storageChunk);
    if (verifyInfo === null) {
      console.log(`✓ Verified: Chunk account no longer exists`);
    } else {
      console.log(`⚠ Warning: Chunk account still exists (may need time to propagate)`);
    }

    return signature;
  } catch (error: any) {
    console.error(`\n✗ Failed to close chunk:`, error);

    if (error.logs) {
      console.error('\nProgram logs:');
      error.logs.forEach((log: string) => console.error(`  ${log}`));
    }

    throw error;
  }
}

/**
 * Main recovery function
 */
async function recoverOrphanedChunks() {
  console.log('=== Orphaned Chunk Recovery Tool ===\n');

  // Setup (you'll need to provide wallet)
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

  // NOTE: You need to connect your wallet here
  // For browser: use window.solana
  // For CLI: use Keypair.fromSecretKey() with your secret key

  const wallet = (window as any).solana; // For browser environment

  if (!wallet) {
    throw new Error('No wallet found. Please connect your wallet.');
  }

  await wallet.connect();
  console.log(`Connected wallet: ${wallet.publicKey.toBase58()}\n`);

  // Try to close chunk 0 (the orphaned one)
  try {
    await closeOrphanedChunk(connection, wallet, 0);

    console.log('\n✓ Recovery complete!');
    console.log('You should now be able to initialize your master lockbox.');
  } catch (error) {
    console.error('\n✗ Recovery failed:', error);
    console.error('\nThis may require one of the following:');
    console.error('1. The program may not allow closing chunks without a valid master lockbox');
    console.error('2. You may need to contact program authority to manually drain the account');
    console.error('3. A program upgrade may be needed to add orphan recovery functionality');
  }
}

// Export for use in scripts or browser console
export { closeOrphanedChunk, recoverOrphanedChunks };

// Auto-run if executed directly
if (typeof window !== 'undefined') {
  console.log('Recovery script loaded. Run recoverOrphanedChunks() to start.');
  (window as any).recoverOrphanedChunks = recoverOrphanedChunks;
  (window as any).closeOrphanedChunk = closeOrphanedChunk;
}
