#!/usr/bin/env ts-node

/**
 * Test script to initialize master lockbox using Anchor's generated client
 * This will help us verify if the program works when called via Anchor's framework
 */

import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import IDL from '../nextjs-app/sdk/idl/lockbox-v2.json';

async function main() {
  // Setup
  const connection = new anchor.web3.Connection('https://api.devnet.solana.com', 'confirmed');

  // Load wallet from environment or create ephemeral
  const wallet = anchor.Wallet.local();
  console.log('Using wallet:', wallet.publicKey.toBase58());

  // Create provider
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: 'confirmed',
  });

  // Load program
  const programId = new PublicKey('7JxsHjdReydiz36jwsWuvwwR28qqK6V454VwFJnnSkoB');
  const program = new Program(IDL as any, programId, provider);

  console.log('\nProgram loaded successfully!');
  console.log('Program ID:', program.programId.toBase58());

  // Derive master lockbox PDA
  const [masterLockboxPda, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from('master_lockbox'), wallet.publicKey.toBuffer()],
    programId
  );

  console.log('\nMaster Lockbox PDA:', masterLockboxPda.toBase58());
  console.log('Bump:', bump);

  // Check if already exists
  try {
    const accountInfo = await connection.getAccountInfo(masterLockboxPda);
    if (accountInfo) {
      console.log('\n❌ Master lockbox already exists! Skipping initialization.');
      return;
    }
  } catch (e) {
    // Account doesn't exist, continue
  }

  console.log('\n🚀 Initializing master lockbox...');

  try {
    const tx = await program.methods
      .initializeMasterLockbox()
      .accounts({
        masterLockbox: masterLockboxPda,
        owner: wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log('\n✅ Success!');
    console.log('Transaction signature:', tx);

    // Fetch and display the account
    const masterLockbox = await program.account.masterLockbox.fetch(masterLockboxPda);
    console.log('\n📦 Master Lockbox Data:');
    console.log('  Owner:', masterLockbox.owner.toBase58());
    console.log('  Total Entries:', masterLockbox.totalEntries.toString());
    console.log('  Storage Chunks:', masterLockbox.storageChunksCount);
    console.log('  Subscription Tier:', Object.keys(masterLockbox.subscriptionTier)[0]);
    console.log('  Total Capacity:', masterLockbox.totalCapacity.toString());

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    if (error.logs) {
      console.error('\nProgram logs:');
      error.logs.forEach((log: string) => console.error('  ', log));
    }
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
