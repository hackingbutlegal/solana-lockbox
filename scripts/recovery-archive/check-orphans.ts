/**
 * Check for orphaned storage chunks for a specific wallet
 */

import { Connection, PublicKey } from '@solana/web3.js';

const PROGRAM_ID = new PublicKey('7JxsHjdReydiz36jwsWuvwwR28qqK6V454VwFJnnSkoB');

/**
 * Derive master lockbox PDA for a wallet
 */
function deriveMasterLockboxAddress(owner: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('master_lockbox'), owner.toBuffer()],
    PROGRAM_ID
  );
}

/**
 * Derive storage chunk PDA
 */
function deriveStorageChunkAddress(
  masterLockboxAddress: PublicKey,
  chunkIndex: number
): [PublicKey, number] {
  const indexBuffer = Buffer.alloc(2);
  indexBuffer.writeUInt16LE(chunkIndex);

  return PublicKey.findProgramAddressSync(
    [Buffer.from('storage_chunk'), masterLockboxAddress.toBuffer(), indexBuffer],
    PROGRAM_ID
  );
}

/**
 * Check for orphaned chunks for a wallet
 */
async function checkOrphanedChunks(walletAddress: string) {
  console.log('\n=== Orphaned Chunk Scanner ===\n');
  console.log(`Wallet: ${walletAddress}`);
  console.log(`Network: Devnet`);
  console.log(`Program: ${PROGRAM_ID.toBase58()}\n`);

  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  const owner = new PublicKey(walletAddress);

  // Check master lockbox
  const [masterLockbox] = deriveMasterLockboxAddress(owner);
  console.log(`Master Lockbox PDA: ${masterLockbox.toBase58()}`);

  const masterInfo = await connection.getAccountInfo(masterLockbox);
  console.log(`Master Lockbox exists: ${masterInfo !== null}\n`);

  if (masterInfo) {
    console.log(`Master Lockbox account:`);
    console.log(`  - Lamports: ${masterInfo.lamports} (${(masterInfo.lamports / 1e9).toFixed(4)} SOL)`);
    console.log(`  - Owner: ${masterInfo.owner.toBase58()}`);
    console.log(`  - Data length: ${masterInfo.data.length} bytes\n`);
  }

  // Check for orphaned chunks (indices 0-9)
  console.log('Scanning for orphaned storage chunks (indices 0-9)...\n');

  const orphanedChunks: {
    index: number;
    address: string;
    lamports: number;
  }[] = [];

  for (let i = 0; i < 10; i++) {
    const [chunkPDA] = deriveStorageChunkAddress(masterLockbox, i);
    const chunkInfo = await connection.getAccountInfo(chunkPDA);

    if (chunkInfo) {
      console.log(`✓ Found chunk ${i}:`);
      console.log(`  - Address: ${chunkPDA.toBase58()}`);
      console.log(`  - Lamports: ${chunkInfo.lamports} (${(chunkInfo.lamports / 1e9).toFixed(4)} SOL)`);
      console.log(`  - Owner: ${chunkInfo.owner.toBase58()}`);
      console.log(`  - Data length: ${chunkInfo.data.length} bytes`);

      // Verify it's owned by our program
      if (chunkInfo.owner.equals(PROGRAM_ID)) {
        console.log(`  - Status: ${masterInfo ? 'Registered' : '⚠️  ORPHANED'}`);

        if (!masterInfo) {
          orphanedChunks.push({
            index: i,
            address: chunkPDA.toBase58(),
            lamports: chunkInfo.lamports,
          });
        }
      } else {
        console.log(`  - Status: ❌ Wrong owner (not our program)`);
      }
      console.log();
    }
  }

  // Summary
  console.log('=== Scan Summary ===\n');

  if (orphanedChunks.length === 0) {
    console.log('✅ No orphaned chunks found!');

    if (masterInfo) {
      console.log('\nYour master lockbox exists and appears to be in good state.');
    } else {
      console.log('\nNo master lockbox exists for this wallet.');
      console.log('You can initialize a new one normally.');
    }
  } else {
    console.log(`⚠️  Found ${orphanedChunks.length} orphaned chunk(s):\n`);

    let totalLocked = 0;
    orphanedChunks.forEach(({ index, address, lamports }) => {
      console.log(`  Chunk ${index}:`);
      console.log(`    Address: ${address}`);
      console.log(`    Rent: ${(lamports / 1e9).toFixed(4)} SOL`);
      totalLocked += lamports;
    });

    console.log(`\nTotal SOL locked: ${(totalLocked / 1e9).toFixed(4)} SOL`);
    console.log(`\n📋 Recovery command:`);
    console.log(`\n  await client.recoverOrphanedChunks([${orphanedChunks.map(c => c.index).join(', ')}]);\n`);
  }

  return orphanedChunks;
}

// Export for use in other scripts
export { checkOrphanedChunks };

// CLI usage
if (require.main === module) {
  const walletAddress = process.argv[2];

  if (!walletAddress) {
    console.error('Usage: npx tsx check-orphans.ts <wallet-address>');
    process.exit(1);
  }

  checkOrphanedChunks(walletAddress)
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('\n❌ Error:', error.message);
      process.exit(1);
    });
}
