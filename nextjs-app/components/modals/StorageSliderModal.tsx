'use client';

import React, { useState, useEffect } from 'react';
import { SubscriptionTier, TIER_INFO } from '../../sdk/src/types-v2';

interface StorageSliderModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCapacity: number; // in bytes
  currentTier: SubscriptionTier;
  onConfirm: (targetBytes: number) => Promise<void>;
}

/**
 * Storage Slider Modal
 *
 * Continuous slider interface for expanding storage capacity.
 * Shows real-time pricing, password capacity, and fee breakdown.
 */
export function StorageSliderModal({
  isOpen,
  onClose,
  currentCapacity,
  currentTier,
  onConfirm,
}: StorageSliderModalProps) {
  const SOL_TO_USD = 140;
  const MIN_CAPACITY = 1024; // 1KB (Free tier)
  const MAX_CAPACITY = 1048576; // 1MB (Pro tier max)

  const [targetCapacity, setTargetCapacity] = useState(currentCapacity);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Reset to current capacity when modal opens
  useEffect(() => {
    if (isOpen) {
      setTargetCapacity(currentCapacity);
      setShowBreakdown(false);
    }
  }, [isOpen, currentCapacity]);

  if (!isOpen) return null;

  // Calculate pricing based on continuous storage amount
  const calculatePricing = (bytes: number) => {
    // Linear interpolation between tiers
    if (bytes <= 1024) {
      return { rentCost: 0, serviceFee: 0, total: 0 };
    } else if (bytes <= 10240) {
      // Between Free and Basic: scale linearly
      const ratio = (bytes - 1024) / (10240 - 1024);
      const rentCost = Math.ceil(ratio * 1_000_000);
      const serviceFee = Math.ceil(ratio * 2_000_000);
      return { rentCost, serviceFee, total: rentCost + serviceFee };
    } else if (bytes <= 102400) {
      // Between Basic and Premium: scale linearly
      const ratio = (bytes - 10240) / (102400 - 10240);
      const baseRent = 1_000_000;
      const baseFee = 2_000_000;
      const addRent = Math.ceil(ratio * (10_000_000 - 1_000_000));
      const addFee = Math.ceil(ratio * (20_000_000 - 2_000_000));
      const rentCost = baseRent + addRent;
      const serviceFee = baseFee + addFee;
      return { rentCost, serviceFee, total: rentCost + serviceFee };
    } else if (bytes <= 1048576) {
      // Between Premium and Pro: scale linearly
      const ratio = (bytes - 102400) / (1048576 - 102400);
      const baseRent = 10_000_000;
      const baseFee = 20_000_000;
      const addRent = Math.ceil(ratio * (100_000_000 - 10_000_000));
      const addFee = Math.ceil(ratio * (200_000_000 - 20_000_000));
      const rentCost = baseRent + addRent;
      const serviceFee = baseFee + addFee;
      return { rentCost, serviceFee, total: rentCost + serviceFee };
    }

    // Pro tier max
    return { rentCost: 100_000_000, serviceFee: 200_000_000, total: 300_000_000 };
  };

  const pricing = calculatePricing(targetCapacity);
  const currentPricing = calculatePricing(currentCapacity);

  // Cost difference (what user will pay)
  const costDifference = {
    rentCost: pricing.rentCost - currentPricing.rentCost,
    serviceFee: pricing.serviceFee - currentPricing.serviceFee,
    total: pricing.total - currentPricing.total,
  };

  // Format helpers
  const formatBytes = (bytes: number): string => {
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${bytes} B`;
  };

  const formatSOL = (lamports: number): string => {
    const sol = lamports / 1_000_000_000;
    return sol.toFixed(4);
  };

  const formatUSD = (lamports: number): string => {
    const sol = lamports / 1_000_000_000;
    const usd = sol * SOL_TO_USD;
    return usd.toFixed(2);
  };

  const estimatePasswords = (bytes: number): number => {
    // Rough estimate: ~100 bytes per password entry
    return Math.floor(bytes / 100);
  };

  const handleConfirm = async () => {
    if (targetCapacity <= currentCapacity) return;

    setIsProcessing(true);
    try {
      await onConfirm(targetCapacity);
      onClose();
    } catch (error) {
      console.error('Storage expansion failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const canExpand = targetCapacity > currentCapacity && costDifference.total > 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Expand Storage Capacity</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {/* Current vs New Capacity */}
          <div className="capacity-comparison">
            <div className="capacity-item current">
              <div className="capacity-label">Current</div>
              <div className="capacity-value">{formatBytes(currentCapacity)}</div>
              <div className="capacity-passwords">~{estimatePasswords(currentCapacity)} passwords</div>
            </div>
            <div className="capacity-arrow">→</div>
            <div className="capacity-item new">
              <div className="capacity-label">New</div>
              <div className="capacity-value">{formatBytes(targetCapacity)}</div>
              <div className="capacity-passwords">~{estimatePasswords(targetCapacity)} passwords</div>
            </div>
          </div>

          {/* Slider */}
          <div className="slider-container">
            <input
              type="range"
              min={MIN_CAPACITY}
              max={MAX_CAPACITY}
              value={targetCapacity}
              onChange={(e) => setTargetCapacity(parseInt(e.target.value))}
              className="storage-slider"
              step={1024} // 1KB increments
            />
            <div className="slider-labels">
              <span>1 KB</span>
              <span>10 KB</span>
              <span>100 KB</span>
            </div>
          </div>

          {/* Pricing Display */}
          {costDifference.total > 0 && (
            <div className="pricing-box">
              <div className="price-main">
                <div className="price-label">Total Cost</div>
                <div className="price-amount">
                  {formatSOL(costDifference.total)} SOL
                </div>
                <div className="price-usd">~${formatUSD(costDifference.total)} USD</div>
              </div>

              {/* Fee Breakdown Toggle */}
              <button
                className="breakdown-toggle"
                onClick={() => setShowBreakdown(!showBreakdown)}
              >
                {showBreakdown ? '▼' : '▶'} Fee Breakdown
              </button>

              {showBreakdown && (
                <div className="fee-breakdown">
                  <div className="breakdown-item">
                    <span className="breakdown-label">
                      Account Rent
                      <span className="refundable-tag">Refundable</span>
                    </span>
                    <span className="breakdown-value">
                      {formatSOL(costDifference.rentCost)} SOL
                    </span>
                  </div>
                  <div className="breakdown-item">
                    <span className="breakdown-label">
                      Service Fee
                      <span className="non-refundable-tag">Non-refundable</span>
                    </span>
                    <span className="breakdown-value">
                      {formatSOL(costDifference.serviceFee)} SOL
                    </span>
                  </div>
                  <div className="breakdown-divider" />
                  <div className="breakdown-item total">
                    <span className="breakdown-label">Total</span>
                    <span className="breakdown-value">
                      {formatSOL(costDifference.total)} SOL
                    </span>
                  </div>
                  <div className="breakdown-note">
                    💡 Account rent is refunded when you close your account. Service fees support platform development and maintenance.
                  </div>
                </div>
              )}
            </div>
          )}

          {!canExpand && (
            <div className="info-message">
              ℹ️ Move the slider to the right to expand your storage capacity
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={handleConfirm}
            disabled={!canExpand || isProcessing}
          >
            {isProcessing ? 'Processing...' : `Expand to ${formatBytes(targetCapacity)}`}
          </button>
        </div>

        <style jsx>{`
          .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.6);
            backdrop-filter: blur(4px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 2000;
            padding: 1rem;
            animation: fadeIn 0.2s ease-out;
          }

          @keyframes fadeIn {
            from {
              opacity: 0;
            }
            to {
              opacity: 1;
            }
          }

          .modal-content {
            background: white;
            border-radius: 20px;
            max-width: 600px;
            width: 100%;
            max-height: 90vh;
            overflow-y: auto;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            animation: slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
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

          .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 2rem 2rem 1rem 2rem;
            border-bottom: 1px solid #e5e7eb;
          }

          .modal-header h2 {
            margin: 0;
            font-size: 1.75rem;
            font-weight: 800;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
          }

          .close-btn {
            background: none;
            border: none;
            font-size: 2rem;
            color: #9ca3af;
            cursor: pointer;
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            transition: all 0.2s;
          }

          .close-btn:hover {
            background: #f3f4f6;
            color: #4b5563;
          }

          .modal-body {
            padding: 2rem;
          }

          .capacity-comparison {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 1.5rem;
            margin-bottom: 2.5rem;
            padding: 1.5rem;
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            border-radius: 16px;
          }

          .capacity-item {
            flex: 1;
            text-align: center;
          }

          .capacity-label {
            font-size: 0.8rem;
            color: #6b7280;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 0.5rem;
          }

          .capacity-value {
            font-size: 1.75rem;
            font-weight: 700;
            color: #2c3e50;
            margin-bottom: 0.25rem;
          }

          .capacity-item.new .capacity-value {
            color: #667eea;
          }

          .capacity-passwords {
            font-size: 0.875rem;
            color: #9ca3af;
          }

          .capacity-arrow {
            font-size: 1.5rem;
            color: #667eea;
            flex-shrink: 0;
          }

          .slider-container {
            margin-bottom: 2rem;
          }

          .storage-slider {
            width: 100%;
            height: 8px;
            border-radius: 4px;
            background: linear-gradient(to right, #e5e7eb 0%, #667eea 100%);
            outline: none;
            -webkit-appearance: none;
            margin-bottom: 1rem;
          }

          .storage-slider::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
            transition: all 0.2s;
          }

          .storage-slider::-webkit-slider-thumb:hover {
            transform: scale(1.2);
            box-shadow: 0 6px 16px rgba(102, 126, 234, 0.6);
          }

          .storage-slider::-moz-range-thumb {
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            cursor: pointer;
            border: none;
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
            transition: all 0.2s;
          }

          .storage-slider::-moz-range-thumb:hover {
            transform: scale(1.2);
            box-shadow: 0 6px 16px rgba(102, 126, 234, 0.6);
          }

          .slider-labels {
            display: flex;
            justify-content: space-between;
            font-size: 0.8rem;
            color: #6b7280;
            font-weight: 500;
          }

          .pricing-box {
            background: linear-gradient(135deg, #f8f9ff 0%, #ffffff 100%);
            border: 2px solid #667eea;
            border-radius: 16px;
            padding: 1.5rem;
            margin-bottom: 1rem;
          }

          .price-main {
            text-align: center;
            margin-bottom: 1rem;
          }

          .price-label {
            font-size: 0.9rem;
            color: #6b7280;
            font-weight: 600;
            margin-bottom: 0.5rem;
          }

          .price-amount {
            font-size: 2.25rem;
            font-weight: 800;
            color: #667eea;
            margin-bottom: 0.25rem;
          }

          .price-usd {
            font-size: 1rem;
            color: #9ca3af;
            font-weight: 500;
          }

          .breakdown-toggle {
            width: 100%;
            padding: 0.75rem;
            background: rgba(102, 126, 234, 0.1);
            border: 1px solid rgba(102, 126, 234, 0.2);
            border-radius: 8px;
            color: #667eea;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
          }

          .breakdown-toggle:hover {
            background: rgba(102, 126, 234, 0.15);
          }

          .fee-breakdown {
            margin-top: 1rem;
            padding-top: 1rem;
            border-top: 1px solid #e5e7eb;
          }

          .breakdown-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 0.75rem;
            font-size: 0.95rem;
          }

          .breakdown-item.total {
            font-weight: 700;
            font-size: 1.1rem;
            color: #2c3e50;
          }

          .breakdown-label {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            color: #4b5563;
          }

          .refundable-tag {
            background: #d1fae5;
            color: #065f46;
            padding: 0.125rem 0.5rem;
            border-radius: 6px;
            font-size: 0.7rem;
            font-weight: 600;
            text-transform: uppercase;
          }

          .non-refundable-tag {
            background: #fee2e2;
            color: #991b1b;
            padding: 0.125rem 0.5rem;
            border-radius: 6px;
            font-size: 0.7rem;
            font-weight: 600;
            text-transform: uppercase;
          }

          .breakdown-value {
            font-weight: 600;
            color: #2c3e50;
          }

          .breakdown-divider {
            height: 1px;
            background: #e5e7eb;
            margin: 0.75rem 0;
          }

          .breakdown-note {
            margin-top: 1rem;
            padding: 0.75rem;
            background: #fffbeb;
            border-left: 3px solid #f59e0b;
            border-radius: 6px;
            font-size: 0.85rem;
            color: #92400e;
            line-height: 1.5;
          }

          .info-message {
            padding: 1rem;
            background: #f3f4f6;
            border-radius: 12px;
            text-align: center;
            color: #6b7280;
            font-weight: 500;
          }

          .modal-footer {
            display: flex;
            gap: 1rem;
            padding: 1.5rem 2rem 2rem 2rem;
            border-top: 1px solid #e5e7eb;
          }

          .btn-secondary,
          .btn-primary {
            flex: 1;
            padding: 0.875rem 1.5rem;
            border: none;
            border-radius: 12px;
            font-size: 1rem;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          }

          .btn-secondary {
            background: #f3f4f6;
            color: #4b5563;
          }

          .btn-secondary:hover {
            background: #e5e7eb;
          }

          .btn-primary {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            box-shadow: 0 4px 14px rgba(102, 126, 234, 0.3);
          }

          .btn-primary:hover:not(:disabled) {
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
          }

          .btn-primary:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            transform: none;
          }

          @media (max-width: 640px) {
            .modal-content {
              border-radius: 16px;
            }

            .modal-header,
            .modal-body,
            .modal-footer {
              padding-left: 1.5rem;
              padding-right: 1.5rem;
            }

            .capacity-comparison {
              flex-direction: column;
              gap: 1rem;
            }

            .capacity-arrow {
              transform: rotate(90deg);
            }

            .price-amount {
              font-size: 1.75rem;
            }
          }
        `}</style>
      </div>
    </div>
  );
}
