# Lockbox Deployment Guide

## ✅ Current Status

1. **Program**: ✅ Deployed to Solana Devnet
2. **Program ID**: `5nr7xe1U3k6U6zPEmW3FCbPyXCa7jr7JpudaLKuVNyvZ`
3. **Frontend**: ✅ Fully functional at http://localhost:5173
4. **Network**: Devnet
5. **Status**: Live and working

[View Program on Explorer](https://explorer.solana.com/address/5nr7xe1U3k6U6zPEmW3FCbPyXCa7jr7JpudaLKuVNyvZ?cluster=devnet)

---

## Quick Start

### Running Locally

```bash
# Clone repository
git clone https://github.com/hackingbutlegal/lockbox.git
cd lockbox

# Install frontend dependencies
cd app
npm install --legacy-peer-deps

# Start dev server
npm run dev

# Visit http://localhost:5173
```

### Using the App

1. **Connect Wallet**: Click "Select Wallet" and choose Phantom or Solflare
2. **Switch to Devnet**: Ensure your wallet is on Devnet network
3. **Get Devnet SOL**: Use wallet's built-in faucet or https://faucet.solana.com
4. **Store Data**: Enter text (max ~1000 bytes), click "Store Encrypted Data"
5. **View Transaction**: Check Activity Log for transaction hash and Explorer link
6. **Verify On-Chain**: Use `node find-pda.js` to find your PDA address

---

## Features

### Working Features ✅
- ✅ Client-side XChaCha20-Poly1305 encryption
- ✅ HKDF key derivation from wallet signatures
- ✅ On-chain storage in Program Derived Addresses
- ✅ Transaction simulation with detailed logging
- ✅ Real-time activity log with color-coded messages
- ✅ Storage history with retrieval tracking
- ✅ Wallet adapter integration (Phantom, Solflare)
- ✅ Mobile-first responsive design
- ✅ Session timeout (15 minutes inactivity)
- ✅ Memory scrubbing for sensitive data
- ✅ 1 KiB size limit enforcement
- ✅ 0.001 SOL fee per storage operation
- ✅ 10-slot cooldown rate limiting

### Activity Log

The app includes comprehensive logging:

- 🔵 **Info**: General information (wallet connected, PDA calculated, etc.)
- 🟢 **Success**: Successful operations with transaction hashes
- 🟡 **Warning**: Non-critical issues (cooldown warnings, network issues)
- 🔴 **Error**: Operation failures with detailed error messages
- 🟣 **Progress**: Animated indicators for ongoing operations

Each transaction entry includes:
- Full transaction signature
- **Copy** button for easy copying
- **View on Explorer** link (opens Solana Explorer on devnet)

### Storage History

Tracks all your storage operations:
- Timestamp of each storage
- Data preview (first 50 characters)
- Transaction hash with Explorer link
- Size in bytes
- Retrieval history per item

---

## Program Details

### Deployment Info

- **Program ID**: `5nr7xe1U3k6U6zPEmW3FCbPyXCa7jr7JpudaLKuVNyvZ`
- **Network**: Solana Devnet
- **Deployed**: October 11, 2025
- **Slot**: 413989896
- **Size**: 218,320 bytes (213 KB)
- **Upgrade Authority**: 3H8e4VnGjxKGFKxk2QMmjuu1B7dnDLysGN8hvcDCKxZh

### Instructions

#### `store_encrypted`
Stores encrypted data in user's lockbox PDA.

**Parameters:**
- `ciphertext: Vec<u8>` - Encrypted payload (max 1024 bytes)
- `nonce: [u8; 24]` - XChaCha20-Poly1305 nonce
- `salt: [u8; 32]` - HKDF salt

**Checks:**
- Ciphertext size <= 1024 bytes
- Ciphertext not empty
- Cooldown elapsed (10 slots)
- Fee paid (0.001 SOL)

#### `retrieve_encrypted`
Retrieves encrypted data from user's lockbox.

**Returns:**
- `ciphertext: Vec<u8>` - Encrypted data
- `nonce: [u8; 24]` - Nonce for decryption
- `salt: [u8; 32]` - Salt for key derivation

**Checks:**
- Caller is lockbox owner
- Cooldown elapsed

---

## Development

### Prerequisites

- **Node.js**: 18+
- **Solana CLI**: 2.3.13+ (Agave)
- **Rust**: 1.76+ (via Agave platform-tools)
- **Wallet**: Phantom or Solflare with devnet SOL

### Building the Program

```bash
# Install Agave (Solana CLI with updated Rust)
sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"

# Add to PATH
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"

# Build program
cargo-build-sbf \
  --manifest-path=programs/lockbox/Cargo.toml \
  --sbf-out-dir=target/deploy
```

### Deploying Program

```bash
# Configure for devnet
solana config set --url devnet

# Check balance (need ~2 SOL)
solana balance

# Deploy new program
solana program deploy target/deploy/lockbox.so

# Or upgrade existing
solana program deploy \
  --program-id target/deploy/lockbox-keypair.json \
  target/deploy/lockbox.so
```

### Frontend Development

```bash
cd app

# Install dependencies
npm install --legacy-peer-deps

# Development server with HMR
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

---

## Testing

### Test Storage Flow

1. Connect wallet (ensure on Devnet)
2. Enter test data: "Hello, Lockbox!"
3. Click "Store Encrypted Data"
4. Check Activity Log for:
   - "Checking wallet balance..."
   - "Encrypting data with XChaCha20-Poly1305..."
   - "Discriminator: [hash value]"
   - "Simulating transaction..."
   - "Sending transaction to Solana devnet..."
   - "Transaction confirmed! (Signature: ...)"
5. Click "View on Explorer" to verify on-chain
6. Use `node find-pda.js` to get your PDA address
7. Check account: `solana account <PDA_ADDRESS>`

### Verify On-Chain Data

```bash
# Get your wallet address
solana address

# Calculate PDA (uses your wallet address)
node find-pda.js

# View account data
solana account <YOUR_PDA_FROM_SCRIPT>

# Or view in Explorer
# https://explorer.solana.com/address/<YOUR_PDA>?cluster=devnet
```

### Expected Account Structure

```
Bytes 0-7:     Anchor discriminator
Bytes 8-39:    Owner pubkey (your wallet)
Bytes 40-43:   Ciphertext length (u32 little-endian)
Bytes 44+:     Encrypted ciphertext
Bytes ...:     Nonce (24 bytes)
Bytes ...:     Salt (32 bytes)
Bytes ...:     Last action slot (u64)
Bytes ...:     Bump seed (u8)
```

---

## Production Deployment

### Mainnet Preparation

**⚠️ Before deploying to mainnet:**

1. **Security Audit**: Engage professional auditors
2. **Thorough Testing**: Test all edge cases on devnet
3. **Code Review**: Multiple developer reviews
4. **Documentation**: Complete user and developer docs
5. **Incident Response**: Plan for handling issues
6. **Monitoring**: Set up alerts for unusual activity
7. **Insurance**: Consider protocol insurance
8. **Legal Review**: Ensure compliance

### Mainnet Deployment Steps

```bash
# Switch to mainnet
solana config set --url mainnet-beta

# Ensure sufficient SOL (5+ SOL recommended)
solana balance

# Build program
cargo-build-sbf \
  --manifest-path=programs/lockbox/Cargo.toml \
  --sbf-out-dir=target/deploy

# Deploy to mainnet
solana program deploy target/deploy/lockbox.so

# Update frontend
# Change clusterApiUrl('devnet') to clusterApiUrl('mainnet-beta') in App.tsx

# Build production frontend
cd app && npm run build

# Deploy frontend to hosting (Vercel, Netlify, etc.)
```

### Mainnet Costs

**Deployment:**
- Program deployment: ~1.5-2 SOL (one-time)
- Program rent: ~1.52 SOL (stays with program)

**User Costs:**
- First-time storage: ~0.01 SOL (includes PDA creation)
- Subsequent storage: ~0.001 SOL (storage fee)
- Transaction fees: ~0.00005 SOL per transaction

---

## Security Considerations

### Implemented Security Features

- ✅ **Client-Side Encryption**: All encryption happens off-chain
- ✅ **Wallet-Derived Keys**: Keys derived from wallet signatures
- ✅ **No Persistent Secrets**: Keys exist only in session memory
- ✅ **Memory Scrubbing**: Sensitive data wiped after use
- ✅ **Session Timeouts**: 15-minute inactivity auto-disconnect
- ✅ **Rate Limiting**: 10-slot cooldown between operations
- ✅ **Size Limits**: 1 KiB maximum to prevent abuse
- ✅ **Fee Requirement**: 0.001 SOL prevents spam
- ✅ **Owner-Only Access**: PDA ensures isolation
- ✅ **AEAD Encryption**: XChaCha20-Poly1305 with authentication

### Known Limitations

- ⚠️ **Wallet Compromise**: If wallet is compromised, all data is accessible
- ⚠️ **Side-Channel Attacks**: Standard implementation-dependent risks
- ⚠️ **Browser Extensions**: Malicious extensions could intercept in-memory data
- ⚠️ **No Forward Secrecy**: Compromised wallet exposes historical data
- ⚠️ **Single Key Derivation**: All data encrypted with same derivation method

### Threat Model

**Mitigated:**
- ✅ Client-side key theft (no persistent storage)
- ✅ Nonce reuse (random generation)
- ✅ Brute force (rate limiting)
- ✅ Unauthorized access (owner-only PDA)
- ✅ Replay attacks (slot-based timestamps)

**Not Mitigated:**
- ❌ Wallet compromise (single point of failure)
- ❌ Malicious browser extensions
- ❌ Memory inspection attacks
- ❌ Quantum computer attacks (future risk)

---

## Troubleshooting

### Common Issues

**Issue**: "Storage failed: Cannot read properties of undefined (reading '_bn')"
**Solution**: Discriminator calculation error - fixed in current version

**Issue**: "ConstraintMut: A mut constraint was violated on fee_receiver"
**Solution**: Fee receiver must be a wallet, not System Program - fixed

**Issue**: "Cooldown not elapsed: wait 10 slots"
**Solution**: Wait ~4 seconds between operations

**Issue**: "Encrypted data exceeds maximum size"
**Solution**: Keep plaintext under ~1000 bytes (1024 bytes after encryption)

**Issue**: "Insufficient balance"
**Solution**: Get devnet SOL from https://faucet.solana.com

### Debugging Tools

```bash
# View program logs
solana logs 5nr7xe1U3k6U6zPEmW3FCbPyXCa7jr7JpudaLKuVNyvZ

# Check program status
solana program show 5nr7xe1U3k6U6zPEmW3FCbPyXCa7jr7JpudaLKuVNyvZ

# View transaction details
solana confirm <SIGNATURE> -v

# Check account data
solana account <PDA_ADDRESS> --output json
```

### Browser Console

The app includes detailed console logging:
- Transaction simulation results
- Discriminator calculations
- Instruction data breakdown
- Error stack traces

---

## API Documentation

See [API.md](./API.md) for complete API documentation including:
- Program instructions
- Frontend API
- Cryptography functions
- Error codes
- Data types
- Full code examples

---

## Links

- **GitHub**: https://github.com/hackingbutlegal/lockbox
- **Program Explorer**: https://explorer.solana.com/address/5nr7xe1U3k6U6zPEmW3FCbPyXCa7jr7JpudaLKuVNyvZ?cluster=devnet
- **Solana Docs**: https://docs.solana.com/
- **Anchor Docs**: https://www.anchor-lang.com/
- **Solana Faucet**: https://faucet.solana.com/

---

## Support

For issues, questions, or contributions:

1. Check [API.md](./API.md) for detailed documentation
2. Review [DEPLOY_INSTRUCTIONS.md](./DEPLOY_INSTRUCTIONS.md) for deployment help
3. Check browser console and Activity Log for errors
4. View transactions on Solana Explorer
5. Open an issue on GitHub

---

- **Last Updated**: October 11, 2025
- **Version**: v1.0.0
- **Status**: ✅ Live on Devnet
