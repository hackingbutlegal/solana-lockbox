/**
 * Health Recommendations Engine
 *
 * Analyzes password health data and provides prioritized, actionable recommendations
 * to improve overall security posture.
 *
 * Features:
 * - Priority-based recommendations (critical, high, medium, low)
 * - Specific, actionable advice
 * - Progress tracking
 * - Impact assessment
 * - Quick wins identification
 * - Long-term security planning
 *
 * @module health-recommendations
 */

import { PasswordEntry } from '../sdk/src/types-v2';
import { analyzePasswordHealth, PasswordHealthDetails } from './password-health-analyzer';
import { getPasswordRotationStatus } from './password-rotation-manager';

/**
 * Recommendation priority
 */
export type RecommendationPriority = 'critical' | 'high' | 'medium' | 'low';

/**
 * Recommendation category
 */
export type RecommendationCategory =
  | 'weak_passwords'
  | 'reused_passwords'
  | 'old_passwords'
  | 'exposed_passwords'
  | 'missing_2fa'
  | 'policy_compliance'
  | 'rotation_overdue'
  | 'general_security';

/**
 * Single recommendation
 */
export interface SecurityRecommendation {
  id: string;
  priority: RecommendationPriority;
  category: RecommendationCategory;
  title: string;
  description: string;
  affectedEntries: number[];
  affectedCount: number;
  impact: string;
  effort: 'quick' | 'moderate' | 'significant';
  actionable: boolean;
  quickWin: boolean;
}

/**
 * Recommendations summary
 */
export interface RecommendationsSummary {
  totalRecommendations: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  quickWins: number;
  estimatedTimeMinutes: number;
  securityScore: number; // 0-100
}

/**
 * Complete recommendations result
 */
export interface HealthRecommendationsResult {
  recommendations: SecurityRecommendation[];
  summary: RecommendationsSummary;
  prioritizedActions: SecurityRecommendation[];
  quickWins: SecurityRecommendation[];
}

/**
 * Generate comprehensive health recommendations
 */
export function generateHealthRecommendations(
  entries: PasswordEntry[]
): HealthRecommendationsResult {
  const recommendations: SecurityRecommendation[] = [];

  // Build password map for reuse detection
  const passwordMap = new Map<string, string[]>();
  entries.forEach(entry => {
    const pwd = (entry as any).password;
    if (pwd && typeof pwd === 'string') {
      const titles = passwordMap.get(pwd) || [];
      titles.push(entry.title);
      passwordMap.set(pwd, titles);
    }
  });

  // Analyze each entry
  const healthData: Map<number, PasswordHealthDetails> = new Map();
  entries.forEach(entry => {
    if (entry.id && (entry as any).password) {
      try {
        const health = analyzePasswordHealth(entry, passwordMap);
        healthData.set(entry.id, health);
      } catch (error) {
        console.error(`Failed to analyze entry ${entry.id}:`, error);
      }
    }
  });

  // Generate recommendations for weak passwords
  const weakPasswords = Array.from(healthData.entries())
    .filter(([_, health]) => health.strength <= 2)
    .map(([id]) => id);

  if (weakPasswords.length > 0) {
    recommendations.push({
      id: 'weak_passwords',
      priority: weakPasswords.some(id => {
        const health = healthData.get(id);
        return health && health.strength <= 1;
      }) ? 'critical' : 'high',
      category: 'weak_passwords',
      title: `Strengthen ${weakPasswords.length} weak password${weakPasswords.length > 1 ? 's' : ''}`,
      description: `You have ${weakPasswords.length} password${weakPasswords.length > 1 ? 's' : ''} that ${weakPasswords.length > 1 ? 'are' : 'is'} weak and easily guessable. Update ${weakPasswords.length > 1 ? 'them' : 'it'} to strong, unique password${weakPasswords.length > 1 ? 's' : ''}.`,
      affectedEntries: weakPasswords,
      affectedCount: weakPasswords.length,
      impact: 'High - Weak passwords are the #1 cause of account breaches',
      effort: weakPasswords.length <= 5 ? 'quick' : 'moderate',
      actionable: true,
      quickWin: weakPasswords.length <= 3,
    });
  }

  // Generate recommendations for reused passwords
  const reusedPasswords = Array.from(healthData.entries())
    .filter(([_, health]) => health.isReused)
    .map(([id]) => id);

  if (reusedPasswords.length > 0) {
    recommendations.push({
      id: 'reused_passwords',
      priority: 'high',
      category: 'reused_passwords',
      title: `Make ${reusedPasswords.length} reused password${reusedPasswords.length > 1 ? 's' : ''} unique`,
      description: `${reusedPasswords.length} account${reusedPasswords.length > 1 ? 's' : ''} ${reusedPasswords.length > 1 ? 'are' : 'is'} using the same password. If one is compromised, all are at risk.`,
      affectedEntries: reusedPasswords,
      affectedCount: reusedPasswords.length,
      impact: 'High - Credential stuffing attacks can compromise multiple accounts',
      effort: reusedPasswords.length <= 5 ? 'quick' : 'moderate',
      actionable: true,
      quickWin: reusedPasswords.length <= 3,
    });
  }

  // Generate recommendations for old passwords
  const oldPasswords = Array.from(healthData.entries())
    .filter(([_, health]) => health.age > 90)
    .map(([id]) => id);

  if (oldPasswords.length > 0) {
    const veryOldPasswords = Array.from(healthData.entries())
      .filter(([_, health]) => health.age > 365)
      .map(([id]) => id);

    recommendations.push({
      id: 'old_passwords',
      priority: veryOldPasswords.length > 0 ? 'high' : 'medium',
      category: 'old_passwords',
      title: `Rotate ${oldPasswords.length} password${oldPasswords.length > 1 ? 's' : ''} over 90 days old`,
      description: `${oldPasswords.length} password${oldPasswords.length > 1 ? 's have' : ' has'} not been changed in over 90 days. ${veryOldPasswords.length > 0 ? `${veryOldPasswords.length} ${veryOldPasswords.length > 1 ? 'are' : 'is'} over 1 year old.` : ''}`,
      affectedEntries: oldPasswords,
      affectedCount: oldPasswords.length,
      impact: 'Medium - Old passwords have higher breach risk over time',
      effort: oldPasswords.length <= 10 ? 'moderate' : 'significant',
      actionable: true,
      quickWin: oldPasswords.length <= 5,
    });
  }

  // Generate recommendations for exposed passwords
  const exposedPasswords = Array.from(healthData.entries())
    .filter(([_, health]) => health.isExposed)
    .map(([id]) => id);

  if (exposedPasswords.length > 0) {
    recommendations.push({
      id: 'exposed_passwords',
      priority: 'critical',
      category: 'exposed_passwords',
      title: `Change ${exposedPasswords.length} exposed password${exposedPasswords.length > 1 ? 's' : ''} immediately`,
      description: `${exposedPasswords.length} password${exposedPasswords.length > 1 ? 's appear' : ' appears'} in known data breaches or ${exposedPasswords.length > 1 ? 'are' : 'is'} easily guessable. These must be changed immediately.`,
      affectedEntries: exposedPasswords,
      affectedCount: exposedPasswords.length,
      impact: 'Critical - These passwords are actively targeted by attackers',
      effort: exposedPasswords.length <= 5 ? 'quick' : 'moderate',
      actionable: true,
      quickWin: exposedPasswords.length <= 2,
    });
  }

  // Check for missing 2FA
  const loginEntries = entries.filter(e => (e as any).type === 0); // PasswordEntryType.Login
  const missing2FA = loginEntries.filter(e => !(e as any).totpSecret).map(e => e.id!).filter(Boolean);

  if (missing2FA.length > 0 && loginEntries.length > 0) {
    const criticalAccounts = loginEntries.filter(e =>
      e.title.toLowerCase().includes('bank') ||
      e.title.toLowerCase().includes('email') ||
      e.title.toLowerCase().includes('crypto') ||
      e.title.toLowerCase().includes('financial')
    );

    const criticalMissing2FA = criticalAccounts.filter(e => !(e as any).totpSecret).map(e => e.id!).filter(Boolean);

    if (criticalMissing2FA.length > 0) {
      recommendations.push({
        id: 'missing_2fa_critical',
        priority: 'high',
        category: 'missing_2fa',
        title: `Enable 2FA on ${criticalMissing2FA.length} critical account${criticalMissing2FA.length > 1 ? 's' : ''}`,
        description: `Important accounts like email, banking, or crypto ${criticalMissing2FA.length > 1 ? 'are' : 'is'} missing two-factor authentication (2FA).`,
        affectedEntries: criticalMissing2FA,
        affectedCount: criticalMissing2FA.length,
        impact: 'High - 2FA prevents 99.9% of automated attacks',
        effort: 'moderate',
        actionable: true,
        quickWin: false,
      });
    }

    if (missing2FA.length > criticalMissing2FA.length) {
      const remaining = missing2FA.length - criticalMissing2FA.length;
      recommendations.push({
        id: 'missing_2fa_general',
        priority: 'medium',
        category: 'missing_2fa',
        title: `Consider enabling 2FA on ${remaining} more account${remaining > 1 ? 's' : ''}`,
        description: `${remaining} account${remaining > 1 ? 's' : ''} could benefit from two-factor authentication for extra security.`,
        affectedEntries: missing2FA.filter(id => !criticalMissing2FA.includes(id)),
        affectedCount: remaining,
        impact: 'Medium - Additional layer of security protection',
        effort: 'moderate',
        actionable: true,
        quickWin: false,
      });
    }
  }

  // Check rotation status
  try {
    const overdueRotations: number[] = [];
    entries.forEach(entry => {
      if (entry.id) {
        const status = getPasswordRotationStatus(entry);
        if (status && status.isOverdue) {
          overdueRotations.push(entry.id);
        }
      }
    });

    if (overdueRotations.length > 0) {
      const criticalRotations = overdueRotations.filter(id => {
        const status = getPasswordRotationStatus(entries.find(e => e.id === id)!);
        return status && status.isCritical;
      });

      if (criticalRotations.length > 0) {
        recommendations.push({
          id: 'rotation_critical',
          priority: 'high',
          category: 'rotation_overdue',
          title: `${criticalRotations.length} password${criticalRotations.length > 1 ? 's' : ''} critically overdue for rotation`,
          description: `${criticalRotations.length} password${criticalRotations.length > 1 ? 's have' : ' has'} not been rotated in over 30 days past the scheduled rotation date.`,
          affectedEntries: criticalRotations,
          affectedCount: criticalRotations.length,
          impact: 'High - Stale passwords increase breach risk',
          effort: criticalRotations.length <= 5 ? 'quick' : 'moderate',
          actionable: true,
          quickWin: criticalRotations.length <= 3,
        });
      }
    }
  } catch (error) {
    // Rotation manager not available or errored
  }

  // General security recommendations
  if (entries.length > 20 && passwordMap.size / entries.length < 0.8) {
    recommendations.push({
      id: 'general_uniqueness',
      priority: 'low',
      category: 'general_security',
      title: 'Improve password uniqueness across all accounts',
      description: 'Many of your passwords share similar patterns. Each account should have a completely unique password.',
      affectedEntries: [],
      affectedCount: 0,
      impact: 'Medium - Unique passwords limit damage from breaches',
      effort: 'significant',
      actionable: false,
      quickWin: false,
    });
  }

  if (entries.length > 0) {
    const avgStrength = Array.from(healthData.values())
      .reduce((sum, h) => sum + h.strength, 0) / healthData.size;

    if (avgStrength < 2.5) {
      recommendations.push({
        id: 'general_strength',
        priority: 'low',
        category: 'general_security',
        title: 'Increase overall password strength',
        description: 'Your average password strength is below recommended levels. Consider using longer passwords with mixed characters.',
        affectedEntries: [],
        affectedCount: 0,
        impact: 'Medium - Stronger passwords resist brute force attacks',
        effort: 'significant',
        actionable: false,
        quickWin: false,
      });
    }
  }

  // Sort by priority
  const priorityOrder: Record<RecommendationPriority, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };

  recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  // Build summary
  const summary: RecommendationsSummary = {
    totalRecommendations: recommendations.length,
    criticalCount: recommendations.filter(r => r.priority === 'critical').length,
    highCount: recommendations.filter(r => r.priority === 'high').length,
    mediumCount: recommendations.filter(r => r.priority === 'medium').length,
    lowCount: recommendations.filter(r => r.priority === 'low').length,
    quickWins: recommendations.filter(r => r.quickWin).length,
    estimatedTimeMinutes: calculateEstimatedTime(recommendations),
    securityScore: calculateSecurityScore(recommendations, entries.length),
  };

  // Identify quick wins (high impact, low effort)
  const quickWins = recommendations
    .filter(r => r.quickWin && r.actionable)
    .slice(0, 5);

  // Prioritize critical and high priority actions
  const prioritizedActions = recommendations
    .filter(r => r.priority === 'critical' || r.priority === 'high')
    .slice(0, 10);

  return {
    recommendations,
    summary,
    prioritizedActions,
    quickWins,
  };
}

/**
 * Calculate estimated time to complete recommendations
 */
function calculateEstimatedTime(recommendations: SecurityRecommendation[]): number {
  return recommendations.reduce((total, rec) => {
    if (!rec.actionable) return total;

    const baseTime = rec.effort === 'quick' ? 5 : rec.effort === 'moderate' ? 15 : 30;
    return total + (baseTime * Math.min(rec.affectedCount, 10));
  }, 0);
}

/**
 * Calculate overall security score (0-100)
 */
function calculateSecurityScore(
  recommendations: SecurityRecommendation[],
  totalEntries: number
): number {
  if (totalEntries === 0) return 100;

  let score = 100;

  // Deduct points for critical issues
  const criticalCount = recommendations.filter(r => r.priority === 'critical').length;
  score -= criticalCount * 20;

  // Deduct points for high priority issues
  const highCount = recommendations.filter(r => r.priority === 'high').length;
  score -= highCount * 10;

  // Deduct points for medium priority issues
  const mediumCount = recommendations.filter(r => r.priority === 'medium').length;
  score -= mediumCount * 5;

  // Deduct points for low priority issues
  const lowCount = recommendations.filter(r => r.priority === 'low').length;
  score -= lowCount * 2;

  return Math.max(0, Math.min(100, score));
}

/**
 * Get priority color
 */
export function getPriorityColor(priority: RecommendationPriority): string {
  switch (priority) {
    case 'critical': return '#dc2626';
    case 'high': return '#f59e0b';
    case 'medium': return '#eab308';
    case 'low': return '#3b82f6';
  }
}

/**
 * Get priority icon
 */
export function getPriorityIcon(priority: RecommendationPriority): string {
  switch (priority) {
    case 'critical': return '🚨';
    case 'high': return '⚠️';
    case 'medium': return '⚡';
    case 'low': return 'ℹ️';
  }
}

/**
 * Get category icon
 */
export function getCategoryIcon(category: RecommendationCategory): string {
  switch (category) {
    case 'weak_passwords': return '🔓';
    case 'reused_passwords': return '♻️';
    case 'old_passwords': return '⏰';
    case 'exposed_passwords': return '☠️';
    case 'missing_2fa': return '🔐';
    case 'policy_compliance': return '📋';
    case 'rotation_overdue': return '🔄';
    case 'general_security': return '🛡️';
  }
}

/**
 * Get security score grade
 */
export function getSecurityGrade(score: number): {
  grade: string;
  color: string;
  description: string;
} {
  if (score >= 90) {
    return {
      grade: 'A',
      color: '#10b981',
      description: 'Excellent security posture',
    };
  } else if (score >= 80) {
    return {
      grade: 'B',
      color: '#22c55e',
      description: 'Good security with minor improvements needed',
    };
  } else if (score >= 70) {
    return {
      grade: 'C',
      color: '#eab308',
      description: 'Fair security with some concerns',
    };
  } else if (score >= 60) {
    return {
      grade: 'D',
      color: '#f59e0b',
      description: 'Poor security - immediate action needed',
    };
  } else {
    return {
      grade: 'F',
      color: '#ef4444',
      description: 'Critical security issues - urgent action required',
    };
  }
}
