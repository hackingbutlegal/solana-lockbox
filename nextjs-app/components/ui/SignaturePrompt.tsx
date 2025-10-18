'use client';

import React from 'react';

/**
 * SignaturePrompt Component
 *
 * Beautiful modal that explains why the user needs to sign a message
 * and provides context about what's happening.
 */

export interface SignaturePromptProps {
  isOpen: boolean;
  onRetry: () => void;
  error?: string | null;
  isLoading?: boolean;
}

export function SignaturePrompt({ isOpen, onRetry, error, isLoading }: SignaturePromptProps) {
  if (!isOpen) return null;

  const isUserRejection = error?.includes('Signature required') || error?.includes('approve the request');

  return (
    <div className="signature-prompt-overlay">
      <div className="signature-prompt-card">
        <div className="signature-icon-container">
          {isLoading ? (
            <div className="signature-icon loading">
              <div className="spinner"></div>
            </div>
          ) : isUserRejection ? (
            <div className="signature-icon warning">⚠️</div>
          ) : error ? (
            <div className="signature-icon error">❌</div>
          ) : (
            <div className="signature-icon pending">🔐</div>
          )}
        </div>

        <h2>
          {isLoading ? 'Waiting for Signature...' :
           isUserRejection ? 'Signature Required' :
           error ? 'Signature Failed' :
           'Sign to Continue'}
        </h2>

        <div className="signature-content">
          {isLoading ? (
            <p>Please approve the signature request in your wallet.</p>
          ) : isUserRejection ? (
            <>
              <p>Your passwords are encrypted and can only be decrypted with your wallet signature.</p>
              <p className="highlight">This signature doesn't send any transaction or cost any SOL.</p>
            </>
          ) : error ? (
            <>
              <p className="error-text">{error}</p>
              <p>Please try again or check your wallet connection.</p>
            </>
          ) : (
            <>
              <p>To access your encrypted passwords, we need you to sign a message with your wallet.</p>
              <p className="info-text">This signature is used to derive your encryption key.</p>
            </>
          )}
        </div>

        <div className="signature-features">
          <div className="feature-item">
            <span className="feature-icon">🔒</span>
            <span>Zero-knowledge encryption</span>
          </div>
          <div className="feature-item">
            <span className="feature-icon">⚡</span>
            <span>No transaction fees</span>
          </div>
          <div className="feature-item">
            <span className="feature-icon">🛡️</span>
            <span>Your keys, your data</span>
          </div>
        </div>

        {(isUserRejection || error) && !isLoading && (
          <button className="btn-retry" onClick={onRetry}>
            Try Again
          </button>
        )}

        {isLoading && (
          <p className="waiting-text">Check your wallet for the signature request...</p>
        )}
      </div>

      <style jsx>{`
        .signature-prompt-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(15, 23, 42, 0.85);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 10000;
          backdrop-filter: blur(12px) saturate(180%);
          animation: fadeIn 0.2s ease-out;
          padding: 1rem;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .signature-prompt-card {
          background: white;
          border-radius: 24px;
          padding: 3rem;
          max-width: 500px;
          width: 100%;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(0, 0, 0, 0.05);
          animation: slideUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
          text-align: center;
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(30px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .signature-icon-container {
          margin-bottom: 1.5rem;
        }

        .signature-icon {
          width: 80px;
          height: 80px;
          margin: 0 auto;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 2.5rem;
          position: relative;
        }

        .signature-icon.loading {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }

        .signature-icon.pending {
          background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
          animation: pulse 2s ease-in-out infinite;
        }

        .signature-icon.warning {
          background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
        }

        .signature-icon.error {
          background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.8;
            transform: scale(1.05);
          }
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 4px solid rgba(255, 255, 255, 0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        h2 {
          margin: 0 0 1rem 0;
          font-size: 1.75rem;
          font-weight: 800;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          letter-spacing: -0.02em;
        }

        .signature-content {
          margin-bottom: 2rem;
        }

        .signature-content p {
          margin: 0.75rem 0;
          font-size: 1rem;
          line-height: 1.6;
          color: #4b5563;
        }

        .highlight {
          font-weight: 600;
          color: #667eea;
          background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
          padding: 0.75rem 1rem;
          border-radius: 12px;
          border: 1px solid #bfdbfe;
        }

        .info-text {
          font-size: 0.9375rem;
          color: #6b7280;
          font-style: italic;
        }

        .error-text {
          color: #dc2626;
          font-weight: 600;
        }

        .signature-features {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1rem;
          margin-bottom: 2rem;
          padding: 1.5rem;
          background: linear-gradient(135deg, #fafbfc 0%, #f8f9fa 100%);
          border-radius: 16px;
          border: 1px solid #e5e7eb;
        }

        .feature-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.875rem;
          color: #4b5563;
          font-weight: 500;
        }

        .feature-icon {
          font-size: 1.5rem;
        }

        .btn-retry {
          width: 100%;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 12px;
          padding: 1rem 2rem;
          font-size: 1.0625rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.25);
        }

        .btn-retry:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(102, 126, 234, 0.35);
        }

        .btn-retry:active {
          transform: translateY(0);
        }

        .waiting-text {
          margin-top: 1.5rem;
          font-size: 0.9375rem;
          color: #6b7280;
          font-style: italic;
        }

        @media (max-width: 640px) {
          .signature-prompt-card {
            padding: 2rem 1.5rem;
            border-radius: 16px;
          }

          .signature-icon {
            width: 64px;
            height: 64px;
            font-size: 2rem;
          }

          .spinner {
            width: 32px;
            height: 32px;
          }

          h2 {
            font-size: 1.5rem;
          }

          .signature-features {
            grid-template-columns: 1fr;
            gap: 0.75rem;
            padding: 1rem;
          }

          .feature-item {
            flex-direction: row;
            justify-content: center;
            gap: 0.75rem;
          }
        }
      `}</style>
    </div>
  );
}
