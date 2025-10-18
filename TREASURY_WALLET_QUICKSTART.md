# Treasury Wallet Configuration - Quick Start Guide

## Overview

Subscription fees can now be sent to any wallet address you specify (instead of the program ID). This enables you to collect subscription revenue in a wallet you control.

---

## 🚀 Quick Setup (3 Steps)

### Step 1: Choose Your Treasury Wallet

Pick a wallet address to receive subscription fees:
```
Example: GraffYourTreasuryWalletAddressHere123456789
```

**Recommendations**:
- Use a **hardware wallet** (Ledger, Trezor) for security
- Consider a **multisig wallet** for team control
- Keep separate from your development wallet

### Step 2: Configure in Your App

**Option A: Direct Configuration** (Recommended)
```typescript
// nextjs-app/app/page.tsx
import { PublicKey } from '@solana/web3.js';

const PROGRAM_ID = '7JxsHjdReydiz36jwsWuvwwR28qqK6V454VwFJnnSkoB';
const TREASURY_WALLET = new PublicKey('YOUR_TREASURY_WALLET_ADDRESS');

export default function Home() {
  // ... existing code ...

  return (
    <AuthProvider
      programId={PROGRAM_ID}
      treasuryWallet={TREASURY_WALLET}  // Add this line
    >
      {/* rest of app */}
    </AuthProvider>
  );
}
```

**Option B: Environment Variable** (Production)
```bash
# .env.local
NEXT_PUBLIC_TREASURY_WALLET=YOUR_TREASURY_WALLET_ADDRESS
```

```typescript
// nextjs-app/app/page.tsx
const TREASURY_WALLET = process.env.NEXT_PUBLIC_TREASURY_WALLET
  ? new PublicKey(process.env.NEXT_PUBLIC_TREASURY_WALLET)
  : undefined; // Falls back to program ID

<AuthProvider
  programId={PROGRAM_ID}
  treasuryWallet={TREASURY_WALLET}
>
```

### Step 3: Test It

1. **Start your app**: `npm run dev`
2. **Upgrade a subscription**: Go to `/settings?tab=subscription`
3. **Check your treasury wallet**: Verify fees were received

```bash
# Check treasury wallet balance
solana balance YOUR_TREASURY_WALLET_ADDRESS --url devnet
```

---

## 💰 Fee Schedule

When users upgrade, fees are sent to your treasury wallet:

| Tier | Monthly Cost | Fee to Treasury |
|------|-------------|-----------------|
| Free → Basic | 0.001 SOL | 0.001 SOL (~$0.14) |
| Free → Premium | 0.01 SOL | 0.01 SOL (~$1.40) |
| Free → Enterprise | 0.1 SOL | 0.1 SOL (~$14.00) |
| Basic → Premium | 0.01 SOL | 0.01 SOL (~$1.40) |
| Basic → Enterprise | 0.1 SOL | 0.1 SOL (~$14.00) |
| Premium → Enterprise | 0.1 SOL | 0.1 SOL (~$14.00) |

**Note**: Renewals also send fees to your treasury wallet.

---

## 🔍 Verification

### Check Fee Receiver in Client
```typescript
// In browser console
const client = /* your LockboxV2Client instance */;
console.log('Treasury wallet:', client.treasuryWallet.toBase58());
```

### Monitor Incoming Transactions
```bash
# Watch for incoming SOL
solana logs YOUR_TREASURY_WALLET_ADDRESS --url devnet
```

### Verify Transaction on Explorer
After a subscription upgrade, check the transaction:
```
https://explorer.solana.com/tx/YOUR_TRANSACTION_SIGNATURE?cluster=devnet
```

Look for:
- Transfer from user wallet → your treasury wallet
- Amount matches subscription tier cost

---

## 🔧 Advanced Configuration

### Multiple Treasury Wallets (Multi-tenant)

If you're running multiple instances (e.g., white-label):

```typescript
const getTreasuryWallet = (tenantId: string): PublicKey => {
  const treasuryMap = {
    'tenant-a': new PublicKey('TENANT_A_TREASURY'),
    'tenant-b': new PublicKey('TENANT_B_TREASURY'),
    'default': new PublicKey('DEFAULT_TREASURY'),
  };
  return treasuryMap[tenantId] || treasuryMap['default'];
};

<AuthProvider
  programId={PROGRAM_ID}
  treasuryWallet={getTreasuryWallet(currentTenant)}
>
```

### Dynamic Treasury Switching

```typescript
const [treasuryWallet, setTreasuryWallet] = useState<PublicKey | undefined>();

// Update treasury wallet dynamically
useEffect(() => {
  // Fetch from config, database, or admin panel
  const wallet = await fetchTreasuryConfig();
  setTreasuryWallet(new PublicKey(wallet));
}, []);

<AuthProvider
  programId={PROGRAM_ID}
  treasuryWallet={treasuryWallet}
>
```

---

## 🛡️ Security Best Practices

### 1. Use Multisig for Large Revenue
```typescript
// Example: 2-of-3 multisig with Squads Protocol
const TREASURY_WALLET = new PublicKey('YOUR_SQUADS_MULTISIG_ADDRESS');
```

### 2. Separate Development & Production
```typescript
const TREASURY_WALLET = process.env.NODE_ENV === 'production'
  ? new PublicKey(process.env.NEXT_PUBLIC_PROD_TREASURY)
  : new PublicKey(process.env.NEXT_PUBLIC_DEV_TREASURY);
```

### 3. Monitor Treasury Balance
Set up alerts for:
- Large incoming transfers (> 1 SOL)
- Unexpected withdrawals
- Balance drops below threshold

### 4. Regular Audits
- Weekly: Check transaction log
- Monthly: Reconcile revenue vs. subscriptions
- Quarterly: Security audit of treasury wallet access

---

## 🐛 Troubleshooting

### Fees Not Arriving

**Check 1**: Verify treasury wallet is set correctly
```typescript
console.log('Treasury:', client.treasuryWallet.toBase58());
```

**Check 2**: Confirm transaction succeeded
```bash
solana confirm YOUR_TX_SIGNATURE --url devnet
```

**Check 3**: Check for transaction errors
```typescript
// Look for 'Subscription payment: X lamports' in logs
console.log('Recent transactions:', await connection.getSignaturesForAddress(userWallet));
```

### Wrong Treasury Receiving Fees

**Cause**: Old client instance still using previous treasury wallet

**Fix**: Hard refresh browser (`Ctrl+Shift+R`) or clear cache

### Treasury Wallet Validation Errors

**Cause**: Invalid wallet address format

**Fix**:
```typescript
try {
  const wallet = new PublicKey('YOUR_ADDRESS');
  console.log('Valid:', wallet.toBase58());
} catch (e) {
  console.error('Invalid treasury wallet address');
}
```

---

## 📊 Revenue Tracking

### Simple Tracking Script
```typescript
// scripts/track-revenue.ts
import { Connection, PublicKey } from '@solana/web3.js';

const connection = new Connection('https://api.devnet.solana.com');
const TREASURY_WALLET = new PublicKey('YOUR_TREASURY_WALLET');

async function trackRevenue() {
  const signatures = await connection.getSignaturesForAddress(
    TREASURY_WALLET,
    { limit: 100 }
  );

  let totalRevenue = 0;

  for (const sig of signatures) {
    const tx = await connection.getTransaction(sig.signature);
    // Parse and sum incoming transfers
    // ... (implementation details)
  }

  console.log('Total Revenue:', totalRevenue / 1e9, 'SOL');
}

trackRevenue();
```

### Integration with Analytics

```typescript
// Track subscription upgrades
analytics.track('Subscription Upgraded', {
  tier: newTier,
  amount: tierCost,
  treasury: treasuryWallet.toBase58(),
  timestamp: Date.now()
});
```

---

## 🔄 Migration Guide

### From Program ID to Treasury Wallet

**Before**:
```typescript
<AuthProvider programId={PROGRAM_ID}>
  {/* Fees go to program ID */}
</AuthProvider>
```

**After**:
```typescript
<AuthProvider
  programId={PROGRAM_ID}
  treasuryWallet={YOUR_TREASURY_WALLET}
>
  {/* Fees go to your wallet */}
</AuthProvider>
```

**Impact**: No breaking changes, fully backward compatible

---

## ✅ Checklist

- [ ] Choose treasury wallet address
- [ ] Test wallet address is valid (can send/receive SOL)
- [ ] Configure `treasuryWallet` in AuthProvider
- [ ] Test subscription upgrade on devnet
- [ ] Verify fees arrive in treasury wallet
- [ ] Set up monitoring/alerts
- [ ] Document treasury wallet in your runbook
- [ ] Plan for treasury wallet backup/recovery
- [ ] Configure production treasury wallet (separate from dev)
- [ ] Test revenue tracking script

---

## 📞 Support

If you encounter issues:
1. Check the comprehensive summary: [`FEE_STRUCTURE_AND_ACCOUNT_MANAGEMENT_SUMMARY.md`](./FEE_STRUCTURE_AND_ACCOUNT_MANAGEMENT_SUMMARY.md)
2. Review Solana transaction on Explorer
3. Check browser console for errors
4. Verify wallet permissions

---

**Last Updated**: October 17, 2025
**Version**: v2.2.5+

Built with ❤️ for Solana Lockbox
