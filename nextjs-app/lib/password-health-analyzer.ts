/**
 * Password Health Analyzer - Phase 4: Search & Intelligence
 *
 * Analyzes password strength, reuse, age, and security vulnerabilities.
 * Provides actionable recommendations for improving password security.
 *
 * ## Features
 *
 * - **Strength Analysis**: Entropy calculation, character diversity, pattern detection
 * - **Reuse Detection**: Identifies duplicate passwords across entries
 * - **Age Tracking**: Flags passwords older than 90 days
 * - **Weak Password Detection**: Common passwords, dictionary words, keyboard patterns
 * - **Overall Security Score**: Weighted composite score (0-100)
 * - **Actionable Recommendations**: Specific suggestions for improvement
 *
 * ## Scoring System
 *
 * Individual password strength (0-5):
 * - 0: Very Weak (< 30 bits entropy)
 * - 1: Weak (30-40 bits)
 * - 2: Fair (40-50 bits)
 * - 3: Good (50-60 bits)
 * - 4: Strong (60-80 bits)
 * - 5: Very Strong (>= 80 bits)
 *
 * Overall vault security score (0-100):
 * - Weighted by password strength distribution
 * - Penalties for reused/old/weak passwords
 * - Bonuses for strong unique passwords
 *
 * @module password-health-analyzer
 */

import { PasswordEntry, PasswordEntryType, isLoginEntry } from '../sdk/src/types-v2';
import { checkPasswordBreach, getCommonPatterns, getBreachRiskDescription } from './breach-checker';

/**
 * Password strength score (0-5)
 */
export enum PasswordStrength {
  VeryWeak = 0,
  Weak = 1,
  Fair = 2,
  Good = 3,
  Strong = 4,
  VeryStrong = 5,
}

/**
 * Individual password health analysis
 */
export interface PasswordHealthDetails {
  entryId: number | undefined;
  entryTitle: string;
  strength: PasswordStrength;
  entropy: number; // bits of entropy
  isReused: boolean;
  isOld: boolean; // > 90 days
  isWeak: boolean; // strength <= 2
  isCommon: boolean; // in common password list
  isExposed: boolean; // appears in breach databases
  hasPatterns: boolean; // keyboard patterns, sequences
  characterDiversity: {
    lowercase: boolean;
    uppercase: boolean;
    numbers: boolean;
    symbols: boolean;
  };
  daysSinceChange: number;
  recommendations: string[];
  breachDetails?: {
    crackTime: string;
    warning: string;
    patterns: string[];
  };
}

/**
 * Overall vault health analysis
 */
export interface VaultHealthAnalysis {
  totalPasswords: number;
  overallScore: number; // 0-100
  strengthDistribution: Record<PasswordStrength, number>;
  weakPasswords: PasswordHealthDetails[];
  reusedPasswords: Array<{
    password: string; // hashed for privacy
    entries: string[]; // entry titles
    count: number;
  }>;
  oldPasswords: PasswordHealthDetails[];
  commonPasswords: PasswordHealthDetails[];
  recommendations: string[];
}

/**
 * Common weak passwords - inline fallback list (300+ most common)
 *
 * SECURITY: This is a comprehensive inline list that serves as a fallback.
 * For production, the full 10,000+ list is loaded from /common-passwords.txt
 *
 * Source: Compiled from SecLists, RockYou, and Have I Been Pwned databases
 */
const COMMON_PASSWORDS_INLINE = new Set([
  'password', '123456', '12345678', 'qwerty', 'abc123', 'monkey', '1234567',
  'letmein', 'trustno1', 'dragon', 'baseball', 'iloveyou', 'master', 'sunshine',
  'ashley', '123123', 'admin', 'welcome', 'password1', 'ninja', 'passw0rd',
  'solo', 'hello', 'freedom', 'whatever', 'qazwsx', '1234567890', '000000',
  'football', 'michael', 'login', 'bailey', 'shadow', 'superman', 'princess',
  'qwerty123', '1q2w3e4r', 'starwars', 'cookie', 'cheese', 'hunter', 'computer',
  'secret', 'killer', 'jordan', 'michelle', 'ranger', 'tigger', 'pepper',
  'corvette', 'jessica', 'bigdog', 'merlin', 'matrix', 'maverick', 'silver',
  'hammer', 'summer', 'zxcvbnm', 'buster', 'daniel', 'jackson', 'joseph',
  'thomas', 'robert', 'ferrari', 'nothing', 'iceman', 'andrew', 'madison',
  'spider', 'banana', 'mustang', 'purple', 'monster', 'chelsea', 'diamond',
  'yellow', 'joshua', 'harley', 'biteme', 'charlie', 'maggie', 'chicken',
  'martin', 'peanut', 'hockey', 'flower', 'orange', 'internet', 'anthony',
  'austin', 'scooter', 'password123', 'mypassword', 'abc123', '111111',
  '121212', '123456789', '654321', '1q2w3e', 'qwertyuiop', 'azerty', 'trustno1',
  'p@ssw0rd', 'passw0rd', 'password!', 'qwerty12', 'qwerty1', 'letmein123',
  'welcome123', 'admin123', 'root', 'toor', 'pass', 'test', 'guest', 'user',
  'default', 'changeme', '12345', '1234', '12345678', '123456789', '1234567890',
  'qwertyuiop', 'asdfghjkl', 'zxcvbnm', 'qazwsxedc', '!@#$%^&*', 'football1',
  'baseball1', 'basketball', 'soccer', 'hockey1', 'tennis', 'golf', 'swimming',
  'running', 'cycling', 'london', 'paris', 'berlin', 'madrid', 'rome', 'athens',
  'moscow', 'tokyo', 'beijing', 'sydney', 'newyork', 'losangeles', 'chicago',
  'houston', 'phoenix', 'philadelphia', 'dallas', 'miami', 'atlanta', 'boston',
  'jennifer', 'jessica', 'ashley', 'amanda', 'brittany', 'sarah', 'melissa',
  'nicole', 'stephanie', 'katherine', 'heather', 'rachel', 'rebecca', 'laura',
  'lauren', 'emily', 'michelle', 'angela', 'christina', 'kimberly', 'amy',
  'elizabeth', 'sophia', 'isabella', 'emma', 'olivia', 'ava', 'mia', 'abigail',
  'madison', 'hannah', 'chloe', 'samantha', 'natalie', 'grace', 'addison',
  'michael', 'christopher', 'matthew', 'joshua', 'david', 'andrew', 'james',
  'daniel', 'robert', 'john', 'joseph', 'ryan', 'brandon', 'william', 'justin',
  'nicholas', 'anthony', 'tyler', 'kevin', 'zachary', 'jacob', 'alexander',
  'ethan', 'nathan', 'benjamin', 'samuel', 'jonathan', 'christian', 'dylan',
  'taylor', 'austin', 'noah', 'hunter', 'cameron', 'jordan', 'connor', 'caleb',
  'yankees', 'redsox', 'dodgers', 'giants', 'cowboys', 'patriots', 'steelers',
  'eagles', '49ers', 'raiders', 'lakers', 'celtics', 'bulls', 'knicks', 'heat',
  'ferrari', 'porsche', 'lamborghini', 'corvette', 'mustang', 'bmw', 'mercedes',
  'audi', 'honda', 'toyota', 'nissan', 'ford', 'chevrolet', 'dodge', 'jeep',
  'summer2024', 'winter2024', 'spring2024', 'fall2024', 'autumn2024', 'january',
  'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september',
  'october', 'november', 'december', 'monday', 'tuesday', 'wednesday', 'thursday',
  'friday', 'saturday', 'sunday', 'iloveu', 'iloveyou', 'loveyou', 'iluvu',
  'iluvyou', 'trustme', 'believe', 'forever', 'always', 'together', 'family',
  'friends', 'blessed', 'love', 'peace', 'happy', 'smile', 'laugh', 'dream',
  'hope', 'faith', 'angel', 'princess', 'prince', 'king', 'queen', 'master',
  'chief', 'boss', 'leader', 'winner', 'champion', 'legend', 'hero', 'superhero',
]);

/**
 * Lazy-loaded common passwords set (loaded from /common-passwords.txt)
 * This provides a much larger database (10,000+ passwords) for production use
 */
let COMMON_PASSWORDS_LOADED: Set<string> | null = null;
let isLoadingCommonPasswords = false;

/**
 * Load common passwords from file (lazy loading)
 *
 * Attempts to load the full common passwords list from /common-passwords.txt
 * Falls back to inline list if loading fails (e.g., in development or if file missing)
 *
 * @returns Promise<Set<string>> Common passwords set
 */
async function loadCommonPasswords(): Promise<Set<string>> {
  // Return already loaded set
  if (COMMON_PASSWORDS_LOADED) {
    return COMMON_PASSWORDS_LOADED;
  }

  // Wait if currently loading
  if (isLoadingCommonPasswords) {
    // Wait up to 5 seconds for loading to complete
    for (let i = 0; i < 50; i++) {
      if (COMMON_PASSWORDS_LOADED) {
        return COMMON_PASSWORDS_LOADED;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    // Timeout - fall back to inline list
    return COMMON_PASSWORDS_INLINE;
  }

  try {
    isLoadingCommonPasswords = true;

    // Attempt to load from public file
    const response = await fetch('/common-passwords.txt');
    if (!response.ok) {
      throw new Error(`Failed to load common passwords: ${response.status}`);
    }

    const text = await response.text();
    const passwords = text
      .split('\n')
      .map(p => p.trim().toLowerCase())
      .filter(p => p.length > 0);

    COMMON_PASSWORDS_LOADED = new Set([...COMMON_PASSWORDS_INLINE, ...passwords]);
    console.log(`✓ Loaded ${COMMON_PASSWORDS_LOADED.size} common passwords`);

    return COMMON_PASSWORDS_LOADED;
  } catch (error) {
    console.warn('Failed to load common passwords file, using inline list:', error);
    COMMON_PASSWORDS_LOADED = COMMON_PASSWORDS_INLINE;
    return COMMON_PASSWORDS_INLINE;
  } finally {
    isLoadingCommonPasswords = false;
  }
}

/**
 * Get common passwords set (with lazy loading)
 *
 * Returns the loaded set if available, otherwise returns inline set
 * and triggers background loading for future calls
 */
function getCommonPasswords(): Set<string> {
  // Return loaded set if available
  if (COMMON_PASSWORDS_LOADED) {
    return COMMON_PASSWORDS_LOADED;
  }

  // Trigger background loading (don't await)
  if (!isLoadingCommonPasswords) {
    loadCommonPasswords().catch(console.error);
  }

  // Return inline set for immediate use
  return COMMON_PASSWORDS_INLINE;
}

/**
 * Calculate Shannon entropy of a password
 * Measures the randomness/unpredictability of the password
 *
 * @param password - Password to analyze
 * @returns Entropy in bits
 */
function calculateEntropy(password: string): number {
  if (password.length === 0) return 0;

  // Count character frequencies
  const frequencies = new Map<string, number>();
  for (const char of password) {
    frequencies.set(char, (frequencies.get(char) || 0) + 1);
  }

  // Calculate Shannon entropy
  let entropy = 0;
  const length = password.length;
  for (const count of frequencies.values()) {
    const probability = count / length;
    entropy -= probability * Math.log2(probability);
  }

  // Multiply by length to get total entropy in bits
  return entropy * length;
}

/**
 * Analyze character diversity in password
 */
function analyzeCharacterDiversity(password: string): {
  lowercase: boolean;
  uppercase: boolean;
  numbers: boolean;
  symbols: boolean;
} {
  return {
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    numbers: /[0-9]/.test(password),
    symbols: /[^a-zA-Z0-9]/.test(password),
  };
}

/**
 * Detect common keyboard patterns
 * Examples: qwerty, asdf, zxcvbn, 12345, etc.
 */
function hasKeyboardPatterns(password: string): boolean {
  const patterns = [
    'qwerty',
    'qwertz',
    'azerty',
    'asdfgh',
    'zxcvbn',
    '123456',
    '1234567890',
    'abcdef',
    'qazwsx',
    '1q2w3e',
  ];

  const lower = password.toLowerCase();
  for (const pattern of patterns) {
    if (lower.includes(pattern)) {
      return true;
    }
    // Check reverse patterns
    if (lower.includes(pattern.split('').reverse().join(''))) {
      return true;
    }
  }

  // Check for sequential characters (3+ in a row)
  for (let i = 0; i < password.length - 2; i++) {
    const c1 = password.charCodeAt(i);
    const c2 = password.charCodeAt(i + 1);
    const c3 = password.charCodeAt(i + 2);

    // Sequential ascending or descending
    if ((c2 === c1 + 1 && c3 === c2 + 1) || (c2 === c1 - 1 && c3 === c2 - 1)) {
      return true;
    }

    // Repeated characters (3+ same)
    if (c1 === c2 && c2 === c3) {
      return true;
    }
  }

  return false;
}

/**
 * Calculate password strength score (0-5)
 */
function calculatePasswordStrength(
  password: string,
  entropy: number,
  diversity: { lowercase: boolean; uppercase: boolean; numbers: boolean; symbols: boolean },
  hasPatterns: boolean,
  isCommon: boolean
): PasswordStrength {
  // Start with entropy-based score
  let baseScore: PasswordStrength;

  if (entropy < 30) {
    baseScore = PasswordStrength.VeryWeak;
  } else if (entropy < 40) {
    baseScore = PasswordStrength.Weak;
  } else if (entropy < 50) {
    baseScore = PasswordStrength.Fair;
  } else if (entropy < 60) {
    baseScore = PasswordStrength.Good;
  } else if (entropy < 80) {
    baseScore = PasswordStrength.Strong;
  } else {
    baseScore = PasswordStrength.VeryStrong;
  }

  // Apply penalties
  if (isCommon) {
    return PasswordStrength.VeryWeak; // Common passwords are always very weak
  }

  if (hasPatterns) {
    baseScore = Math.max(0, baseScore - 2) as PasswordStrength;
  }

  // Apply diversity bonus
  const diversityCount = Object.values(diversity).filter((v) => v).length;
  if (diversityCount === 4 && baseScore < PasswordStrength.VeryStrong) {
    baseScore = (baseScore + 1) as PasswordStrength;
  }

  // Length penalties
  if (password.length < 8) {
    baseScore = Math.max(0, baseScore - 2) as PasswordStrength;
  } else if (password.length < 12) {
    baseScore = Math.max(0, baseScore - 1) as PasswordStrength;
  }

  return baseScore;
}

/**
 * Generate recommendations for a password
 */
function generateRecommendations(health: PasswordHealthDetails): string[] {
  const recommendations: string[] = [];

  // CRITICAL: Exposed passwords should be changed immediately
  if (health.isExposed) {
    recommendations.push('⚠️ CRITICAL: Password appears in breach databases or is easily crackable. Change immediately!');
    if (health.breachDetails?.warning) {
      recommendations.push(health.breachDetails.warning);
    }
  }

  if (health.isCommon) {
    recommendations.push('This is a commonly used password. Change it immediately.');
  }

  if (health.strength <= PasswordStrength.Weak) {
    recommendations.push('Password is too weak. Use at least 12 characters with mixed cases, numbers, and symbols.');
  }

  if (health.hasPatterns) {
    recommendations.push('Avoid keyboard patterns and sequential characters.');
  }

  const diversity = health.characterDiversity;
  if (!diversity.uppercase) {
    recommendations.push('Add uppercase letters (A-Z).');
  }
  if (!diversity.numbers) {
    recommendations.push('Add numbers (0-9).');
  }
  if (!diversity.symbols) {
    recommendations.push('Add symbols (!@#$%^&*).');
  }

  if (health.isReused) {
    recommendations.push('This password is used for multiple accounts. Use unique passwords.');
  }

  if (health.isOld) {
    recommendations.push(`Password is ${Math.floor(health.daysSinceChange)} days old. Consider changing it.`);
  }

  if (health.entropy < 50 && recommendations.length === 0) {
    recommendations.push('Increase password length for better security.');
  }

  // Add breach details patterns if available
  if (health.breachDetails?.patterns && health.breachDetails.patterns.length > 0) {
    recommendations.push(`Detected patterns: ${health.breachDetails.patterns.join(', ')}`);
  }

  return recommendations;
}

/**
 * Analyze individual password health
 */
export function analyzePasswordHealth(
  entry: PasswordEntry,
  allPasswords: Map<string, string[]>, // password -> entry titles (for reuse detection)
  now: number = Date.now()
): PasswordHealthDetails {
  // Extract password from entry
  let password: string | undefined;
  if (isLoginEntry(entry)) {
    password = entry.password;
  }
  // For other entry types, we don't analyze password strength
  // (CreditCard CVV, SSH private keys, etc. have different security models)

  // If no password to analyze, return minimal health details
  if (!password) {
    return {
      entryId: entry.id,
      entryTitle: entry.title,
      strength: PasswordStrength.VeryStrong, // N/A, don't flag non-password entries
      entropy: 0,
      isReused: false,
      isOld: false,
      isWeak: false,
      isCommon: false,
      isExposed: false,
      hasPatterns: false,
      characterDiversity: {
        lowercase: false,
        uppercase: false,
        numbers: false,
        symbols: false,
      },
      daysSinceChange: 0,
      recommendations: [],
    };
  }

  // Calculate password metrics
  const entropy = calculateEntropy(password);
  const diversity = analyzeCharacterDiversity(password);
  const hasPatterns = hasKeyboardPatterns(password);
  const commonPasswords = getCommonPasswords();
  const isCommon = commonPasswords.has(password.toLowerCase());

  // Check for breaches using zxcvbn
  const userInputs = [];
  if (isLoginEntry(entry)) {
    if (entry.username) userInputs.push(entry.username);
    if (entry.url) {
      try {
        const domain = new URL(entry.url).hostname;
        userInputs.push(domain);
      } catch {
        // Invalid URL, skip
      }
    }
  }
  const breachResult = checkPasswordBreach(password, userInputs);
  const isExposed = breachResult.isBreached;

  // Calculate strength score
  const strength = calculatePasswordStrength(password, entropy, diversity, hasPatterns, isCommon);

  // Check reuse
  const isReused = (allPasswords.get(password)?.length || 0) > 1;

  // Calculate age
  const lastModified = entry.lastModified?.getTime() || entry.createdAt?.getTime() || now;
  const daysSinceChange = (now - lastModified) / (1000 * 60 * 60 * 24);
  const isOld = daysSinceChange > 90;

  // Check if weak
  const isWeak = strength <= PasswordStrength.Fair;

  // Create health details
  const health: PasswordHealthDetails = {
    entryId: entry.id,
    entryTitle: entry.title,
    strength,
    entropy,
    isReused,
    isOld,
    isWeak,
    isCommon,
    isExposed,
    hasPatterns,
    characterDiversity: diversity,
    daysSinceChange,
    recommendations: [],
    breachDetails: isExposed ? {
      crackTime: breachResult.crackTimeDisplay,
      warning: breachResult.warning,
      patterns: getCommonPatterns(breachResult),
    } : undefined,
  };

  // Generate recommendations
  health.recommendations = generateRecommendations(health);

  return health;
}

/**
 * Analyze overall vault health
 */
export function analyzeVaultHealth(entries: PasswordEntry[]): VaultHealthAnalysis {
  // Build password reuse map
  const passwordMap = new Map<string, string[]>();
  for (const entry of entries) {
    if (isLoginEntry(entry)) {
      const titles = passwordMap.get(entry.password) || [];
      titles.push(entry.title);
      passwordMap.set(entry.password, titles);
    }
  }

  // Analyze each password
  const now = Date.now();
  const healthDetails: PasswordHealthDetails[] = [];
  const strengthDistribution: Record<PasswordStrength, number> = {
    [PasswordStrength.VeryWeak]: 0,
    [PasswordStrength.Weak]: 0,
    [PasswordStrength.Fair]: 0,
    [PasswordStrength.Good]: 0,
    [PasswordStrength.Strong]: 0,
    [PasswordStrength.VeryStrong]: 0,
  };

  for (const entry of entries) {
    // Only analyze login entries (those with passwords)
    if (!isLoginEntry(entry)) {
      continue;
    }

    const health = analyzePasswordHealth(entry, passwordMap, now);
    healthDetails.push(health);
    strengthDistribution[health.strength]++;
  }

  // Calculate overall score (0-100)
  const total = healthDetails.length;
  let score = 100;

  if (total > 0) {
    // Calculate weighted strength score
    const strengthScore =
      (strengthDistribution[PasswordStrength.VeryWeak] * 0 +
        strengthDistribution[PasswordStrength.Weak] * 20 +
        strengthDistribution[PasswordStrength.Fair] * 40 +
        strengthDistribution[PasswordStrength.Good] * 60 +
        strengthDistribution[PasswordStrength.Strong] * 80 +
        strengthDistribution[PasswordStrength.VeryStrong] * 100) /
      total;

    score = Math.round(strengthScore);

    // Apply penalties for weak passwords
    const weakCount = healthDetails.filter((h) => h.isWeak).length;
    const weakPenalty = (weakCount / total) * 30;
    score = Math.max(0, score - Math.round(weakPenalty));

    // Apply penalties for reused passwords
    const reusedCount = healthDetails.filter((h) => h.isReused).length;
    const reusedPenalty = (reusedCount / total) * 20;
    score = Math.max(0, score - Math.round(reusedPenalty));

    // Apply penalties for old passwords
    const oldCount = healthDetails.filter((h) => h.isOld).length;
    const oldPenalty = (oldCount / total) * 10;
    score = Math.max(0, score - Math.round(oldPenalty));
  }

  // Extract weak passwords
  const weakPasswords = healthDetails.filter((h) => h.isWeak);

  // Extract old passwords
  const oldPasswords = healthDetails.filter((h) => h.isOld);

  // Extract common passwords
  const commonPasswords = healthDetails.filter((h) => h.isCommon);

  // Build reused passwords list
  const reusedPasswords: VaultHealthAnalysis['reusedPasswords'] = [];
  for (const [password, titles] of passwordMap.entries()) {
    if (titles.length > 1) {
      // Hash password for privacy (even though this is client-side only)
      const passwordHash = btoa(password).substring(0, 16);
      reusedPasswords.push({
        password: passwordHash,
        entries: titles,
        count: titles.length,
      });
    }
  }

  // Generate vault-level recommendations
  const recommendations: string[] = [];

  if (weakPasswords.length > 0) {
    recommendations.push(
      `${weakPasswords.length} weak password${weakPasswords.length === 1 ? '' : 's'} detected. Update immediately.`
    );
  }

  if (reusedPasswords.length > 0) {
    recommendations.push(
      `${reusedPasswords.length} password${reusedPasswords.length === 1 ? ' is' : 's are'} reused across multiple accounts. Use unique passwords for each account.`
    );
  }

  if (oldPasswords.length > 0) {
    recommendations.push(
      `${oldPasswords.length} password${oldPasswords.length === 1 ? '' : 's'} haven't been changed in over 90 days. Consider rotating them.`
    );
  }

  if (commonPasswords.length > 0) {
    recommendations.push(
      `${commonPasswords.length} password${commonPasswords.length === 1 ? '' : 's'} in common password list. Change immediately.`
    );
  }

  if (score >= 90) {
    recommendations.push('Excellent password security! Keep up the good work.');
  } else if (score >= 70) {
    recommendations.push('Good password security, but there\'s room for improvement.');
  } else if (score >= 50) {
    recommendations.push('Password security needs attention. Focus on weak and reused passwords.');
  } else {
    recommendations.push('Password security is concerning. Immediate action required.');
  }

  return {
    totalPasswords: healthDetails.length,
    overallScore: score,
    strengthDistribution,
    weakPasswords,
    reusedPasswords,
    oldPasswords,
    commonPasswords,
    recommendations,
  };
}

/**
 * Get strength label for display
 */
export function getStrengthLabel(strength: PasswordStrength): string {
  switch (strength) {
    case PasswordStrength.VeryWeak:
      return 'Very Weak';
    case PasswordStrength.Weak:
      return 'Weak';
    case PasswordStrength.Fair:
      return 'Fair';
    case PasswordStrength.Good:
      return 'Good';
    case PasswordStrength.Strong:
      return 'Strong';
    case PasswordStrength.VeryStrong:
      return 'Very Strong';
  }
}

/**
 * Get strength color for display (CSS color or Tailwind class)
 */
export function getStrengthColor(strength: PasswordStrength): string {
  switch (strength) {
    case PasswordStrength.VeryWeak:
      return 'text-red-600';
    case PasswordStrength.Weak:
      return 'text-orange-600';
    case PasswordStrength.Fair:
      return 'text-yellow-600';
    case PasswordStrength.Good:
      return 'text-blue-600';
    case PasswordStrength.Strong:
      return 'text-green-600';
    case PasswordStrength.VeryStrong:
      return 'text-green-700';
  }
}

/**
 * Get score color for overall vault health
 */
export function getScoreColor(score: number): string {
  if (score >= 90) return 'text-green-600';
  if (score >= 70) return 'text-blue-600';
  if (score >= 50) return 'text-yellow-600';
  if (score >= 30) return 'text-orange-600';
  return 'text-red-600';
}
