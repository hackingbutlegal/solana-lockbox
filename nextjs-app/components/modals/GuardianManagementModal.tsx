/**
 * Guardian Management Modal
 *
 * View and manage guardians for social recovery
 *
 * Features:
 * - View all guardians with status
 * - Add new guardians
 * - Remove guardians
 * - Resend shares to guardians
 * - View recovery configuration (threshold, delay)
 * - Cancel pending recovery requests
 */

'use client';

import React, { useState } from 'react';
import { PublicKey } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';

// Types
interface GuardianManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Guardian {
  pubkey: string;
  nickname: string;
  shareIndex: number;
  status: 'pending' | 'active' | 'inactive';
  addedAt: number;
}

interface RecoveryConfig {
  threshold: number;
  totalGuardians: number;
  recoveryDelay: number; // seconds
  guardians: Guardian[];
}

// Mock data (TODO: Replace with actual on-chain data)
const mockRecoveryConfig: RecoveryConfig = {
  threshold: 3,
  totalGuardians: 5,
  recoveryDelay: 7 * 24 * 60 * 60, // 7 days
  guardians: [
    {
      pubkey: '7Np41oeYqPefeNQEHSv1UDhYrehxin3NStELsSKCT4K2',
      nickname: 'Mom',
      shareIndex: 1,
      status: 'active',
      addedAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
    },
    {
      pubkey: '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin',
      nickname: 'Best Friend',
      shareIndex: 2,
      status: 'active',
      addedAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
    },
    {
      pubkey: 'CuieVDEDtLo7FypA9SbLM9saXFdb1dsshEkyErMqkRQq',
      nickname: 'Brother',
      shareIndex: 3,
      status: 'pending',
      addedAt: Date.now() - 2 * 24 * 60 * 60 * 1000,
    },
    {
      pubkey: '5VQxXgTiKykfAUSQfnXCMQT4RSLx5HMGqR5RgqNvVXTz',
      nickname: 'Spouse',
      shareIndex: 4,
      status: 'active',
      addedAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
    },
    {
      pubkey: '8sxMrYqHdHvJQe7KhJqJ5jJk4kEhPLhvFZjLx6YhTcRp',
      nickname: 'Trusted Colleague',
      shareIndex: 5,
      status: 'active',
      addedAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
    },
  ],
};

export default function GuardianManagementModal({
  isOpen,
  onClose,
}: GuardianManagementModalProps) {
  const { publicKey } = useWallet();

  // State
  const [config, setConfig] = useState<RecoveryConfig>(mockRecoveryConfig);
  const [selectedGuardian, setSelectedGuardian] = useState<Guardian | null>(null);
  const [showAddGuardian, setShowAddGuardian] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

  // Handlers
  const handleRemoveGuardian = (guardian: Guardian) => {
    setSelectedGuardian(guardian);
    setShowRemoveConfirm(true);
  };

  const confirmRemoveGuardian = () => {
    if (!selectedGuardian) return;

    // TODO: Call on-chain remove_guardian instruction
    console.log('Removing guardian:', selectedGuardian);

    setConfig({
      ...config,
      guardians: config.guardians.filter(g => g.pubkey !== selectedGuardian.pubkey),
      totalGuardians: config.totalGuardians - 1,
    });

    setShowRemoveConfirm(false);
    setSelectedGuardian(null);
  };

  const handleResendShare = (guardian: Guardian) => {
    // TODO: Regenerate and send share to guardian
    console.log('Resending share to:', guardian);
    alert(`Share resent to ${guardian.nickname}`);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDelay = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    return `${days} day${days !== 1 ? 's' : ''}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-green-400 bg-green-500/10 border-green-500/30';
      case 'pending':
        return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
      case 'inactive':
        return 'text-gray-400 bg-gray-500/10 border-gray-500/30';
      default:
        return 'text-gray-400 bg-gray-500/10 border-gray-500/30';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-gray-900 border border-cyan-500/30 rounded-xl shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-gray-900 border-b border-cyan-500/30 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-cyan-400">Guardian Management</h2>
              <p className="text-sm text-gray-400 mt-1">
                Manage your social recovery guardians
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Recovery Configuration Summary */}
          <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
            <h3 className="text-lg font-semibold text-white mb-4">Recovery Configuration</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-gray-400 mb-1">Threshold</p>
                <p className="text-2xl font-bold text-cyan-400">
                  {config.threshold} <span className="text-gray-500">of</span> {config.totalGuardians}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Recovery Delay</p>
                <p className="text-2xl font-bold text-cyan-400">{formatDelay(config.recoveryDelay)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Active Guardians</p>
                <p className="text-2xl font-bold text-green-400">
                  {config.guardians.filter(g => g.status === 'active').length}
                </p>
              </div>
            </div>
          </div>

          {/* Guardians List */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Guardians</h3>
              <button
                onClick={() => setShowAddGuardian(true)}
                className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg transition-colors text-sm"
              >
                + Add Guardian
              </button>
            </div>

            <div className="space-y-3">
              {config.guardians.map(guardian => (
                <div
                  key={guardian.pubkey}
                  className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg hover:border-gray-600 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="text-lg font-semibold text-white">{guardian.nickname}</h4>
                        <span
                          className={`px-2 py-1 text-xs font-medium border rounded ${getStatusColor(
                            guardian.status
                          )}`}
                        >
                          {guardian.status.charAt(0).toUpperCase() + guardian.status.slice(1)}
                        </span>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-gray-400 font-mono">
                          {guardian.pubkey.slice(0, 16)}...{guardian.pubkey.slice(-16)}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span>Share Index: {guardian.shareIndex}</span>
                          <span>•</span>
                          <span>Added: {formatDate(guardian.addedAt)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleResendShare(guardian)}
                        className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm transition-colors"
                      >
                        Resend Share
                      </button>
                      <button
                        onClick={() => handleRemoveGuardian(guardian)}
                        className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded text-sm transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Security Info */}
          <div className="p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
            <h4 className="text-sm font-semibold text-cyan-300 mb-2">Security Notes</h4>
            <ul className="space-y-1 text-sm text-cyan-300/80">
              <li>• Guardians can initiate recovery after you lose access</li>
              <li>• {config.threshold} guardians must approve for recovery to succeed</li>
              <li>• You have {formatDelay(config.recoveryDelay)} to cancel unauthorized recoveries</li>
              <li>• Shares are stored off-chain for maximum security (V2)</li>
            </ul>
          </div>
        </div>

        {/* Remove Confirmation Modal */}
        {showRemoveConfirm && selectedGuardian && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center backdrop-blur-sm rounded-xl">
            <div className="bg-gray-800 border border-red-500/30 rounded-lg p-6 max-w-md">
              <h3 className="text-lg font-bold text-red-400 mb-4">Remove Guardian?</h3>
              <p className="text-sm text-gray-300 mb-4">
                Are you sure you want to remove <strong>{selectedGuardian.nickname}</strong> as a
                guardian? This action cannot be undone.
              </p>
              <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded mb-4">
                <p className="text-xs text-yellow-300">
                  ⚠️ Make sure you still have at least {config.threshold} active guardians after removal.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowRemoveConfirm(false);
                    setSelectedGuardian(null);
                  }}
                  className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmRemoveGuardian}
                  className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                >
                  Remove Guardian
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
