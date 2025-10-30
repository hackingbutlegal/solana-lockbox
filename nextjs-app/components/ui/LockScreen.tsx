'use client';

import React, { useState } from 'react';
import { useLock } from '../../contexts/LockContext';

/**
 * Lock Screen Component
 *
 * Displays when app is locked, providing unlock options
 */

export function LockScreen() {
  const {
    unlockWithWallet,
    unlockWithBiometric,
    hasBiometricSetup,
  } = useLock();

  const [unlocking, setUnlocking] = useState(false);
  const [error, setError] = useState('');

  const handleUnlockWallet = async () => {
    setUnlocking(true);
    setError('');

    try {
      const success = await unlockWithWallet();
      if (!success) {
        setError('Failed to unlock. Please try again.');
      }
    } catch (err) {
      console.error('Unlock error:', err);
      setError('Failed to unlock. Please try again.');
    } finally {
      setUnlocking(false);
    }
  };

  const handleUnlockBiometric = async () => {
    setUnlocking(true);
    setError('');

    try {
      const success = await unlockWithBiometric();
      if (!success) {
        setError('Biometric authentication failed. Try unlocking with wallet.');
      }
    } catch (err) {
      console.error('Biometric unlock error:', err);
      setError('Biometric authentication failed. Try unlocking with wallet.');
    } finally {
      setUnlocking(false);
    }
  };

  return (
    <div className="lock-screen">
      <div className="lock-content">
        <div className="lock-icon">🔒</div>
        <h1>Vault Locked</h1>
        <p>Your vault is locked for security. Please unlock to continue.</p>

        {error && (
          <div className="error-message">
            <span className="error-icon">⚠️</span>
            {error}
          </div>
        )}

        <div className="unlock-actions">
          <button
            className="btn-unlock-wallet"
            onClick={handleUnlockWallet}
            disabled={unlocking}
          >
            {unlocking ? '🔄 Unlocking...' : '🔓 Unlock with Wallet'}
          </button>

          {hasBiometricSetup && (
            <button
              className="btn-unlock-biometric"
              onClick={handleUnlockBiometric}
              disabled={unlocking}
            >
              {unlocking ? '🔄 Unlocking...' : '🔑 Unlock with Biometric'}
            </button>
          )}
        </div>

        <div className="lock-info">
          <p>
            💡 Your session expired or you manually locked the app.
            Unlock using your connected wallet signature.
          </p>
        </div>
      </div>

      <style jsx>{`
        .lock-screen {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
        }

        .lock-content {
          max-width: 500px;
          width: 100%;
          padding: 2rem;
          text-align: center;
        }

        .lock-icon {
          font-size: 5rem;
          margin-bottom: 1.5rem;
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

        h1 {
          margin: 0 0 1rem 0;
          font-size: 2.5rem;
          font-weight: 800;
          color: white;
          text-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
        }

        p {
          margin: 0 0 2rem 0;
          font-size: 1.1rem;
          color: rgba(255, 255, 255, 0.95);
        }

        .error-message {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 1rem;
          margin-bottom: 1.5rem;
          background: rgba(255, 255, 255, 0.15);
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-radius: 8px;
          color: white;
          font-weight: 600;
        }

        .error-icon {
          font-size: 1.5rem;
        }

        .unlock-actions {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          margin-bottom: 2rem;
        }

        .btn-unlock-wallet,
        .btn-unlock-biometric {
          padding: 1rem 2rem;
          background: white;
          color: #667eea;
          border: none;
          border-radius: 12px;
          font-size: 1.1rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
        }

        .btn-unlock-wallet:hover:not(:disabled),
        .btn-unlock-biometric:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 25px rgba(0, 0, 0, 0.3);
        }

        .btn-unlock-wallet:disabled,
        .btn-unlock-biometric:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-unlock-biometric {
          background: rgba(255, 255, 255, 0.15);
          color: white;
          border: 2px solid rgba(255, 255, 255, 0.3);
        }

        .lock-info {
          background: rgba(255, 255, 255, 0.1);
          border: 2px solid rgba(255, 255, 255, 0.2);
          border-radius: 12px;
          padding: 1.5rem;
        }

        .lock-info p {
          margin: 0;
          font-size: 0.95rem;
          color: rgba(255, 255, 255, 0.9);
        }

        @media (max-width: 768px) {
          .lock-content {
            padding: 1.5rem;
          }

          h1 {
            font-size: 2rem;
          }

          .lock-icon {
            font-size: 4rem;
          }
        }
      `}</style>
    </div>
  );
}
