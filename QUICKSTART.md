# Lockbox v2 - Quick Start Guide

Get up and running with Lockbox v2 in 5 minutes.

## Prerequisites

- Node.js 18+ installed
- Solana wallet (Phantom, Solflare, etc.) for testing
- Basic understanding of Solana and web3

## 1. Clone and Setup

```bash
# Clone the repository
git clone https://github.com/hackingbutlegal/solana-lockbox.git
cd solana-lockbox

# Install dependencies
npm install
```

## 2. Verify Deployment

The v2 program is already deployed to devnet. Verify it:

```bash
# Make scripts executable
chmod +x verify-deployment.sh run-devnet-tests.sh

# Run verification
./verify-deployment.sh
```

You should see:
```
✓ Program ID: 7JxsHjdReydiz36jwsWuvwwR28qqK6V454VwFJnnSkoB
✓ Program Size: 355672 bytes
✓ IDL files synchronized
✓ Deployment verification complete!
```

## 3. Option A: Use the Next.js Web App

### Start the Development Server

```bash
cd nextjs-app
npm install
npm run dev
```

### Access the App

Open http://localhost:3000 in your browser.

### Connect Your Wallet

1. Click "Select Wallet" in the top-right
2. Choose your wallet (Phantom, Solflare, etc.)
3. Approve the connection

### Create Your First Password Entry

1. Click "Initialize Lockbox" if this is your first time
2. Click "Add Password"
3. Fill in the details:
   - Title: "GitHub"
   - Username: "your@email.com"
   - Password: (generate or enter)
   - URL: "https://github.com"
4. Click "Save"
5. Approve the transaction in your wallet

### View and Manage Entries

- All entries are encrypted client-side before sending to Solana
- Click any entry to view, edit, or delete
- Use the search bar to find entries
- Check your subscription tier and storage usage in the dashboard

## 4. Option B: Use the TypeScript SDK

### Install the SDK

```bash
cd sdk
npm install
npm run build
```

### Basic Usage Example

Create a file `example.ts`:

```typescript
import { Connection, Keypair } from '@solana/web3.js';
import { LockboxV2Client } from './src/client-v2';
import { PasswordEntryType } from './src/types-v2';

// Setup connection
const connection = new Connection('https://api.devnet.solana.com');
const wallet = Keypair.generate(); // In production, use real wallet

// Create client
const client = new LockboxV2Client({
  connection,
  wallet: {
    publicKey: wallet.publicKey,
    signTransaction: async (tx) => {
      tx.partialSign(wallet);
      return tx;
    },
    signAllTransactions: async (txs) => {
      return txs.map(tx => {
        tx.partialSign(wallet);
        return tx;
      });
    },
    signMessage: async (message) => {
      // Implement signature logic
      return new Uint8Array(64);
    }
  }
});

async function main() {
  // Check if lockbox exists
  const exists = await client.exists();
  console.log('Lockbox exists:', exists);

  if (!exists) {
    // Initialize
    console.log('Initializing lockbox...');
    const tx = await client.initializeMasterLockbox();
    console.log('Initialized:', tx);
  }

  // Store a password
  const { txSignature, entryId } = await client.storePassword({
    title: 'My First Password',
    username: 'user@example.com',
    password: 'super-secret-123',
    url: 'https://example.com',
    notes: 'Test entry',
    type: PasswordEntryType.Login,
    category: 0
  });

  console.log('Stored password:', entryId);
  console.log('Transaction:', txSignature);

  // Retrieve the password
  const entry = await client.retrievePassword(0, entryId);
  console.log('Retrieved:', entry);

  // List all passwords
  const allEntries = await client.listPasswords();
  console.log('Total entries:', allEntries.length);

  // Get storage stats
  const stats = await client.getStorageStats();
  console.log('Storage:', stats);
}

main().catch(console.error);
```

Run it:
```bash
npx ts-node example.ts
```

## 5. Understanding the Architecture

### Accounts

**MasterLockbox** - Your root account
- Owned by your wallet (PDA)
- Tracks total entries and storage
- Manages subscription tier
- Contains references to storage chunks

**StorageChunks** - Data containers
- Multiple chunks per user
- Configurable size (1KB - 1MB)
- Stores encrypted password data
- Entry headers for efficient lookup

### Encryption

- **Client-side only** - Your keys never leave your device
- **Zero-knowledge** - Server/program can't read your data
- **XChaCha20-Poly1305** - Industry-standard AEAD encryption
- **Wallet-derived keys** - Secure and deterministic

### Subscription Tiers

| Tier | Entries | Storage | Chunks | Price/Month |
|------|---------|---------|--------|-------------|
| Free | 100 | 100 KB | 5 | Free |
| Basic | 1,000 | 1 MB | 25 | 0.1 SOL |
| Premium | 10,000 | 10 MB | 100 | 0.5 SOL |
| Enterprise | Unlimited | 100 MB | 1,000 | 2.0 SOL |

## 6. Testing

### Run All Tests

```bash
# Verification (no SOL needed)
./verify-deployment.sh

# TypeScript tests (requires SOL)
./run-devnet-tests.sh
```

### Manual Testing Checklist

- [ ] Initialize lockbox
- [ ] Create password entry
- [ ] View entry details
- [ ] Update entry
- [ ] Delete entry
- [ ] Search entries
- [ ] Check storage stats
- [ ] View subscription info

## 7. Common Operations

### Check if Account Exists

```typescript
const exists = await client.exists();
```

### Get Master Lockbox Address

```typescript
const [address, bump] = client.getMasterLockboxAddress();
console.log('Your lockbox:', address.toBase58());
```

### Store a Password

```typescript
const { txSignature, entryId } = await client.storePassword({
  title: 'GitHub',
  username: 'myuser',
  password: 'mypass123',
  url: 'https://github.com',
  type: PasswordEntryType.Login
});
```

### Retrieve a Password

```typescript
const entry = await client.retrievePassword(chunkIndex, entryId);
console.log('Password:', entry.password);
```

### Update a Password

```typescript
await client.updatePassword(chunkIndex, entryId, {
  ...entry,
  password: 'new-password-456'
});
```

### Delete a Password

```typescript
await client.deletePassword(chunkIndex, entryId);
```

### List All Passwords

```typescript
const entries = await client.listPasswords();
entries.forEach(entry => {
  console.log(entry.title, entry.username);
});
```

### Get Storage Statistics

```typescript
const stats = await client.getStorageStats();
console.log(`Using ${stats.used} / ${stats.total} bytes`);
console.log(`${stats.percentage.toFixed(2)}% full`);
```

### Upgrade Subscription

```typescript
import { SubscriptionTier } from './src/types-v2';

await client.upgradeSubscription(SubscriptionTier.Premium);
```

## 8. Troubleshooting

### "Lockbox not initialized"

```bash
# Initialize via SDK
await client.initializeMasterLockbox();

# Or via Next.js app
# Click "Initialize Lockbox" button
```

### "Insufficient SOL balance"

```bash
# Get devnet SOL
solana config set --url devnet
solana airdrop 2
```

### "Transaction failed"

Common causes:
- Network issues (retry)
- Insufficient SOL for rent
- Account already exists
- Invalid data size

Check transaction on explorer:
```
https://explorer.solana.com/tx/[SIGNATURE]?cluster=devnet
```

### "Program not found"

Verify you're on devnet:
```bash
solana config get
# Should show: https://api.devnet.solana.com
```

### "IDL type mismatch"

Ensure both IDL files are synchronized:
```bash
diff sdk/idl/lockbox-v2.json nextjs-app/sdk/idl/lockbox-v2.json
# Should show no differences
```

## 9. Security Best Practices

### DO
✅ Use strong master passwords
✅ Backup your wallet seed phrase
✅ Test with small amounts first
✅ Review transactions before signing
✅ Keep software updated

### DON'T
❌ Share your private keys
❌ Use on untrusted devices
❌ Store real passwords in devnet
❌ Skip transaction reviews
❌ Use weak passwords

## 10. Next Steps

### For Users
1. Test with fake data on devnet
2. Explore all features
3. Report bugs on GitHub
4. Wait for mainnet launch

### For Developers
1. Read [TESTING.md](./TESTING.md) for test suite details
2. Review [STATUS.md](./STATUS.md) for architecture
3. Check [TOOLCHAIN.md](./TOOLCHAIN.md) for development setup
4. Contribute via GitHub pull requests

### For Contributors
1. Fork the repository
2. Create a feature branch
3. Add tests for new features
4. Submit pull request
5. Follow code review process

## 11. Resources

### Documentation
- [Testing Guide](./TESTING.md) - Comprehensive testing procedures
- [Project Status](./STATUS.md) - Architecture and roadmap
- [Toolchain Guide](./TOOLCHAIN.md) - Development environment

### Links
- **Program**: [7JxsHjdReydiz36jwsWuvwwR28qqK6V454VwFJnnSkoB](https://explorer.solana.com/address/7JxsHjdReydiz36jwsWuvwwR28qqK6V454VwFJnnSkoB?cluster=devnet)
- **GitHub**: [hackingbutlegal/solana-lockbox](https://github.com/hackingbutlegal/solana-lockbox)
- **Solana Docs**: [docs.solana.com](https://docs.solana.com)
- **Anchor Docs**: [anchor-lang.com](https://www.anchor-lang.com)

### Community
- Open issues for bugs
- Discussions for questions
- Pull requests for contributions

## 12. FAQ

**Q: Is this production-ready?**
A: No, currently on devnet for testing. Security audit needed before mainnet.

**Q: How much does it cost?**
A: Free tier is completely free. Paid tiers range from 0.1-2.0 SOL/month.

**Q: Is my data really encrypted?**
A: Yes, all encryption happens client-side. The program only stores ciphertext.

**Q: Can I recover my passwords if I lose my wallet?**
A: No, passwords are encrypted with wallet-derived keys. Backup your seed phrase!

**Q: What happens if Solana is down?**
A: You can't access your passwords until the network recovers. Consider local backups.

**Q: Can I export my passwords?**
A: Yes, use `client.listPasswords()` to export all entries as JSON.

**Q: How do I delete my account?**
A: You can close your accounts and reclaim rent, but data is permanent on-chain.

**Q: Is there a mobile app?**
A: Not yet. React Native app is planned for Q2 2026.

---

**Ready to start? Run:**
```bash
./verify-deployment.sh && cd nextjs-app && npm run dev
```

**Need help?** Open an issue on GitHub!
