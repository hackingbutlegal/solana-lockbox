/**
 * Recovery Setup Modal
 *
 * Multi-step wizard for setting up social recovery (V2 secure flow)
 *
 * Steps:
 * 1. Guardian Selection - Choose trusted guardians
 * 2. Threshold Configuration - Set M-of-N threshold
 * 3. Recovery Delay - Configure time-lock delay
 * 4. Share Distribution - Display shares for guardians (QR codes, download)
 * 5. Confirmation - Review and submit to blockchain
 *
 * Uses V2 secure flow:
 * - Shares never touch blockchain (only hash commitments)
 * - Client-side secret splitting
 * - Off-chain share distribution to guardians
 */

'use client';

import React, { useState, useEffect } from 'react';
import { PublicKey } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import {
  setupRecovery,
  GuardianInfo,
  RecoverySetup,
} from '@/lib/recovery-client-v2';
import { splitSecret, Share } from '@/lib/shamir-secret-sharing';

// Types
interface RecoverySetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  masterSecret: Uint8Array; // The master encryption key to split
}

interface GuardianInput {
  id: string;
  address: string;
  nickname: string;
  isValid: boolean;
}

type SetupStep = 'guardians' | 'threshold' | 'delay' | 'shares' | 'confirmation';

// Constants
const MIN_GUARDIANS = 2;
const MAX_GUARDIANS = 10;
const MIN_THRESHOLD = 2;
const DEFAULT_RECOVERY_DELAY = 7 * 24 * 60 * 60; // 7 days in seconds

export default function RecoverySetupModal({
  isOpen,
  onClose,
  masterSecret,
}: RecoverySetupModalProps) {
  const { publicKey } = useWallet();

  // State
  const [currentStep, setCurrentStep] = useState<SetupStep>('guardians');
  const [guardians, setGuardians] = useState<GuardianInput[]>([
    { id: '1', address: '', nickname: '', isValid: false },
    { id: '2', address: '', nickname: '', isValid: false },
  ]);
  const [threshold, setThreshold] = useState<number>(2);
  const [recoveryDelay, setRecoveryDelay] = useState<number>(DEFAULT_RECOVERY_DELAY);
  const [recoverySetup, setRecoverySetup] = useState<RecoverySetup | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Validation
  const validGuardians = guardians.filter(g => g.isValid);
  const canProceed = {
    guardians: validGuardians.length >= MIN_GUARDIANS,
    threshold: threshold >= MIN_THRESHOLD && threshold <= validGuardians.length,
    delay: recoveryDelay >= 0,
    shares: recoverySetup !== null,
    confirmation: true,
  };

  // Handlers
  const handleAddGuardian = () => {
    if (guardians.length >= MAX_GUARDIANS) {
      setError(`Maximum ${MAX_GUARDIANS} guardians allowed`);
      return;
    }
    setGuardians([
      ...guardians,
      { id: Date.now().toString(), address: '', nickname: '', isValid: false },
    ]);
  };

  const handleRemoveGuardian = (id: string) => {
    if (guardians.length <= MIN_GUARDIANS) {
      setError(`Minimum ${MIN_GUARDIANS} guardians required`);
      return;
    }
    setGuardians(guardians.filter(g => g.id !== id));
    setError(null);
  };

  const handleGuardianChange = (id: string, field: 'address' | 'nickname', value: string) => {
    setGuardians(
      guardians.map(g => {
        if (g.id !== id) return g;

        const updated = { ...g, [field]: value };

        // Validate address
        if (field === 'address') {
          try {
            new PublicKey(value);
            updated.isValid = value.length > 0 && updated.nickname.length > 0;
          } catch {
            updated.isValid = false;
          }
        } else {
          // Nickname changed
          updated.isValid = updated.address.length > 0 && value.length > 0;
        }

        return updated;
      })
    );
    setError(null);
  };

  const handleGenerateShares = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Convert guardians to GuardianInfo format
      const guardianInfos: GuardianInfo[] = validGuardians.map((g, index) => ({
        pubkey: new PublicKey(g.address),
        shareIndex: index + 1,
      }));

      // Generate recovery setup (client-side)
      const setup = await setupRecovery(masterSecret, guardianInfos, threshold);
      setRecoverySetup(setup);
      setCurrentStep('shares');
    } catch (err: any) {
      setError(err.message || 'Failed to generate shares');
    } finally {
      setIsLoading(false);
    }
  };

  const handleNextStep = () => {
    const steps: SetupStep[] = ['guardians', 'threshold', 'delay', 'shares', 'confirmation'];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex < steps.length - 1) {
      if (currentStep === 'delay') {
        // Generate shares when moving from delay to shares
        handleGenerateShares();
      } else {
        setCurrentStep(steps[currentIndex + 1]);
      }
    }
  };

  const handlePrevStep = () => {
    const steps: SetupStep[] = ['guardians', 'threshold', 'delay', 'shares', 'confirmation'];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1]);
    }
  };

  const handleSubmit = async () => {
    // TODO: Submit to blockchain
    // This will call the on-chain initialize_recovery_config_v2 instruction
    console.log('Submitting recovery setup to blockchain...');
    console.log('Recovery Setup:', recoverySetup);
    // For now, just close the modal
    onClose();
  };

  const downloadShare = (guardianIndex: number) => {
    if (!recoverySetup) return;

    const guardian = validGuardians[guardianIndex];
    const share = recoverySetup.encryptedShares[guardianIndex];

    const data = {
      guardian: {
        address: guardian.address,
        nickname: guardian.nickname,
      },
      share: share.encrypted,
      commitment: Array.from(recoverySetup.guardianCommitments[guardianIndex].commitment),
      setupDate: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `guardian-share-${guardian.nickname.toLowerCase().replace(/\s+/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-gray-900 border border-cyan-500/30 rounded-xl shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-gray-900 border-b border-cyan-500/30 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-cyan-400">Social Recovery Setup</h2>
              <p className="text-sm text-gray-400 mt-1">
                Secure your vault with trusted guardians (V2 Secure)
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Progress Steps */}
          <div className="mt-4 flex items-center justify-between">
            {['Guardians', 'Threshold', 'Delay', 'Shares', 'Confirm'].map((label, index) => {
              const steps: SetupStep[] = ['guardians', 'threshold', 'delay', 'shares', 'confirmation'];
              const step = steps[index];
              const isActive = currentStep === step;
              const isCompleted = steps.indexOf(currentStep) > index;

              return (
                <React.Fragment key={step}>
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                        isActive
                          ? 'bg-cyan-500 border-cyan-500 text-white'
                          : isCompleted
                          ? 'bg-green-500 border-green-500 text-white'
                          : 'bg-gray-800 border-gray-600 text-gray-400'
                      }`}
                    >
                      {isCompleted ? (
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        index + 1
                      )}
                    </div>
                    <span
                      className={`text-xs mt-1 ${
                        isActive ? 'text-cyan-400 font-semibold' : 'text-gray-400'
                      }`}
                    >
                      {label}
                    </span>
                  </div>
                  {index < 4 && (
                    <div
                      className={`flex-1 h-0.5 mx-2 ${
                        isCompleted ? 'bg-green-500' : 'bg-gray-700'
                      }`}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
              {error}
            </div>
          )}

          {/* Step 1: Guardian Selection */}
          {currentStep === 'guardians' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Choose Guardians</h3>
                <p className="text-sm text-gray-400">
                  Select {MIN_GUARDIANS}-{MAX_GUARDIANS} trusted people who will help recover your
                  vault if you lose access.
                </p>
              </div>

              <div className="space-y-3">
                {guardians.map((guardian, index) => (
                  <div
                    key={guardian.id}
                    className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-1">
                            Guardian #{index + 1} Nickname
                          </label>
                          <input
                            type="text"
                            value={guardian.nickname}
                            onChange={e =>
                              handleGuardianChange(guardian.id, 'nickname', e.target.value)
                            }
                            placeholder="e.g., Mom, Best Friend, Spouse"
                            className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-1">
                            Solana Address
                          </label>
                          <input
                            type="text"
                            value={guardian.address}
                            onChange={e =>
                              handleGuardianChange(guardian.id, 'address', e.target.value)
                            }
                            placeholder="Enter guardian's wallet address"
                            className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 font-mono text-sm"
                          />
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveGuardian(guardian.id)}
                        disabled={guardians.length <= MIN_GUARDIANS}
                        className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        aria-label="Remove guardian"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={handleAddGuardian}
                disabled={guardians.length >= MAX_GUARDIANS}
                className="w-full py-2 border-2 border-dashed border-gray-600 rounded-lg text-gray-400 hover:border-cyan-500 hover:text-cyan-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                + Add Guardian
              </button>

              <div className="p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
                <p className="text-sm text-cyan-300">
                  <strong>Tip:</strong> Choose guardians who are tech-savvy and will keep their
                  share secure. They should be people you trust and can contact easily.
                </p>
              </div>
            </div>
          )}

          {/* Step 2: Threshold Configuration */}
          {currentStep === 'threshold' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  Set Recovery Threshold
                </h3>
                <p className="text-sm text-gray-400">
                  Choose how many guardians ({threshold} of {validGuardians.length}) must approve a
                  recovery request.
                </p>
              </div>

              <div className="p-6 bg-gray-800/50 border border-gray-700 rounded-lg">
                <label className="block text-sm font-medium text-gray-300 mb-4">
                  Threshold: {threshold} of {validGuardians.length}
                </label>
                <input
                  type="range"
                  min={MIN_THRESHOLD}
                  max={validGuardians.length}
                  value={threshold}
                  onChange={e => setThreshold(parseInt(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-2">
                  <span>Min ({MIN_THRESHOLD})</span>
                  <span>Max ({validGuardians.length})</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <p className="text-sm text-yellow-300">
                    <strong>Lower threshold ({threshold < validGuardians.length / 2 ? 'e.g., 2 of 5' : ''}):</strong>{' '}
                    Easier to recover, but less secure if guardians collude.
                  </p>
                </div>
                <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                  <p className="text-sm text-green-300">
                    <strong>Higher threshold ({threshold > validGuardians.length / 2 ? `e.g., ${threshold} of ${validGuardians.length}` : ''}):</strong>{' '}
                    More secure, but harder to recover if guardians are unavailable.
                  </p>
                </div>
              </div>

              <div className="p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
                <p className="text-sm text-cyan-300">
                  <strong>Recommended:</strong> Use {Math.ceil(validGuardians.length / 2) + 1} of{' '}
                  {validGuardians.length} for optimal balance between security and recoverability.
                </p>
              </div>
            </div>
          )}

          {/* Step 3: Recovery Delay */}
          {currentStep === 'delay' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Recovery Time-Lock</h3>
                <p className="text-sm text-gray-400">
                  Set the mandatory delay between recovery initiation and completion.
                </p>
              </div>

              <div className="p-6 bg-gray-800/50 border border-gray-700 rounded-lg">
                <label className="block text-sm font-medium text-gray-300 mb-4">
                  Delay: {Math.floor(recoveryDelay / 86400)} days
                </label>
                <input
                  type="range"
                  min={1}
                  max={30}
                  value={Math.floor(recoveryDelay / 86400)}
                  onChange={e => setRecoveryDelay(parseInt(e.target.value) * 86400)}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-2">
                  <span>1 day</span>
                  <span>30 days</span>
                </div>
              </div>

              <div className="p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
                <p className="text-sm text-cyan-300">
                  <strong>Purpose:</strong> The time-lock gives you time to cancel unauthorized
                  recovery attempts. You'll be notified when recovery is initiated.
                </p>
              </div>

              <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <p className="text-sm text-yellow-300">
                  <strong>Warning:</strong> Shorter delays ({recoveryDelay < 3 * 86400 ? 'like your current setting' : 'e.g., 1-2 days'}) are less
                  secure. Recommended: 7+ days.
                </p>
              </div>
            </div>
          )}

          {/* Step 4: Share Distribution */}
          {currentStep === 'shares' && recoverySetup && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Distribute Shares</h3>
                <p className="text-sm text-gray-400">
                  Send each guardian their unique recovery share. Keep these shares secure and
                  private!
                </p>
              </div>

              <div className="space-y-3">
                {validGuardians.map((guardian, index) => (
                  <div
                    key={guardian.id}
                    className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold text-white">{guardian.nickname}</h4>
                        <p className="text-xs text-gray-400 font-mono">
                          {guardian.address.slice(0, 8)}...{guardian.address.slice(-8)}
                        </p>
                      </div>
                      <button
                        onClick={() => downloadShare(index)}
                        className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg transition-colors"
                      >
                        Download Share
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-sm text-red-300">
                  <strong>IMPORTANT:</strong> Send each share ONLY to the designated guardian via a
                  secure channel (encrypted email, Signal, in person). Never share multiple shares
                  with one person!
                </p>
              </div>

              <div className="p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
                <p className="text-sm text-cyan-300">
                  <strong>V2 Security:</strong> Your shares are never stored on the blockchain.
                  Only hash commitments are stored, ensuring maximum privacy.
                </p>
              </div>
            </div>
          )}

          {/* Step 5: Confirmation */}
          {currentStep === 'confirmation' && recoverySetup && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Confirm Setup</h3>
                <p className="text-sm text-gray-400">
                  Review your recovery configuration before submitting to the blockchain.
                </p>
              </div>

              <div className="space-y-3">
                <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-400">Guardians</p>
                      <p className="text-lg font-semibold text-white">{validGuardians.length}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Threshold</p>
                      <p className="text-lg font-semibold text-white">
                        {threshold} of {validGuardians.length}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Recovery Delay</p>
                      <p className="text-lg font-semibold text-white">
                        {Math.floor(recoveryDelay / 86400)} days
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Security</p>
                      <p className="text-lg font-semibold text-green-400">V2 Secure</p>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
                  <p className="text-sm font-medium text-gray-300 mb-2">Guardian List:</p>
                  <ul className="space-y-1">
                    {validGuardians.map((g, i) => (
                      <li key={i} className="text-sm text-gray-400">
                        {i + 1}. {g.nickname} ({g.address.slice(0, 8)}...{g.address.slice(-8)})
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                <p className="text-sm text-green-300">
                  <strong>Ready to submit!</strong> Click "Complete Setup" to save your recovery
                  configuration on the Solana blockchain.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-900 border-t border-cyan-500/30 px-6 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={handlePrevStep}
              disabled={currentStep === 'guardians'}
              className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Back
            </button>

            <div className="text-sm text-gray-400">
              Step {['guardians', 'threshold', 'delay', 'shares', 'confirmation'].indexOf(currentStep) + 1} of 5
            </div>

            {currentStep === 'confirmation' ? (
              <button
                onClick={handleSubmit}
                disabled={isLoading}
                className="px-6 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Submitting...' : 'Complete Setup'}
              </button>
            ) : (
              <button
                onClick={handleNextStep}
                disabled={!canProceed[currentStep] || isLoading}
                className="px-6 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Processing...' : 'Next'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
