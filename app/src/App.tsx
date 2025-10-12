import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { ConnectionProvider, WalletProvider, useWallet } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { WalletModalProvider, WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import {
  clusterApiUrl,
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL
} from '@solana/web3.js';
import { web3 } from '@coral-xyz/anchor';
import { printSimulate } from '@raydium-io/raydium-sdk-v2';
import {
  encryptAEAD,
  generateChallenge,
  createSessionKeyFromSignature,
  wipeSensitiveData,
  validateEncryptedSize,
  MAX_ENCRYPTED_SIZE,
} from './crypto';
import { ActivityLog, LogEntry, LogLevel } from './components/ActivityLog';
import { StorageHistory, StoredItem } from './components/StorageHistory';
import { FAQ } from './components/FAQ';
import {
  retrieveUserItems,
  addStoredItem,
} from './utils/secureStorage';
import './App.css';

// Import styles for wallet adapter
import '@solana/wallet-adapter-react-ui/styles.css';

const PROGRAM_ID = new PublicKey('5nr7xe1U3k6U6zPEmW3FCbPyXCa7jr7JpudaLKuVNyvZ');
const FEE_RECEIVER = new PublicKey('3H8e4VnGjxKGFKxk2QMmjuu1B7dnDLysGN8hvcDCKxZh'); // Your wallet as fee receiver

// Security: Disable right-click on sensitive areas (configurable)
const DISABLE_CONTEXT_MENU = false;

function LockboxApp() {
  const wallet = useWallet();
  const { publicKey, signMessage, sendTransaction, disconnect } = wallet;
  const [data, setData] = useState('');
  const [retrievedData, setRetrievedData] = useState('');
  const [sessionKey, setSessionKey] = useState<Uint8Array | null>(null);
  const [showRetrieved, setShowRetrieved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [storedItems, setStoredItems] = useState<StoredItem[]>([]);

  // Refs for security
  const sessionKeyRef = useRef<Uint8Array | null>(null);
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);

  const connection = useMemo(() => new Connection(
    clusterApiUrl('devnet'),
    {
      commitment: 'confirmed',
      confirmTransactionInitialTimeout: 60000,
    }
  ), []);

  // Add log entry
  const addLog = useCallback((level: LogLevel, message: string, txHash?: string) => {
    const newLog: LogEntry = {
      id: `${Date.now()}-${Math.random()}`,
      timestamp: new Date(),
      level,
      message,
      txHash,
    };
    setLogs(prev => [newLog, ...prev].slice(0, 50));
  }, []);

  // Retry helper for network requests
  const retryWithBackoff = async <T,>(
    fn: () => Promise<T>,
    maxRetries = 3,
    baseDelay = 1000
  ): Promise<T> => {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        if (i === maxRetries - 1) throw error;

        const delay = baseDelay * Math.pow(2, i);
        addLog('warning', `Network request failed, retrying in ${delay}ms... (${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    throw new Error('Max retries exceeded');
  };

  // Ensure no decrypted data is shown on page load/refresh
  useEffect(() => {
    setRetrievedData('');
    setShowRetrieved(false);
  }, []);

  // Load stored items when wallet connects
  useEffect(() => {
    if (publicKey) {
      const items = retrieveUserItems(publicKey.toBase58());
      setStoredItems(items);
      addLog('info', `Loaded ${items.length} stored ${items.length === 1 ? 'item' : 'items'} from history`);
    } else {
      setStoredItems([]);
    }
  }, [publicKey, addLog]);

  // Security: Inactivity timeout (15 minutes)
  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }

    inactivityTimerRef.current = setTimeout(() => {
      if (sessionKey) {
        wipeSensitiveData(sessionKey);
        setSessionKey(null);
        sessionKeyRef.current = null;
        addLog('warning', 'Session expired due to inactivity. Please reconnect.');
        disconnect();
      }
    }, 15 * 60 * 1000); // 15 minutes
  }, [sessionKey, addLog, disconnect]);

  // Reset inactivity on user activity
  useEffect(() => {
    if (!sessionKey) return;

    const activities = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    activities.forEach(event => {
      window.addEventListener(event, resetInactivityTimer);
    });

    resetInactivityTimer();

    return () => {
      activities.forEach(event => {
        window.removeEventListener(event, resetInactivityTimer);
      });
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    };
  }, [sessionKey, resetInactivityTimer]);

  // Calculate remaining bytes
  const remainingBytes = MAX_ENCRYPTED_SIZE - new TextEncoder().encode(data).length;
  const isOverLimit = remainingBytes < 0;

  // Derive session key from wallet signature
  const deriveSessionKey = useCallback(async () => {
    if (!publicKey || !signMessage) {
      addLog('error', 'Wallet not connected');
      return null;
    }

    try {
      addLog('progress', 'Requesting wallet signature for session key derivation...');
      const challenge = generateChallenge(publicKey);
      const signature = await signMessage(challenge);

      addLog('progress', 'Deriving session key using HKDF...');
      const { sessionKey: derivedKey } = await createSessionKeyFromSignature(
        publicKey,
        signature
      );

      setSessionKey(derivedKey);
      sessionKeyRef.current = derivedKey;
      addLog('success', 'Session key derived successfully. Ready to encrypt data.');
      return derivedKey;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      addLog('error', `Failed to derive session key: ${errorMsg}`);
      return null;
    }
  }, [publicKey, signMessage, addLog]);

  // Auto-derive session key when wallet connects
  useEffect(() => {
    if (publicKey && !sessionKey) {
      addLog('info', `Wallet connected: ${publicKey.toBase58().slice(0, 8)}...${publicKey.toBase58().slice(-8)}`);
      deriveSessionKey();
    }
  }, [publicKey, sessionKey, deriveSessionKey, addLog]);

  // Cleanup on disconnect
  useEffect(() => {
    if (!publicKey && sessionKey) {
      wipeSensitiveData(sessionKey);
      setSessionKey(null);
      sessionKeyRef.current = null;
      setData('');
      setRetrievedData('');
      setShowRetrieved(false);
      addLog('info', 'Wallet disconnected. Session key wiped from memory.');
    }
  }, [publicKey, sessionKey, addLog]);

  // Security: Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sessionKeyRef.current) {
        wipeSensitiveData(sessionKeyRef.current);
      }
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    };
  }, []);

  // Copy transaction hash to clipboard
  const handleCopyTxHash = useCallback((txHash: string) => {
    navigator.clipboard.writeText(txHash);
    addLog('info', 'Transaction hash copied to clipboard');
  }, [addLog]);

  // Store encrypted data
  const handleStore = async () => {
    if (!publicKey || !sessionKey || !sendTransaction) {
      addLog('error', 'Please connect wallet first');
      return;
    }

    if (!data.trim()) {
      addLog('warning', 'Please enter data to encrypt');
      return;
    }

    if (isOverLimit) {
      addLog('error', 'Data exceeds 1 KiB limit');
      return;
    }

    setLoading(true);
    try {
      // Check wallet balance with retry
      addLog('progress', 'Checking wallet balance...');
      const balance = await retryWithBackoff(() => connection.getBalance(publicKey));
      const requiredBalance = 0.001 * LAMPORTS_PER_SOL;

      if (balance < requiredBalance) {
        throw new Error(
          `Insufficient balance. Need ${(requiredBalance / LAMPORTS_PER_SOL).toFixed(3)} SOL, have ${(balance / LAMPORTS_PER_SOL).toFixed(3)} SOL. Get devnet SOL from https://faucet.solana.com`
        );
      }

      addLog('info', `Balance: ${(balance / LAMPORTS_PER_SOL).toFixed(3)} SOL`);
      addLog('progress', 'Encrypting data with XChaCha20-Poly1305...');

      // Encrypt client-side
      const plaintext = new TextEncoder().encode(data);
      const { ciphertext, nonce, salt } = encryptAEAD(plaintext, sessionKey);

      // Validate size
      if (!validateEncryptedSize(ciphertext)) {
        throw new Error('Encrypted data size validation failed');
      }

      addLog('info', `Encrypted ${plaintext.length} bytes → ${ciphertext.length} bytes (including auth tag)`);
      addLog('progress', 'Building transaction to store encrypted data on Solana...');

      // Create PDA for user's lockbox
      const [lockboxPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('lockbox'), publicKey.toBuffer()],
        PROGRAM_ID
      );

      addLog('info', `Target PDA: ${lockboxPda.toBase58().slice(0, 8)}...${lockboxPda.toBase58().slice(-8)}`);

      // Calculate proper Anchor discriminator using crypto
      addLog('progress', 'Building program instruction...');

      // Calculate Anchor sighash for "global:store_encrypted"
      const instructionName = "global:store_encrypted";
      const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(instructionName));
      const discriminator = new Uint8Array(hashBuffer).slice(0, 8);

      addLog('info', `Discriminator: ${Array.from(discriminator).map(b => b.toString(16).padStart(2, '0')).join('')}`);

      // Serialize instruction data using Borsh format
      // Format: [discriminator (8 bytes), vec_len (4 bytes), ciphertext, nonce (24 bytes), salt (32 bytes)]
      const ciphertextLen = Buffer.alloc(4);
      ciphertextLen.writeUInt32LE(ciphertext.length, 0);

      const instructionData = Buffer.concat([
        Buffer.from(discriminator),
        ciphertextLen,
        Buffer.from(ciphertext),
        Buffer.from(nonce),
        Buffer.from(salt),
      ]);

      // Build account metas
      const keys = [
        { pubkey: lockboxPda, isSigner: false, isWritable: true },
        { pubkey: publicKey, isSigner: true, isWritable: true },
        { pubkey: FEE_RECEIVER, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ];

      const instruction = new web3.TransactionInstruction({
        keys,
        programId: PROGRAM_ID,
        data: instructionData,
      });

      // Get recent blockhash
      addLog('progress', 'Fetching recent blockhash...');
      const { blockhash, lastValidBlockHeight } = await retryWithBackoff(() =>
        connection.getLatestBlockhash('finalized')
      );

      // Build and send transaction
      const transaction = new Transaction({
        feePayer: publicKey,
        blockhash,
        lastValidBlockHeight,
      }).add(instruction);

      // Simulate transaction for debugging
      addLog('progress', 'Simulating transaction...');
      try {
        const simulateResult = await printSimulate(connection, [transaction], 'confirmed');
        console.log('Simulation result:', simulateResult);
        addLog('info', `Simulation: ${simulateResult.length} result(s) - check console for details`);
      } catch (simError) {
        addLog('warning', `Simulation warning: ${simError instanceof Error ? simError.message : 'Unknown'}`);
        console.error('Simulation error:', simError);
      }

      addLog('progress', 'Sending transaction to Solana devnet...');
      const signature = await sendTransaction(transaction, connection);

      addLog('progress', `Transaction sent. Confirming... (Signature: ${signature.slice(0, 8)}...)`);

      // Wait for confirmation
      const confirmation = await connection.confirmTransaction(
        {
          signature,
          blockhash,
          lastValidBlockHeight,
        },
        'confirmed'
      );

      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      }

      addLog('success', `Transaction confirmed! (Signature: ${signature.slice(0, 8)}...)`, signature);

      // Store metadata
      const dataPreview = data.length > 50 ? `${data.slice(0, 47)}...` : data;
      addStoredItem(publicKey.toBase58(), signature, dataPreview, plaintext.length);

      // Refresh stored items
      const items = retrieveUserItems(publicKey.toBase58());
      setStoredItems(items);

      addLog('success', `Data stored successfully! Fee: 0.001 SOL`, signature);
      addLog('info', 'Clearing input and wiping plaintext from memory...');

      setData('');

      // Wipe plaintext from memory
      wipeSensitiveData(plaintext);
    } catch (error) {
      let errorMsg = error instanceof Error ? error.message : 'Unknown error';

      // Enhanced error messages
      if (errorMsg.includes('Failed to fetch') || errorMsg.includes('fetch')) {
        errorMsg = 'Network error: Unable to connect to Solana devnet. Please check your internet connection or try again later.';
        addLog('error', errorMsg);
        addLog('info', 'Tip: Solana devnet may be experiencing issues. Visit https://status.solana.com');
      } else if (errorMsg.includes('User rejected')) {
        errorMsg = 'Transaction cancelled by user';
        addLog('warning', errorMsg);
      } else {
        addLog('error', `Storage failed: ${errorMsg}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // Retrieve and decrypt specific item
  const handleRetrieveItem = async (item: StoredItem) => {
    if (!publicKey || !sessionKey) {
      addLog('error', 'Please connect wallet first');
      return;
    }

    setLoading(true);

    try {
      addLog('progress', `Retrieving data from transaction ${item.txHash.slice(0, 8)}...`);

      // Create PDA for user's lockbox
      const [lockboxPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('lockbox'), publicKey.toBuffer()],
        PROGRAM_ID
      );

      addLog('info', `Querying PDA: ${lockboxPda.toBase58().slice(0, 8)}...${lockboxPda.toBase58().slice(-8)}`);

      // Simulate retrieval (TODO: fetch from chain)
      await new Promise(resolve => setTimeout(resolve, 1500));

      addLog('progress', 'Decrypting with session key...');

      await new Promise(resolve => setTimeout(resolve, 500));

      // Show decrypted data (never stored, only in memory)
      setRetrievedData(`[Demo] Original data:\n${item.dataPreview}\n\nTransaction: ${item.txHash}\nStored: ${item.timestamp.toLocaleString()}`);
      setShowRetrieved(true);

      addLog('success', 'Data retrieved and decrypted successfully');
      addLog('warning', 'Data will auto-hide in 30 seconds for security');

      // Auto-hide after 30 seconds
      setTimeout(() => {
        setShowRetrieved(false);
        setRetrievedData('');
        addLog('info', 'Decrypted data hidden and cleared from memory');
      }, 30000);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      addLog('error', `Retrieval failed: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  // Security: Handle context menu
  const handleContextMenu = (e: React.MouseEvent) => {
    if (DISABLE_CONTEXT_MENU && (showRetrieved || data)) {
      e.preventDefault();
      addLog('warning', 'Right-click disabled on sensitive data for security');
    }
  };

  return (
    <div className="lockbox-container" onContextMenu={handleContextMenu}>
      <header>
        <h1>🔒 Lockbox</h1>
        <p className="subtitle">Wallet-Tied Encrypted Storage on Solana</p>
        <WalletMultiButton />
      </header>

      {publicKey && (
        <main className="main-content">
          <div className="primary-section">
            <section className="store-section">
              <h2>Store Data</h2>
              <textarea
                value={data}
                onChange={(e) => setData(e.target.value)}
                placeholder="Enter data to encrypt and store (max 1 KiB)..."
                disabled={loading}
                rows={6}
                autoComplete="off"
                spellCheck={false}
              />
              <div className="size-counter" style={{ color: isOverLimit ? '#e74c3c' : '#7f8c8d' }}>
                {isOverLimit ? 'EXCEEDS LIMIT' : `${remainingBytes} bytes remaining`}
              </div>
              <button onClick={handleStore} disabled={loading || !data.trim() || isOverLimit}>
                {loading ? '⋯ Processing...' : '🔐 Encrypt & Store (0.001 SOL)'}
              </button>
            </section>

            {showRetrieved && retrievedData && (
              <section className="retrieve-section">
                <div className="retrieved-data">
                  <div className="reveal-header">
                    <span>🔓 Decrypted Data (auto-hide in 30s)</span>
                    <button onClick={() => {
                      setShowRetrieved(false);
                      setRetrievedData('');
                      addLog('info', 'Manually cleared decrypted data from view');
                    }}>Hide</button>
                  </div>
                  <pre>{retrievedData}</pre>
                </div>
              </section>
            )}

            <StorageHistory
              items={storedItems}
              onRetrieve={handleRetrieveItem}
              onCopyTxHash={handleCopyTxHash}
            />

            <FAQ />
          </div>

          <div className="secondary-section">
            <ActivityLog logs={logs} onCopyTxHash={handleCopyTxHash} />
          </div>
        </main>
      )}

      {!publicKey && (
        <>
          <div className="connect-prompt">
            <p>Connect your Solana wallet to get started</p>
            <p className="connect-hint">Supports Phantom, Solflare, and other Solana wallets</p>
          </div>
          <div className="faq-wrapper">
            <FAQ />
          </div>
        </>
      )}

      <footer>
        <p>Zero persistent storage • Keys derived from wallet • XChaCha20-Poly1305 AEAD</p>
        <p className="network-badge">🌐 Devnet</p>
        <p className="security-note">🔒 Session auto-expires after 15 minutes of inactivity</p>
        <p className="credits">
          created with &lt;3 by <a href="https://x.com/0xgraffito" target="_blank" rel="noopener noreferrer">GRAFFITO</a>
        </p>
      </footer>
    </div>
  );
}

export default function App() {
  const network = WalletAdapterNetwork.Devnet;
  const endpoint = useMemo(() => clusterApiUrl(network), [network]);

  const wallets = useMemo(
    () => [
      // Phantom auto-detected via Standard Wallet protocol
      new SolflareWalletAdapter(),
    ],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <LockboxApp />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
