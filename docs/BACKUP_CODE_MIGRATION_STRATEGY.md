# Backup Code Migration Strategy

## User Requirement

**"Don't force users to update their recovery keys unless you think it's necessary per the security model. We want to minimize inconvenience to the user and risk of loss of backup codes."**

## Current Situation

### Old System (Currently Deployed)
- Backup codes provide **full vault access**
- No additional password required
- Single-factor authentication (just the code)
- Security Risk: If backup codes are compromised, attacker has full access

### New System (Being Implemented)
- Backup codes require **recovery password**
- Two-factor authentication (code + password)
- Read-only access via Recovery Console
- Security Improvement: Compromised backup codes alone don't grant access

## Migration Analysis

### Question: Should We Force Migration?

**Arguments FOR Forcing Migration:**
1. **Security Improvement** - Two-factor is objectively better
2. **Consistency** - All users on same system
3. **Simpler Codebase** - Don't maintain two code paths

**Arguments AGAINST Forcing Migration:**
1. **User Convenience** - Existing codes still work
2. **Risk of Loss** - Users might lose codes during regeneration
3. **No Immediate Threat** - Old codes aren't compromised just because they're old
4. **User Choice** - Let users decide their security level

### Recommendation: **GRADUAL MIGRATION (Don't Force)**

## Proposed Migration Strategy

### Phase 1: Coexistence (Recommended)

**Support BOTH old and new backup codes simultaneously.**

```typescript
interface BackupCodesData {
  codes: BackupCode[];
  generatedAt: string;
  version: number;
  hasRecoveryPassword: boolean; // false for old codes
  recoveryKeyVersion?: number;   // undefined for old codes
}

// Old codes: hasRecoveryPassword = false
// New codes: hasRecoveryPassword = true
```

**Benefits:**
- ✅ Existing users keep working codes
- ✅ No forced inconvenience
- ✅ No risk of lost codes during migration
- ✅ New users get better security
- ✅ Existing users can upgrade when ready

**Implementation:**
```typescript
// In BackupCodesModal
useEffect(() => {
  const existing = loadBackupCodes();

  if (existing && !existing.hasRecoveryPassword) {
    // Show OPTIONAL upgrade prompt, not forced
    setShowUpgradeRecommendation(true);
  }
}, []);
```

### Phase 2: UI Treatment

#### For Users with Old Codes (hasRecoveryPassword = false)

**In Settings → Security:**

```
┌─────────────────────────────────────────────────────────┐
│ 🔐 Recovery Backup Codes                                │
│                                                         │
│ Status: ⚠️ Basic Protection                             │
│                                                         │
│ Your backup codes use single-factor authentication.     │
│ Consider upgrading to two-factor for better security.   │
│                                                         │
│ ℹ️ Your current codes will continue to work.            │
│                                                         │
│ [View Codes]  [↑ Upgrade to Two-Factor (Recommended)]  │
└─────────────────────────────────────────────────────────┘
```

**NOT:**
```
❌ Your codes are INSECURE! Upgrade NOW!
❌ Old codes will be disabled in 30 days
❌ You MUST regenerate your codes
```

#### For Users with New Codes (hasRecoveryPassword = true)

```
┌─────────────────────────────────────────────────────────┐
│ 🔐 Recovery Backup Codes                                │
│                                                         │
│ Status: ✅ Two-Factor Protection                        │
│                                                         │
│ Your backup codes are protected with a recovery         │
│ password for enhanced security.                         │
│                                                         │
│ 8 of 10 codes remaining                                 │
│                                                         │
│ [View Codes]  [Regenerate Codes]                       │
└─────────────────────────────────────────────────────────┘
```

### Phase 3: Recovery Flow

#### Old Backup Code Recovery (No Password Required)

**On Recovery Page:**
```
1. User enters backup code
2. Code validated against stored codes
3. If valid → FULL ACCESS granted (old behavior)
4. Prompt: "Upgrade to two-factor protection?"
```

#### New Backup Code Recovery (Password Required)

**On Recovery Page:**
```
1. User enters backup code
2. Code validated against stored codes
3. User enters recovery password
4. If valid → READ-ONLY Recovery Console
5. User can export passwords, then restore wallet for full access
```

### Phase 4: Upgrade Flow

**When User Clicks "Upgrade to Two-Factor":**

```
┌─────────────────────────────────────────────────────────┐
│ 🔒 Upgrade to Two-Factor Protection                     │
│                                                         │
│ Current: Backup codes only (single-factor)              │
│ After:   Backup codes + Recovery password (two-factor)  │
│                                                         │
│ ⚠️ Important:                                            │
│ • Your old backup codes will be replaced                │
│ • You'll need to save new codes AND recovery password   │
│ • Store them in separate locations                      │
│                                                         │
│ Benefits:                                               │
│ • Better security (two-factor)                          │
│ • Read-only recovery (can't modify without wallet)      │
│ • Protection even if codes are compromised              │
│                                                         │
│ [Cancel]  [Continue to Create Recovery Password]       │
└─────────────────────────────────────────────────────────┘
```

**After User Confirms:**
→ Go to recovery password creation flow (already implemented)

## Security Model Decision Matrix

### Scenario 1: User Has Old Codes, Never Upgrades

**Security Level:** Single-factor (backup code only)

**Risk:**
- If backup codes compromised → Full access

**Mitigation:**
- User accepted this risk by not upgrading
- Same risk they've always had
- Not worse than before

**Action:** ✅ Allow this (user choice)

### Scenario 2: User Has Old Codes, Upgrades Voluntarily

**Security Level:** Two-factor (backup code + password)

**Risk:**
- If backup codes compromised → Still need recovery password
- Better security than before

**Action:** ✅ Encourage this (but don't force)

### Scenario 3: New User Generates Codes

**Security Level:** Two-factor (backup code + password)

**Risk:**
- Best security from the start
- No migration needed

**Action:** ✅ Require this for new codes

## Implementation Checklist

### ✅ Already Implemented

- [x] BackupCodesData interface supports hasRecoveryPassword flag
- [x] generateBackupCodes() accepts hasRecoveryPassword parameter
- [x] needsSecurityMigration() detects old codes
- [x] getMigrationMessage() provides user-friendly message

### 🎯 Required Changes (Non-Breaking)

#### Change 1: Make Migration OPTIONAL

**File:** `SecuritySettingsPanel.tsx`

```typescript
// BEFORE (if we were forcing)
if (needsSecurityMigration()) {
  return <ForcedMigrationScreen />;
}

// AFTER (recommended)
if (needsSecurityMigration()) {
  showUpgradeRecommendation = true; // Just show a banner
}
```

#### Change 2: Update UI Messages

**File:** `backup-codes-manager.ts`

```typescript
// BEFORE
export function getMigrationMessage(): string | null {
  if (!needsSecurityMigration()) return null;

  return 'Security Update Required: Your backup codes were generated with an older, less secure system. Please regenerate them with a recovery password to improve security.';
}

// AFTER
export function getMigrationMessage(): string | null {
  if (!needsSecurityMigration()) return null;

  return 'Optional Security Upgrade: Your backup codes use single-factor authentication. Consider upgrading to two-factor (backup code + recovery password) for enhanced security. Your current codes will continue to work.';
}
```

#### Change 3: Recovery Console Handles Both

**File:** `/app/recovery/page.tsx` (to be created)

```typescript
async function handleRecovery(backupCode: string, recoveryPassword?: string) {
  // 1. Validate backup code
  const codeData = loadBackupCodes();
  const isValid = validateBackupCode(backupCode);

  if (!isValid) {
    toast.showError('Invalid backup code');
    return;
  }

  // 2. Check if code requires password
  if (codeData.hasRecoveryPassword) {
    // NEW SYSTEM: Requires password
    if (!recoveryPassword) {
      toast.showError('Recovery password required');
      return;
    }

    // Verify password and grant read-only access
    const key = await decryptRecoveryKey(recoveryPassword);
    if (!key) {
      toast.showError('Invalid recovery password');
      return;
    }

    // Show Recovery Console (read-only)
    setMode('recovery-console');
  } else {
    // OLD SYSTEM: No password required
    // Grant full access (legacy behavior)
    markBackupCodeUsed(backupCode);

    // Show upgrade prompt
    toast.showInfo('Consider upgrading to two-factor protection');

    // Redirect to main app with full access
    router.push('/');
  }
}
```

#### Change 4: Upgrade Banner in Settings

**File:** `SecuritySettingsPanel.tsx`

```typescript
export function SecuritySettingsPanel() {
  const needsUpgrade = needsSecurityMigration();

  return (
    <div>
      {needsUpgrade && (
        <div className="upgrade-banner">
          <div className="banner-icon">🔒</div>
          <div className="banner-content">
            <h4>Optional Security Upgrade Available</h4>
            <p>
              Your backup codes use single-factor authentication. Upgrade to two-factor
              (backup code + recovery password) for enhanced security.
            </p>
            <p className="banner-note">
              ℹ️ Your current codes will continue to work. This upgrade is recommended
              but optional.
            </p>
          </div>
          <button
            className="btn-upgrade"
            onClick={() => setShowUpgradeModal(true)}
          >
            Upgrade to Two-Factor
          </button>
        </div>
      )}

      {/* Rest of panel ... */}
    </div>
  );
}
```

## User Communication

### In-App Messages

**When User Logs In with Old Codes:**
```
✅ Welcome back!

💡 Tip: Consider upgrading your backup codes to two-factor protection
   for better security. Your current codes will continue to work.

   [Learn More]  [Upgrade Now]  [Dismiss]
```

**When User Views Old Codes in Settings:**
```
📋 Your Backup Codes (Basic Protection)

Status: Single-factor authentication
Upgrade: Two-factor protection available

Your codes:
01. ABCD-EFGH-IJKL-MNOP
02. QRST-UVWX-YZAB-CDEF
...

[Download]  [↑ Upgrade to Two-Factor]  [Close]
```

### Documentation

**In README.md:**
```markdown
## Backup Codes

Solana Lockbox offers two backup code systems:

### Single-Factor (Legacy)
- Just backup codes
- Full vault access
- Simpler but less secure

### Two-Factor (Recommended)
- Backup codes + Recovery password
- Read-only recovery console
- Enhanced security

**Existing users:** Your current backup codes will continue to work.
We recommend upgrading to two-factor when convenient.

**New users:** New backup codes automatically use two-factor protection.
```

## Testing Migration

### Test 1: Old Code Still Works

```typescript
test('Old backup codes without password still work', async () => {
  // Create old-style backup codes
  const oldCodes = generateBackupCodes({ hasRecoveryPassword: false });
  saveBackupCodes(oldCodes);

  // Verify they work
  const valid = validateBackupCode(oldCodes.codes[0].code);
  expect(valid).toBe(true);

  // Should show upgrade recommendation
  const needsUpgrade = needsSecurityMigration();
  expect(needsUpgrade).toBe(true);
});
```

### Test 2: New Codes Require Password

```typescript
test('New backup codes require recovery password', async () => {
  // Create new-style backup codes
  const recoveryPassword = 'SecurePassword123!';
  await generateRecoveryKey(recoveryPassword, sessionKey);
  const newCodes = generateBackupCodes({ hasRecoveryPassword: true });

  // Code alone should not be enough
  // Need both code AND password for recovery
});
```

### Test 3: Upgrade Flow

```typescript
test('User can upgrade from old to new codes', async () => {
  // Start with old codes
  const oldCodes = generateBackupCodes({ hasRecoveryPassword: false });
  saveBackupCodes(oldCodes);

  // User decides to upgrade
  const recoveryPassword = 'SecurePassword123!';
  await generateRecoveryKey(recoveryPassword, sessionKey);
  const newCodes = regenerateBackupCodes({ hasRecoveryPassword: true });

  // Old codes are now invalid
  const oldValid = validateBackupCode(oldCodes.codes[0].code);
  expect(oldValid).toBe(false);

  // New codes require password
  expect(newCodes.hasRecoveryPassword).toBe(true);
});
```

## Summary

### Migration Policy: **GRADUAL, NOT FORCED**

✅ **What We Do:**
- Support both old and new backup codes
- Show optional upgrade recommendation
- Explain benefits clearly
- Make upgrade easy and safe
- Preserve existing codes that work

❌ **What We Don't Do:**
- Force immediate migration
- Disable old codes after deadline
- Block features for non-upgraded users
- Use scary/alarmist language
- Create time pressure

### User Impact: **MINIMAL**

- Existing codes keep working indefinitely
- No data loss risk
- No service disruption
- Upgrade is user's choice and timing
- Clear communication without pressure

### Security Impact: **POSITIVE (When Users Upgrade)**

- Users who upgrade get better security
- Users who don't upgrade maintain current security level
- No decrease in security for anyone
- Net positive (some users upgrade = overall improvement)

### Code Impact: **MINIMAL**

- Add hasRecoveryPassword boolean flag
- Support both code paths in recovery
- Show optional upgrade UI
- ~200 lines of additional code
- No breaking changes

## Conclusion

**Don't force migration.** Support both systems, recommend the better one, let users choose. This respects user autonomy, minimizes inconvenience, and avoids the risk of users losing backup codes during a forced migration.

The security improvement (two-factor vs single-factor) is meaningful but not so critical that it justifies forcing all users to migrate immediately. Users who care about security will upgrade voluntarily. Users who prioritize convenience can stick with what works.

This approach aligns with the principle of **progressive enhancement**: new users get the best security by default, existing users get the option to upgrade when ready, and nobody is forced into a potentially disruptive change.
