/**
 * Emergency Access Modal (Dead Man's Switch)
 *
 * Manage emergency contacts who can gain access after inactivity period.
 *
 * Features:
 * - View emergency contacts with status
 * - Add new emergency contacts
 * - Remove emergency contacts
 * - Configure inactivity period (30 days - 1 year)
 * - Configure access levels (ViewOnly, FullAccess, TransferOwnership)
 * - Configure grace period (delay before access granted)
 * - "I'm Alive" button to reset countdown
 * - View pending emergency access requests
 * - Cancel pending requests
 * - Activity status display
 */

'use client';

import React, { useState } from 'react';
import { PublicKey } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';

// Types
interface EmergencyAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface EmergencyContact {
  pubkey: string;
  nickname: string;
  accessLevel: 'ViewOnly' | 'FullAccess' | 'TransferOwnership';
  status: 'active' | 'pending' | 'inactive';
  addedAt: number;
}

interface EmergencyConfig {
  inactivityPeriod: number; // seconds
  gracePeriod: number; // seconds
  lastActivity: number; // timestamp
  contacts: EmergencyContact[];
}

// Mock data (TODO: Replace with actual on-chain data)
const mockConfig: EmergencyConfig = {
  inactivityPeriod: 90 * 24 * 60 * 60, // 90 days
  gracePeriod: 7 * 24 * 60 * 60, // 7 days
  lastActivity: Date.now() - 10 * 24 * 60 * 60 * 1000, // 10 days ago
  contacts: [
    {
      pubkey: '7Np41oeYqPefeNQEHSv1UDhYrehxin3NStELsSKCT4K2',
      nickname: 'Spouse',
      accessLevel: 'TransferOwnership',
      status: 'active',
      addedAt: Date.now() - 60 * 24 * 60 * 60 * 1000,
    },
    {
      pubkey: '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin',
      nickname: 'Family Member',
      accessLevel: 'FullAccess',
      status: 'active',
      addedAt: Date.now() - 45 * 24 * 60 * 60 * 1000,
    },
  ],
};

export default function EmergencyAccessModal({
  isOpen,
  onClose,
}: EmergencyAccessModalProps) {
  const { publicKey } = useWallet();

  // State
  const [config, setConfig] = useState<EmergencyConfig>(mockConfig);
  const [selectedContact, setSelectedContact] = useState<EmergencyContact | null>(null);
  const [showAddContact, setShowAddContact] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

  // New contact form
  const [newContactAddress, setNewContactAddress] = useState('');
  const [newContactNickname, setNewContactNickname] = useState('');
  const [newContactAccessLevel, setNewContactAccessLevel] = useState<'ViewOnly' | 'FullAccess' | 'TransferOwnership'>('ViewOnly');

  // Handlers
  const handleAliveClick = () => {
    // TODO: Call on-chain update_activity instruction
    setConfig({
      ...config,
      lastActivity: Date.now(),
    });
    alert('Activity updated! Countdown reset.');
  };

  const handleAddContact = () => {
    // TODO: Call on-chain add_emergency_contact instruction
    const newContact: EmergencyContact = {
      pubkey: newContactAddress,
      nickname: newContactNickname,
      accessLevel: newContactAccessLevel,
      status: 'pending',
      addedAt: Date.now(),
    };

    setConfig({
      ...config,
      contacts: [...config.contacts, newContact],
    });

    // Reset form
    setNewContactAddress('');
    setNewContactNickname('');
    setNewContactAccessLevel('ViewOnly');
    setShowAddContact(false);
  };

  const handleRemoveContact = (contact: EmergencyContact) => {
    setSelectedContact(contact);
    setShowRemoveConfirm(true);
  };

  const confirmRemoveContact = () => {
    if (!selectedContact) return;

    // TODO: Call on-chain remove_emergency_contact instruction
    setConfig({
      ...config,
      contacts: config.contacts.filter(c => c.pubkey !== selectedContact.pubkey),
    });

    setShowRemoveConfirm(false);
    setSelectedContact(null);
  };

  // Utility functions
  const formatDuration = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    if (days >= 365) {
      const years = Math.floor(days / 365);
      return `${years} year${years !== 1 ? 's' : ''}`;
    }
    return `${days} day${days !== 1 ? 's' : ''}`;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getTimeUntilDeadline = () => {
    const elapsed = Date.now() - config.lastActivity;
    const remaining = config.inactivityPeriod * 1000 - elapsed;
    if (remaining <= 0) return 'OVERDUE';
    return formatDuration(Math.floor(remaining / 1000));
  };

  const getActivityStatus = () => {
    const elapsed = Date.now() - config.lastActivity;
    const threshold = config.inactivityPeriod * 1000;
    const percentage = (elapsed / threshold) * 100;

    if (percentage >= 100) return { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'INACTIVE' };
    if (percentage >= 75) return { color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', text: 'WARNING' };
    return { color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/30', text: 'ACTIVE' };
  };

  const getAccessLevelColor = (level: string) => {
    switch (level) {
      case 'ViewOnly':
        return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
      case 'FullAccess':
        return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
      case 'TransferOwnership':
        return 'text-red-400 bg-red-500/10 border-red-500/30';
      default:
        return 'text-gray-400 bg-gray-500/10 border-gray-500/30';
    }
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

  const activityStatus = getActivityStatus();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-gray-900 border border-cyan-500/30 rounded-xl shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-gray-900 border-b border-cyan-500/30 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-cyan-400">Emergency Access</h2>
              <p className="text-sm text-gray-400 mt-1">
                Dead Man's Switch - Grant access after inactivity
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
          {/* Activity Status */}
          <div className={`p-4 ${activityStatus.bg} border ${activityStatus.border} rounded-lg`}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className={`text-lg font-semibold ${activityStatus.color}`}>
                  Status: {activityStatus.text}
                </h3>
                <p className="text-sm text-gray-400 mt-1">
                  Last activity: {formatDate(config.lastActivity)}
                </p>
              </div>
              <button
                onClick={handleAliveClick}
                className="px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors font-semibold"
              >
                I'm Alive
              </button>
            </div>

            <div className="grid grid-cols-3 gap-4 mt-4">
              <div>
                <p className="text-xs text-gray-400 mb-1">Inactivity Threshold</p>
                <p className={`text-xl font-bold ${activityStatus.color}`}>
                  {formatDuration(config.inactivityPeriod)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Time Remaining</p>
                <p className={`text-xl font-bold ${activityStatus.color}`}>
                  {getTimeUntilDeadline()}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Grace Period</p>
                <p className={`text-xl font-bold ${activityStatus.color}`}>
                  {formatDuration(config.gracePeriod)}
                </p>
              </div>
            </div>
          </div>

          {/* Emergency Contacts */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Emergency Contacts</h3>
              <button
                onClick={() => setShowAddContact(true)}
                className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg transition-colors text-sm"
              >
                + Add Contact
              </button>
            </div>

            {config.contacts.length === 0 ? (
              <div className="p-8 bg-gray-800/50 border border-gray-700 rounded-lg text-center">
                <p className="text-gray-400">No emergency contacts configured</p>
                <p className="text-sm text-gray-500 mt-1">
                  Add trusted contacts who can access your vault if you're inactive
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {config.contacts.map(contact => (
                  <div
                    key={contact.pubkey}
                    className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg hover:border-gray-600 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="text-lg font-semibold text-white">{contact.nickname}</h4>
                          <span
                            className={`px-2 py-1 text-xs font-medium border rounded ${getStatusColor(
                              contact.status
                            )}`}
                          >
                            {contact.status.charAt(0).toUpperCase() + contact.status.slice(1)}
                          </span>
                          <span
                            className={`px-2 py-1 text-xs font-medium border rounded ${getAccessLevelColor(
                              contact.accessLevel
                            )}`}
                          >
                            {contact.accessLevel.replace(/([A-Z])/g, ' $1').trim()}
                          </span>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm text-gray-400 font-mono">
                            {contact.pubkey.slice(0, 16)}...{contact.pubkey.slice(-16)}
                          </p>
                          <p className="text-xs text-gray-500">Added: {formatDate(contact.addedAt)}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleRemoveContact(contact)}
                          className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded text-sm transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Info Box */}
          <div className="p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
            <h4 className="text-sm font-semibold text-cyan-300 mb-2">How Emergency Access Works</h4>
            <ul className="space-y-1 text-sm text-cyan-300/80">
              <li>• Click "I'm Alive" regularly to reset the countdown</li>
              <li>• If inactive for {formatDuration(config.inactivityPeriod)}, emergency contacts are notified</li>
              <li>• After {formatDuration(config.gracePeriod)} grace period, contacts can claim access</li>
              <li>• You can cancel any emergency access request during grace period</li>
            </ul>
          </div>

          {/* Access Levels Explanation */}
          <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
            <h4 className="text-sm font-semibold text-white mb-3">Access Levels</h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <span className="px-2 py-0.5 text-xs font-medium border rounded text-blue-400 bg-blue-500/10 border-blue-500/30">
                  View Only
                </span>
                <p className="text-gray-400">Can view passwords but not modify or decrypt them</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="px-2 py-0.5 text-xs font-medium border rounded text-yellow-400 bg-yellow-500/10 border-yellow-500/30">
                  Full Access
                </span>
                <p className="text-gray-400">Can view, add, edit, and delete passwords</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="px-2 py-0.5 text-xs font-medium border rounded text-red-400 bg-red-500/10 border-red-500/30">
                  Transfer Ownership
                </span>
                <p className="text-gray-400">Full control including transferring vault to another wallet</p>
              </div>
            </div>
          </div>
        </div>

        {/* Add Contact Modal */}
        {showAddContact && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center backdrop-blur-sm rounded-xl">
            <div className="bg-gray-800 border border-cyan-500/30 rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-bold text-cyan-400 mb-4">Add Emergency Contact</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-2">Nickname</label>
                  <input
                    type="text"
                    value={newContactNickname}
                    onChange={(e) => setNewContactNickname(e.target.value)}
                    placeholder="E.g., Family Member"
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-300 mb-2">Solana Address</label>
                  <input
                    type="text"
                    value={newContactAddress}
                    onChange={(e) => setNewContactAddress(e.target.value)}
                    placeholder="E.g., 7Np41oeYqPefeNQEHSv1UDhYrehxin3NStELsSKCT4K2"
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-300 mb-2">Access Level</label>
                  <select
                    value={newContactAccessLevel}
                    onChange={(e) => setNewContactAccessLevel(e.target.value as any)}
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="ViewOnly">View Only</option>
                    <option value="FullAccess">Full Access</option>
                    <option value="TransferOwnership">Transfer Ownership</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowAddContact(false);
                    setNewContactAddress('');
                    setNewContactNickname('');
                    setNewContactAccessLevel('ViewOnly');
                  }}
                  className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddContact}
                  disabled={!newContactAddress || !newContactNickname}
                  className="flex-1 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add Contact
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Remove Confirmation Modal */}
        {showRemoveConfirm && selectedContact && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center backdrop-blur-sm rounded-xl">
            <div className="bg-gray-800 border border-red-500/30 rounded-lg p-6 max-w-md">
              <h3 className="text-lg font-bold text-red-400 mb-4">Remove Emergency Contact?</h3>
              <p className="text-sm text-gray-300 mb-4">
                Are you sure you want to remove <strong>{selectedContact.nickname}</strong> as an
                emergency contact? They will no longer be able to access your vault.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowRemoveConfirm(false);
                    setSelectedContact(null);
                  }}
                  className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmRemoveContact}
                  className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                >
                  Remove Contact
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
