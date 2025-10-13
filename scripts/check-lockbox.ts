#!/usr/bin/env ts-node

/**
 * Check if a master lockbox exists for a wallet address
 */

import { Connection, PublicKey } from '@solana/web3.js';

const PROGRAM_ID = new PublicKey('7JxsHjdReydiz36jwsWuvwwR28qqK6V454VwFJnnSkoB');
const RPC_URL = 'https://api.devnet.solana.com';

async function main() {
  const walletAddress = process.argv[2];

  if (!walletAddress) {
    console.log('Usage: npm run check-lockbox <wallet_address>');
    console.log('Example: npm run check-lockbox 3H8e4VnGjxKGFKxk2QMmjuu1B7dnDLysGN8hvcDCKxZh');
    process.exit(1);
  }

  console.log('\n🔍 Checking Master Lockbox...\n');

  try {
    const connection = new Connection(RPC_URL, 'confirmed');
    const wallet = new PublicKey(walletAddress);

    // Derive PDA
    const [pda, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from('master_lockbox'), wallet.toBuffer()],
      PROGRAM_ID
    );

    console.log('Wallet Address:', wallet.toBase58());
    console.log('Master Lockbox PDA:', pda.toBase58());
    console.log('PDA Bump:', bump);
    console.log('');

    // Check if account exists
    const accountInfo = await connection.getAccountInfo(pda);

    if (accountInfo) {
      console.log('✅ Master Lockbox EXISTS');
      console.log('');
      console.log('Account Details:');
      console.log('  Owner Program:', accountInfo.owner.toBase58());
      console.log('  Data Length:', accountInfo.data.length, 'bytes');
      console.log('  Lamports:', accountInfo.lamports);
      console.log('  Executable:', accountInfo.executable);
      console.log('');
      console.log('Explorer:');
      console.log(`  https://explorer.solana.com/address/${pda.toBase58()}?cluster=devnet`);
      console.log('');

      // Try to deserialize basic fields
      console.log('Account Data (first 100 bytes):');
      console.log(accountInfo.data.slice(0, 100).toString('hex'));
      console.log('');

      return true;
    } else {
      console.log('❌ Master Lockbox DOES NOT EXIST');
      console.log('');
      console.log('You can create it by:');
      console.log('  1. Visit your Next.js app');
      console.log('  2. Connect your wallet');
      console.log('  3. Click "Create Password Vault"');
      console.log('');
      console.log('Or test via script:');
      console.log('  npm run test-initialize');
      console.log('');

      return false;
    }
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main()
  .then((exists) => process.exit(exists ? 0 : 1))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
