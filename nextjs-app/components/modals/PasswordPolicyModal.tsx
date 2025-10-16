'use client';

import React, { useState, useEffect } from 'react';
import {
  PasswordPolicy,
  PolicyPreset,
  PolicyValidationResult,
  POLICY_PRESETS,
  loadPasswordPolicy,
  savePasswordPolicy,
  applyPolicyPreset,
  validatePasswordPolicy,
  getPolicyDescription,
  detectPolicyPreset,
  generateCompliantPassword,
  getStrengthIndicator,
} from '../../lib/password-strength-policy';
import { useToast } from '../ui/Toast';

interface PasswordPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PasswordPolicyModal({
  isOpen,
  onClose,
}: PasswordPolicyModalProps) {
  const toast = useToast();
  const [policy, setPolicy] = useState<PasswordPolicy>(loadPasswordPolicy());
  const [selectedPreset, setSelectedPreset] = useState<PolicyPreset>('standard');
  const [testPassword, setTestPassword] = useState('');
  const [testResult, setTestResult] = useState<PolicyValidationResult | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Load policy on mount
  useEffect(() => {
    if (isOpen) {
      const loaded = loadPasswordPolicy();
      setPolicy(loaded);
      setSelectedPreset(detectPolicyPreset(loaded));
      setHasChanges(false);
    }
  }, [isOpen]);

  // Test password when it changes
  useEffect(() => {
    if (testPassword) {
      const result = validatePasswordPolicy(testPassword, policy);
      setTestResult(result);
    } else {
      setTestResult(null);
    }
  }, [testPassword, policy]);

  const handlePresetChange = (preset: PolicyPreset) => {
    setSelectedPreset(preset);
    const newPolicy = { ...POLICY_PRESETS[preset] };
    setPolicy(newPolicy);
    setHasChanges(true);
  };

  const handlePolicyChange = (updates: Partial<PasswordPolicy>) => {
    const newPolicy = { ...policy, ...updates };
    setPolicy(newPolicy);
    setSelectedPreset('custom');
    setHasChanges(true);
  };

  const handleSave = () => {
    savePasswordPolicy(policy);
    toast.showSuccess('Password policy saved successfully');
    setHasChanges(false);
  };

  const handleReset = () => {
    const loaded = loadPasswordPolicy();
    setPolicy(loaded);
    setSelectedPreset(detectPolicyPreset(loaded));
    setHasChanges(false);
    toast.showInfo('Changes discarded');
  };

  const handleGenerateTest = () => {
    const generated = generateCompliantPassword(policy);
    setTestPassword(generated);
  };

  if (!isOpen) return null;

  const policyDescription = getPolicyDescription(policy);
  const strengthIndicator = testResult ? getStrengthIndicator(testResult.score) : null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content password-policy-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>🔒 Password Policy</h2>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          {/* Policy Toggle */}
          <div className="policy-toggle">
            <label className="toggle-container">
              <input
                type="checkbox"
                checked={policy.enabled}
                onChange={(e) => handlePolicyChange({ enabled: e.target.checked })}
              />
              <span className="toggle-label">
                <strong>Enable Password Policy Enforcement</strong>
              </span>
            </label>
            <p className="toggle-description">
              When enabled, all passwords must meet the requirements below
            </p>
          </div>

          {/* Preset Selection */}
          <div className="preset-section">
            <h3>Policy Presets</h3>
            <div className="preset-grid">
              {Object.keys(POLICY_PRESETS).filter(p => p !== 'custom').map((preset) => {
                const presetPolicy = POLICY_PRESETS[preset as PolicyPreset];
                return (
                  <button
                    key={preset}
                    className={`preset-card ${selectedPreset === preset ? 'active' : ''} ${!policy.enabled ? 'disabled' : ''}`}
                    onClick={() => handlePresetChange(preset as PolicyPreset)}
                    disabled={!policy.enabled}
                  >
                    <div className="preset-name">{preset.toUpperCase()}</div>
                    <div className="preset-details">
                      <div className="preset-length">{presetPolicy.minLength}+ chars</div>
                      <div className="preset-score">
                        Score: {['Any', 'Weak+', 'Med+', 'Strong+', 'Very Strong'][presetPolicy.minStrengthScore]}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Settings */}
          <div className="custom-settings">
            <div className="settings-header">
              <h3>Custom Settings</h3>
              {selectedPreset === 'custom' && (
                <span className="custom-badge">Custom Policy</span>
              )}
            </div>

            <div className="settings-grid">
              {/* Minimum Length */}
              <div className="setting-item">
                <label>Minimum Length</label>
                <div className="length-control">
                  <input
                    type="range"
                    min="6"
                    max="32"
                    value={policy.minLength}
                    onChange={(e) => handlePolicyChange({ minLength: parseInt(e.target.value) })}
                    disabled={!policy.enabled}
                  />
                  <span className="length-value">{policy.minLength} characters</span>
                </div>
              </div>

              {/* Character Requirements */}
              <div className="setting-item">
                <label>Character Requirements</label>
                <div className="checkbox-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={policy.requireUppercase}
                      onChange={(e) => handlePolicyChange({ requireUppercase: e.target.checked })}
                      disabled={!policy.enabled}
                    />
                    Uppercase letters (A-Z)
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={policy.requireLowercase}
                      onChange={(e) => handlePolicyChange({ requireLowercase: e.target.checked })}
                      disabled={!policy.enabled}
                    />
                    Lowercase letters (a-z)
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={policy.requireNumbers}
                      onChange={(e) => handlePolicyChange({ requireNumbers: e.target.checked })}
                      disabled={!policy.enabled}
                    />
                    Numbers (0-9)
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={policy.requireSymbols}
                      onChange={(e) => handlePolicyChange({ requireSymbols: e.target.checked })}
                      disabled={!policy.enabled}
                    />
                    Special characters (!@#$%...)
                  </label>
                </div>
              </div>

              {/* Minimum Strength Score */}
              <div className="setting-item">
                <label>Minimum Strength Score</label>
                <div className="score-control">
                  <input
                    type="range"
                    min="0"
                    max="4"
                    value={policy.minStrengthScore}
                    onChange={(e) => handlePolicyChange({ minStrengthScore: parseInt(e.target.value) })}
                    disabled={!policy.enabled}
                  />
                  <span className="score-value">
                    {['No minimum', 'Weak', 'Medium', 'Strong', 'Very Strong'][policy.minStrengthScore]}
                  </span>
                </div>
              </div>

              {/* Additional Options */}
              <div className="setting-item">
                <label>Additional Options</label>
                <div className="checkbox-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={policy.preventCommonPasswords}
                      onChange={(e) => handlePolicyChange({ preventCommonPasswords: e.target.checked })}
                      disabled={!policy.enabled}
                    />
                    Block common passwords
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={policy.preventReuse}
                      onChange={(e) => handlePolicyChange({ preventReuse: e.target.checked })}
                      disabled={!policy.enabled}
                    />
                    Prevent password reuse
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Policy Description */}
          <div className="policy-description">
            <h4>Current Policy</h4>
            <p>{policyDescription}</p>
          </div>

          {/* Password Tester */}
          <div className="password-tester">
            <h3>Test Password</h3>
            <p className="tester-description">
              Test a password against your current policy
            </p>

            <div className="test-input-group">
              <input
                type="text"
                placeholder="Enter a password to test..."
                value={testPassword}
                onChange={(e) => setTestPassword(e.target.value)}
                className="test-input"
              />
              <button onClick={handleGenerateTest} className="btn-generate">
                Generate
              </button>
            </div>

            {testResult && (
              <div className={`test-results ${testResult.isValid ? 'valid' : 'invalid'}`}>
                <div className="result-header">
                  <div className="result-status">
                    {testResult.isValid ? '✅ Valid' : '❌ Invalid'}
                  </div>
                  {strengthIndicator && (
                    <div className="result-strength">
                      <span className="strength-label">{strengthIndicator.label}</span>
                      <div className="strength-bar">
                        <div
                          className="strength-fill"
                          style={{
                            width: `${strengthIndicator.percentage}%`,
                            backgroundColor: strengthIndicator.color,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {testResult.errors.length > 0 && (
                  <div className="result-errors">
                    <h4>❌ Errors</h4>
                    <ul>
                      {testResult.errors.map((error, i) => (
                        <li key={i}>{error}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {testResult.warnings.length > 0 && (
                  <div className="result-warnings">
                    <h4>⚠️ Warnings</h4>
                    <ul>
                      {testResult.warnings.map((warning, i) => (
                        <li key={i}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {testResult.suggestions.length > 0 && (
                  <div className="result-suggestions">
                    <h4>💡 Suggestions</h4>
                    <ul>
                      {testResult.suggestions.map((suggestion, i) => (
                        <li key={i}>{suggestion}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          {hasChanges && (
            <button onClick={handleReset} className="btn-reset">
              Reset
            </button>
          )}
          <button onClick={handleSave} className="btn-save" disabled={!hasChanges}>
            {hasChanges ? 'Save Policy' : 'Saved'}
          </button>
          <button onClick={onClose} className="btn-close">
            Close
          </button>
        </div>

        <style jsx>{`
          .password-policy-modal {
            max-width: 800px;
            width: 95%;
            max-height: 90vh;
            display: flex;
            flex-direction: column;
          }

          .modal-body {
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 2rem;
          }

          .policy-toggle {
            padding: 1.5rem;
            background: #f8f9fa;
            border-radius: 12px;
          }

          .toggle-container {
            display: flex;
            align-items: center;
            gap: 1rem;
            cursor: pointer;
          }

          .toggle-container input[type="checkbox"] {
            width: 20px;
            height: 20px;
            cursor: pointer;
          }

          .toggle-label {
            font-size: 1.1rem;
            color: #2c3e50;
          }

          .toggle-description {
            margin: 0.5rem 0 0 2.5rem;
            font-size: 0.9rem;
            color: #7f8c8d;
          }

          .preset-section h3,
          .custom-settings h3,
          .password-tester h3 {
            margin: 0 0 1rem 0;
            color: #2c3e50;
          }

          .preset-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 1rem;
          }

          .preset-card {
            padding: 1.5rem;
            border: 2px solid #e1e8ed;
            border-radius: 12px;
            background: white;
            cursor: pointer;
            transition: all 0.2s;
            text-align: center;
          }

          .preset-card:hover:not(.disabled) {
            border-color: #3498db;
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(52, 152, 219, 0.2);
          }

          .preset-card.active {
            border-color: #3498db;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
          }

          .preset-card.disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }

          .preset-name {
            font-weight: 700;
            font-size: 1.1rem;
            margin-bottom: 0.5rem;
          }

          .preset-details {
            display: flex;
            flex-direction: column;
            gap: 0.25rem;
            font-size: 0.85rem;
            opacity: 0.9;
          }

          .custom-settings {
            padding: 1.5rem;
            border: 2px solid #e1e8ed;
            border-radius: 12px;
          }

          .settings-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1rem;
          }

          .custom-badge {
            padding: 0.25rem 0.75rem;
            background: #3498db;
            color: white;
            border-radius: 20px;
            font-size: 0.85rem;
            font-weight: 600;
          }

          .settings-grid {
            display: flex;
            flex-direction: column;
            gap: 1.5rem;
          }

          .setting-item label:first-of-type {
            display: block;
            font-weight: 600;
            color: #2c3e50;
            margin-bottom: 0.75rem;
          }

          .length-control,
          .score-control {
            display: flex;
            align-items: center;
            gap: 1rem;
          }

          .length-control input[type="range"],
          .score-control input[type="range"] {
            flex: 1;
          }

          .length-value,
          .score-value {
            min-width: 120px;
            font-weight: 600;
            color: #3498db;
          }

          .checkbox-group {
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
          }

          .checkbox-group label {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            cursor: pointer;
          }

          .checkbox-group input[type="checkbox"] {
            width: 18px;
            height: 18px;
            cursor: pointer;
          }

          .policy-description {
            padding: 1.5rem;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-radius: 12px;
          }

          .policy-description h4 {
            margin: 0 0 0.5rem 0;
            font-size: 1rem;
          }

          .policy-description p {
            margin: 0;
            font-size: 0.95rem;
            line-height: 1.6;
          }

          .password-tester {
            padding: 1.5rem;
            background: #f8f9fa;
            border-radius: 12px;
          }

          .tester-description {
            margin: 0 0 1rem 0;
            font-size: 0.9rem;
            color: #7f8c8d;
          }

          .test-input-group {
            display: flex;
            gap: 0.75rem;
            margin-bottom: 1rem;
          }

          .test-input {
            flex: 1;
            padding: 0.75rem;
            border: 2px solid #e1e8ed;
            border-radius: 8px;
            font-size: 1rem;
          }

          .btn-generate {
            padding: 0.75rem 1.5rem;
            background: #3498db;
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 600;
            transition: background 0.2s;
          }

          .btn-generate:hover {
            background: #2980b9;
          }

          .test-results {
            padding: 1.5rem;
            border-radius: 12px;
            border: 2px solid;
          }

          .test-results.valid {
            border-color: #22c55e;
            background: #f0fdf4;
          }

          .test-results.invalid {
            border-color: #ef4444;
            background: #fef2f2;
          }

          .result-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1rem;
            padding-bottom: 1rem;
            border-bottom: 1px solid rgba(0, 0, 0, 0.1);
          }

          .result-status {
            font-size: 1.25rem;
            font-weight: 700;
          }

          .result-strength {
            display: flex;
            align-items: center;
            gap: 1rem;
          }

          .strength-label {
            font-weight: 600;
            font-size: 0.9rem;
          }

          .strength-bar {
            width: 150px;
            height: 8px;
            background: #e1e8ed;
            border-radius: 4px;
            overflow: hidden;
          }

          .strength-fill {
            height: 100%;
            transition: width 0.3s, background-color 0.3s;
          }

          .result-errors,
          .result-warnings,
          .result-suggestions {
            margin-top: 1rem;
          }

          .result-errors h4,
          .result-warnings h4,
          .result-suggestions h4 {
            margin: 0 0 0.5rem 0;
            font-size: 0.95rem;
          }

          .result-errors ul,
          .result-warnings ul,
          .result-suggestions ul {
            margin: 0;
            padding-left: 1.5rem;
          }

          .result-errors li {
            color: #dc2626;
            margin-bottom: 0.25rem;
          }

          .result-warnings li {
            color: #ea580c;
            margin-bottom: 0.25rem;
          }

          .result-suggestions li {
            color: #2563eb;
            margin-bottom: 0.25rem;
          }

          .modal-footer {
            display: flex;
            gap: 0.75rem;
            justify-content: flex-end;
          }

          .modal-footer button {
            padding: 0.75rem 1.5rem;
            border-radius: 8px;
            border: none;
            cursor: pointer;
            font-weight: 600;
            transition: all 0.2s;
          }

          .btn-reset {
            background: #f59e0b;
            color: white;
          }

          .btn-reset:hover {
            background: #d97706;
          }

          .btn-save {
            background: #22c55e;
            color: white;
          }

          .btn-save:hover:not(:disabled) {
            background: #16a34a;
          }

          .btn-save:disabled {
            background: #94a3b8;
            cursor: not-allowed;
          }

          .btn-close {
            background: #64748b;
            color: white;
          }

          .btn-close:hover {
            background: #475569;
          }

          @media (max-width: 768px) {
            .preset-grid {
              grid-template-columns: repeat(2, 1fr);
            }

            .result-header {
              flex-direction: column;
              align-items: flex-start;
              gap: 1rem;
            }
          }
        `}</style>
      </div>
    </div>
  );
}
