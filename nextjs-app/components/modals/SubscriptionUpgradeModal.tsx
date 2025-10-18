'use client';

import React, { useState } from 'react';
import { SubscriptionTier, TIER_INFO } from '../../sdk/src/types-v2';
import { SubscriptionCard } from '../features/SubscriptionCard';

interface SubscriptionUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTier: SubscriptionTier;
  onUpgrade: (tier: SubscriptionTier) => Promise<void>;
}

export function SubscriptionUpgradeModal({
  isOpen,
  onClose,
  currentTier,
  onUpgrade,
}: SubscriptionUpgradeModalProps) {
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  if (!isOpen) return null;

  const handleSelectTier = (tier: SubscriptionTier) => {
    setSelectedTier(tier);
    setShowConfirmation(true);
  };

  const handleConfirmUpgrade = async () => {
    if (!selectedTier) return;

    try {
      setIsProcessing(true);
      await onUpgrade(selectedTier);
      // Success handled by parent component
      onClose();
    } catch (error) {
      console.error('Upgrade failed:', error);
      // Error handled by parent component
    } finally {
      setIsProcessing(false);
      setShowConfirmation(false);
      setSelectedTier(null);
    }
  };

  const handleCancelConfirmation = () => {
    setShowConfirmation(false);
    setSelectedTier(null);
  };

  const formatSOL = (lamports: number): string => {
    return `${(lamports / 1_000_000_000).toFixed(3)} SOL`;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        {!showConfirmation ? (
          <>
            <div className="modal-header">
              <h2>Upgrade Your Subscription</h2>
              <button className="modal-close" onClick={onClose}>
                ×
              </button>
            </div>

            <div className="modal-body">
              <p className="modal-description">
                Choose a plan that fits your needs. Upgrade anytime to unlock more storage and features.
              </p>

              <div className="tiers-grid">
                {([SubscriptionTier.Free, SubscriptionTier.Basic, SubscriptionTier.Premium, SubscriptionTier.Pro] as SubscriptionTier[]).map((tier) => (
                  <SubscriptionCard
                    key={tier}
                    tier={tier}
                    currentTier={currentTier}
                    onUpgrade={handleSelectTier}
                    disabled={isProcessing}
                  />
                ))}
              </div>

              <div className="modal-footer">
                <div className="footer-note">
                  <strong>Note:</strong> Subscription fees are paid monthly in SOL. Storage rent is a one-time payment for account space.
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="modal-header">
              <h2>Confirm Upgrade</h2>
              <button className="modal-close" onClick={handleCancelConfirmation}>
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="confirmation-card">
                <div className="confirmation-header">
                  <h3>Upgrading to {selectedTier !== null ? TIER_INFO[selectedTier].name : ''}</h3>
                </div>

                {selectedTier !== null && (
                  <>
                    <div className="confirmation-details">
                      <div className="detail-row">
                        <span className="detail-label">Monthly Cost:</span>
                        <span className="detail-value">{formatSOL(TIER_INFO[selectedTier].monthlyCost)}/month</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Storage Capacity:</span>
                        <span className="detail-value">
                          {TIER_INFO[selectedTier].maxCapacity >= 1048576
                            ? `${(TIER_INFO[selectedTier].maxCapacity / 1048576).toFixed(0)}MB`
                            : `${(TIER_INFO[selectedTier].maxCapacity / 1024).toFixed(0)}KB`}
                        </span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Max Passwords:</span>
                        <span className="detail-value">~{TIER_INFO[selectedTier].maxEntries.toLocaleString()}</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Billing Cycle:</span>
                        <span className="detail-value">30 days (auto-renew)</span>
                      </div>
                    </div>

                    <div className="confirmation-features">
                      <h4>Included Features:</h4>
                      <ul>
                        {TIER_INFO[selectedTier].features.map((feature, idx) => (
                          <li key={idx}>
                            <span className="feature-check">✓</span>
                            {feature}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="confirmation-warning">
                      <strong>⚠️ Important:</strong>
                      <ul>
                        <li>Payment will be processed immediately from your connected wallet</li>
                        <li>Subscription renews automatically every 30 days</li>
                        <li>You can cancel anytime before the next billing cycle</li>
                        <li>Additional rent may be charged for account storage expansion</li>
                      </ul>
                    </div>
                  </>
                )}

                <div className="confirmation-actions">
                  <button
                    className="btn-cancel"
                    onClick={handleCancelConfirmation}
                    disabled={isProcessing}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn-confirm"
                    onClick={handleConfirmUpgrade}
                    disabled={isProcessing}
                  >
                    {isProcessing ? 'Processing...' : `Pay ${selectedTier !== null ? formatSOL(TIER_INFO[selectedTier].monthlyCost) : ''} & Upgrade`}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        <style jsx>{`
          .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            padding: 1rem;
            overflow-y: auto;
          }

          .modal-container {
            background: white;
            border-radius: 20px;
            width: 100%;
            max-width: 1400px;
            max-height: 90vh;
            overflow-y: auto;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          }

          .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 2rem;
            border-bottom: 1px solid #e1e8ed;
            position: sticky;
            top: 0;
            background: white;
            z-index: 1;
          }

          .modal-header h2 {
            margin: 0;
            font-size: 1.75rem;
            color: #2c3e50;
          }

          .modal-close {
            background: none;
            border: none;
            font-size: 2.5rem;
            color: #7f8c8d;
            cursor: pointer;
            line-height: 1;
            padding: 0;
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 8px;
            transition: all 0.2s;
          }

          .modal-close:hover {
            background: #f8f9fa;
            color: #2c3e50;
          }

          .modal-body {
            padding: 2rem;
          }

          .modal-description {
            text-align: center;
            font-size: 1.1rem;
            color: #7f8c8d;
            margin-bottom: 2rem;
          }

          .tiers-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 1.5rem;
            margin-bottom: 2rem;
          }

          .modal-footer {
            border-top: 1px solid #e1e8ed;
            padding-top: 1.5rem;
          }

          .footer-note {
            text-align: center;
            font-size: 0.9rem;
            color: #7f8c8d;
          }

          .confirmation-card {
            max-width: 600px;
            margin: 0 auto;
          }

          .confirmation-header {
            text-align: center;
            margin-bottom: 2rem;
          }

          .confirmation-header h3 {
            font-size: 1.5rem;
            color: #2c3e50;
            margin: 0;
          }

          .confirmation-details {
            background: #f8f9fa;
            border-radius: 12px;
            padding: 1.5rem;
            margin-bottom: 1.5rem;
          }

          .detail-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0.75rem 0;
            border-bottom: 1px solid #e1e8ed;
          }

          .detail-row:last-child {
            border-bottom: none;
          }

          .detail-label {
            font-weight: 600;
            color: #2c3e50;
          }

          .detail-value {
            color: #667eea;
            font-weight: 600;
          }

          .confirmation-features {
            margin-bottom: 1.5rem;
          }

          .confirmation-features h4 {
            color: #2c3e50;
            margin-bottom: 1rem;
          }

          .confirmation-features ul {
            list-style: none;
            padding: 0;
            margin: 0;
          }

          .confirmation-features li {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            padding: 0.5rem 0;
            color: #2c3e50;
          }

          .feature-check {
            color: #27ae60;
            font-weight: 700;
          }

          .confirmation-warning {
            background: #fff3cd;
            border: 1px solid #ffc107;
            border-radius: 8px;
            padding: 1rem;
            margin-bottom: 2rem;
          }

          .confirmation-warning strong {
            display: block;
            margin-bottom: 0.5rem;
            color: #856404;
          }

          .confirmation-warning ul {
            margin: 0.5rem 0 0 1.5rem;
            color: #856404;
          }

          .confirmation-warning li {
            margin-bottom: 0.25rem;
          }

          .confirmation-actions {
            display: flex;
            gap: 1rem;
          }

          .btn-cancel,
          .btn-confirm {
            flex: 1;
            padding: 1rem;
            border: none;
            border-radius: 8px;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
          }

          .btn-cancel {
            background: #f8f9fa;
            color: #2c3e50;
          }

          .btn-cancel:hover:not(:disabled) {
            background: #e1e8ed;
          }

          .btn-confirm {
            background: #667eea;
            color: white;
          }

          .btn-confirm:hover:not(:disabled) {
            background: #5568d3;
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
          }

          .btn-cancel:disabled,
          .btn-confirm:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }

          @media (max-width: 768px) {
            .modal-container {
              max-width: 100%;
              max-height: 100vh;
              border-radius: 0;
            }

            .modal-header h2 {
              font-size: 1.25rem;
            }

            .tiers-grid {
              grid-template-columns: 1fr;
            }

            .confirmation-actions {
              flex-direction: column;
            }
          }
        `}</style>
      </div>
    </div>
  );
}
