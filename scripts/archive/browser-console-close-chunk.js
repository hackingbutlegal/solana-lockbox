/**
 * BROWSER CONSOLE SCRIPT: Close Orphaned Storage Chunk
 *
 * Copy and paste this entire script into your browser console while on http://localhost:3000
 * Make sure your Phantom wallet is connected!
 */

(async function() {
  // Import from the global scope (loaded by Next.js)
  const solanaWeb3 = await import('https://unpkg.com/@solana/web3.js@latest/lib/index.iife.min.js');
  const { Connection, PublicKey, Transaction, TransactionInstruction } = solanaWeb3;

  const PROGRAM_ID = new PublicKey('7JxsHjdReydiz36jwsWuvwwR28qqK6V454VwFJnnSkoB');
  const RPC_URL = 'https://api.devnet.solana.com';

  // Discriminator for close_storage_chunk
  const CLOSE_STORAGE_CHUNK_DISCRIMINATOR = Buffer.from([0x79, 0xb6, 0xfd, 0x51, 0x67, 0xd2, 0x2e, 0xe9]);

  const connection = new Connection(RPC_URL, 'confirmed');
  const wallet = window.solana; // Phantom wallet

  if (!wallet || !wallet.isConnected) {
    console.error('❌ Phantom wallet not connected!');
    console.log('Please connect your wallet and try again.');
    return;
  }

  const walletPubkey = wallet.publicKey;
  console.log('✓ Wallet connected:', walletPubkey.toBase58());

  // Find PDAs
  const [masterLockbox] = PublicKey.findProgramAddressSync(
    [Buffer.from('master_lockbox'), walletPubkey.toBuffer()],
    PROGRAM_ID
  );

  const indexBuffer = Buffer.alloc(2);
  indexBuffer.writeUInt16LE(0); // Chunk index 0
  const [storageChunk0] = PublicKey.findProgramAddressSync(
    [Buffer.from('storage_chunk'), masterLockbox.toBuffer(), indexBuffer],
    PROGRAM_ID
  );

  console.log('Master lockbox:', masterLockbox.toBase58());
  console.log('Storage chunk 0:', storageChunk0.toBase58());

  // Check chunk exists
  const chunkInfo = await connection.getAccountInfo(storageChunk0);
  if (!chunkInfo) {
    console.log('✓ Storage chunk does not exist - nothing to close!');
    return;
  }

  console.log('Found orphaned chunk:');
  console.log('  Balance:', chunkInfo.lamports / 1e9, 'SOL');
  console.log('  Size:', chunkInfo.data.length, 'bytes');
  console.log('\nPreparing to close...');

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
      { pubkey: walletPubkey, isSigner: true, isWritable: true },
    ],
    data: instructionData,
  });

  const transaction = new Transaction().add(instruction);
  transaction.feePayer = walletPubkey;
  transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

  console.log('Sending transaction to Phantom for approval...');

  try {
    // Send transaction using Phantom
    const signature = await wallet.sendTransaction(transaction, connection);
    console.log('✓ Transaction sent:', signature);
    console.log('Waiting for confirmation...');

    await connection.confirmTransaction(signature, 'confirmed');

    console.log('✅ SUCCESS! Orphaned chunk closed.');
    console.log('  Transaction:', signature);
    console.log('  Rent returned:', chunkInfo.lamports / 1e9, 'SOL');
    console.log('\nYou can now try storing a password again!');
  } catch (error) {
    console.error('❌ Transaction failed:', error);
    console.error('Error details:', error.message);
  }
})();
