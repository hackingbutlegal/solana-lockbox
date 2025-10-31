'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, useLockbox } from '../../contexts';
import { OrphanedChunkRecovery } from '../ui/OrphanedChunkRecovery';
import { useToast } from '../ui/Toast';

/**
 * Initialize Vault Component
 *
 * Standalone page for vault initialization
 */

export function InitializeVault() {
  const router = useRouter();
  const toast = useToast();
  const { client, loading: authLoading, error: authError, initializeSession } = useAuth();
  const { masterLockbox, error: lockboxError, refreshLockbox } = useLockbox();

  const error = authError || lockboxError;
  const loading = authLoading;

  // Auto-redirect if vault already exists
  useEffect(() => {
    if (masterLockbox && !loading) {
      console.log('[InitializeVault] Vault already exists, redirecting to dashboard...');
      toast.showInfo('Your vault already exists! Redirecting to dashboard...');
      router.push('/');
    }
  }, [masterLockbox, loading, router, toast]);

  return (
    <div className="initialize-vault">
      <div className="vault-setup-prompt">
        <div className="vault-card">
          {(error || lockboxError) && (error?.includes('IDL not loaded') || lockboxError?.includes('IDL not loaded')) ? (
            <>
              <div className="info-message">
                <p><strong>Status:</strong> ✅ Program Deployed to Devnet</p>
                <p><strong>Program ID:</strong> 7JxsHjdReydiz36jwsWuvwwR28qqK6V454VwFJnnSkoB</p>
                <p>
                  The program is deployed with all security fixes, but the IDL (Interface Description Language) needs to be generated for the frontend to interact with it.
                </p>
              </div>

              <div className="info-box">
                <h3>What&apos;s Next?</h3>
                <ul>
                  <li>✅ v2 Rust program code complete</li>
                  <li>✅ All critical security fixes applied</li>
                  <li>✅ Frontend dashboard complete</li>
                  <li>✅ SDK complete (client, types, utils)</li>
                  <li>✅ Deployed to devnet</li>
                  <li>⏳ Generate program IDL (blocked by anchor-syn version issue)</li>
                  <li>⏳ Full integration testing</li>
                </ul>
              </div>

              <div className="info-box">
                <h3>Technical Details:</h3>
                <p>
                  The program binary was successfully built and deployed using cargo-build-sbf.
                  IDL generation failed due to a proc-macro2 incompatibility in anchor-syn 0.30.1.
                </p>
                <p>
                  <strong>Security Fixes Deployed:</strong>
                </p>
                <ul>
                  <li>✅ Fixed FEE_RECEIVER .unwrap() panic risk</li>
                  <li>✅ Added checked arithmetic for overflow prevention</li>
                  <li>✅ Added chunk validation and duplicate detection</li>
                </ul>
              </div>
            </>
          ) : (
            <>
              <div className="vault-icon">🔐</div>
              <h1>Initialize Your Vault</h1>
              <p>Create your password vault to start storing<br/>passwords securely on the blockchain.</p>

              {error && (
                <div className="error-message">
                  <span className="error-icon">⚠️</span>
                  {error}
                </div>
              )}

              {/* Orphaned Chunk Recovery Component */}
              <OrphanedChunkRecovery
                client={client}
                onRecoveryComplete={async () => {
                  // Initialize session to prevent lock screen
                  await initializeSession();
                  toast.showSuccess('Recovery complete! Redirecting to password manager...');
                  setTimeout(() => router.push('/'), 2000);
                }}
                onCancel={() => {
                  // User cancelled, they can still try normal initialization
                }}
              />

              <div className="vault-actions">
                <button
                  onClick={async () => {
                    if (client && !loading) {
                      try {
                        console.log('Creating password vault...');
                        await client.initializeMasterLockbox();
                        console.log('Vault created! Refreshing lockbox state...');

                        // Refresh lockbox to update context with new vault
                        await refreshLockbox();

                        // Initialize session to prevent lock screen from appearing
                        console.log('Initializing session...');
                        await initializeSession();
                        console.log('Session initialized!');

                        toast.showSuccess('Password vault created! Redirecting to password manager...');

                        // Redirect to password manager
                        setTimeout(() => router.push('/'), 500);
                      } catch (err: any) {
                        console.error('Failed to initialize:', err);

                        // Handle specific errors
                        if (err.message?.includes('already initialized') ||
                            err.message?.includes('already been processed') ||
                            err.message?.includes('Unexpected error') ||
                            err.toString().includes('WalletSendTransactionError')) {
                          // Account likely already exists
                          toast.showInfo('Your password vault already exists! Redirecting...');
                          // Refresh lockbox state before redirecting
                          await refreshLockbox();
                          // Initialize session to prevent lock screen
                          await initializeSession();
                          setTimeout(() => router.push('/'), 500);
                        } else if (err.message?.includes('orphaned')) {
                          // If orphaned chunks error, the recovery component should have shown
                          toast.showError('Please use the recovery button above to fix orphaned chunks first');
                        } else {
                          toast.showError(`Failed to create vault: ${err.message || 'Unknown error'}`);
                        }
                      }
                    }
                  }}
                  disabled={loading}
                  className="btn-create-vault"
                >
                  {loading ? '🔄 Initializing...' : '🔓 Create Password Vault'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <style jsx>{`
        .initialize-vault {
          min-height: 100vh;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }

        .vault-setup-prompt {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          padding: 2rem;
        }

        .vault-card {
          max-width: 500px;
          width: 100%;
          padding: 2rem;
          text-align: center;
        }

        .vault-icon {
          font-size: 4rem;
          margin-bottom: 2rem;
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.1);
          }
        }

        .vault-card h1 {
          margin: 0 0 2rem 0;
          font-size: 2rem;
          font-weight: 800;
          color: white;
          text-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
        }

        .vault-card p {
          margin: 0 0 2rem 0;
          font-size: 1rem;
          color: rgba(255, 255, 255, 0.95);
        }

        .vault-actions {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          margin-bottom: 2rem;
        }

        .btn-create-vault {
          padding: 1rem 2rem;
          background: white;
          color: #667eea;
          border: none;
          border-radius: 12px;
          font-size: 1rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
        }

        .btn-create-vault:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 25px rgba(0, 0, 0, 0.3);
        }

        .btn-create-vault:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .error-message {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          padding: 1rem 1.5rem;
          margin-bottom: 2rem;
          background: rgba(255, 255, 255, 0.15);
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-radius: 12px;
          color: white;
          font-weight: 600;
          font-size: 1rem;
        }

        .error-icon {
          font-size: 1.25rem;
        }

        .info-box {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 1.5rem;
          text-align: left;
          margin-bottom: 1rem;
          color: white;
        }

        .info-box h3 {
          margin: 0 0 1rem 0;
          font-size: 1.1rem;
        }

        .info-box p {
          margin: 0.5rem 0;
          font-size: 0.95rem;
        }

        .info-box ul {
          list-style: none;
          padding: 0;
          margin: 0.5rem 0;
        }

        .info-box li {
          padding: 0.5rem 0;
        }

        .info-message {
          background: rgba(255, 255, 255, 0.15);
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-radius: 12px;
          padding: 1rem;
          margin-bottom: 1rem;
          text-align: center;
          color: white;
        }

        .info-message p {
          margin: 0.5rem 0;
        }

        /* Mobile responsive */
        @media (max-width: 768px) {
          .vault-setup-prompt {
            padding: 1rem;
            min-height: calc(100vh - 120px);
          }

          .vault-card {
            padding: 1.25rem;
          }

          .vault-icon {
            font-size: 3rem;
            margin-bottom: 1.5rem;
          }

          .vault-card h1 {
            font-size: 1.65rem;
            margin-bottom: 1.5rem;
          }

          .vault-card p {
            font-size: 0.95rem;
            margin-bottom: 1.5rem;
          }

          .btn-create-vault {
            font-size: 0.95rem;
            padding: 0.875rem 1.5rem;
            min-height: 48px; /* Better touch target */
          }

          .info-box {
            padding: 1rem;
            font-size: 0.9rem;
          }

          .info-box h3 {
            font-size: 1rem;
          }

          .info-box li {
            padding: 0.4rem 0;
            font-size: 0.875rem;
          }

          .error-message {
            padding: 0.875rem 1.25rem;
            font-size: 0.9rem;
          }

          .info-message {
            padding: 0.875rem;
            font-size: 0.9rem;
          }

          .info-message p {
            font-size: 0.85rem;
          }
        }

        @media (max-width: 480px) {
          .vault-setup-prompt {
            padding: 0.75rem;
          }

          .vault-card {
            padding: 1rem;
          }

          .vault-icon {
            font-size: 2.5rem;
            margin-bottom: 1rem;
          }

          .vault-card h1 {
            font-size: 1.5rem;
            margin-bottom: 1rem;
          }

          .vault-card p {
            font-size: 0.9rem;
            margin-bottom: 1rem;
          }

          .btn-create-vault {
            font-size: 0.9rem;
            padding: 0.75rem 1.25rem;
          }

          .info-box {
            padding: 0.875rem;
          }

          .info-box h3 {
            font-size: 0.95rem;
          }

          .info-box li {
            font-size: 0.825rem;
          }
        }
      `}</style>
    </div>
  );
}
