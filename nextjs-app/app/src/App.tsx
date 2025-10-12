'use client';

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
import {
  encryptAEAD,
  decryptAEAD,
  generateChallenge,
  createSessionKeyFromSignature,
  deriveSessionKey,
  wipeSensitiveData,
  validateEncryptedSize,
  MAX_ENCRYPTED_SIZE,
} from './crypto';
import { ActivityLog, LogEntry, LogLevel } from './components/ActivityLog';
import { StoredItem } from './components/StorageHistory';
import { FAQ } from './components/FAQ';
import { QuickStart } from './components/QuickStart';
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
  const [sessionSalt, setSessionSalt] = useState<Uint8Array | null>(null);
  const [showRetrieved, setShowRetrieved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [storedItems, setStoredItems] = useState<StoredItem[]>([]);
  const [activeTab, setActiveTab] = useState<'app' | 'quickstart' | 'faq'>('app');
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);

  // Refs for security
  const sessionKeyRef = useRef<Uint8Array | null>(null);
  const sessionSaltRef = useRef<Uint8Array | null>(null);
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connection = useMemo(() => new Connection(
    clusterApiUrl('devnet'),
    {
      commitment: 'confirmed',
      confirmTransactionInitialTimeout: 60000,
    }
  ), []);

  // Console-only logging for debug info (not shown in UI)
  const consoleLog = useCallback((level: string, message: string, data?: unknown) => {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = `[Lockbox ${timestamp}]`;

    switch (level) {
      case 'debug':
        console.log(prefix, message, data ?? '');
        break;
      case 'warn':
        console.warn(prefix, message, data ?? '');
        break;
      case 'error':
        console.error(prefix, message, data ?? '');
        break;
      default:
        console.info(prefix, message, data ?? '');
    }
  }, []);

  // Add log entry to UI Activity Log (user-facing only)
  const addLog = useCallback((level: LogLevel, message: string, txHash?: string) => {
    const newLog: LogEntry = {
      id: `${Date.now()}-${Math.random()}`,
      timestamp: new Date(),
      level,
      message,
      txHash,
    };
    setLogs(prev => [newLog, ...prev].slice(0, 50));

    // Also log to console for debugging
    consoleLog(level === 'error' ? 'error' : level === 'warning' ? 'warn' : 'info', message, txHash);
  }, [consoleLog]);

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
      consoleLog('debug', `Loaded ${items.length} stored ${items.length === 1 ? 'item' : 'items'} from history`);
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
        if (sessionSalt) {
          wipeSensitiveData(sessionSalt);
          setSessionSalt(null);
          sessionSaltRef.current = null;
        }
        addLog('warning', 'Session expired due to inactivity. Please reconnect.');
        disconnect();
      }
    }, 15 * 60 * 1000); // 15 minutes
  }, [sessionKey, sessionSalt, addLog, disconnect]);

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

  // Initialize session key from wallet signature (creates new random salt)
  const initializeSessionKey = useCallback(async () => {
    if (!publicKey || !signMessage) {
      addLog('error', 'Wallet not connected');
      return null;
    }

    try {
      addLog('progress', 'Deriving encryption key...');
      const challenge = generateChallenge(publicKey);
      const signature = await signMessage(challenge);

      const { sessionKey: derivedKey, salt: derivedSalt } = await createSessionKeyFromSignature(
        publicKey,
        signature
      );

      setSessionKey(derivedKey);
      setSessionSalt(derivedSalt);
      sessionKeyRef.current = derivedKey;
      sessionSaltRef.current = derivedSalt;
      addLog('success', 'Ready to encrypt/decrypt data');
      return derivedKey;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      addLog('error', `Failed to derive session key: ${errorMsg}`);
      return null;
    }
  }, [publicKey, signMessage, addLog]);

  // Check if user has stored data on-chain
  const checkForStoredData = useCallback(async () => {
    if (!publicKey) return;

    try {
      const [lockboxPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('lockbox'), publicKey.toBuffer()],
        PROGRAM_ID
      );

      const accountInfo = await connection.getAccountInfo(lockboxPda);

      if (accountInfo && accountInfo.data.length > 0) {
        // User has stored data - add to storedItems so decrypt button appears
        const dummyItem: StoredItem = {
          id: `existing-${Date.now()}`,
          txHash: 'existing',
          timestamp: new Date(),
          dataPreview: '[Encrypted data available on-chain]',
          sizeBytes: accountInfo.data.length
        };
        setStoredItems([dummyItem]);
        consoleLog('debug', 'Found existing encrypted data on-chain');
      } else {
        consoleLog('debug', 'No stored data found on-chain');
        setStoredItems([]);
      }
    } catch (error) {
      console.error('Error checking for stored data:', error);
      setStoredItems([]);
    }
  }, [publicKey, addLog]);

  // Check for stored data when wallet connects (no signature needed)
  useEffect(() => {
    if (publicKey) {
      addLog('success', 'Wallet connected');
      checkForStoredData();
    }
  }, [publicKey, checkForStoredData, addLog]);

  // Cleanup on disconnect
  useEffect(() => {
    if (!publicKey && sessionKey) {
      wipeSensitiveData(sessionKey);
      setSessionKey(null);
      sessionKeyRef.current = null;
      if (sessionSalt) {
        wipeSensitiveData(sessionSalt);
        setSessionSalt(null);
        sessionSaltRef.current = null;
      }
      setData('');
      setRetrievedData('');
      setShowRetrieved(false);
      consoleLog('debug', 'Wallet disconnected. Session key wiped from memory.');
    }
  }, [publicKey, sessionKey, sessionSalt, addLog]);

  // Security: Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sessionKeyRef.current) {
        wipeSensitiveData(sessionKeyRef.current);
      }
      if (sessionSaltRef.current) {
        wipeSensitiveData(sessionSaltRef.current);
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
    if (!publicKey || !sendTransaction) {
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

    // Check if user confirmed overwrite when existing data present
    if (storedItems.length > 0 && !confirmOverwrite) {
      addLog('error', 'Please confirm you want to overwrite existing data');
      return;
    }

    setLoading(true);
    try {
      // Derive session key if not already done
      let currentSessionKey = sessionKey;
      let currentSessionSalt = sessionSalt;

      if (!currentSessionKey || !currentSessionSalt) {
        const key = await initializeSessionKey();
        if (!key) {
          throw new Error('Failed to initialize session key');
        }
        currentSessionKey = sessionKeyRef.current!;
        currentSessionSalt = sessionSaltRef.current!;
      }

      // Check wallet balance with retry
      addLog('progress', 'Checking wallet balance...');
      const balance = await retryWithBackoff(() => connection.getBalance(publicKey));
      const requiredBalance = 0.001 * LAMPORTS_PER_SOL;

      if (balance < requiredBalance) {
        throw new Error(
          `Insufficient balance. Need ${(requiredBalance / LAMPORTS_PER_SOL).toFixed(3)} SOL, have ${(balance / LAMPORTS_PER_SOL).toFixed(3)} SOL. Get devnet SOL from https://faucet.solana.com`
        );
      }

      consoleLog('debug', `Balance: ${(balance / LAMPORTS_PER_SOL).toFixed(3)} SOL`);
      addLog('progress', 'Encrypting data...');

      // Encrypt client-side
      const plaintext = new TextEncoder().encode(data);
      const { ciphertext, nonce, salt } = encryptAEAD(plaintext, currentSessionKey, currentSessionSalt);

      // Validate size
      if (!validateEncryptedSize(ciphertext)) {
        throw new Error('Encrypted data size validation failed');
      }

      consoleLog('debug', `Encrypted ${plaintext.length} bytes → ${ciphertext.length} bytes (including auth tag)`);
      addLog('progress', 'Building transaction...');

      // Create PDA for user's lockbox
      const [lockboxPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('lockbox'), publicKey.toBuffer()],
        PROGRAM_ID
      );

      consoleLog('debug', `Target PDA: ${lockboxPda.toBase58()}`);

      // Calculate proper Anchor discriminator using crypto
      const instructionName = "global:store_encrypted";
      const instructionBytes = new TextEncoder().encode(instructionName);
      // @ts-expect-error - TextEncoder.encode() returns Uint8Array but TS infers broader type
      const hashBuffer = await crypto.subtle.digest('SHA-256', instructionBytes);
      const discriminator = new Uint8Array(hashBuffer).slice(0, 8);

      consoleLog('debug', `Discriminator: ${Array.from(discriminator).map(b => b.toString(16).padStart(2, '0')).join('')}`);

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
      consoleLog('debug', 'Fetching recent blockhash...');
      const { blockhash, lastValidBlockHeight } = await retryWithBackoff(() =>
        connection.getLatestBlockhash('finalized')
      );

      // Build and send transaction
      const transaction = new Transaction({
        feePayer: publicKey,
        blockhash,
        lastValidBlockHeight,
      }).add(instruction);

      addLog('progress', 'Sending transaction...');
      const signature = await sendTransaction(transaction, connection);

      addLog('progress', 'Confirming transaction...');

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

      addLog('success', 'Transaction confirmed', signature);

      // Store metadata
      const dataPreview = data.length > 50 ? `${data.slice(0, 47)}...` : data;
      addStoredItem(publicKey.toBase58(), signature, dataPreview, plaintext.length);

      // Refresh stored items
      const items = retrieveUserItems(publicKey.toBase58());
      setStoredItems(items);

      addLog('success', 'Data encrypted and stored on-chain');
      consoleLog('debug', 'Clearing input and wiping plaintext from memory...');

      setData('');
      setConfirmOverwrite(false);

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
    if (!publicKey || !signMessage) {
      addLog('error', 'Please connect wallet first');
      return;
    }

    setLoading(true);

    try {
      addLog('progress', 'Retrieving encrypted data...');

      // Create PDA for user's lockbox
      const [lockboxPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('lockbox'), publicKey.toBuffer()],
        PROGRAM_ID
      );

      consoleLog('debug', `Querying PDA: ${lockboxPda.toBase58()}`);

      // Fetch account data from chain
      const accountInfo = await connection.getAccountInfo(lockboxPda);

      if (!accountInfo || accountInfo.data.length === 0) {
        throw new Error('No encrypted data found on-chain');
      }

      consoleLog('debug', `Retrieved ${accountInfo.data.length} bytes from chain`);

      // Log first 100 bytes for debugging
      const preview = accountInfo.data.slice(0, Math.min(100, accountInfo.data.length));
      const hexDump = Array.from(preview).map(b => b.toString(16).padStart(2, '0')).join(' ');
      consoleLog('debug', `Account data (first ${preview.length} bytes): ${hexDump}`);

      // Parse the account data according to the Lockbox struct:
      // [discriminator (8), owner (32), ciphertext_len (4), ciphertext, nonce (24), salt (32), last_action_slot (8), bump (1)]
      const data = accountInfo.data;

      // Anchor accounts start with 8-byte discriminator
      if (data.length < 8) {
        throw new Error('Account data too small');
      }

      let offset = 8; // Skip discriminator

      // Skip owner pubkey (32 bytes)
      if (data.length < offset + 32) {
        throw new Error('Not enough data for owner field');
      }
      offset += 32;

      // Read Vec<u8> ciphertext (4 byte length prefix + data)
      if (data.length < offset + 4) {
        throw new Error('Not enough data for ciphertext length field');
      }

      const ciphertextLen = data.readUInt32LE(offset);
      offset += 4;
      consoleLog('debug', `Ciphertext length: ${ciphertextLen} bytes`);

      // Read ciphertext
      if (data.length < offset + ciphertextLen) {
        throw new Error(`Not enough data for ciphertext: need ${ciphertextLen}, have ${data.length - offset}`);
      }
      const ciphertext = data.slice(offset, offset + ciphertextLen);
      offset += ciphertextLen;

      // Read nonce (24 bytes)
      if (data.length < offset + 24) {
        throw new Error(`Not enough data for nonce: need 24, have ${data.length - offset}`);
      }
      const nonce = data.slice(offset, offset + 24);
      offset += 24;

      // Read salt (32 bytes)
      if (data.length < offset + 32) {
        throw new Error(`Not enough data for salt: need 32, have ${data.length - offset}`);
      }
      const salt = data.slice(offset, offset + 32);

      // Validate sizes
      consoleLog('debug', `Parsed: ciphertext=${ciphertext.length}B, nonce=${nonce.length}B, salt=${salt.length}B`);

      if (nonce.length !== 24) {
        throw new Error(
          `Invalid nonce size: expected 24 bytes, got ${nonce.length} bytes. ` +
          `This may be old data stored before the encryption fix. Please store fresh data.`
        );
      }
      if (salt.length !== 32) {
        throw new Error(
          `Invalid salt size: expected 32 bytes, got ${salt.length} bytes. ` +
          `This may be old data stored before the encryption fix. Please store fresh data.`
        );
      }

      addLog('progress', 'Requesting signature for decryption...');

      // Get fresh signature to derive decryption key with the on-chain salt
      const challenge = generateChallenge(publicKey);
      const signature = await signMessage(challenge);

      // Derive session key using the salt from on-chain data
      const decryptionKey = await deriveSessionKey(publicKey, signature, salt);

      addLog('progress', 'Decrypting data...');

      // Decrypt the data
      const plaintext = decryptAEAD(ciphertext, nonce, decryptionKey);
      const decryptedText = new TextDecoder().decode(plaintext);

      // Wipe the temporary decryption key
      wipeSensitiveData(decryptionKey);

      // Show decrypted data (never stored, only in memory)
      setRetrievedData(decryptedText);
      setShowRetrieved(true);

      addLog('success', 'Data decrypted successfully');
      addLog('warning', 'Data will auto-hide in 30 seconds');

      // Auto-hide after 30 seconds
      setTimeout(() => {
        setShowRetrieved(false);
        setRetrievedData('');
        consoleLog('debug', 'Decrypted data hidden and cleared from memory');
      }, 30000);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      addLog('error', `Retrieval failed: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  // Clear local state and warn about account
  const handleClearData = () => {
    const confirmed = window.confirm(
      '⚠️ This will clear the local cached state.\n\n' +
      'Your on-chain data will remain, but you can overwrite it by storing new data.\n\n' +
      'To fully delete the account and reclaim rent (~0.009 SOL), you would need a program update.\n\n' +
      'Continue?'
    );

    if (!confirmed) {
      return;
    }

    setStoredItems([]);
    setRetrievedData('');
    setShowRetrieved(false);
    setConfirmOverwrite(false);
    addLog('info', 'Local state cleared. You can now store fresh data to overwrite the account.');
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
        <h1>🔒 Solana Lockbox</h1>
        <p className="subtitle">Wallet-Tied Encrypted Storage on Solana</p>
        <WalletMultiButton />
      </header>

      {publicKey && (
        <>
          <div className="tabs">
            <button
              className={`tab ${activeTab === 'app' ? 'active' : ''}`}
              onClick={() => setActiveTab('app')}
            >
              App
            </button>
            <button
              className={`tab ${activeTab === 'quickstart' ? 'active' : ''}`}
              onClick={() => setActiveTab('quickstart')}
            >
              Quick Start
            </button>
            <button
              className={`tab ${activeTab === 'faq' ? 'active' : ''}`}
              onClick={() => setActiveTab('faq')}
            >
              FAQ
            </button>
          </div>

          {activeTab === 'app' ? (
            <main className="main-content">
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

                {storedItems.length > 0 && (
                  <div className="overwrite-warning">
                    <label className="overwrite-checkbox">
                      <input
                        type="checkbox"
                        checked={confirmOverwrite}
                        onChange={(e) => setConfirmOverwrite(e.target.checked)}
                        disabled={loading}
                      />
                      <span>⚠️ I understand this will overwrite my existing data</span>
                    </label>
                  </div>
                )}

                <button
                  onClick={handleStore}
                  disabled={loading || !data.trim() || isOverLimit || (storedItems.length > 0 && !confirmOverwrite)}
                  className="action-button"
                >
                  {loading ? '⋯ Processing...' : '🔐 Encrypt & Store (0.001 SOL)'}
                </button>

                {storedItems.length > 0 && (
                  <button
                    onClick={() => {
                      if (storedItems.length > 0) {
                        handleRetrieveItem(storedItems[0]);
                      }
                    }}
                    disabled={loading}
                    className="action-button decrypt-button"
                  >
                    🔓 Decrypt & View Latest
                  </button>
                )}

                {storedItems.length > 0 && (
                  <button
                    onClick={handleClearData}
                    disabled={loading}
                    className="action-button"
                    style={{ background: '#e74c3c', marginTop: '8px' }}
                  >
                    🗑️ Clear Stored Data
                  </button>
                )}
              </section>

              {showRetrieved && retrievedData && (
                <section className="retrieve-section">
                  <div className="retrieved-data">
                    <div className="reveal-header">
                      <span>🔓 Decrypted Data (auto-hide in 30s)</span>
                      <div>
                        <button onClick={() => {
                          navigator.clipboard.writeText(retrievedData);
                          addLog('info', 'Decrypted data copied to clipboard');
                        }}>Copy</button>
                        <button onClick={() => {
                          setShowRetrieved(false);
                          setRetrievedData('');
                          addLog('info', 'Manually cleared decrypted data from view');
                        }}>Hide</button>
                      </div>
                    </div>
                    <pre>{retrievedData}</pre>
                  </div>
                </section>
              )}

              <section className="activity-log-section">
                <ActivityLog logs={logs} onCopyTxHash={handleCopyTxHash} />
              </section>
            </main>
          ) : activeTab === 'quickstart' ? (
            <div className="faq-tab-content">
              <QuickStart />
            </div>
          ) : (
            <div className="faq-tab-content">
              <FAQ />
            </div>
          )}
        </>
      )}

      {!publicKey && (
        <>
          <div className="tabs">
            <button
              className={`tab ${activeTab === 'app' ? 'active' : ''}`}
              onClick={() => setActiveTab('app')}
            >
              App
            </button>
            <button
              className={`tab ${activeTab === 'quickstart' ? 'active' : ''}`}
              onClick={() => setActiveTab('quickstart')}
            >
              Quick Start
            </button>
            <button
              className={`tab ${activeTab === 'faq' ? 'active' : ''}`}
              onClick={() => setActiveTab('faq')}
            >
              FAQ
            </button>
          </div>

          {activeTab === 'app' ? (
            <div className="connect-prompt">
              <p>Connect your Solana wallet to get started</p>
              <p className="connect-hint">Supports Phantom, Solflare, and other Solana wallets</p>
            </div>
          ) : activeTab === 'quickstart' ? (
            <div className="faq-tab-content">
              <QuickStart />
            </div>
          ) : (
            <div className="faq-tab-content">
              <FAQ />
            </div>
          )}
        </>
      )}

      <footer>
        <p>Zero persistent storage • Keys derived from wallet • XChaCha20-Poly1305 AEAD</p>
        <p className="network-badge">🌐 Devnet</p>
        <p className="security-note">🔒 Session auto-expires after 15 minutes of inactivity</p>
        <p className="credits">
          created with ❤️ by <a href="https://x.com/0xgraffito" target="_blank" rel="noopener noreferrer">GRAFFITO</a>
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
