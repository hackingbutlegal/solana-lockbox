# Backup Code Security Implementation Plan

## Current Problem

**Critical Security Issue**: Backup codes currently provide full access to the vault, equivalent to wallet access. If backup codes are compromised, an attacker can:
- Read all passwords
- Modify passwords
- Delete passwords
- Add new passwords

This is unacceptable because:
1. Backup codes are often stored less securely than wallet seed phrases
2. Multiple backup codes exist (10x attack surface vs 1 wallet)
3. Users may share backup codes with family members for emergency access

## New Security Model

### Core Principle
**Backup codes should ONLY provide read-only access to passwords through a Recovery Console. They should NEVER provide wallet-level access.**

### Three-Layer Security

```
┌─────────────────────────────────────────────────────────┐
│  Layer 1: Wallet Access (Full Control)                 │
│  - Wallet seed phrase → Full vault access               │
│  - Can read, write, modify, delete passwords           │
│  - Can sign blockchain transactions                     │
│  - Can close account and reclaim rent                   │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│  Layer 2: Recovery Console (Read-Only)                 │
│  - Backup code + Recovery password → Recovery console   │
│  - Can ONLY read and export passwords                   │
│  - CANNOT modify or add passwords (no wallet to sign)   │
│  - CANNOT access blockchain features                    │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│  Layer 3: Lock/Unlock (Convenience)                    │
│  - Wallet fingerprint/Face ID → Temporary unlock        │
│  - Locks after inactivity                               │
│  - Does NOT require typing password each time           │
│  - Uses WebAuthn for biometric authentication           │
└─────────────────────────────────────────────────────────┘
```

## Implementation Architecture

### 1. Recovery Key System

**File**: `/nextjs-app/lib/recovery-key-manager.ts` (✅ Already Created)

**Key Components**:
- `RecoveryKeyData`: Stores encrypted recovery key
- `generateRecoveryKey()`: Creates recovery key encrypted with recovery password
- `decryptRecoveryKey()`: Decrypts recovery key using recovery password
- `validateRecoveryPassword()`: Enforces strong password requirements

**Encryption Flow**:
```
User Recovery Password
    ↓ PBKDF2 (100k iterations)
Password-Derived Key
    ↓ Encrypts
Session Key (Recovery Key)
    ↓ Stored in localStorage
Encrypted Recovery Key
```

**Security Properties**:
- Recovery password never stored (only salt + encrypted key)
- PBKDF2 with 100,000 iterations prevents brute force
- Recovery key can decrypt passwords but cannot sign transactions

### 2. Backup Codes Integration

**File**: `/nextjs-app/lib/backup-codes-manager.ts` (⚠️ Needs Update)

**Required Changes**:

```typescript
// Current
interface BackupCodesData {
  codes: BackupCode[];
  generatedAt: number;
}

// New
interface BackupCodesData {
  codes: BackupCode[];
  generatedAt: number;
  hasRecoveryPassword: boolean; // NEW: Flag indicating recovery password is set
  recoveryKeyVersion: number;   // NEW: Version for migration
}

// Current
export function generateBackupCodes(): BackupCodesData

// New
export function generateBackupCodes(recoveryPassword?: string): BackupCodesData

// BREAKING CHANGE: Old backup codes without recovery password become invalid
// Users must regenerate codes with recovery password
```

**Migration Strategy**:
1. On first use after update, check if backup codes have `hasRecoveryPassword: false`
2. Show warning: "Your backup codes are outdated and no longer secure. Please regenerate with a recovery password."
3. Force regeneration before allowing use

### 3. Backup Codes Modal Update

**File**: `/nextjs-app/components/modals/BackupCodesModal.tsx` (⚠️ Needs Update)

**New UI Flow**:

```
┌─────────────────────────────────────────────┐
│  Step 1: Recovery Password Creation         │
│                                             │
│  Create Recovery Password:                  │
│  [___________________] (password input)     │
│                                             │
│  Confirm Recovery Password:                 │
│  [___________________] (password input)     │
│                                             │
│  ✓ At least 12 characters                   │
│  ✓ Uppercase, lowercase, number, special    │
│                                             │
│  ⚠️ WARNING: This password is required to   │
│     use backup codes. Store it separately!  │
│                                             │
│  [Cancel]  [Create Codes →]                 │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│  Step 2: Backup Codes Display               │
│                                             │
│  🔐 Recovery Backup Codes                   │
│                                             │
│  01. ABCD-EFGH-IJKL-MNOP                   │
│  02. QRST-UVWX-YZAB-CDEF                   │
│  ... (8 more)                               │
│                                             │
│  📥 Download  📋 Copy  👁️ Hide Codes        │
│                                             │
│  ⚠️ CRITICAL: Save both backup codes AND    │
│     recovery password separately!           │
│                                             │
│  ☑ I have saved codes AND recovery password │
│                                             │
│  [Close]                                    │
└─────────────────────────────────────────────┘
```

**Implementation Changes**:

```typescript
// Add state for recovery password
const [recoveryPassword, setRecoveryPassword] = useState('');
const [confirmPassword, setConfirmPassword] = useState('');
const [step, setStep] = useState<'password' | 'codes'>('password');

// Validate passwords match
const passwordsMatch = recoveryPassword === confirmPassword && recoveryPassword.length > 0;
const passwordValid = validateRecoveryPassword(recoveryPassword).valid;

// Generate codes with recovery password
const handleGenerateCodes = async () => {
  if (!passwordValid || !passwordsMatch) {
    toast.showError('Please enter a valid recovery password');
    return;
  }

  // Generate recovery key
  const sessionKey = await getSessionKey(); // From AuthContext
  await generateRecoveryKey(recoveryPassword, sessionKey);

  // Generate backup codes
  const newCodes = generateBackupCodes(recoveryPassword);
  setBackupCodes(newCodes);
  setStep('codes');
  toast.showSuccess('Backup codes generated successfully');
};
```

### 4. Recovery Console

**File**: `/nextjs-app/app/recovery/page.tsx` (⚠️ Needs Creation)

**Route**: `/recovery`

**UI Design**:

```
┌─────────────────────────────────────────────────────────┐
│  🔐 Recovery Console                                    │
│                                                         │
│  Recover your passwords without wallet access           │
│                                                         │
│  Step 1: Enter Backup Code                             │
│  [____-____-____-____] (code input)                    │
│                                                         │
│  Step 2: Enter Recovery Password                       │
│  [___________________] (password input)                 │
│                                                         │
│  [Access Recovery Console]                              │
│                                                         │
│  ℹ️ Recovery console provides read-only access          │
│     You can view and export passwords, but cannot       │
│     modify them without your wallet.                    │
└─────────────────────────────────────────────────────────┘
                    ↓ (on successful authentication)
┌─────────────────────────────────────────────────────────┐
│  🔍 Recovery Console - Read-Only Mode                   │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                         │
│  ⚠️ READ-ONLY MODE: You are viewing passwords without  │
│     wallet access. You cannot modify or add passwords.  │
│                                                         │
│  📥 Export All Passwords (CSV)                          │
│  📥 Export All Passwords (JSON)                         │
│                                                         │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                         │
│  Search: [_______________] 🔍                           │
│                                                         │
│  📁 Passwords (50)                                      │
│  ┌────────────────────────────────────────┐           │
│  │ 🌐 github.com                          │           │
│  │ Username: user@example.com              │           │
│  │ Password: ●●●●●●●●●●●●  [👁️ Show]      │           │
│  │ [📋 Copy Password]                      │           │
│  └────────────────────────────────────────┘           │
│  ┌────────────────────────────────────────┐           │
│  │ 📧 gmail.com                            │           │
│  │ Username: myemail@gmail.com             │           │
│  │ Password: ●●●●●●●●●●●●  [👁️ Show]      │           │
│  │ [📋 Copy Password]                      │           │
│  └────────────────────────────────────────┘           │
│                                                         │
│  [Exit Recovery Console]                                │
└─────────────────────────────────────────────────────────┘
```

**Implementation**:

```typescript
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { decryptRecoveryKey } from '../../lib/recovery-key-manager';
import { verifyBackupCode } from '../../lib/backup-codes-manager';
import { PasswordEntry } from '../../sdk/src/types-v2';

export default function RecoveryPage() {
  const router = useRouter();
  const [step, setStep] = useState<'auth' | 'console'>('auth');
  const [backupCode, setBackupCode] = useState('');
  const [recoveryPassword, setRecoveryPassword] = useState('');
  const [recoveryKey, setRecoveryKey] = useState<Uint8Array | null>(null);
  const [passwords, setPasswords] = useState<PasswordEntry[]>([]);

  const handleAuthenticate = async () => {
    // 1. Verify backup code
    const codeValid = await verifyBackupCode(backupCode);
    if (!codeValid) {
      alert('Invalid backup code');
      return;
    }

    // 2. Decrypt recovery key with password
    const key = await decryptRecoveryKey(recoveryPassword);
    if (!key) {
      alert('Invalid recovery password');
      return;
    }

    // 3. Load encrypted passwords from blockchain
    const encryptedPasswords = await loadPasswordsFromBlockchain();

    // 4. Decrypt passwords with recovery key
    const decrypted = await decryptPasswords(encryptedPasswords, key);
    setPasswords(decrypted);

    // 5. Mark backup code as used
    await markBackupCodeAsUsed(backupCode);

    // 6. Enter recovery console
    setRecoveryKey(key);
    setStep('console');
  };

  // ... rest of implementation
}
```

### 5. Lock/Unlock Feature

**File**: `/nextjs-app/contexts/LockContext.tsx` (⚠️ Needs Creation)

**Purpose**: Allow users to lock the app and unlock with wallet signature or biometric auth (WebAuthn)

**UI Flow**:

```
┌─────────────────────────────────────────────┐
│  🔒 Locked                                  │
│                                             │
│  Your vault is locked for security          │
│                                             │
│  [🔓 Unlock with Wallet]                    │
│  [🔑 Unlock with Fingerprint/Face ID]      │
│                                             │
│  [← Use Recovery Codes Instead]             │
└─────────────────────────────────────────────┘
```

**Implementation**:

```typescript
interface LockContextType {
  isLocked: boolean;
  lockApp: () => void;
  unlockWithWallet: () => Promise<boolean>;
  unlockWithBiometric: () => Promise<boolean>;
  setupBiometric: () => Promise<boolean>;
  hasBiometricSetup: boolean;
}

// Auto-lock after inactivity
const AUTO_LOCK_TIMEOUT = 5 * 60 * 1000; // 5 minutes

// Use WebAuthn for biometric
async function setupBiometric(): Promise<boolean> {
  const credential = await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: 'Solana Lockbox' },
      user: {
        id: crypto.getRandomValues(new Uint8Array(16)),
        name: publicKey.toBase58(),
        displayName: 'Lockbox User',
      },
      pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
      },
    },
  });

  // Store credential ID
  localStorage.setItem('lockbox_biometric_credential', credentialId);
  return true;
}
```

## Migration Strategy

### Phase 1: Add Warning to Existing Backup Codes (Immediate)

```typescript
// In BackupCodesModal
useEffect(() => {
  const existingCodes = loadBackupCodes();
  if (existingCodes && !existingCodes.hasRecoveryPassword) {
    showWarning(
      'Security Update Required',
      'Your backup codes are no longer secure. Please regenerate them with a recovery password.'
    );
  }
}, []);
```

### Phase 2: Implement Recovery Password (Week 1)

1. Create recovery-key-manager.ts ✅ DONE
2. Update backup-codes-manager.ts to support recovery passwords
3. Update BackupCodesModal to require recovery password during generation
4. Add migration prompt for users with old backup codes

### Phase 3: Implement Recovery Console (Week 2)

1. Create /recovery page
2. Implement backup code + password authentication
3. Implement read-only password viewing
4. Implement password export (CSV, JSON)
5. Add prominent link to recovery console on login page

### Phase 4: Implement Lock/Unlock (Week 3)

1. Create LockContext
2. Implement auto-lock after inactivity
3. Implement wallet signature unlock
4. Implement WebAuthn biometric unlock
5. Add lock/unlock UI in header

## Security Considerations

### Threat Model

**Threat 1: Backup Codes Compromised**
- **Old System**: Full access to vault, attacker can steal/modify all passwords
- **New System**: Attacker needs recovery password too (2-factor)
- **Mitigation**: Recovery password stored separately, harder to compromise both

**Threat 2: Recovery Password Compromised**
- **Impact**: Attacker needs backup codes too (2-factor)
- **Mitigation**: Backup codes are one-time use, limited to 10 total

**Threat 3: Both Backup Code + Recovery Password Compromised**
- **Impact**: Attacker gets read-only access, can export passwords
- **Limitation**: Cannot modify/delete passwords (no wallet to sign transactions)
- **Detection**: User still has wallet, can see no new transactions = safe
- **Recovery**: User can close account with wallet, reclaim rent, start fresh

**Threat 4: Wallet Seed Phrase Compromised**
- **Impact**: Full access (same as before)
- **Mitigation**: None (this is the "root" key, ultimate trust anchor)

### Password Strength Requirements

Recovery Password MUST meet:
- Minimum 12 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 number
- At least 1 special character
- PBKDF2 with 100,000 iterations (0.5 seconds to verify, makes brute force impractical)

### Storage Security

**localStorage** (Not Encrypted):
- Encrypted recovery key
- Backup codes (encrypted)
- Preferences (non-sensitive)

**sessionStorage** (Cleared on tab close):
- Decrypted recovery key (temporary)
- Session tokens

**Memory Only** (Never Persisted):
- Recovery password (user must re-enter)
- Decrypted session key

## Testing Plan

### Unit Tests

```typescript
// recovery-key-manager.test.ts
describe('RecoveryKeyManager', () => {
  it('should generate recovery key encrypted with password', async () => {
    const password = 'SecurePassword123!';
    const sessionKey = crypto.getRandomValues(new Uint8Array(32));
    const recoveryKey = await generateRecoveryKey(password, sessionKey);

    expect(recoveryKey.encryptedRecoveryKey).toBeDefined();
    expect(recoveryKey.salt).toBeDefined();
  });

  it('should decrypt recovery key with correct password', async () => {
    const password = 'SecurePassword123!';
    const sessionKey = crypto.getRandomValues(new Uint8Array(32));
    await generateRecoveryKey(password, sessionKey);

    const decrypted = await decryptRecoveryKey(password);
    expect(decrypted).toEqual(sessionKey);
  });

  it('should fail to decrypt with incorrect password', async () => {
    const password = 'SecurePassword123!';
    const sessionKey = crypto.getRandomValues(new Uint8Array(32));
    await generateRecoveryKey(password, sessionKey);

    const decrypted = await decryptRecoveryKey('WrongPassword123!');
    expect(decrypted).toBeNull();
  });

  it('should validate password strength', () => {
    const weak = validateRecoveryPassword('weak');
    expect(weak.valid).toBe(false);
    expect(weak.errors.length).toBeGreaterThan(0);

    const strong = validateRecoveryPassword('SecurePassword123!');
    expect(strong.valid).toBe(true);
    expect(strong.errors.length).toBe(0);
  });
});
```

### Integration Tests

```typescript
// recovery-flow.test.ts
describe('Recovery Flow', () => {
  it('should complete full recovery with backup code + password', async () => {
    // 1. Generate backup codes with recovery password
    const recoveryPassword = 'SecurePassword123!';
    const codes = await generateBackupCodesWithPassword(recoveryPassword);

    // 2. Use backup code + password to access recovery console
    const backupCode = codes.codes[0].code;
    const recoveryKey = await authenticateRecoveryConsole(backupCode, recoveryPassword);

    // 3. Verify recovery key can decrypt passwords
    const encryptedPassword = encryptPassword('mypassword', sessionKey);
    const decrypted = decryptPassword(encryptedPassword, recoveryKey);

    expect(decrypted).toBe('mypassword');
  });

  it('should mark backup code as used after authentication', async () => {
    const backupCode = codes.codes[0].code;
    await authenticateRecoveryConsole(backupCode, recoveryPassword);

    const codeData = loadBackupCodes();
    expect(codeData.codes[0].used).toBe(true);
  });

  it('should reject used backup code', async () => {
    const backupCode = codes.codes[0].code;
    await authenticateRecoveryConsole(backupCode, recoveryPassword); // First use

    const result = await authenticateRecoveryConsole(backupCode, recoveryPassword); // Second use
    expect(result).toBeNull();
  });
});
```

### E2E Tests

```typescript
// backup-codes-e2e.test.ts
test('Generate backup codes with recovery password', async ({ page }) => {
  // 1. Navigate to settings
  await page.goto('/settings?tab=security');

  // 2. Click generate backup codes
  await page.click('text=Generate Codes');

  // 3. Enter recovery password
  await page.fill('input[name="recoveryPassword"]', 'SecurePassword123!');
  await page.fill('input[name="confirmPassword"]', 'SecurePassword123!');

  // 4. Generate codes
  await page.click('text=Create Codes');

  // 5. Verify codes are displayed
  await expect(page.locator('text=01.')).toBeVisible();
  await expect(page.locator('.code-value').first()).toBeVisible();

  // 6. Confirm saved
  await page.check('text=I have saved these codes');
  await page.click('text=Close');

  // 7. Verify codes are stored
  const stored = await page.evaluate(() => localStorage.getItem('lockbox_backup_codes'));
  expect(stored).toBeDefined();
});

test('Use recovery console with backup code + password', async ({ page }) => {
  // 1. Navigate to recovery page
  await page.goto('/recovery');

  // 2. Enter backup code
  await page.fill('input[name="backupCode"]', 'ABCD-EFGH-IJKL-MNOP');

  // 3. Enter recovery password
  await page.fill('input[name="recoveryPassword"]', 'SecurePassword123!');

  // 4. Click authenticate
  await page.click('text=Access Recovery Console');

  // 5. Verify in recovery console
  await expect(page.locator('text=Recovery Console')).toBeVisible();
  await expect(page.locator('text=READ-ONLY MODE')).toBeVisible();

  // 6. Verify passwords are displayed
  await expect(page.locator('.password-entry').first()).toBeVisible();

  // 7. Test export
  const downloadPromise = page.waitForEvent('download');
  await page.click('text=Export All Passwords (CSV)');
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain('.csv');
});
```

## User Experience

### Onboarding Flow

```
1. User creates vault with wallet
2. After first password added, show prompt:
   "🔐 Secure Your Vault"
   "Generate backup codes in case you lose wallet access"
   [Generate Backup Codes] [Later]

3. User clicks Generate → Recovery password flow
4. User saves codes + password → Confirmation
5. Show success: "Your vault is now fully protected!"
```

### Recovery Scenario

```
Scenario: User loses phone with wallet

1. User goes to lockbox.web3stud.io on new device
2. Sees: "No wallet connected" + "Use Recovery Codes"
3. Clicks "Use Recovery Codes" → /recovery
4. Enters backup code + recovery password
5. Access recovery console (read-only)
6. Exports passwords to CSV
7. Can use exported passwords temporarily
8. User restores wallet from seed phrase
9. User connects wallet → Full access restored
10. User regenerates backup codes (old one used)
```

## Documentation

### User-Facing

Create `/docs/RECOVERY_CODES.md`:
- What are recovery codes?
- What is the recovery password?
- How to use recovery codes
- What recovery console can and cannot do
- Best practices for storing recovery codes + password

### Developer-Facing

Create `/docs/RECOVERY_ARCHITECTURE.md`:
- Technical architecture
- Encryption scheme
- Security model
- API documentation
- Migration guide

## Success Criteria

✅ **Security**:
- [ ] Backup codes require recovery password (2-factor)
- [ ] Recovery console is read-only (cannot sign transactions)
- [ ] Recovery password meets strength requirements
- [ ] Recovery password never stored in plaintext
- [ ] PBKDF2 with 100k iterations prevents brute force

✅ **Functionality**:
- [ ] Users can generate backup codes with recovery password
- [ ] Users can access recovery console with code + password
- [ ] Users can view passwords in recovery console
- [ ] Users can export passwords from recovery console
- [ ] Backup codes are marked as used after consumption
- [ ] Lock/unlock feature works with wallet + biometric

✅ **User Experience**:
- [ ] Clear warnings about recovery password importance
- [ ] Intuitive UI for creating recovery password
- [ ] Obvious link to recovery console from login page
- [ ] Helpful error messages for invalid codes/passwords
- [ ] Smooth migration from old backup codes

✅ **Testing**:
- [ ] 100% unit test coverage for recovery-key-manager
- [ ] 100% integration test coverage for recovery flow
- [ ] E2E tests for backup code generation and usage
- [ ] Security audit passes penetration testing
- [ ] Performance: PBKDF2 completes in <1 second

## Timeline

**Week 1**: Recovery Password System
- Update BackupCodesModal
- Implement recovery password generation
- Add migration warnings
- Unit tests

**Week 2**: Recovery Console
- Create /recovery page
- Implement authentication
- Implement read-only password viewing
- Implement export functionality
- Integration tests

**Week 3**: Lock/Unlock Feature
- Create LockContext
- Implement auto-lock
- Implement wallet unlock
- Implement WebAuthn biometric unlock
- E2E tests

**Week 4**: Polish & Security Audit
- User documentation
- Developer documentation
- Security audit
- Penetration testing
- Bug fixes

## Notes

- **BREAKING CHANGE**: Existing backup codes without recovery password will be invalidated
- Users MUST regenerate backup codes after this update
- Prominent warning must be shown to all users with old backup codes
- Consider grace period (30 days) before fully deprecating old codes
