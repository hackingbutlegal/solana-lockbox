/**
 * Recovery Initiation Modal
 *
 * For guardians to initiate recovery on behalf of the vault owner.
 *
 * V2 Secure Flow:
 * 1. Guardian initiates recovery request (generates challenge)
 * 2. Guardian contacts other guardians off-chain to collect shares
 * 3. Guardian reconstructs secret client-side (never on blockchain)
 * 4. Guardian decrypts challenge with reconstructed secret
 * 5. Guardian submits decrypted challenge as proof
 * 6. On-chain verification → ownership transfer
 *
 * Features:
 * - Initiate recovery for a specific vault owner
 * - Upload shares from other guardians (JSON files or QR codes)
 * - Client-side secret reconstruction
 * - Proof generation
 * - Submit recovery completion with proof
 */

'use client';

import React, { useState } from 'react';
import { PublicKey } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import { useRecovery } from '@/contexts';
import { reconstructSecret, Share } from '@/lib/shamir-secret-sharing';
import {
  generateProofOfReconstruction,
  verifyProof,
} from '@/lib/recovery-client-v2';

// Types
interface RecoveryInitiationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShareInput {
  id: string;
  guardianName: string;
  shareData: Uint8Array | null;
  isValid: boolean;
  file?: File;
}

type InitiationStep = 'owner' | 'challenge' | 'shares' | 'reconstruct' | 'submit';

export default function RecoveryInitiationModal({
  isOpen,
  onClose,
}: RecoveryInitiationModalProps) {
  const { publicKey } = useWallet();
  const {
    initiateRecovery,
    completeRecovery,
    activeRequests,
    loading,
    error,
  } = useRecovery();

  // State
  const [currentStep, setCurrentStep] = useState<InitiationStep>('owner');
  const [vaultOwner, setVaultOwner] = useState<string>('');
  const [vaultOwnerValid, setVaultOwnerValid] = useState(false);
  const [requestId, setRequestId] = useState<number | null>(null);
  const [encryptedChallenge, setEncryptedChallenge] = useState<Uint8Array | null>(null);
  const [shares, setShares] = useState<ShareInput[]>([
    { id: '1', guardianName: '', shareData: null, isValid: false },
    { id: '2', guardianName: '', shareData: null, isValid: false },
  ]);
  const [reconstructedSecret, setReconstructedSecret] = useState<Uint8Array | null>(null);
  const [proof, setProof] = useState<Uint8Array | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Validation
  const validShares = shares.filter(s => s.isValid && s.shareData);
  const canProceed = {
    owner: vaultOwnerValid,
    challenge: requestId !== null && encryptedChallenge !== null,
    shares: validShares.length >= 2, // Minimum threshold
    reconstruct: reconstructedSecret !== null,
    submit: proof !== null,
  };

  // Handlers
  const handleVaultOwnerChange = (value: string) => {
    setVaultOwner(value);
    try {
      new PublicKey(value);
      setVaultOwnerValid(true);
      setLocalError(null);
    } catch {
      setVaultOwnerValid(false);
      if (value.length > 0) {
        setLocalError('Invalid Solana address');
      }
    }
  };

  const handleInitiateRecovery = async () => {
    if (!vaultOwnerValid) return;

    setIsProcessing(true);
    setLocalError(null);

    try {
      const ownerPubkey = new PublicKey(vaultOwner);
      await initiateRecovery(ownerPubkey);

      // Find the newly created request
      const newRequest = activeRequests.find(r => r.owner === vaultOwner);
      if (newRequest) {
        setRequestId(newRequest.requestId);
        setEncryptedChallenge(newRequest.encryptedChallenge);
        setCurrentStep('challenge');
      } else {
        setLocalError('Recovery initiated but request not found. Please check active requests.');
      }
    } catch (err: any) {
      console.error('Failed to initiate recovery:', err);
      setLocalError(err?.message || 'Failed to initiate recovery');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddShare = () => {
    setShares([
      ...shares,
      { id: Date.now().toString(), guardianName: '', shareData: null, isValid: false },
    ]);
  };

  const handleRemoveShare = (id: string) => {
    setShares(shares.filter(s => s.id !== id));
  };

  const handleFileUpload = async (id: string, file: File) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      // Validate structure
      if (!data.guardian || !data.share || !data.commitment) {
        throw new Error('Invalid share file format');
      }

      // Extract share data
      const shareData = new Uint8Array(data.share);

      setShares(shares.map(s =>
        s.id === id
          ? {
              ...s,
              guardianName: data.guardian.nickname || 'Unknown',
              shareData,
              isValid: true,
              file,
            }
          : s
      ));

      setLocalError(null);
    } catch (err: any) {
      console.error('Failed to parse share file:', err);
      setLocalError(`Invalid share file: ${err.message}`);
    }
  };

  const handleReconstruct = async () => {
    if (validShares.length < 2) {
      setLocalError('Need at least 2 shares to reconstruct secret');
      return;
    }

    setIsProcessing(true);
    setLocalError(null);

    try {
      // Convert ShareInput to Share format
      const shamirShares: Share[] = validShares.map((s, index) => ({
        index: index + 1, // 1-based indexing
        data: s.shareData!,
      }));

      // Reconstruct secret
      const secret = reconstructSecret(shamirShares);
      setReconstructedSecret(secret);
      setCurrentStep('reconstruct');
    } catch (err: any) {
      console.error('Failed to reconstruct secret:', err);
      setLocalError(err?.message || 'Failed to reconstruct secret. Shares may be invalid.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGenerateProof = async () => {
    if (!reconstructedSecret || !encryptedChallenge) {
      setLocalError('Missing reconstructed secret or challenge');
      return;
    }

    setIsProcessing(true);
    setLocalError(null);

    try {
      // Generate proof by decrypting challenge
      const generatedProof = await generateProofOfReconstruction(
        encryptedChallenge,
        reconstructedSecret
      );

      // Verify proof locally before submitting
      const isValid = await verifyProof(encryptedChallenge, generatedProof, reconstructedSecret);
      if (!isValid) {
        throw new Error('Proof verification failed. Secret may be incorrect.');
      }

      setProof(generatedProof);
      setCurrentStep('submit');
    } catch (err: any) {
      console.error('Failed to generate proof:', err);
      setLocalError(err?.message || 'Failed to generate proof');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmit = async () => {
    if (!proof || requestId === null || !vaultOwnerValid) {
      setLocalError('Missing proof, request ID, or vault owner');
      return;
    }

    setIsProcessing(true);
    setLocalError(null);

    try {
      const ownerPubkey = new PublicKey(vaultOwner);
      await completeRecovery(ownerPubkey, requestId, proof);

      // Success!
      alert('Recovery completed successfully! Ownership has been transferred.');
      onClose();
    } catch (err: any) {
      console.error('Failed to complete recovery:', err);
      setLocalError(err?.message || 'Failed to complete recovery');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleNextStep = () => {
    const steps: InitiationStep[] = ['owner', 'challenge', 'shares', 'reconstruct', 'submit'];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex < steps.length - 1) {
      if (currentStep === 'challenge') {
        setCurrentStep('shares');
      } else if (currentStep === 'shares') {
        handleReconstruct();
      } else if (currentStep === 'reconstruct') {
        handleGenerateProof();
      } else {
        setCurrentStep(steps[currentIndex + 1]);
      }
    }
  };

  const handlePrevStep = () => {
    const steps: InitiationStep[] = ['owner', 'challenge', 'shares', 'reconstruct', 'submit'];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1]);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-gray-900 border border-cyan-500/30 rounded-xl shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-gray-900 border-b border-cyan-500/30 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-cyan-400">Initiate Recovery</h2>
              <p className="text-sm text-gray-400 mt-1">
                Recover vault access on behalf of the owner (V2 Secure)
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
            {['Owner', 'Challenge', 'Shares', 'Reconstruct', 'Submit'].map((label, index) => {
              const steps: InitiationStep[] = ['owner', 'challenge', 'shares', 'reconstruct', 'submit'];
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
                      {isCompleted ? '✓' : index + 1}
                    </div>
                    <span className="text-xs text-gray-400 mt-1">{label}</span>
                  </div>
                  {index < 4 && (
                    <div
                      className={`flex-1 h-0.5 mx-2 transition-colors ${
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
          {/* Error Display */}
          {(localError || error) && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-sm text-red-400">{localError || error}</p>
            </div>
          )}

          {/* Step 1: Vault Owner */}
          {currentStep === 'owner' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Vault Owner Address</h3>
                <p className="text-sm text-gray-400 mb-4">
                  Enter the Solana address of the vault owner you want to help recover.
                </p>
              </div>

              <div>
                <label className="block text-sm text-gray-300 mb-2">Owner Address</label>
                <input
                  type="text"
                  value={vaultOwner}
                  onChange={(e) => handleVaultOwnerChange(e.target.value)}
                  placeholder="E.g., 7Np41oeYqPefeNQEHSv1UDhYrehxin3NStELsSKCT4K2"
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                />
                {vaultOwnerValid && (
                  <p className="text-xs text-green-400 mt-1">✓ Valid address</p>
                )}
              </div>

              <button
                onClick={handleInitiateRecovery}
                disabled={!vaultOwnerValid || isProcessing}
                className="w-full px-4 py-3 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? 'Initiating...' : 'Initiate Recovery Request'}
              </button>
            </div>
          )}

          {/* Step 2: Challenge Created */}
          {currentStep === 'challenge' && (
            <div className="space-y-4">
              <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                <h3 className="text-lg font-semibold text-green-400 mb-2">✓ Recovery Request Created</h3>
                <p className="text-sm text-gray-300">
                  Challenge has been generated and encrypted on-chain.
                </p>
                <div className="mt-3 space-y-1 text-xs text-gray-400">
                  <p>Request ID: <span className="text-cyan-400">{requestId}</span></p>
                  <p>Owner: <span className="font-mono text-cyan-400">{vaultOwner.slice(0, 16)}...{vaultOwner.slice(-16)}</span></p>
                </div>
              </div>

              <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <p className="text-sm text-yellow-300">
                  <strong>Next:</strong> Contact other guardians off-chain to collect their shares.
                  You need at least the threshold number of shares to proceed.
                </p>
              </div>
            </div>
          )}

          {/* Step 3: Collect Shares */}
          {currentStep === 'shares' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Collect Guardian Shares</h3>
                <p className="text-sm text-gray-400 mb-4">
                  Upload share files from other guardians (JSON format).
                </p>
              </div>

              <div className="space-y-3">
                {shares.map((share, index) => (
                  <div key={share.id} className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold text-white">Share {index + 1}</h4>
                      {shares.length > 2 && (
                        <button
                          onClick={() => handleRemoveShare(share.id)}
                          className="text-red-400 hover:text-red-300 text-sm"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    {share.isValid ? (
                      <div className="flex items-center gap-2">
                        <span className="text-green-400 text-sm">✓</span>
                        <span className="text-sm text-gray-300">{share.guardianName}</span>
                        <span className="text-xs text-gray-500">({share.file?.name})</span>
                      </div>
                    ) : (
                      <input
                        type="file"
                        accept=".json"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(share.id, file);
                        }}
                        className="w-full text-sm text-gray-400"
                      />
                    )}
                  </div>
                ))}
              </div>

              <button
                onClick={handleAddShare}
                className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm"
              >
                + Add Another Share
              </button>

              <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
                <p className="text-sm text-cyan-300">
                  Collected {validShares.length} share{validShares.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          )}

          {/* Step 4: Reconstruct Secret */}
          {currentStep === 'reconstruct' && (
            <div className="space-y-4">
              <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                <h3 className="text-lg font-semibold text-green-400 mb-2">✓ Secret Reconstructed</h3>
                <p className="text-sm text-gray-300">
                  Master secret successfully reconstructed from {validShares.length} shares.
                </p>
              </div>

              <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
                <p className="text-xs text-gray-400 mb-2">Reconstructed Secret (hex):</p>
                <p className="text-xs font-mono text-cyan-400 break-all">
                  {reconstructedSecret ? Array.from(reconstructedSecret).map(b => b.toString(16).padStart(2, '0')).join('') : 'N/A'}
                </p>
              </div>

              <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <p className="text-sm text-yellow-300">
                  <strong>Note:</strong> The secret is reconstructed entirely client-side.
                  It never touches the blockchain.
                </p>
              </div>
            </div>
          )}

          {/* Step 5: Submit Proof */}
          {currentStep === 'submit' && (
            <div className="space-y-4">
              <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                <h3 className="text-lg font-semibold text-green-400 mb-2">✓ Proof Generated</h3>
                <p className="text-sm text-gray-300">
                  Challenge decrypted successfully. Ready to submit proof to blockchain.
                </p>
              </div>

              <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
                <p className="text-xs text-gray-400 mb-2">Proof (decrypted challenge):</p>
                <p className="text-xs font-mono text-cyan-400 break-all">
                  {proof ? Array.from(proof).map(b => b.toString(16).padStart(2, '0')).join('') : 'N/A'}
                </p>
              </div>

              <div className="p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
                <h4 className="text-sm font-semibold text-cyan-300 mb-2">What happens next?</h4>
                <ul className="space-y-1 text-sm text-cyan-300/80">
                  <li>• Proof submitted to blockchain</li>
                  <li>• On-chain verification (SHA256 hash comparison)</li>
                  <li>• If valid → ownership transferred to your wallet</li>
                  <li>• You gain full access to the vault</li>
                </ul>
              </div>

              <button
                onClick={handleSubmit}
                disabled={isProcessing || loading}
                className="w-full px-4 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing || loading ? 'Submitting Proof...' : 'Complete Recovery'}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-900 border-t border-cyan-500/30 px-6 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={handlePrevStep}
              disabled={currentStep === 'owner' || isProcessing || loading}
              className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Back
            </button>

            <div className="text-sm text-gray-400">
              Step {['owner', 'challenge', 'shares', 'reconstruct', 'submit'].indexOf(currentStep) + 1} of 5
            </div>

            {currentStep !== 'submit' && currentStep !== 'owner' && (
              <button
                onClick={handleNextStep}
                disabled={!canProceed[currentStep] || isProcessing || loading}
                className="px-6 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {isProcessing || loading ? 'Processing...' : 'Next'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
