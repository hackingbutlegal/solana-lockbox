/**
 * Recovery Script for Wallet: 465Av5qxktim1iN9p54k41MbRGPe2nqCfyVYwB2EF84J
 *
 * This script recovers orphaned storage chunk 0 from a previous failed account closure.
 *
 * Orphaned Chunk Details:
 * - Chunk Index: 0
 * - Chunk Address: CJGC88t7zGeY3BTDjraGgThbSA4Mm3kdbBrKwqLYmcVy
 * - Rent Locked: 0.0088 SOL
 * - Master Lockbox PDA: 57m2s41uiiyHX1kqrrbgAxnqgjEwRyxNJN1dwELGbobz (currently doesn't exist)
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { LockboxV2Client } from './sdk/src/client-v2';

const WALLET_ADDRESS = '465Av5qxktim1iN9p54k41MbRGPe2nqCfyVYwB2EF84J';
const ORPHANED_CHUNKS = [0]; // Chunk index 0 is orphaned
const NETWORK = 'https://api.devnet.solana.com';

/**
 * Run recovery for this wallet
 */
async function recoverWallet465Av5() {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║         Orphaned Chunk Recovery - Wallet 465Av5...            ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  console.log(`Wallet: ${WALLET_ADDRESS}`);
  console.log(`Network: Devnet`);
  console.log(`Orphaned Chunks: ${ORPHANED_CHUNKS.join(', ')}\n`);

  // Check if we're in browser environment
  if (typeof window === 'undefined') {
    console.error('❌ This script must be run in a browser environment with wallet access.');
    console.error('\nTo use this script:');
    console.error('1. Open your application in the browser');
    console.error('2. Connect wallet: 465Av5qxktim1iN9p54k41MbRGPe2nqCfyVYwB2EF84J');
    console.error('3. Open browser console (F12)');
    console.error('4. Run: window.recoverWallet465Av5()');
    return;
  }

  // Get wallet from browser
  const wallet = (window as any).solana;

  if (!wallet) {
    throw new Error(
      'No wallet found. Please install Phantom or Solflare wallet extension.'
    );
  }

  // Connect wallet
  try {
    await wallet.connect();
  } catch (error) {
    console.error('Failed to connect wallet:', error);
    throw error;
  }

  const connectedAddress = wallet.publicKey.toBase58();
  console.log(`Connected wallet: ${connectedAddress}`);

  // Verify correct wallet is connected
  if (connectedAddress !== WALLET_ADDRESS) {
    throw new Error(
      `Wrong wallet connected!\n` +
      `Expected: ${WALLET_ADDRESS}\n` +
      `Connected: ${connectedAddress}\n\n` +
      `Please switch to the correct wallet and try again.`
    );
  }

  console.log('✓ Correct wallet connected\n');

  // Create connection and client
  const connection = new Connection(NETWORK, 'confirmed');
  const client = new LockboxV2Client({
    connection,
    wallet,
  });

  // Check wallet balance
  const balance = await connection.getBalance(wallet.publicKey);
  console.log(`Wallet balance: ${(balance / 1e9).toFixed(4)} SOL`);

  if (balance < 50000) { // ~0.00005 SOL for transaction fees
    throw new Error(
      'Insufficient balance for transaction fees. Please add SOL to your wallet.'
    );
  }

  console.log('✓ Sufficient balance for recovery\n');

  // Verify orphaned chunk exists before recovery
  console.log('Pre-recovery verification...');
  const [masterLockbox] = client.getMasterLockboxAddress();
  console.log(`Master Lockbox PDA: ${masterLockbox.toBase58()}`);

  const masterInfo = await connection.getAccountInfo(masterLockbox);
  if (masterInfo) {
    throw new Error(
      'Master lockbox already exists! Recovery not needed.\n' +
      'If you need to close chunks, use the normal closeMasterLockbox() method.'
    );
  }
  console.log('✓ Master lockbox does not exist (expected)\n');

  // Check orphaned chunk
  for (const chunkIndex of ORPHANED_CHUNKS) {
    const [chunkPDA] = client.getStorageChunkAddress(chunkIndex);
    const chunkInfo = await connection.getAccountInfo(chunkPDA);

    if (!chunkInfo) {
      console.warn(`⚠️  Chunk ${chunkIndex} doesn't exist - skipping`);
      continue;
    }

    console.log(`✓ Orphaned chunk ${chunkIndex} verified:`);
    console.log(`  Address: ${chunkPDA.toBase58()}`);
    console.log(`  Rent: ${(chunkInfo.lamports / 1e9).toFixed(4)} SOL\n`);
  }

  // Confirm with user
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('Ready to start recovery. This will:');
  console.log('1. Initialize a new master lockbox');
  console.log('2. Close orphaned storage chunk 0');
  console.log('3. Reclaim ~0.0088 SOL rent');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Perform recovery
  console.log('Starting recovery...\n');

  try {
    const result = await client.recoverOrphanedChunks(ORPHANED_CHUNKS);

    // Display results
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║                    RECOVERY SUCCESSFUL!                        ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    console.log('📊 Recovery Summary:\n');
    console.log(`✅ Master lockbox initialized`);
    console.log(`   Transaction: ${result.initSignature}`);
    console.log(`   Explorer: https://explorer.solana.com/tx/${result.initSignature}?cluster=devnet\n`);

    console.log(`✅ Chunks closed: ${result.closedChunks.length}`);
    result.closedChunks.forEach(({ index, signature }) => {
      console.log(`   - Chunk ${index}`);
      console.log(`     Transaction: ${signature}`);
      console.log(`     Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
    });

    if (result.failedChunks.length > 0) {
      console.log(`\n⚠️  Chunks failed: ${result.failedChunks.length}`);
      result.failedChunks.forEach(({ index, error }) => {
        console.log(`   - Chunk ${index}: ${error}`);
      });
    }

    const totalReclaimed = result.closedChunks.length * 0.0088;
    console.log(`\n💰 Total rent reclaimed: ~${totalReclaimed.toFixed(4)} SOL\n`);

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('✅ Recovery complete! Your lockbox is ready to use.');
    console.log('═══════════════════════════════════════════════════════════════\n');

    return result;
  } catch (error: any) {
    console.error('\n╔════════════════════════════════════════════════════════════════╗');
    console.error('║                    RECOVERY FAILED!                            ║');
    console.error('╚════════════════════════════════════════════════════════════════╝\n');

    console.error('Error:', error.message);

    if (error.logs) {
      console.error('\nTransaction logs:');
      error.logs.forEach((log: string) => console.error(`  ${log}`));
    }

    console.error('\n💡 Troubleshooting:');
    console.error('1. Ensure you have sufficient SOL for transaction fees');
    console.error('2. Try again - network issues can cause temporary failures');
    console.error('3. Check Solana network status: https://status.solana.com/');
    console.error('4. If problem persists, contact support with error details above\n');

    throw error;
  }
}

// Browser usage
if (typeof window !== 'undefined') {
  (window as any).recoverWallet465Av5 = recoverWallet465Av5;
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║  Recovery script loaded for wallet 465Av5...                   ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');
  console.log('To start recovery, run:');
  console.log('  window.recoverWallet465Av5()\n');
  console.log('Make sure you are connected with wallet:');
  console.log(`  ${WALLET_ADDRESS}\n`);
}

export { recoverWallet465Av5 };
