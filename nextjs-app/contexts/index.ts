/**
 * Contexts Barrel Export
 *
 * Centralized export for all context providers and hooks.
 * Use this for clean imports in components:
 *
 * import { useAuth, usePassword, useLockbox, useSubscription } from '@/contexts';
 */

// Auth Context
export { AuthProvider, useAuth } from './AuthContext';
export type { AuthContextType } from './AuthContext';

// Lockbox Context
export { LockboxProvider, useLockbox } from './LockboxContext';
export type { LockboxContextType } from './LockboxContext';

// Password Context
export { PasswordProvider, usePassword } from './PasswordContext';
export type { PasswordContextType } from './PasswordContext';

// Subscription Context
export { SubscriptionProvider, useSubscription } from './SubscriptionContext';
export type { SubscriptionContextType } from './SubscriptionContext';

// Legacy context (kept for backward compatibility during migration)
export { LockboxV2Provider, useLockboxV2 } from './LockboxV2Context';
