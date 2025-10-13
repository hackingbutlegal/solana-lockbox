/**
 * Password Health Analyzer
 *
 * Provides comprehensive security analysis of stored passwords including:
 * - Weak password detection
 * - Password reuse analysis
 * - Age tracking (outdated passwords)
 * - Breach database checking (planned)
 * - Overall security score calculation
 *
 * This module helps users maintain good password hygiene by identifying
 * security risks and providing actionable recommendations.
 */

import { PasswordGenerator } from './password-generator';

/**
 * Password entry interface for health analysis
 *
 * Minimal interface needed for security analysis. Passwords must be
 * decrypted client-side before analysis.
 */
export interface PasswordEntryForAnalysis {
  id: string | number;
  title?: string;
  username?: string;
  password: string;  // Decrypted password
  url?: string;
  lastModified: number;  // Unix timestamp
  createdAt: number;     // Unix timestamp
}

/**
 * Overall password health assessment
 */
export interface PasswordHealth {
  totalPasswords: number;
  weakPasswords: number;
  reusedPasswords: number;
  oldPasswords: number;
  exposedPasswords: number;  // Planned: breach database check
  overallScore: number;      // 0-100 scale
  recommendations: string[];
}

/**
 * Individual password security analysis
 */
export interface PasswordSecurityAnalysis {
  entryId: string | number;
  title: string;
  isWeak: boolean;
  isReused: boolean;
  isOld: boolean;
  isExposed: boolean;  // Planned
  ageInDays: number;
  strengthScore: number;
  issues: string[];
}

/**
 * Password Health Analyzer
 *
 * Analyzes password vault for security issues and provides recommendations.
 * All analysis happens client-side - passwords never leave the device.
 */
export class PasswordHealthAnalyzer {
  /**
   * Analyze all passwords for security issues
   *
   * SECURITY: This function requires decrypted passwords. Ensure all
   * decryption happens client-side and passwords are wiped from memory
   * immediately after analysis.
   *
   * @param entries - Array of password entries (must be decrypted)
   * @returns Overall health assessment
   *
   * @example
   * ```typescript
   * const entries = await decryptAllPasswords(); // Client-side decryption
   * const health = PasswordHealthAnalyzer.analyze(entries);
   * console.log(`Overall Score: ${health.overallScore}/100`);
   * console.log(`Weak Passwords: ${health.weakPasswords}`);
   * wipePasswordsFromMemory(entries); // Clean up after analysis
   * ```
   */
  static analyze(entries: PasswordEntryForAnalysis[]): PasswordHealth {
    if (entries.length === 0) {
      return {
        totalPasswords: 0,
        weakPasswords: 0,
        reusedPasswords: 0,
        oldPasswords: 0,
        exposedPasswords: 0,
        overallScore: 100,
        recommendations: ['Add your first password to get started'],
      };
    }

    // Track passwords for reuse detection
    const passwordCounts = new Map<string, number>();
    let weakCount = 0;
    let oldCount = 0;
    const now = Date.now() / 1000;  // Current time in seconds

    // Analyze each entry
    for (const entry of entries) {
      const password = entry.password;

      // Check strength
      const strength = PasswordGenerator.assessStrength(password);
      if (strength.score <= 2) {
        weakCount++;
      }

      // Check age (>90 days = old)
      const ageSeconds = now - (entry.lastModified || entry.createdAt);
      const ageDays = ageSeconds / (24 * 60 * 60);
      if (ageDays > 90) {
        oldCount++;
      }

      // Track password reuse
      const count = passwordCounts.get(password) || 0;
      passwordCounts.set(password, count + 1);
    }

    // Count reused passwords (any password used more than once)
    let reusedCount = 0;
    for (const count of passwordCounts.values()) {
      if (count > 1) {
        reusedCount++;
        break;  // Count unique reused passwords
      }
    }

    // Calculate reused password instances
    const reusedInstances = Array.from(passwordCounts.values())
      .filter(count => count > 1)
      .reduce((sum, count) => sum + count, 0);

    // Calculate overall score (0-100)
    const totalPasswords = entries.length;
    const weakPercent = (weakCount / totalPasswords) * 100;
    const reusedPercent = (reusedInstances / totalPasswords) * 100;
    const oldPercent = (oldCount / totalPasswords) * 100;

    // Score calculation:
    // - Start at 100
    // - Subtract 1 point per 1% weak passwords
    // - Subtract 1 point per 1% reused passwords
    // - Subtract 0.5 points per 1% old passwords
    const overallScore = Math.max(
      0,
      Math.round(100 - weakPercent - reusedPercent - (oldPercent / 2))
    );

    // Generate recommendations
    const recommendations = this.generateRecommendations({
      totalPasswords,
      weakPasswords: weakCount,
      reusedPasswords: reusedInstances,
      oldPasswords: oldCount,
      exposedPasswords: 0,
      overallScore,
      recommendations: [],
    });

    return {
      totalPasswords,
      weakPasswords: weakCount,
      reusedPasswords: reusedInstances,
      oldPasswords: oldCount,
      exposedPasswords: 0,  // Future: breach database check
      overallScore,
      recommendations,
    };
  }

  /**
   * Analyze individual entries for detailed security breakdown
   *
   * @param entries - Array of password entries
   * @returns Array of per-entry security analysis
   */
  static analyzeEntries(
    entries: PasswordEntryForAnalysis[]
  ): PasswordSecurityAnalysis[] {
    const now = Date.now() / 1000;
    const passwordUsage = new Map<string, number>();

    // Count password usage
    for (const entry of entries) {
      const count = passwordUsage.get(entry.password) || 0;
      passwordUsage.set(entry.password, count + 1);
    }

    // Analyze each entry
    return entries.map(entry => {
      const strength = PasswordGenerator.assessStrength(entry.password);
      const isWeak = strength.score <= 2;
      const isReused = (passwordUsage.get(entry.password) || 0) > 1;

      const ageSeconds = now - (entry.lastModified || entry.createdAt);
      const ageDays = Math.floor(ageSeconds / (24 * 60 * 60));
      const isOld = ageDays > 90;

      const issues: string[] = [];
      if (isWeak) issues.push('Weak password - consider using a stronger one');
      if (isReused) issues.push('Password reused - each account should have a unique password');
      if (isOld) issues.push(`Password is ${ageDays} days old - consider updating it`);

      return {
        entryId: entry.id,
        title: entry.title || entry.username || 'Untitled',
        isWeak,
        isReused,
        isOld,
        isExposed: false,  // Future: breach check
        ageInDays: ageDays,
        strengthScore: strength.score,
        issues,
      };
    });
  }

  /**
   * Generate prioritized recommendations based on health analysis
   *
   * @param health - Health assessment
   * @returns Array of actionable recommendations
   */
  private static generateRecommendations(health: PasswordHealth): string[] {
    const recommendations: string[] = [];

    // Critical issues (most important)
    if (health.exposedPasswords > 0) {
      recommendations.push(
        `🚨 URGENT: ${health.exposedPasswords} password(s) found in data breaches - change immediately!`
      );
    }

    if (health.reusedPasswords > 0) {
      recommendations.push(
        `⚠️  ${health.reusedPasswords} reused password(s) detected - use unique passwords for each account`
      );
    }

    if (health.weakPasswords > 0) {
      recommendations.push(
        `⚠️  ${health.weakPasswords} weak password(s) found - upgrade to stronger passwords (16+ characters)`
      );
    }

    // Moderate issues
    if (health.oldPasswords > 0) {
      recommendations.push(
        `📅 ${health.oldPasswords} password(s) haven't been changed in 90+ days - consider updating them`
      );
    }

    // Score-based feedback
    if (health.overallScore >= 90) {
      recommendations.push('✅ Excellent password security! Keep up the good work.');
    } else if (health.overallScore >= 70) {
      recommendations.push("✅ Good password security, but there's room for improvement");
    } else if (health.overallScore >= 50) {
      recommendations.push('⚠️  Fair password security - address the issues above to improve');
    } else {
      recommendations.push('🚨 Poor password security - immediate action recommended');
    }

    // General best practices
    if (health.totalPasswords > 0 && health.totalPasswords < 5) {
      recommendations.push('💡 Consider using a password manager for all your accounts');
    }

    return recommendations;
  }

  /**
   * Get entropy distribution across all passwords
   *
   * Analyzes the distribution of password strengths to identify patterns.
   *
   * @param entries - Array of password entries
   * @returns Distribution of password strengths
   */
  static getEntropyDistribution(entries: PasswordEntryForAnalysis[]): {
    veryWeak: number;  // Score 0-1
    weak: number;      // Score 2
    fair: number;      // Score 3
    strong: number;    // Score 4
    veryStrong: number; // Score 5
  } {
    const distribution = {
      veryWeak: 0,
      weak: 0,
      fair: 0,
      strong: 0,
      veryStrong: 0,
    };

    for (const entry of entries) {
      const strength = PasswordGenerator.assessStrength(entry.password);

      if (strength.score <= 1) distribution.veryWeak++;
      else if (strength.score === 2) distribution.weak++;
      else if (strength.score === 3) distribution.fair++;
      else if (strength.score === 4) distribution.strong++;
      else distribution.veryStrong++;
    }

    return distribution;
  }

  /**
   * Get password age statistics
   *
   * @param entries - Array of password entries
   * @returns Age statistics
   */
  static getAgeStatistics(entries: PasswordEntryForAnalysis[]): {
    averageAgeDays: number;
    oldestAgeDays: number;
    newestAgeDays: number;
    over90Days: number;
    over180Days: number;
    over365Days: number;
  } {
    if (entries.length === 0) {
      return {
        averageAgeDays: 0,
        oldestAgeDays: 0,
        newestAgeDays: 0,
        over90Days: 0,
        over180Days: 0,
        over365Days: 0,
      };
    }

    const now = Date.now() / 1000;
    const ages = entries.map(entry => {
      const ageSeconds = now - (entry.lastModified || entry.createdAt);
      return ageSeconds / (24 * 60 * 60);  // Convert to days
    });

    const averageAgeDays = Math.round(
      ages.reduce((sum, age) => sum + age, 0) / ages.length
    );
    const oldestAgeDays = Math.round(Math.max(...ages));
    const newestAgeDays = Math.round(Math.min(...ages));

    const over90Days = ages.filter(age => age > 90).length;
    const over180Days = ages.filter(age => age > 180).length;
    const over365Days = ages.filter(age => age > 365).length;

    return {
      averageAgeDays,
      oldestAgeDays,
      newestAgeDays,
      over90Days,
      over180Days,
      over365Days,
    };
  }

  /**
   * Identify most critical passwords to update
   *
   * Returns a prioritized list of passwords that need attention,
   * sorted by severity of issues.
   *
   * @param entries - Array of password entries
   * @param limit - Maximum number of entries to return
   * @returns Prioritized list of passwords to update
   */
  static getCriticalPasswords(
    entries: PasswordEntryForAnalysis[],
    limit: number = 10
  ): PasswordSecurityAnalysis[] {
    const analyses = this.analyzeEntries(entries);

    // Sort by severity (number of issues + strength score)
    return analyses
      .filter(analysis => analysis.issues.length > 0)
      .sort((a, b) => {
        // Primary sort: Number of issues (descending)
        if (b.issues.length !== a.issues.length) {
          return b.issues.length - a.issues.length;
        }
        // Secondary sort: Strength score (ascending - weaker first)
        return a.strengthScore - b.strengthScore;
      })
      .slice(0, limit);
  }

  /**
   * Calculate security score change over time
   *
   * Compares current health with a previous snapshot to show improvement
   * or degradation.
   *
   * @param current - Current health assessment
   * @param previous - Previous health assessment
   * @returns Score change and status
   */
  static calculateScoreChange(
    current: PasswordHealth,
    previous: PasswordHealth
  ): {
    change: number;
    percentChange: number;
    status: 'improved' | 'degraded' | 'unchanged';
  } {
    const change = current.overallScore - previous.overallScore;
    const percentChange = previous.overallScore > 0
      ? Math.round((change / previous.overallScore) * 100)
      : 0;

    let status: 'improved' | 'degraded' | 'unchanged';
    if (change > 0) status = 'improved';
    else if (change < 0) status = 'degraded';
    else status = 'unchanged';

    return {
      change,
      percentChange,
      status,
    };
  }

  /**
   * Export health report as formatted text
   *
   * Generates a human-readable report suitable for display or export.
   *
   * @param health - Health assessment
   * @returns Formatted report text
   */
  static exportReport(health: PasswordHealth): string {
    const lines: string[] = [];

    lines.push('=== PASSWORD HEALTH REPORT ===');
    lines.push('');
    lines.push(`Overall Security Score: ${health.overallScore}/100`);
    lines.push('');
    lines.push('Summary:');
    lines.push(`  Total Passwords: ${health.totalPasswords}`);
    lines.push(`  Weak Passwords: ${health.weakPasswords}`);
    lines.push(`  Reused Passwords: ${health.reusedPasswords}`);
    lines.push(`  Old Passwords (90+ days): ${health.oldPasswords}`);
    lines.push(`  Exposed in Breaches: ${health.exposedPasswords}`);
    lines.push('');
    lines.push('Recommendations:');
    health.recommendations.forEach((rec, index) => {
      lines.push(`  ${index + 1}. ${rec}`);
    });
    lines.push('');
    lines.push(`Generated: ${new Date().toLocaleString()}`);

    return lines.join('\n');
  }
}
