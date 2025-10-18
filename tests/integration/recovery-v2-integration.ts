/**
 * Recovery V2 Integration Tests
 *
 * Complete end-to-end tests for V2 secure recovery system on devnet.
 * Tests the full flow from setup through guardian-initiated recovery.
 *
 * Prerequisites:
 * - Program deployed to devnet at 7JxsHjdReydiz36jwsWuvwwR28qqK6V454VwFJnnSkoB
 * - Test wallets funded with devnet SOL
 * - RPC endpoint configured for devnet
 *
 * Usage:
 *   npx ts-node tests/integration/recovery-v2-integration.ts
 */

import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';
import { LockboxClient } from '../../nextjs-app/sdk/src/client-v2';
import {
  setupRecovery,
  initiateRecovery,
  generateProofOfReconstruction,
  GuardianInfo,
  RecoverySetup
} from '../../nextjs-app/lib/recovery-client-v2';
import { reconstructSecret, Share } from '../../nextjs-app/lib/shamir-secret-sharing';

// Configuration
const DEVNET_RPC = 'https://api.devnet.solana.com';
const PROGRAM_ID = new PublicKey('7JxsHjdReydiz36jwsWuvwwR28qqK6V454VwFJnnSkoB');

// Test wallets directory
const WALLETS_DIR = path.join(__dirname, 'test-wallets');

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSection(title: string) {
  console.log('\n' + '='.repeat(80));
  log(title, colors.bright + colors.cyan);
  console.log('='.repeat(80) + '\n');
}

function logSuccess(message: string) {
  log(`✓ ${message}`, colors.green);
}

function logWarning(message: string) {
  log(`⚠ ${message}`, colors.yellow);
}

function logError(message: string) {
  log(`✗ ${message}`, colors.red);
}

// Test state
interface TestState {
  connection: Connection;
  owner: Keypair;
  guardians: Keypair[];
  masterSecret: Uint8Array;
  recoverySetup: RecoverySetup | null;
  requestId: number | null;
  encryptedChallenge: Uint8Array | null;
}

/**
 * Initialize test wallets
 */
async function initializeTestWallets(): Promise<{ owner: Keypair; guardians: Keypair[] }> {
  logSection('Initializing Test Wallets');

  // Create wallets directory if it doesn't exist
  if (!fs.existsSync(WALLETS_DIR)) {
    fs.mkdirSync(WALLETS_DIR, { recursive: true });
  }

  // Load or create owner wallet
  const ownerPath = path.join(WALLETS_DIR, 'owner.json');
  let owner: Keypair;
  if (fs.existsSync(ownerPath)) {
    const ownerKey = JSON.parse(fs.readFileSync(ownerPath, 'utf-8'));
    owner = Keypair.fromSecretKey(Uint8Array.from(ownerKey));
    log(`Loaded owner wallet: ${owner.publicKey.toBase58()}`);
  } else {
    owner = Keypair.generate();
    fs.writeFileSync(ownerPath, JSON.stringify(Array.from(owner.secretKey)));
    logSuccess(`Created owner wallet: ${owner.publicKey.toBase58()}`);
  }

  // Load or create guardian wallets (3 guardians)
  const guardians: Keypair[] = [];
  for (let i = 0; i < 3; i++) {
    const guardianPath = path.join(WALLETS_DIR, `guardian-${i + 1}.json`);
    let guardian: Keypair;
    if (fs.existsSync(guardianPath)) {
      const guardianKey = JSON.parse(fs.readFileSync(guardianPath, 'utf-8'));
      guardian = Keypair.fromSecretKey(Uint8Array.from(guardianKey));
      log(`Loaded guardian ${i + 1} wallet: ${guardian.publicKey.toBase58()}`);
    } else {
      guardian = Keypair.generate();
      fs.writeFileSync(guardianPath, JSON.stringify(Array.from(guardian.secretKey)));
      logSuccess(`Created guardian ${i + 1} wallet: ${guardian.publicKey.toBase58()}`);
    }
    guardians.push(guardian);
  }

  return { owner, guardians };
}

/**
 * Fund test wallets with devnet SOL
 */
async function fundWallets(connection: Connection, wallets: Keypair[]): Promise<void> {
  logSection('Funding Test Wallets');

  for (const wallet of wallets) {
    const balance = await connection.getBalance(wallet.publicKey);
    const balanceSOL = balance / LAMPORTS_PER_SOL;

    if (balanceSOL < 1) {
      log(`Requesting airdrop for ${wallet.publicKey.toBase58()}...`);
      try {
        const signature = await connection.requestAirdrop(
          wallet.publicKey,
          2 * LAMPORTS_PER_SOL
        );
        await connection.confirmTransaction(signature);
        logSuccess(`Airdropped 2 SOL to ${wallet.publicKey.toBase58()}`);
      } catch (error: any) {
        logWarning(`Airdrop failed: ${error.message}`);
        logWarning('Please manually fund wallet or try again later');
      }
    } else {
      log(`Wallet ${wallet.publicKey.toBase58()} has ${balanceSOL.toFixed(4)} SOL`);
    }
  }

  // Wait for confirmations
  await new Promise(resolve => setTimeout(resolve, 2000));
}

/**
 * Test 1: Setup Recovery Configuration
 */
async function testRecoverySetup(state: TestState): Promise<void> {
  logSection('Test 1: Recovery Setup');

  const client = new LockboxClient(state.connection, state.owner, PROGRAM_ID);

  // Generate guardian info
  const guardianInfos: GuardianInfo[] = state.guardians.map((guardian, index) => ({
    pubkey: guardian.publicKey,
    nickname: `Guardian ${index + 1}`,
    shareIndex: index + 1,
  }));

  log(`Setting up recovery with:`);
  log(`  - Threshold: 2 of 3`);
  log(`  - Recovery Delay: 7 days`);
  log(`  - Guardians: ${guardianInfos.length}`);

  // Setup recovery client-side
  const threshold = 2;
  const recoveryDelay = 7 * 24 * 60 * 60; // 7 days in seconds

  log('\nGenerating shares and commitments...');
  const recoverySetup = await setupRecovery(
    state.masterSecret,
    guardianInfos,
    threshold
  );
  state.recoverySetup = recoverySetup;

  logSuccess(`Generated ${recoverySetup.encryptedShares.length} shares`);
  logSuccess(`Generated ${recoverySetup.guardianCommitments.length} commitments`);

  // Save shares to files
  const sharesDir = path.join(WALLETS_DIR, 'shares');
  if (!fs.existsSync(sharesDir)) {
    fs.mkdirSync(sharesDir, { recursive: true });
  }

  recoverySetup.encryptedShares.forEach((share, index) => {
    const shareData = {
      guardian: {
        address: guardianInfos[index].pubkey.toBase58(),
        nickname: guardianInfos[index].nickname,
      },
      share: Array.from(share.encrypted),
      commitment: Array.from(recoverySetup.guardianCommitments[index].commitment),
      shareIndex: index + 1,
      setupDate: new Date().toISOString(),
    };

    const sharePath = path.join(sharesDir, `guardian-${index + 1}-share.json`);
    fs.writeFileSync(sharePath, JSON.stringify(shareData, null, 2));
    logSuccess(`Saved share for ${guardianInfos[index].nickname}`);
  });

  // Initialize recovery config on-chain
  log('\nInitializing recovery config on-chain...');
  try {
    const txid = await client.initializeRecoveryConfigV2(
      threshold,
      recoveryDelay,
      recoverySetup.masterSecretHash
    );
    logSuccess(`Recovery config initialized: ${txid}`);

    // Add guardians
    log('\nAdding guardians on-chain...');
    for (let i = 0; i < guardianInfos.length; i++) {
      const guardian = guardianInfos[i];
      const commitment = recoverySetup.guardianCommitments[i];

      const guardianTxid = await client.addGuardianV2(
        guardian.pubkey,
        guardian.shareIndex,
        commitment.commitment,
        Buffer.from(guardian.nickname) // TODO: Encrypt nickname
      );
      logSuccess(`Added ${guardian.nickname}: ${guardianTxid}`);
    }

    logSuccess('\n✓ Recovery setup complete!');
  } catch (error: any) {
    logError(`Recovery setup failed: ${error.message}`);
    throw error;
  }
}

/**
 * Test 2: Initiate Recovery Request
 */
async function testRecoveryInitiation(state: TestState): Promise<void> {
  logSection('Test 2: Initiate Recovery Request');

  // Use first guardian to initiate recovery
  const initiatingGuardian = state.guardians[0];
  const client = new LockboxClient(state.connection, initiatingGuardian, PROGRAM_ID);

  log(`Initiating recovery as ${initiatingGuardian.publicKey.toBase58()}`);
  log(`For vault owner: ${state.owner.publicKey.toBase58()}`);

  try {
    // Generate request ID (in production, this would be fetched from on-chain)
    const requestId = 1; // First request
    state.requestId = requestId;

    // Initiate recovery on-chain
    const txid = await client.initiateRecoveryV2(state.owner.publicKey, requestId);
    logSuccess(`Recovery request initiated: ${txid}`);

    // In a real scenario, the encrypted challenge would be fetched from on-chain
    // For testing, we'll generate a mock challenge
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);
    state.encryptedChallenge = challenge;

    logSuccess(`Recovery request ID: ${requestId}`);
    log(`Challenge: ${Buffer.from(challenge).toString('hex').slice(0, 32)}...`);
  } catch (error: any) {
    logError(`Recovery initiation failed: ${error.message}`);
    throw error;
  }
}

/**
 * Test 3: Collect Shares and Reconstruct Secret
 */
async function testSecretReconstruction(state: TestState): Promise<Uint8Array> {
  logSection('Test 3: Collect Shares and Reconstruct Secret');

  if (!state.recoverySetup) {
    throw new Error('Recovery setup not initialized');
  }

  log('Loading guardian shares from disk...');
  const sharesDir = path.join(WALLETS_DIR, 'shares');
  const shares: Share[] = [];

  // Load first 2 shares (threshold = 2)
  for (let i = 0; i < 2; i++) {
    const sharePath = path.join(sharesDir, `guardian-${i + 1}-share.json`);
    const shareData = JSON.parse(fs.readFileSync(sharePath, 'utf-8'));

    shares.push({
      index: shareData.shareIndex,
      data: new Uint8Array(shareData.share),
    });

    logSuccess(`Loaded share ${i + 1} from ${shareData.guardian.nickname}`);
  }

  log('\nReconstructing master secret...');
  const reconstructed = reconstructSecret(shares);

  // Verify reconstruction
  const matches = Buffer.from(reconstructed).equals(Buffer.from(state.masterSecret));
  if (matches) {
    logSuccess('✓ Secret reconstructed successfully!');
    log(`Reconstructed: ${Buffer.from(reconstructed).toString('hex').slice(0, 32)}...`);
    log(`Original:      ${Buffer.from(state.masterSecret).toString('hex').slice(0, 32)}...`);
  } else {
    logError('✗ Secret reconstruction failed - mismatch!');
    throw new Error('Secret reconstruction verification failed');
  }

  return reconstructed;
}

/**
 * Test 4: Generate and Submit Proof
 */
async function testProofSubmission(state: TestState, reconstructedSecret: Uint8Array): Promise<void> {
  logSection('Test 4: Generate and Submit Proof');

  if (!state.encryptedChallenge || state.requestId === null) {
    throw new Error('Recovery request not initialized');
  }

  log('Generating proof of reconstruction...');
  const proof = await generateProofOfReconstruction(
    state.encryptedChallenge,
    reconstructedSecret
  );

  logSuccess(`Proof generated: ${Buffer.from(proof).toString('hex').slice(0, 32)}...`);

  // Submit proof to blockchain
  const initiatingGuardian = state.guardians[0];
  const client = new LockboxClient(state.connection, initiatingGuardian, PROGRAM_ID);

  log('\nSubmitting proof to blockchain...');
  try {
    const txid = await client.completeRecoveryWithProof(
      state.owner.publicKey,
      state.requestId,
      proof
    );
    logSuccess(`Proof submitted: ${txid}`);
    logSuccess('\n✓ Recovery completed successfully!');
    log(`\nOwnership should now be transferred to: ${initiatingGuardian.publicKey.toBase58()}`);
  } catch (error: any) {
    logError(`Proof submission failed: ${error.message}`);
    throw error;
  }
}

/**
 * Main test runner
 */
async function runIntegrationTests() {
  logSection('Recovery V2 Integration Tests - Devnet');

  // Initialize connection
  const connection = new Connection(DEVNET_RPC, 'confirmed');
  log(`Connected to devnet: ${DEVNET_RPC}\n`);

  // Initialize test state
  const { owner, guardians } = await initializeTestWallets();
  const state: TestState = {
    connection,
    owner,
    guardians,
    masterSecret: new Uint8Array(32),
    recoverySetup: null,
    requestId: null,
    encryptedChallenge: null,
  };

  // Generate master secret
  crypto.getRandomValues(state.masterSecret);
  log(`Master secret: ${Buffer.from(state.masterSecret).toString('hex').slice(0, 32)}...\n`);

  // Fund wallets
  await fundWallets(connection, [owner, ...guardians]);

  try {
    // Run tests
    await testRecoverySetup(state);
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for confirmations

    await testRecoveryInitiation(state);
    await new Promise(resolve => setTimeout(resolve, 2000));

    const reconstructed = await testSecretReconstruction(state);
    await new Promise(resolve => setTimeout(resolve, 1000));

    await testProofSubmission(state, reconstructed);

    // Success summary
    logSection('Test Summary');
    logSuccess('All integration tests passed! ✓');
    console.log('\nTest Results:');
    logSuccess('✓ Recovery setup completed');
    logSuccess('✓ Guardians added on-chain');
    logSuccess('✓ Recovery request initiated');
    logSuccess('✓ Secret reconstructed from shares');
    logSuccess('✓ Proof generated and submitted');
    logSuccess('✓ Recovery completed successfully');

  } catch (error: any) {
    logSection('Test Failed');
    logError(`Integration test failed: ${error.message}`);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run tests
if (require.main === module) {
  runIntegrationTests()
    .then(() => {
      log('\n✓ Integration tests completed successfully', colors.green + colors.bright);
      process.exit(0);
    })
    .catch((error) => {
      logError('\n✗ Integration tests failed');
      console.error(error);
      process.exit(1);
    });
}

export { runIntegrationTests };
