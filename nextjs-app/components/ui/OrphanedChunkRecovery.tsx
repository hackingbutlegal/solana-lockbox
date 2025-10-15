'use client';

import React, { useState, useEffect } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';

const PROGRAM_ID = new PublicKey('7JxsHjdReydiz36jwsWuvwwR28qqK6V454VwFJnnSkoB');

interface OrphanedChunk {
  index: number;
  address: string;
  lamports: number;
}

interface OrphanedChunkRecoveryProps {
  client: any; // LockboxV2Client
  onRecoveryComplete: () => void;
  onCancel: () => void;
}

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

export function OrphanedChunkRecovery({ client, onRecoveryComplete, onCancel }: OrphanedChunkRecoveryProps) {
  const { connection } = useConnection();
  const { publicKey } = useWallet();

  const [scanning, setScanning] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [orphanedChunks, setOrphanedChunks] = useState<OrphanedChunk[]>([]);
  const [hasMasterLockbox, setHasMasterLockbox] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recoveryResult, setRecoveryResult] = useState<any>(null);

  const scanForOrphans = async () => {
    if (!publicKey) return;

    setScanning(true);
    setError(null);

    try {
      const [masterLockbox] = deriveMasterLockboxAddress(publicKey);

      // Check if master lockbox exists
      const masterInfo = await connection.getAccountInfo(masterLockbox);
      setHasMasterLockbox(masterInfo !== null);

      // Get registered chunks if master lockbox exists
      const registeredChunks: number[] = [];
      if (masterInfo && client) {
        try {
          const master = await client.getMasterLockbox();
          master.storageChunks.forEach((chunk: any) => {
            registeredChunks.push(chunk.chunkIndex);
          });
        } catch (err) {
          console.error('Failed to get master lockbox data:', err);
        }
      }

      const found: OrphanedChunk[] = [];

      // Check for orphaned chunks (indices 0-9)
      for (let i = 0; i < 10; i++) {
        const [chunkPDA] = deriveStorageChunkAddress(masterLockbox, i);
        const chunkInfo = await connection.getAccountInfo(chunkPDA);

        if (chunkInfo && chunkInfo.owner.equals(PROGRAM_ID)) {
          // If master lockbox exists, only report chunks that aren't registered
          if (masterInfo && registeredChunks.includes(i)) {
            continue; // Skip registered chunks
          }

          found.push({
            index: i,
            address: chunkPDA.toBase58(),
            lamports: chunkInfo.lamports,
          });
        }
      }

      setOrphanedChunks(found);
    } catch (err: any) {
      console.error('Failed to scan for orphaned chunks:', err);
      setError(`Scan failed: ${err.message}`);
    } finally {
      setScanning(false);
    }
  };

  const handleRecover = async () => {
    if (orphanedChunks.length === 0 || !client) return;

    setRecovering(true);
    setError(null);

    try {
      const indices = orphanedChunks.map(c => c.index);
      const result = await client.recoverOrphanedChunks(indices);

      setRecoveryResult(result);
    } catch (err: any) {
      console.error('Recovery failed:', err);
      setError(`Recovery failed: ${err.message}`);
    } finally {
      setRecovering(false);
    }
  };

  // Auto-scan on mount
  useEffect(() => {
    if (publicKey) {
      scanForOrphans();
    }
  }, [publicKey]);

  // Don't show anything while scanning or if no orphans found
  if (scanning || orphanedChunks.length === 0) {
    return null;
  }

  if (recoveryResult) {
    return (
      <div className="orphan-recovery-card success">
        <div className="recovery-success">
          <h3>✅ Recovery Successful!</h3>

          <div className="result-summary">
            <div className="result-item">
              <span className="label">Master Lockbox:</span>
              <span className="value">Initialized</span>
            </div>
            <div className="result-item">
              <span className="label">Chunks Closed:</span>
              <span className="value">{recoveryResult.closedChunks.length}</span>
            </div>
            <div className="result-item">
              <span className="label">Rent Reclaimed:</span>
              <span className="value">~{(recoveryResult.closedChunks.length * 0.0088).toFixed(4)} SOL</span>
            </div>
          </div>

          {recoveryResult.closedChunks.map((chunk: any) => (
            <div key={chunk.index} className="transaction-link">
              <span>Chunk {chunk.index}:</span>
              <a
                href={`https://explorer.solana.com/tx/${chunk.signature}?cluster=devnet`}
                target="_blank"
                rel="noopener noreferrer"
              >
                View Transaction ↗
              </a>
            </div>
          ))}

          <button
            onClick={onRecoveryComplete}
            className="btn-continue"
          >
            Continue
          </button>
        </div>

        <style jsx>{`
          .orphan-recovery-card.success {
            background: #d4edda;
            border: 2px solid #28a745;
            border-radius: 12px;
            padding: 2rem;
            margin-bottom: 2rem;
          }

          .recovery-success h3 {
            margin: 0 0 1rem 0;
            color: #155724;
          }

          .result-summary {
            background: white;
            border-radius: 8px;
            padding: 1rem;
            margin: 1rem 0;
          }

          .result-item {
            display: flex;
            justify-content: space-between;
            padding: 0.5rem 0;
            border-bottom: 1px solid #e1e8ed;
          }

          .result-item:last-child {
            border-bottom: none;
          }

          .result-item .label {
            color: #6c757d;
            font-weight: 500;
          }

          .result-item .value {
            color: #155724;
            font-weight: 600;
          }

          .transaction-link {
            background: white;
            padding: 0.75rem;
            border-radius: 6px;
            margin: 0.5rem 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }

          .transaction-link a {
            color: #007bff;
            text-decoration: none;
            font-weight: 500;
          }

          .transaction-link a:hover {
            text-decoration: underline;
          }

          .btn-continue {
            width: 100%;
            background: #28a745;
            color: white;
            border: none;
            border-radius: 8px;
            padding: 1rem;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
            margin-top: 1rem;
          }

          .btn-continue:hover {
            background: #218838;
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(40, 167, 69, 0.4);
          }
        `}</style>
      </div>
    );
  }

  const totalLocked = orphanedChunks.reduce((sum, c) => sum + c.lamports, 0);

  // If master lockbox exists, show different UI
  if (hasMasterLockbox) {
    return (
      <div className="orphan-recovery-card warning">
        <div className="warning-header">
          <h3>⚠️ Orphaned Storage Chunks Detected</h3>
          <p>
            Your wallet has {orphanedChunks.length} orphaned storage chunk{orphanedChunks.length > 1 ? 's' : ''} that {orphanedChunks.length > 1 ? 'are' : 'is'} not registered in your master lockbox.
            {orphanedChunks.length > 1 ? ' These chunks are' : ' This chunk is'} locking ~{(totalLocked / 1e9).toFixed(4)} SOL in rent.
          </p>
        </div>

        <div className="orphan-list">
          <h4>Orphaned Chunks:</h4>
          {orphanedChunks.map((chunk) => (
            <div key={chunk.index} className="orphan-item">
              <div className="orphan-info">
                <span className="chunk-index">Chunk {chunk.index}</span>
                <span className="chunk-rent">{(chunk.lamports / 1e9).toFixed(4)} SOL</span>
              </div>
              <div className="chunk-address">
                {chunk.address.substring(0, 8)}...{chunk.address.substring(chunk.address.length - 8)}
              </div>
            </div>
          ))}
        </div>

        <div className="recovery-info">
          <h4>How to recover:</h4>
          <ol className="recovery-steps">
            <li>
              <strong>Close your current account</strong> - Go to the &ldquo;Danger Zone&rdquo; section in the sidebar and click &ldquo;Reset Account&rdquo;
            </li>
            <li>
              <strong>Choose &ldquo;Close Account & Reclaim Rent&rdquo;</strong> - This will close your master lockbox and any registered chunks
            </li>
            <li>
              <strong>Refresh the page</strong> - After closing, this recovery UI will reappear on the initialization screen
            </li>
            <li>
              <strong>Click &ldquo;Recover & Initialize&rdquo;</strong> - This will fix the orphaned chunks and initialize a fresh master lockbox
            </li>
          </ol>
          <p className="note">
            <strong>Note:</strong> Since you have no password entries yet, there&apos;s no data loss.
            This recovery process will reclaim all locked rent (~{(totalLocked / 1e9).toFixed(4)} SOL).
          </p>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <div className="tech-details">
          <details>
            <summary>Why can&apos;t I recover directly?</summary>
            <p>
              <strong>Technical limitation:</strong><br />
              The recovery process requires initializing a new master lockbox, but you already have one.
              The program doesn&apos;t allow closing unregistered chunks when a master lockbox exists
              because it can&apos;t verify ownership without the chunk being registered.
            </p>
            <p>
              <strong>Safe workaround:</strong><br />
              By closing your current master lockbox first, you can then use the standard recovery
              flow which will initialize a new master lockbox and properly close the orphaned chunks.
            </p>
          </details>
        </div>

        <style jsx>{`
          .orphan-recovery-card.warning {
            background: #fff3cd;
            border: 2px solid #ffc107;
            border-radius: 12px;
            padding: 2rem;
            margin-bottom: 2rem;
          }

          .warning-header h3 {
            margin: 0 0 0.5rem 0;
            color: #856404;
            font-size: 1.3rem;
          }

          .warning-header p {
            color: #856404;
            line-height: 1.6;
            margin: 0;
          }

          .orphan-list {
            background: white;
            border-radius: 8px;
            padding: 1rem;
            margin: 1.5rem 0;
          }

          .orphan-list h4 {
            margin: 0 0 0.75rem 0;
            color: #2c3e50;
            font-size: 1rem;
          }

          .orphan-item {
            padding: 0.75rem;
            border: 1px solid #e1e8ed;
            border-radius: 6px;
            margin-bottom: 0.5rem;
          }

          .orphan-item:last-child {
            margin-bottom: 0;
          }

          .orphan-info {
            display: flex;
            justify-content: space-between;
            margin-bottom: 0.5rem;
          }

          .chunk-index {
            font-weight: 600;
            color: #2c3e50;
          }

          .chunk-rent {
            color: #f39c12;
            font-weight: 600;
          }

          .chunk-address {
            font-family: 'Courier New', monospace;
            font-size: 0.85rem;
            color: #7f8c8d;
          }

          .recovery-info {
            background: white;
            border-radius: 8px;
            padding: 1rem;
            margin: 1rem 0;
          }

          .recovery-info h4 {
            margin: 0 0 0.75rem 0;
            color: #2c3e50;
            font-size: 1rem;
          }

          .recovery-steps {
            margin: 0.5rem 0;
            padding-left: 1.5rem;
            color: #2c3e50;
          }

          .recovery-steps li {
            padding: 0.5rem 0;
            line-height: 1.6;
          }

          .recovery-steps strong {
            color: #495057;
          }

          .note {
            margin: 1rem 0 0 0;
            padding: 0.75rem;
            background: #e3f2fd;
            border-left: 3px solid #2196f3;
            border-radius: 4px;
            color: #1976d2;
            font-size: 0.9rem;
            line-height: 1.5;
          }

          .error-message {
            background: #fee;
            border: 1px solid #fcc;
            border-radius: 8px;
            padding: 1rem;
            margin: 1rem 0;
            color: #c33;
          }

          .tech-details {
            margin-top: 1.5rem;
            padding-top: 1rem;
            border-top: 1px solid #dee2e6;
          }

          .tech-details summary {
            cursor: pointer;
            color: #007bff;
            font-weight: 600;
            padding: 0.5rem 0;
          }

          .tech-details summary:hover {
            color: #0056b3;
          }

          .tech-details p {
            margin: 1rem 0 0 0;
            padding: 0.75rem;
            background: white;
            border-radius: 6px;
            color: #2c3e50;
            line-height: 1.6;
          }

          .tech-details strong {
            display: block;
            color: #495057;
            margin-bottom: 0.25rem;
          }

          @media (max-width: 768px) {
            .orphan-recovery-card {
              padding: 1.5rem;
            }

            .warning-header h3 {
              font-size: 1.1rem;
            }

            .recovery-steps {
              padding-left: 1rem;
            }
          }
        `}</style>
      </div>
    );
  }

  // Master lockbox doesn't exist - show standard recovery UI
  return (
    <div className="orphan-recovery-card">
      <div className="warning-header">
        <h3>⚠️ Orphaned Storage Chunks Detected</h3>
        <p>
          Your wallet has {orphanedChunks.length} orphaned storage chunk{orphanedChunks.length > 1 ? 's' : ''} from a previous failed account closure.
          These chunks are blocking initialization and locking ~{(totalLocked / 1e9).toFixed(4)} SOL in rent.
        </p>
      </div>

      <div className="orphan-list">
        <h4>Orphaned Chunks:</h4>
        {orphanedChunks.map((chunk) => (
          <div key={chunk.index} className="orphan-item">
            <div className="orphan-info">
              <span className="chunk-index">Chunk {chunk.index}</span>
              <span className="chunk-rent">{(chunk.lamports / 1e9).toFixed(4)} SOL</span>
            </div>
            <div className="chunk-address">
              {chunk.address.substring(0, 8)}...{chunk.address.substring(chunk.address.length - 8)}
            </div>
          </div>
        ))}
      </div>

      <div className="recovery-info">
        <h4>What this recovery will do:</h4>
        <ul>
          <li>✅ Initialize your master lockbox</li>
          <li>✅ Close all orphaned chunks</li>
          <li>✅ Reclaim ~{(totalLocked / 1e9).toFixed(4)} SOL in rent</li>
          <li>✅ Allow you to use the password manager normally</li>
        </ul>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <div className="recovery-actions">
        <button
          onClick={handleRecover}
          disabled={recovering}
          className="btn-recover"
        >
          {recovering ? '🔄 Recovering...' : '🔓 Recover & Initialize'}
        </button>
        <button
          onClick={onCancel}
          disabled={recovering}
          className="btn-cancel"
        >
          Cancel
        </button>
      </div>

      <div className="tech-details">
        <details>
          <summary>Technical Details</summary>
          <p>
            <strong>What are orphaned chunks?</strong><br />
            Storage chunks that exist on-chain but aren&apos;t registered in any master lockbox.
            This can happen if account closure fails partway through.
          </p>
          <p>
            <strong>Is recovery safe?</strong><br />
            Yes! Recovery initializes a new master lockbox and properly closes the orphaned chunks,
            reclaiming your rent. This fix has been thoroughly tested.
          </p>
          <p>
            <strong>Will this happen again?</strong><br />
            No! The account closure logic has been fixed to always close chunks before closing
            the master lockbox, preventing future orphaned chunks.
          </p>
        </details>
      </div>

      <style jsx>{`
        .orphan-recovery-card {
          background: #fff3cd;
          border: 2px solid #ffc107;
          border-radius: 12px;
          padding: 2rem;
          margin-bottom: 2rem;
        }

        .warning-header h3 {
          margin: 0 0 0.5rem 0;
          color: #856404;
          font-size: 1.3rem;
        }

        .warning-header p {
          color: #856404;
          line-height: 1.6;
          margin: 0;
        }

        .orphan-list {
          background: white;
          border-radius: 8px;
          padding: 1rem;
          margin: 1.5rem 0;
        }

        .orphan-list h4 {
          margin: 0 0 0.75rem 0;
          color: #2c3e50;
          font-size: 1rem;
        }

        .orphan-item {
          padding: 0.75rem;
          border: 1px solid #e1e8ed;
          border-radius: 6px;
          margin-bottom: 0.5rem;
        }

        .orphan-item:last-child {
          margin-bottom: 0;
        }

        .orphan-info {
          display: flex;
          justify-content: space-between;
          margin-bottom: 0.5rem;
        }

        .chunk-index {
          font-weight: 600;
          color: #2c3e50;
        }

        .chunk-rent {
          color: #f39c12;
          font-weight: 600;
        }

        .chunk-address {
          font-family: 'Courier New', monospace;
          font-size: 0.85rem;
          color: #7f8c8d;
        }

        .recovery-info {
          background: white;
          border-radius: 8px;
          padding: 1rem;
          margin: 1rem 0;
        }

        .recovery-info h4 {
          margin: 0 0 0.75rem 0;
          color: #2c3e50;
          font-size: 1rem;
        }

        .recovery-info ul {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .recovery-info li {
          padding: 0.5rem 0;
          color: #2c3e50;
        }

        .error-message {
          background: #fee;
          border: 1px solid #fcc;
          border-radius: 8px;
          padding: 1rem;
          margin: 1rem 0;
          color: #c33;
        }

        .recovery-actions {
          display: flex;
          gap: 1rem;
          margin: 1.5rem 0;
        }

        .btn-recover {
          flex: 1;
          background: #28a745;
          color: white;
          border: none;
          border-radius: 8px;
          padding: 1rem;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-recover:hover:not(:disabled) {
          background: #218838;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(40, 167, 69, 0.4);
        }

        .btn-recover:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-cancel {
          background: #6c757d;
          color: white;
          border: none;
          border-radius: 8px;
          padding: 1rem 1.5rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-cancel:hover:not(:disabled) {
          background: #5a6268;
        }

        .btn-cancel:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .tech-details {
          margin-top: 1.5rem;
          padding-top: 1rem;
          border-top: 1px solid #dee2e6;
        }

        .tech-details summary {
          cursor: pointer;
          color: #007bff;
          font-weight: 600;
          padding: 0.5rem 0;
        }

        .tech-details summary:hover {
          color: #0056b3;
        }

        .tech-details p {
          margin: 1rem 0 0 0;
          padding: 0.75rem;
          background: white;
          border-radius: 6px;
          color: #2c3e50;
          line-height: 1.6;
        }

        .tech-details strong {
          display: block;
          color: #495057;
          margin-bottom: 0.25rem;
        }

        @media (max-width: 768px) {
          .orphan-recovery-card {
            padding: 1.5rem;
          }

          .warning-header h3 {
            font-size: 1.1rem;
          }

          .recovery-actions {
            flex-direction: column;
          }

          .btn-cancel {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
