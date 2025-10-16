/**
 * Breach Checker
 *
 * Checks passwords against common breach databases and weak password lists.
 * Uses zxcvbn-ts for advanced password analysis including:
 * - Dictionary attacks
 * - Common passwords
 * - Pattern matching
 * - Keyboard patterns
 * - L33t speak variations
 *
 * No external API calls - all checking is done locally.
 *
 * @module breach-checker
 */

import { zxcvbn, zxcvbnOptions } from '@zxcvbn-ts/core';
import * as zxcvbnCommonPackage from '@zxcvbn-ts/language-common';
import * as zxcvbnEnPackage from '@zxcvbn-ts/language-en';

// Initialize zxcvbn with English and common dictionaries
let zxcvbnInitialized = false;

function initializeZxcvbn() {
  if (zxcvbnInitialized) return;

  const options = {
    translations: zxcvbnEnPackage.translations,
    graphs: zxcvbnCommonPackage.adjacencyGraphs,
    dictionary: {
      ...zxcvbnCommonPackage.dictionary,
      ...zxcvbnEnPackage.dictionary,
    },
  };

  zxcvbnOptions.setOptions(options);
  zxcvbnInitialized = true;
}

export interface BreachCheckResult {
  isBreached: boolean;
  score: number; // 0-4 (zxcvbn score)
  crackTime: number; // Estimated seconds to crack
  crackTimeDisplay: string; // Human-readable time
  warning: string;
  suggestions: string[];
  matchSequence: BreachMatch[];
}

export interface BreachMatch {
  pattern: string;
  token: string;
  matchedWord?: string;
  dictionaryName?: string;
}

/**
 * Check if a password appears in breach databases or common password lists
 *
 * @param password - Password to check
 * @param userInputs - Optional array of user-specific words to check against (username, email, etc.)
 * @returns Breach check result
 */
export function checkPasswordBreach(
  password: string,
  userInputs: string[] = []
): BreachCheckResult {
  // Initialize zxcvbn on first use
  initializeZxcvbn();

  // Run zxcvbn analysis
  const result = zxcvbn(password, userInputs);

  // Map matches to our format
  const matchSequence: BreachMatch[] = result.sequence.map(match => ({
    pattern: match.pattern,
    token: match.token,
    matchedWord: 'matchedWord' in match ? (match as any).matchedWord : undefined,
    dictionaryName: 'dictionaryName' in match ? (match as any).dictionaryName : undefined,
  }));

  // Determine if breached based on score and dictionary matches
  const isDictionaryMatch = matchSequence.some(
    m => m.dictionaryName && ['passwords', 'commonWords'].includes(m.dictionaryName)
  );

  const isBreached = result.score <= 2 || isDictionaryMatch;

  return {
    isBreached,
    score: result.score,
    crackTime: result.crackTimesSeconds.offlineSlowHashing1e4PerSecond,
    crackTimeDisplay: result.crackTimesDisplay.offlineSlowHashing1e4PerSecond,
    warning: result.feedback.warning || '',
    suggestions: result.feedback.suggestions || [],
    matchSequence,
  };
}

/**
 * Check multiple passwords for breaches in batch
 *
 * @param passwords - Array of passwords to check
 * @param userInputs - Optional array of user-specific words
 * @returns Map of password to breach result
 */
export function batchCheckBreaches(
  passwords: { password: string; userInputs?: string[] }[]
): Map<string, BreachCheckResult> {
  const results = new Map<string, BreachCheckResult>();

  passwords.forEach(({ password, userInputs }) => {
    const result = checkPasswordBreach(password, userInputs);
    results.set(password, result);
  });

  return results;
}

/**
 * Get breach statistics for a set of passwords
 *
 * @param passwords - Array of passwords to analyze
 * @returns Statistics object
 */
export function getBreachStatistics(passwords: string[]): {
  total: number;
  breached: number;
  percentageBreached: number;
  averageScore: number;
  weakPasswords: number; // score 0-1
  fairPasswords: number; // score 2
  goodPasswords: number; // score 3
  strongPasswords: number; // score 4
} {
  if (passwords.length === 0) {
    return {
      total: 0,
      breached: 0,
      percentageBreached: 0,
      averageScore: 0,
      weakPasswords: 0,
      fairPasswords: 0,
      goodPasswords: 0,
      strongPasswords: 0,
    };
  }

  let breachedCount = 0;
  let totalScore = 0;
  const scoreCounts = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };

  passwords.forEach(password => {
    const result = checkPasswordBreach(password);
    if (result.isBreached) {
      breachedCount++;
    }
    totalScore += result.score;
    scoreCounts[result.score as keyof typeof scoreCounts]++;
  });

  return {
    total: passwords.length,
    breached: breachedCount,
    percentageBreached: (breachedCount / passwords.length) * 100,
    averageScore: totalScore / passwords.length,
    weakPasswords: scoreCounts[0] + scoreCounts[1],
    fairPasswords: scoreCounts[2],
    goodPasswords: scoreCounts[3],
    strongPasswords: scoreCounts[4],
  };
}

/**
 * Get human-readable description of breach risk
 *
 * @param result - Breach check result
 * @returns Risk description
 */
export function getBreachRiskDescription(result: BreachCheckResult): {
  level: 'critical' | 'high' | 'medium' | 'low' | 'minimal';
  description: string;
  color: string;
} {
  if (result.score === 0) {
    return {
      level: 'critical',
      description: 'Extremely weak - likely in breach databases',
      color: '#c0392b',
    };
  }

  if (result.score === 1) {
    return {
      level: 'high',
      description: 'Very weak - easily crackable',
      color: '#e74c3c',
    };
  }

  if (result.score === 2) {
    return {
      level: 'medium',
      description: 'Weak - could be cracked with effort',
      color: '#f39c12',
    };
  }

  if (result.score === 3) {
    return {
      level: 'low',
      description: 'Good - reasonably secure',
      color: '#27ae60',
    };
  }

  return {
    level: 'minimal',
    description: 'Strong - very difficult to crack',
    color: '#16a085',
  };
}

/**
 * Generate improvement suggestions for a weak password
 *
 * @param result - Breach check result
 * @returns Array of actionable suggestions
 */
export function generateImprovementSuggestions(result: BreachCheckResult): string[] {
  const suggestions: string[] = [];

  // Add zxcvbn suggestions
  suggestions.push(...result.suggestions);

  // Add custom suggestions based on patterns
  const hasDatePattern = result.matchSequence.some(m => m.pattern === 'date');
  const hasSequencePattern = result.matchSequence.some(m => m.pattern === 'sequence');
  const hasRepeatPattern = result.matchSequence.some(m => m.pattern === 'repeat');
  const hasDictionaryWord = result.matchSequence.some(m => m.dictionaryName);

  if (hasDatePattern) {
    suggestions.push('Avoid using dates - they are easily guessable');
  }

  if (hasSequencePattern) {
    suggestions.push('Avoid sequences like "abc" or "123"');
  }

  if (hasRepeatPattern) {
    suggestions.push('Avoid repeating characters like "aaa" or "111"');
  }

  if (hasDictionaryWord) {
    suggestions.push('Avoid common dictionary words');
  }

  // Add minimum requirements suggestion if score is low
  if (result.score < 3) {
    suggestions.push('Use at least 12 characters with a mix of uppercase, lowercase, numbers, and symbols');
  }

  return [...new Set(suggestions)]; // Remove duplicates
}

/**
 * Check if password contains user-specific information
 *
 * @param password - Password to check
 * @param userInfo - User information (username, email, name, etc.)
 * @returns true if password contains user info
 */
export function containsUserInfo(
  password: string,
  userInfo: { username?: string; email?: string; name?: string }
): boolean {
  const lowerPassword = password.toLowerCase();

  if (userInfo.username && lowerPassword.includes(userInfo.username.toLowerCase())) {
    return true;
  }

  if (userInfo.email) {
    const emailParts = userInfo.email.toLowerCase().split('@');
    if (emailParts[0] && lowerPassword.includes(emailParts[0])) {
      return true;
    }
  }

  if (userInfo.name) {
    const nameParts = userInfo.name.toLowerCase().split(' ');
    for (const part of nameParts) {
      if (part.length > 2 && lowerPassword.includes(part)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Get most common breach patterns in a password
 *
 * @param result - Breach check result
 * @returns Array of pattern descriptions
 */
export function getCommonPatterns(result: BreachCheckResult): string[] {
  const patterns: string[] = [];

  result.matchSequence.forEach(match => {
    if (match.pattern === 'dictionary') {
      patterns.push(`Dictionary word: "${match.token}"`);
    } else if (match.pattern === 'sequence') {
      patterns.push(`Sequence: "${match.token}"`);
    } else if (match.pattern === 'repeat') {
      patterns.push(`Repeating pattern: "${match.token}"`);
    } else if (match.pattern === 'date') {
      patterns.push(`Date pattern: "${match.token}"`);
    } else if (match.pattern === 'spatial') {
      patterns.push(`Keyboard pattern: "${match.token}"`);
    }
  });

  return patterns;
}

/**
 * Estimate time to crack password using different attack methods
 *
 * @param password - Password to analyze
 * @returns Object with crack time estimates
 */
export function estimateCrackTime(password: string): {
  onlineThrottling: string;
  onlineNoThrottling: string;
  offlineSlow: string;
  offlineFast: string;
} {
  initializeZxcvbn();

  const result = zxcvbn(password);

  return {
    onlineThrottling: result.crackTimesDisplay.onlineThrottling100PerHour,
    onlineNoThrottling: result.crackTimesDisplay.onlineNoThrottling10PerSecond,
    offlineSlow: result.crackTimesDisplay.offlineSlowHashing1e4PerSecond,
    offlineFast: result.crackTimesDisplay.offlineFastHashing1e10PerSecond,
  };
}
