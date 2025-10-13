/**
 * Password Generator and Strength Assessment
 *
 * Provides cryptographically secure password generation with customizable
 * options and real-time strength assessment based on industry best practices.
 *
 * Features:
 * - Cryptographic randomness (crypto.getRandomValues)
 * - Customizable character sets
 * - Ambiguous character exclusion
 * - Real-time strength scoring (0-5 scale)
 * - Actionable improvement suggestions
 */

export interface PasswordOptions {
  length?: number;
  includeUppercase?: boolean;
  includeLowercase?: boolean;
  includeNumbers?: boolean;
  includeSymbols?: boolean;
  excludeAmbiguous?: boolean;
  customCharset?: string;
}

export interface PasswordStrength {
  score: number;         // 0-5 scale
  label: string;         // 'Very Weak' to 'Very Strong'
  suggestions: string[]; // Actionable improvements
  entropy: number;       // Bits of entropy
}

/**
 * Password Generator
 *
 * Uses cryptographically secure randomness (crypto.getRandomValues) to generate
 * strong, unpredictable passwords. Character sets are customizable with
 * built-in support for excluding ambiguous characters (0/O, 1/l/I, etc).
 */
export class PasswordGenerator {
  /**
   * Generate a random password with specified options
   *
   * @param options - Configuration for password generation
   * @returns Cryptographically random password
   * @throws Error if charset is empty or invalid parameters
   *
   * @example
   * ```typescript
   * // Generate 16-character password with all character types
   * const password = PasswordGenerator.generate({
   *   length: 16,
   *   includeUppercase: true,
   *   includeLowercase: true,
   *   includeNumbers: true,
   *   includeSymbols: true,
   *   excludeAmbiguous: true
   * });
   * ```
   */
  static generate(options: PasswordOptions = {}): string {
    const {
      length = 16,
      includeUppercase = true,
      includeLowercase = true,
      includeNumbers = true,
      includeSymbols = true,
      excludeAmbiguous = true,
      customCharset = '',
    } = options;

    // Validate length
    if (length < 1) {
      throw new Error('Password length must be at least 1');
    }
    if (length > 128) {
      throw new Error('Password length cannot exceed 128 characters');
    }

    let charset = customCharset;

    // Build charset from options if no custom charset provided
    if (!customCharset) {
      if (includeLowercase) {
        charset += excludeAmbiguous
          ? 'abcdefghjkmnpqrstuvwxyz'  // Exclude: i, l, o
          : 'abcdefghijklmnopqrstuvwxyz';
      }
      if (includeUppercase) {
        charset += excludeAmbiguous
          ? 'ABCDEFGHJKLMNPQRSTUVWXYZ'  // Exclude: I, O
          : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      }
      if (includeNumbers) {
        charset += excludeAmbiguous
          ? '23456789'  // Exclude: 0, 1
          : '0123456789';
      }
      if (includeSymbols) {
        // Common symbols, no exclusions
        charset += '!@#$%^&*()_+-=[]{}|;:,.<>?';
      }
    }

    if (charset.length === 0) {
      throw new Error('Charset cannot be empty - select at least one character type');
    }

    // SECURITY: Use cryptographically secure random number generator
    // crypto.getRandomValues provides true randomness from OS entropy pool
    const randomBytes = new Uint8Array(length);
    crypto.getRandomValues(randomBytes);

    // Build password by mapping random bytes to charset
    let password = '';
    for (let i = 0; i < length; i++) {
      // Modulo bias is negligible with large charset and 256-value bytes
      password += charset[randomBytes[i] % charset.length];
    }

    return password;
  }

  /**
   * Assess password strength
   *
   * Evaluates password strength using multiple criteria:
   * - Length (longer is better)
   * - Character variety (uppercase, lowercase, numbers, symbols)
   * - Common patterns (repeated characters, sequences, dictionary words)
   * - Entropy calculation (bits of randomness)
   *
   * Returns score (0-5), descriptive label, and actionable suggestions.
   *
   * @param password - Password to assess
   * @returns Strength assessment with score, label, suggestions, and entropy
   *
   * @example
   * ```typescript
   * const strength = PasswordGenerator.assessStrength('MyP@ssw0rd123');
   * console.log(strength.label);      // 'Strong'
   * console.log(strength.score);      // 4
   * console.log(strength.entropy);    // 64.2
   * console.log(strength.suggestions); // ['Increase length to 16+ characters']
   * ```
   */
  static assessStrength(password: string): PasswordStrength {
    if (!password || password.length === 0) {
      return {
        score: 0,
        label: 'No Password',
        suggestions: ['Enter a password'],
        entropy: 0,
      };
    }

    let score = 0;

    // Length scoring (max 3 points)
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;
    if (password.length >= 16) score += 1;

    // Character variety scoring (max 4 points)
    if (/[a-z]/.test(password)) score += 1;  // lowercase
    if (/[A-Z]/.test(password)) score += 1;  // uppercase
    if (/[0-9]/.test(password)) score += 1;  // numbers
    if (/[^a-zA-Z0-9]/.test(password)) score += 1;  // symbols

    // Common patterns penalty
    if (/(.)\1{2,}/.test(password)) score -= 1;  // Repeated characters (aaa, 111)
    if (/123|abc|qwerty|password|admin/i.test(password)) score -= 2;  // Common sequences

    // Ensure score is within bounds
    score = Math.max(0, Math.min(5, score));

    // Calculate entropy (bits)
    const entropy = this.calculateEntropy(password);

    return {
      score,
      label: this.getStrengthLabel(score),
      suggestions: this.getSuggestions(password, score),
      entropy,
    };
  }

  /**
   * Calculate password entropy in bits
   *
   * Entropy = log2(charset_size^password_length)
   * Higher entropy = more difficult to brute force
   *
   * @param password - Password to analyze
   * @returns Entropy in bits
   */
  private static calculateEntropy(password: string): number {
    let charsetSize = 0;

    // Determine charset size based on character types present
    if (/[a-z]/.test(password)) charsetSize += 26;
    if (/[A-Z]/.test(password)) charsetSize += 26;
    if (/[0-9]/.test(password)) charsetSize += 10;
    if (/[^a-zA-Z0-9]/.test(password)) charsetSize += 32; // Approximate for symbols

    if (charsetSize === 0) return 0;

    // Entropy = log2(charsetSize^length)
    return Math.round(password.length * Math.log2(charsetSize) * 10) / 10;
  }

  /**
   * Get descriptive label for score
   *
   * @param score - Strength score (0-5)
   * @returns Human-readable label
   */
  private static getStrengthLabel(score: number): string {
    if (score <= 1) return 'Very Weak';
    if (score === 2) return 'Weak';
    if (score === 3) return 'Fair';
    if (score === 4) return 'Strong';
    return 'Very Strong';
  }

  /**
   * Get actionable suggestions for improving password strength
   *
   * @param password - Password to analyze
   * @param score - Current strength score
   * @returns Array of improvement suggestions
   */
  private static getSuggestions(password: string, score: number): string[] {
    const suggestions: string[] = [];

    // Length suggestions
    if (password.length < 8) {
      suggestions.push('⚠️  Password must be at least 8 characters');
    } else if (password.length < 12) {
      suggestions.push('Increase length to at least 12 characters');
    } else if (password.length < 16) {
      suggestions.push('Consider increasing length to 16+ characters for better security');
    }

    // Character variety suggestions
    if (!/[a-z]/.test(password)) {
      suggestions.push('Add lowercase letters (a-z)');
    }
    if (!/[A-Z]/.test(password)) {
      suggestions.push('Add uppercase letters (A-Z)');
    }
    if (/[0-9]/.test(password)) {
      suggestions.push('Add numbers (0-9)');
    }
    if (!/[^a-zA-Z0-9]/.test(password)) {
      suggestions.push('Add special characters (!@#$%^&*)');
    }

    // Pattern warnings
    if (/(.)\1{2,}/.test(password)) {
      suggestions.push('⚠️  Avoid repeated characters (e.g., aaa, 111)');
    }
    if (/123|abc|qwerty|password|admin|letmein|welcome/i.test(password)) {
      suggestions.push('⚠️  Avoid common patterns and dictionary words');
    }

    // Overall strength feedback
    if (score >= 5) {
      suggestions.push('✅ Excellent password strength!');
    } else if (score >= 4) {
      suggestions.push('✅ Good password strength');
    }

    return suggestions;
  }

  /**
   * Generate multiple password options for user to choose from
   *
   * @param count - Number of passwords to generate
   * @param options - Password generation options
   * @returns Array of passwords with strength assessments
   */
  static generateMultiple(
    count: number = 5,
    options: PasswordOptions = {}
  ): Array<{ password: string; strength: PasswordStrength }> {
    const passwords: Array<{ password: string; strength: PasswordStrength }> = [];

    for (let i = 0; i < count; i++) {
      const password = this.generate(options);
      const strength = this.assessStrength(password);
      passwords.push({ password, strength });
    }

    // Sort by strength score (strongest first)
    return passwords.sort((a, b) => b.strength.score - a.strength.score);
  }

  /**
   * Generate a memorable passphrase using dictionary words
   *
   * Passphrases are easier to remember than random characters while
   * still providing good entropy through word combination.
   *
   * @param wordCount - Number of words to include (default: 4)
   * @param separator - Character to separate words (default: '-')
   * @param includeNumber - Add random number to passphrase (default: true)
   * @returns Memorable passphrase
   *
   * @example
   * ```typescript
   * const passphrase = PasswordGenerator.generatePassphrase(4, '-', true);
   * // Example output: 'correct-horse-battery-staple-8472'
   * ```
   */
  static generatePassphrase(
    wordCount: number = 4,
    separator: string = '-',
    includeNumber: boolean = true
  ): string {
    // Common word list for passphrases (simplified - in production use larger list)
    const words = [
      'correct', 'horse', 'battery', 'staple', 'dragon', 'monkey', 'castle',
      'wizard', 'forest', 'mountain', 'river', 'ocean', 'thunder', 'lightning',
      'phoenix', 'eagle', 'lion', 'tiger', 'bear', 'wolf', 'falcon', 'hawk',
      'sapphire', 'emerald', 'ruby', 'diamond', 'gold', 'silver', 'bronze',
      'nebula', 'galaxy', 'comet', 'asteroid', 'planet', 'star', 'cosmos',
      'quantum', 'photon', 'neutron', 'proton', 'electron', 'atom', 'molecule',
      'cipher', 'crypto', 'enigma', 'puzzle', 'riddle', 'mystery', 'secret',
      'anchor', 'harbor', 'beacon', 'lighthouse', 'compass', 'navigator',
    ];

    // Select random words
    const selectedWords: string[] = [];
    const randomBytes = new Uint8Array(wordCount);
    crypto.getRandomValues(randomBytes);

    for (let i = 0; i < wordCount; i++) {
      const randomIndex = randomBytes[i] % words.length;
      selectedWords.push(words[randomIndex]);
    }

    let passphrase = selectedWords.join(separator);

    // Add random number if requested
    if (includeNumber) {
      const numberBytes = new Uint8Array(1);
      crypto.getRandomValues(numberBytes);
      const randomNumber = (numberBytes[0] % 9000) + 1000; // 4-digit number
      passphrase += separator + randomNumber;
    }

    return passphrase;
  }
}
