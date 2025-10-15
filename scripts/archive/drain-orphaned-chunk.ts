/**
 * Drain orphaned storage chunk by transferring lamports to your wallet
 * This is a workaround since we don't have a close_storage_chunk instruction
 */

import { Connection, PublicKey, Transaction, SystemProgram, Keypair, sendAndConfirmTransaction } from '@solana/web3.js';
import bs58 from 'bs58';
import * as readline from 'readline';

const PROGRAM_ID = new PublicKey('7JxsHjdReydiz36jwsWuvwwR28qqK6V454VwFJnnSkoB');
const RPC_URL = 'https://api.devnet.solana.com';
const ORPHANED_CHUNK = new PublicKey('CJGC88t7zGeY3BTDjraGgThbSA4Mm3kdbBrKwqLYmcVy');

async function promptForPrivateKey(): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question('Enter your wallet private key (base58): ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  console.log('=== Drain Orphaned Storage Chunk ===\n');
  console.log('WARNING: This script cannot work because storage chunks are PDAs (Program Derived Addresses)');
  console.log('PDAs cannot sign transactions, so we cannot drain them without program support.\n');
  console.log('The ONLY solution is to add a close_storage_chunk instruction to the program.\n');

  console.log('Orphaned chunk:', ORPHANED_CHUNK.toBase58());

  const connection = new Connection(RPC_URL, 'confirmed');
  const chunkInfo = await connection.getAccountInfo(ORPHANED_CHUNK);

  if (chunkInfo) {
    console.log('Balance:', chunkInfo.lamports / 1e9, 'SOL');
    console.log('This rent is unfortunately locked until we add a close instruction.');
  }

  console.log('\n=== WORKAROUND ===');
  console.log('Use a different wallet address for testing, or:');
  console.log('1. Add close_storage_chunk instruction to the Rust program');
  console.log('2. Redeploy the program');
  console.log('3. Close the orphaned chunk');
  console.log('4. Try again with the clean state');
}

main().catch(console.error);
