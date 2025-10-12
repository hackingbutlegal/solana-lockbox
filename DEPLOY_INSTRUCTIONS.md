# Deployment Instructions for Lockbox

## ✅ Current Status

- **Program**: Successfully deployed to Solana Devnet
- **Program ID**: `5nr7xe1U3k6U6zPEmW3FCbPyXCa7jr7JpudaLKuVNyvZ`
- **Network**: Solana Devnet
- **Frontend**: Fully functional at http://localhost:5173

[View on Solana Explorer](https://explorer.solana.com/address/5nr7xe1U3k6U6zPEmW3FCbPyXCa7jr7JpudaLKuVNyvZ?cluster=devnet)

---

## Deployment History

### Latest Deployment
- **Date**: October 11, 2025
- **Slot**: 413989896
- **Transaction**: [39qMBweD...](https://explorer.solana.com/tx/39qMBweD9RuHrRjyosyFQRnYesEj95WU8G8yzJ21mmx663cyQM46Sdn83j4wQfRxj19rAZUkzk3BVLDNAEbvPEir?cluster=devnet)
- **Program Size**: 218,320 bytes (213 KB)
- **Upgrade Authority**: 3H8e4VnGjxKGFKxk2QMmjuu1B7dnDLysGN8hvcDCKxZh
- **Features**: `init_if_needed` support, XChaCha20-Poly1305 encryption

---

## Prerequisites

### System Requirements
- **Solana CLI**: 2.3.13+ (Agave client)
- **Rust**: 1.76+ (via Agave platform-tools)
- **Node.js**: 18+
- **Wallet**: Funded with at least 3 SOL for deployment

### Install Agave (Solana Client)

```bash
# Install Agave (includes updated platform-tools with rustc 1.76+)
sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"

# Update PATH
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"

# Verify installation
solana --version
# Expected: solana-cli 2.3.13 (src:...; feat:..., agave:...)

cargo-build-sbf --version
# Expected: rustc 1.76+ or higher
```

---

## Building the Program

### Method 1: cargo-build-sbf (Recommended)

```bash
cd /Users/graffito/lockbox

# Build the program
cargo-build-sbf \
  --manifest-path=programs/lockbox/Cargo.toml \
  --sbf-out-dir=target/deploy

# Output: target/deploy/lockbox.so (~213 KB)
```

### Method 2: Anchor Build (If IDL generation works)

```bash
# Note: May fail due to anchor-syn version issues
# If it works, it will generate both .so and IDL
anchor build
```

---

## Deploying to Devnet

### Initial Deployment

```bash
# Configure Solana CLI for devnet
solana config set --url devnet

# Check your wallet balance (need ~2 SOL for deployment)
solana balance

# If needed, get devnet SOL
solana airdrop 2

# Deploy program (creates new program ID)
solana program deploy target/deploy/lockbox.so

# Note the Program ID from output, e.g.:
# Program Id: 5nr7xe1U3k6U6zPEmW3FCbPyXCa7jr7JpudaLKuVNyvZ
```

### Upgrading Existing Program

```bash
# Rebuild program
cargo-build-sbf \
  --manifest-path=programs/lockbox/Cargo.toml \
  --sbf-out-dir=target/deploy

# Upgrade using existing keypair
solana program deploy \
  --program-id target/deploy/lockbox-keypair.json \
  target/deploy/lockbox.so

# This maintains the same Program ID
```

---

## Frontend Configuration

### 1. Update Program ID (if changed)

Edit `app/src/App.tsx`:

```typescript
const PROGRAM_ID = new PublicKey('5nr7xe1U3k6U6zPEmW3FCbPyXCa7jr7JpudaLKuVNyvZ');
```

### 2. Update Fee Receiver (if desired)

```typescript
const FEE_RECEIVER = new PublicKey('YOUR_TREASURY_WALLET_ADDRESS');
```

### 3. Install Frontend Dependencies

```bash
cd app
npm install --legacy-peer-deps
```

### 4. Start Development Server

```bash
npm run dev

# Visit http://localhost:5173
```

### 5. Build for Production

```bash
npm run build

# Output: app/dist/
# Deploy to Vercel, Netlify, or any static host
```

---

## Verifying Deployment

### Check Program Status

```bash
# View program details
solana program show 5nr7xe1U3k6U6zPEmW3FCbPyXCa7jr7JpudaLKuVNyvZ

# Expected output:
# Program Id: 5nr7xe1U3k6U6zPEmW3FCbPyXCa7jr7JpudaLKuVNyvZ
# Owner: BPFLoaderUpgradeab1e11111111111111111111111
# ProgramData Address: CzuU6zFa3g5sbjBcDRxmh4zk2hzDVck8MqFoJevRsceW
# Authority: 3H8e4VnGjxKGFKxk2QMmjuu1B7dnDLysGN8hvcDCKxZh
# Last Deployed In Slot: 413989896
# Data Length: 218320 (0x354d0) bytes
# Balance: 1.52071128 SOL
```

### Test Transaction Simulation

The frontend includes built-in transaction simulation using Raydium SDK:

1. Open http://localhost:5173
2. View the interactive FAQ to understand how Lockbox works
3. Connect your wallet (Phantom or Solflare)
4. Enter test data (e.g., "Hello, Lockbox!")
5. Click "Encrypt & Store (0.001 SOL)"
6. Check Activity Log for real-time transaction status:
   - "Checking wallet balance..."
   - "Encrypting data with XChaCha20-Poly1305..."
   - "Simulating transaction..."
   - "Transaction confirmed!"
7. Check Storage History to see your stored data
8. Click "Decrypt & View" to temporarily decrypt
9. Watch as data auto-hides after 30 seconds
10. Refresh page and notice decrypted data is cleared

### View On-Chain Data

```bash
# Calculate your lockbox PDA
node find-pda.js

# View account data
solana account <YOUR_PDA_ADDRESS>

# Or view in Explorer:
# https://explorer.solana.com/address/<YOUR_PDA_ADDRESS>?cluster=devnet
```

---

## Troubleshooting

### Issue: Rust Version Too Old

**Error**: `package 'toml_parser' requires rustc 1.76 or newer`

**Solution**: Install Agave client (see Prerequisites above)

### Issue: Account Already Exists

**Error**: `Custom program error: 0x0` (account already initialized)

**Cause**: Using `init` instead of `init_if_needed`

**Solution**: Program now uses `init_if_needed` - should work for both create and update

### Issue: Fee Receiver Constraint Error

**Error**: `ConstraintMut: A mut constraint was violated on fee_receiver`

**Cause**: Fee receiver set to System Program (`11111...`)

**Solution**: Set fee receiver to a valid wallet address (not a program)

### Issue: Transaction Fails with "Unexpected error"

**Steps to debug**:
1. Check Activity Log in the app for detailed error messages
2. Check browser console for simulation output
3. Look at simulation output (shows exactly which instruction failed)
4. Verify all accounts are correct
5. Check wallet has sufficient balance
6. Check the FAQ section for common issues

### Issue: IDL Build Fails

**Error**: `no method named 'source_file' found for struct 'proc_macro2::Span'`

**Cause**: Version mismatch between Anchor and proc-macro2

**Solution**: Use `cargo-build-sbf` directly (doesn't need IDL for deployment)

---

## Cost Breakdown

### Deployment Costs (Devnet)
- **Initial deployment**: ~1.5 SOL (one-time)
- **Program upgrade**: ~0.3 SOL (when updating)
- **Account rent**: 1.52 SOL (stays with program)

### User Costs (Per Transaction)
- **Storage fee**: 0.001 SOL (goes to fee receiver)
- **Transaction fee**: ~0.00005 SOL (network fee)
- **PDA creation**: ~0.00883 SOL (one-time, rent-exempt)

**Total first-time user cost**: ~0.01 SOL
**Subsequent storage costs**: ~0.001 SOL per update

---

## Production Deployment (Mainnet)

### Prepare for Mainnet

```bash
# Switch to mainnet
solana config set --url mainnet-beta

# Ensure sufficient SOL
solana balance
# Need ~5 SOL for safe deployment + buffer

# Deploy
solana program deploy target/deploy/lockbox.so

# Update frontend endpoint
# Change clusterApiUrl('devnet') to clusterApiUrl('mainnet-beta')
```

### Security Checklist

Before deploying to mainnet:

- [ ] Full security audit completed
- [ ] Program code reviewed by multiple developers
- [ ] All tests passing
- [ ] Frontend thoroughly tested on devnet
- [ ] Fee receiver configured correctly
- [ ] Upgrade authority secured (consider multisig)
- [ ] Bug bounty program established
- [ ] Incident response plan documented
- [ ] User documentation complete
- [ ] Legal review completed (if applicable)

---

## Mainnet Deployment Recommendations

⚠️ **This program is currently on devnet for testing**

Before mainnet deployment, consider:

1. **Formal Security Audit**: Engage professional auditors
2. **Insurance**: Consider protocol insurance (Nexus Mutual, etc.)
3. **Multisig Authority**: Use Squads/Goki for upgrade control
4. **Rate Limiting**: Review cooldown period adequacy
5. **Fee Structure**: Validate 0.001 SOL is appropriate
6. **Size Limits**: Confirm 1 KiB is suitable for use cases
7. **Recovery Mechanism**: Document key recovery process
8. **Monitoring**: Set up alert system for unusual activity

---

## Deployment Checklist

### Pre-Deployment
- [ ] Agave client installed (rustc 1.76+)
- [ ] Wallet funded with 3+ SOL
- [ ] Program code reviewed
- [ ] Frontend tested locally
- [ ] IDL generated (or manual instruction building tested)

### Deployment
- [ ] Solana CLI configured for correct network
- [ ] Program built successfully
- [ ] Program deployed/upgraded
- [ ] Program ID confirmed
- [ ] Frontend updated with correct Program ID
- [ ] Transaction simulation passes

### Post-Deployment
- [ ] Program visible on Solana Explorer
- [ ] Test transaction executed successfully
- [ ] On-chain data verified
- [ ] Frontend connected to deployed program
- [ ] Documentation updated
- [ ] Repository tagged with version

---

## Useful Commands

```bash
# Check Solana configuration
solana config get

# View wallet address
solana address

# Get wallet balance
solana balance

# View program logs (requires RPC with logs)
solana logs 5nr7xe1U3k6U6zPEmW3FCbPyXCa7jr7JpudaLKuVNyvZ

# Close program (permanently)
# ⚠️ WARNING: This is irreversible!
solana program close <PROGRAM_ID>

# Transfer upgrade authority
solana program set-upgrade-authority \
  <PROGRAM_ID> \
  --new-upgrade-authority <NEW_AUTHORITY>
```

---

## Links

- **Program Explorer**: https://explorer.solana.com/address/5nr7xe1U3k6U6zPEmW3FCbPyXCa7jr7JpudaLKuVNyvZ?cluster=devnet
- **Repository**: https://github.com/hackingbutlegal/lockbox
- **Agave Releases**: https://github.com/anza-xyz/agave/releases
- **Solana Docs**: https://docs.solana.com/cli/deploy-a-program
- **Anchor Docs**: https://www.anchor-lang.com/docs/cli

---

## Recent Updates

**v1.1.0** (October 2025):
- Added comprehensive FAQ section for new users
- Implemented ephemeral decryption model
- Removed persistent retrieval tracking
- Enhanced Activity Log messaging
- Added creator attribution footer
- Updated all documentation

---

**Last Updated**: October 12, 2025
**Deployed Version**: v1.1.0
**Status**: ✅ Live on Devnet

Created with <3 by [GRAFFITO](https://x.com/0xgraffito)
