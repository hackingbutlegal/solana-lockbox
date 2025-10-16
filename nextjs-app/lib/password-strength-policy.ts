/**
 * Password Strength Policy Manager
 *
 * Enforces minimum password strength requirements across the application.
 * Provides configurable policies for different security needs.
 *
 * Features:
 * - Minimum length requirements
 * - Character type requirements (uppercase, lowercase, numbers, symbols)
 * - Minimum strength score enforcement
 * - Custom rules support
 * - Policy presets (basic, standard, strong, paranoid)
 * - Real-time validation
 * - User-friendly feedback
 *
 * @module password-strength-policy
 */

import { checkPasswordStrength, PasswordStrengthResult } from '../sdk/src/utils';

/**
 * Password policy configuration
 */
export interface PasswordPolicy {
  enabled: boolean;
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSymbols: boolean;
  minStrengthScore: number; // 0-4 (0=very weak, 4=very strong)
  preventCommonPasswords: boolean;
  preventReuse: boolean;
  customRules: CustomPasswordRule[];
}

/**
 * Custom password validation rule
 */
export interface CustomPasswordRule {
  id: string;
  name: string;
  description: string;
  validator: (password: string) => boolean;
  errorMessage: string;
}

/**
 * Policy validation result
 */
export interface PolicyValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  score: number;
  suggestions: string[];
}

/**
 * Policy preset names
 */
export type PolicyPreset = 'basic' | 'standard' | 'strong' | 'paranoid' | 'custom';

/**
 * Default policy (standard)
 */
const DEFAULT_POLICY: PasswordPolicy = {
  enabled: true,
  minLength: 12,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSymbols: true,
  minStrengthScore: 2, // Medium
  preventCommonPasswords: true,
  preventReuse: true,
  customRules: [],
};

/**
 * Policy presets
 */
export const POLICY_PRESETS: Record<PolicyPreset, PasswordPolicy> = {
  basic: {
    enabled: true,
    minLength: 8,
    requireUppercase: false,
    requireLowercase: true,
    requireNumbers: false,
    requireSymbols: false,
    minStrengthScore: 1, // Weak
    preventCommonPasswords: false,
    preventReuse: false,
    customRules: [],
  },
  standard: {
    enabled: true,
    minLength: 12,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSymbols: true,
    minStrengthScore: 2, // Medium
    preventCommonPasswords: true,
    preventReuse: true,
    customRules: [],
  },
  strong: {
    enabled: true,
    minLength: 16,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSymbols: true,
    minStrengthScore: 3, // Strong
    preventCommonPasswords: true,
    preventReuse: true,
    customRules: [],
  },
  paranoid: {
    enabled: true,
    minLength: 20,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSymbols: true,
    minStrengthScore: 4, // Very strong
    preventCommonPasswords: true,
    preventReuse: true,
    customRules: [],
  },
  custom: DEFAULT_POLICY,
};

const STORAGE_KEY = 'lockbox_password_policy';

/**
 * Load password policy from storage
 */
export function loadPasswordPolicy(): PasswordPolicy {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const policy = JSON.parse(stored);
      // Merge with defaults to ensure all fields exist
      return { ...DEFAULT_POLICY, ...policy, customRules: [] };
    }
  } catch (error) {
    console.error('Failed to load password policy:', error);
  }
  return { ...DEFAULT_POLICY };
}

/**
 * Save password policy to storage
 */
export function savePasswordPolicy(policy: PasswordPolicy): void {
  try {
    // Don't serialize custom rules with functions
    const toSave = {
      ...policy,
      customRules: [], // Custom rules not persisted
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch (error) {
    console.error('Failed to save password policy:', error);
  }
}

/**
 * Apply a policy preset
 */
export function applyPolicyPreset(preset: PolicyPreset): PasswordPolicy {
  const policy = { ...POLICY_PRESETS[preset] };
  savePasswordPolicy(policy);
  return policy;
}

/**
 * Validate password against policy
 */
export function validatePasswordPolicy(
  password: string,
  policy: PasswordPolicy = loadPasswordPolicy()
): PolicyValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];

  // If policy is disabled, allow all
  if (!policy.enabled) {
    return {
      isValid: true,
      errors,
      warnings,
      score: 4,
      suggestions,
    };
  }

  // Check minimum length
  if (password.length < policy.minLength) {
    errors.push(`Password must be at least ${policy.minLength} characters long (currently ${password.length})`);
    suggestions.push(`Add ${policy.minLength - password.length} more characters`);
  }

  // Check uppercase requirement
  if (policy.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter (A-Z)');
    suggestions.push('Add an uppercase letter');
  }

  // Check lowercase requirement
  if (policy.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter (a-z)');
    suggestions.push('Add a lowercase letter');
  }

  // Check number requirement
  if (policy.requireNumbers && !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number (0-9)');
    suggestions.push('Add a number');
  }

  // Check symbol requirement
  if (policy.requireSymbols && !/[^A-Za-z0-9]/.test(password)) {
    errors.push('Password must contain at least one special character (!@#$%^&*...)');
    suggestions.push('Add a special character');
  }

  // Check password strength score
  let strengthResult: PasswordStrengthResult;
  try {
    strengthResult = checkPasswordStrength(password);
  } catch (error) {
    // Fallback strength check
    strengthResult = {
      score: password.length >= 12 ? 2 : 1,
      feedback: 'Unable to analyze password strength',
    };
  }

  if (strengthResult.score < policy.minStrengthScore) {
    const scoreNames = ['Very Weak', 'Weak', 'Medium', 'Strong', 'Very Strong'];
    const currentScore = scoreNames[strengthResult.score] || 'Unknown';
    const requiredScore = scoreNames[policy.minStrengthScore] || 'Unknown';
    errors.push(`Password strength is ${currentScore}, but ${requiredScore} is required`);

    if (strengthResult.feedback) {
      suggestions.push(strengthResult.feedback);
    }
  }

  // Check for common passwords (basic check)
  if (policy.preventCommonPasswords) {
    const commonPasswords = [
      'password', 'password123', '12345678', 'qwerty', 'abc123',
      'monkey', '1234567890', 'letmein', 'trustno1', 'dragon',
      'baseball', 'iloveyou', 'master', 'sunshine', 'ashley',
      'bailey', 'passw0rd', 'shadow', '123123', '654321',
    ];

    if (commonPasswords.includes(password.toLowerCase())) {
      errors.push('This password is too common and easily guessed');
      suggestions.push('Choose a unique password');
    }
  }

  // Check for sequential characters
  if (password.length >= 3) {
    const hasSequence = /(?:012|123|234|345|456|567|678|789|890|abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz)/i.test(password);
    if (hasSequence) {
      warnings.push('Password contains sequential characters');
      suggestions.push('Avoid sequences like "123" or "abc"');
    }
  }

  // Check for repeated characters
  if (/(.)\1{2,}/.test(password)) {
    warnings.push('Password contains repeated characters');
    suggestions.push('Avoid repeating characters like "aaa" or "111"');
  }

  // Run custom rules
  for (const rule of policy.customRules) {
    try {
      if (!rule.validator(password)) {
        errors.push(rule.errorMessage);
      }
    } catch (error) {
      console.error(`Custom rule ${rule.id} failed:`, error);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    score: strengthResult.score,
    suggestions: [...new Set(suggestions)], // Deduplicate
  };
}

/**
 * Get policy description for UI display
 */
export function getPolicyDescription(policy: PasswordPolicy): string {
  if (!policy.enabled) {
    return 'No password requirements enforced';
  }

  const requirements: string[] = [];

  requirements.push(`At least ${policy.minLength} characters`);

  const charTypes: string[] = [];
  if (policy.requireUppercase) charTypes.push('uppercase');
  if (policy.requireLowercase) charTypes.push('lowercase');
  if (policy.requireNumbers) charTypes.push('numbers');
  if (policy.requireSymbols) charTypes.push('symbols');

  if (charTypes.length > 0) {
    requirements.push(`Must include: ${charTypes.join(', ')}`);
  }

  if (policy.minStrengthScore > 0) {
    const scoreNames = ['any strength', 'weak or better', 'medium or better', 'strong or better', 'very strong'];
    requirements.push(`Minimum strength: ${scoreNames[policy.minStrengthScore]}`);
  }

  return requirements.join(' • ');
}

/**
 * Get preset name from policy
 */
export function detectPolicyPreset(policy: PasswordPolicy): PolicyPreset {
  // Check each preset
  for (const [name, preset] of Object.entries(POLICY_PRESETS)) {
    if (name === 'custom') continue;

    const matches =
      policy.minLength === preset.minLength &&
      policy.requireUppercase === preset.requireUppercase &&
      policy.requireLowercase === preset.requireLowercase &&
      policy.requireNumbers === preset.requireNumbers &&
      policy.requireSymbols === preset.requireSymbols &&
      policy.minStrengthScore === preset.minStrengthScore;

    if (matches) {
      return name as PolicyPreset;
    }
  }

  return 'custom';
}

/**
 * Check if password meets minimum requirements for save
 */
export function canSavePassword(password: string): boolean {
  const policy = loadPasswordPolicy();
  const result = validatePasswordPolicy(password, policy);
  return result.isValid;
}

/**
 * Get password suggestions
 */
export function getPasswordSuggestions(password: string): string[] {
  const policy = loadPasswordPolicy();
  const result = validatePasswordPolicy(password, policy);
  return result.suggestions;
}

/**
 * Generate a password that meets policy requirements
 */
export function generateCompliantPassword(policy: PasswordPolicy = loadPasswordPolicy()): string {
  const length = Math.max(policy.minLength, 16);

  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';

  let chars = '';
  let password = '';

  // Add required character types first
  if (policy.requireUppercase) {
    chars += uppercase;
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
  }
  if (policy.requireLowercase) {
    chars += lowercase;
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
  }
  if (policy.requireNumbers) {
    chars += numbers;
    password += numbers[Math.floor(Math.random() * numbers.length)];
  }
  if (policy.requireSymbols) {
    chars += symbols;
    password += symbols[Math.floor(Math.random() * symbols.length)];
  }

  // If no requirements, use all character types
  if (chars === '') {
    chars = uppercase + lowercase + numbers + symbols;
  }

  // Fill remaining length
  while (password.length < length) {
    password += chars[Math.floor(Math.random() * chars.length)];
  }

  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

/**
 * Compare two policies
 */
export function isPolicyStrongerThan(policy1: PasswordPolicy, policy2: PasswordPolicy): boolean {
  let score1 = 0;
  let score2 = 0;

  score1 += policy1.minLength;
  score2 += policy2.minLength;

  score1 += (policy1.requireUppercase ? 10 : 0);
  score2 += (policy2.requireUppercase ? 10 : 0);

  score1 += (policy1.requireLowercase ? 10 : 0);
  score2 += (policy2.requireLowercase ? 10 : 0);

  score1 += (policy1.requireNumbers ? 10 : 0);
  score2 += (policy2.requireNumbers ? 10 : 0);

  score1 += (policy1.requireSymbols ? 10 : 0);
  score2 += (policy2.requireSymbols ? 10 : 0);

  score1 += policy1.minStrengthScore * 20;
  score2 += policy2.minStrengthScore * 20;

  return score1 > score2;
}

/**
 * Get visual strength indicator
 */
export function getStrengthIndicator(score: number): {
  label: string;
  color: string;
  percentage: number;
} {
  const indicators = [
    { label: 'Very Weak', color: '#ef4444', percentage: 20 },
    { label: 'Weak', color: '#f59e0b', percentage: 40 },
    { label: 'Medium', color: '#eab308', percentage: 60 },
    { label: 'Strong', color: '#22c55e', percentage: 80 },
    { label: 'Very Strong', color: '#10b981', percentage: 100 },
  ];

  return indicators[score] || indicators[0];
}
