'use client';

import React, { useState } from 'react';
import { PasswordEntry } from '../../sdk/src/types-v2';
import {
  createShare,
  getActiveShares,
  revokeShare,
  ShareType,
  ShareAccessLevel,
} from '../../lib/password-sharing';
import { useToast } from '../ui/Toast';

interface ShareManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  entry?: PasswordEntry;
  walletAddress: string;
}

export function ShareManagementModal({
  isOpen,
  onClose,
  entry,
  walletAddress,
}: ShareManagementModalProps) {
  const toast = useToast();
  const [shareType, setShareType] = useState<ShareType>(ShareType.TIME_LIMITED);
  const [accessLevel, setAccessLevel] = useState<ShareAccessLevel>(ShareAccessLevel.VIEW_ONLY);
  const [expiresIn, setExpiresIn] = useState<number>(60);
  const [generatedLink, setGeneratedLink] = useState<string>('');

  if (!isOpen) return null;

  const handleCreateShare = async () => {
    if (!entry) {
      toast.showError('No entry selected');
      return;
    }

    try {
      const shareLink = await createShare(
        entry,
        shareType,
        accessLevel,
        walletAddress,
        shareType === ShareType.TIME_LIMITED ? expiresIn : undefined
      );

      setGeneratedLink(shareLink.url);
      toast.showSuccess('Share created!');
    } catch (error) {
      toast.showError(`Failed: ${error}`);
    }
  };

  const handleCopyLink = () => {
    if (generatedLink) {
      navigator.clipboard.writeText(generatedLink);
      toast.showSuccess('Copied!');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Password Sharing</h2>
          <button onClick={onClose} className="btn-close">X</button>
        </div>

        <div className="modal-body">
          {!entry ? (
            <div className="empty-state">
              <p>Select an entry to create a share</p>
            </div>
          ) : (
            <>
              <div className="selected-entry">
                <strong>Sharing:</strong> {entry.title}
              </div>

              <div className="form-group">
                <label>Share Type</label>
                <select
                  value={shareType}
                  onChange={(e) => setShareType(e.target.value as ShareType)}
                  className="form-select"
                >
                  <option value={ShareType.ONE_TIME}>One-Time</option>
                  <option value={ShareType.TIME_LIMITED}>Time Limited</option>
                  <option value={ShareType.UNLIMITED}>Unlimited</option>
                </select>
              </div>

              {shareType === ShareType.TIME_LIMITED && (
                <div className="form-group">
                  <label>Expires In (minutes)</label>
                  <input
                    type="number"
                    value={expiresIn}
                    onChange={(e) => setExpiresIn(Number(e.target.value))}
                    min="1"
                    className="form-input"
                  />
                </div>
              )}

              <div className="form-group">
                <label>Access Level</label>
                <select
                  value={accessLevel}
                  onChange={(e) => setAccessLevel(e.target.value as ShareAccessLevel)}
                  className="form-select"
                >
                  <option value={ShareAccessLevel.VIEW_ONLY}>View Only</option>
                  <option value={ShareAccessLevel.COPY_PASSWORD}>Copy Password</option>
                  <option value={ShareAccessLevel.FULL_ACCESS}>Full Access</option>
                </select>
              </div>

              <button onClick={handleCreateShare} className="btn-primary">
                Generate Share Link
              </button>

              {generatedLink && (
                <div className="share-result">
                  <input
                    type="text"
                    value={generatedLink}
                    readOnly
                    className="share-link-input"
                  />
                  <button onClick={handleCopyLink} className="btn-copy">
                    Copy
                  </button>
                </div>
              )}
            </>
          )}
        </div>

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
          }

          .modal-container {
            background: white;
            border-radius: 16px;
            width: 90%;
            max-width: 600px;
            max-height: 90vh;
            overflow: auto;
          }

          .modal-header {
            padding: 1.5rem;
            border-bottom: 1px solid #e1e8ed;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }

          .modal-header h2 {
            margin: 0;
            font-size: 1.5rem;
            color: #2c3e50;
          }

          .btn-close {
            background: transparent;
            border: none;
            font-size: 1.5rem;
            color: #7f8c8d;
            cursor: pointer;
          }

          .modal-body {
            padding: 1.5rem;
          }

          .selected-entry {
            padding: 1rem;
            background: #eff6ff;
            border-radius: 8px;
            margin-bottom: 1.5rem;
            color: #1e40af;
          }

          .form-group {
            margin-bottom: 1.5rem;
          }

          .form-group label {
            display: block;
            margin-bottom: 0.5rem;
            font-weight: 600;
            color: #2c3e50;
          }

          .form-select,
          .form-input {
            width: 100%;
            padding: 0.75rem;
            border: 1px solid #e1e8ed;
            border-radius: 8px;
            font-size: 1rem;
          }

          .btn-primary {
            width: 100%;
            padding: 0.75rem;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
          }

          .btn-primary:hover {
            transform: translateY(-2px);
          }

          .share-result {
            margin-top: 1.5rem;
            padding: 1.5rem;
            background: #f0fdf4;
            border: 2px solid #d1fae5;
            border-radius: 8px;
          }

          .share-link-input {
            width: 100%;
            padding: 0.75rem;
            border: 1px solid #d1fae5;
            border-radius: 8px;
            font-family: monospace;
            font-size: 0.875rem;
            margin-bottom: 0.75rem;
          }

          .btn-copy {
            width: 100%;
            padding: 0.75rem;
            background: #16a34a;
            color: white;
            border: none;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
          }

          .empty-state {
            text-align: center;
            padding: 3rem 1rem;
            color: #7f8c8d;
          }
        `}</style>
      </div>
    </div>
  );
}
