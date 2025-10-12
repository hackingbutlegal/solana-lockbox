# 🔒 Lockbox

Wallet-tied encrypted storage on Solana with zero persistent client secrets.

> **🚀 Live on Devnet**
> Program ID: [`5nr7xe1U3k6U6zPEmW3FCbPyXCa7jr7JpudaLKuVNyvZ`](https://explorer.solana.com/address/5nr7xe1U3k6U6zPEmW3FCbPyXCa7jr7JpudaLKuVNyvZ?cluster=devnet)
> Network: Solana Devnet
> Last Updated: October 2025

## Features

- **Wallet-Derived Encryption**: All keys derived from your Solana wallet signature using HKDF
- **AEAD Encryption**: XChaCha20-Poly1305 authenticated encryption with nonce uniqueness
- **Zero Persistent Secrets**: No decrypted data or keys stored - everything cleared on refresh
- **Ephemeral Decryption**: Decrypted data exists only in memory, auto-hides after 30s
- **On-Chain Storage**: Encrypted ciphertext, salt, and nonce stored in Solana PDAs
- **Interactive FAQ**: Comprehensive user-friendly FAQ section answering common questions
- **Mobile-First UI**: Responsive design with touch-friendly controls
- **Activity Logging**: Real-time transaction monitoring with color-coded status messages
- **Rate Limiting**: 10-slot cooldown protection against brute force attempts
- **Session Security**: 15-minute inactivity timeout with automatic wallet disconnect

## Architecture

### Smart Contract (Anchor Program)

- **PDA Storage**: Each user gets a PDA at `["lockbox", user_pubkey]`
- **Size Limits**: Maximum 1 KiB encrypted payload
- **Fee Model**: 0.001 SOL per store operation
- **Access Control**: Owner-only writes, read returns only ciphertext

### Client Cryptography

1. **Key Derivation**:
   - Generate challenge message with domain separation
   - Sign with wallet (obtains Ed25519 signature)
   - HKDF(public_key || signature || salt) → session_key

2. **Encryption Flow**:
   - Client encrypts plaintext with session key
   - XChaCha20-Poly1305 with random nonce
   - Store (ciphertext, nonce, salt) on-chain

3. **Decryption Flow**:
   - Retrieve (ciphertext, nonce, salt) from chain
   - Derive session key from wallet signature
   - Decrypt and display with timed reveal

## Quick Start

### Prerequisites

- Node.js 18+
- Rust & Anchor CLI
- Solana CLI
- Phantom or Solflare wallet

### Installation

```bash
# Clone the repository
git clone https://github.com/hackingbutlegal/lockbox.git
cd lockbox

# Install frontend dependencies
cd nextjs-app
npm install
cd ..

# Build Solana program
cargo-build-sbf --manifest-path=programs/lockbox/Cargo.toml --sbf-out-dir=target/deploy

# Deploy to devnet (requires Solana CLI and funded wallet)
solana config set --url devnet
solana program deploy --program-id target/deploy/lockbox-keypair.json target/deploy/lockbox.so

# Start frontend dev server
cd nextjs-app
npm run dev
```

Visit http://localhost:3000 and connect your Phantom or Solflare wallet.

### Development

```bash
# Terminal 1: Start local validator (optional)
solana-test-validator

# Terminal 2: Build and deploy program
anchor build && anchor deploy

# Terminal 3: Start frontend
cd nextjs-app && npm run dev
```

## Project Structure

```
lockbox/
├── programs/lockbox/src/
│   └── lib.rs                      # Anchor program with PDA storage
├── nextjs-app/
│   ├── app/
│   │   ├── page.tsx                # Main page component
│   │   ├── layout.tsx              # Root layout
│   │   └── globals.css             # Global styles
│   ├── components/
│   │   ├── LockboxApp.tsx          # Main Lockbox component
│   │   ├── ActivityLog.tsx         # Real-time transaction log
│   │   ├── StorageHistory.tsx      # Transaction history display
│   │   └── FAQ.tsx                 # Interactive FAQ component
│   ├── lib/
│   │   ├── crypto.ts               # Cryptography utilities
│   │   ├── secureStorage.ts        # Session storage utilities
│   │   └── idl/
│   │       └── lockbox.json        # Program IDL
│   └── next.config.ts              # Next.js configuration
├── sdk/
│   ├── src/
│   │   ├── index.ts                # TypeScript SDK
│   │   ├── types.ts                # Type definitions
│   │   └── idl/
│   │       └── lockbox.json        # Program IDL
│   ├── package.json
│   ├── tsconfig.json
│   └── README.md                   # SDK documentation
├── target/
│   └── idl/
│       └── lockbox.json            # Generated IDL
├── Anchor.toml
└── package.json
```

## Cryptography Design

### Key Derivation (HKDF)

```
challenge = domain_separated_message(publicKey, timestamp)
signature = wallet.signMessage(challenge)
salt = random(32 bytes)
session_key = HKDF-SHA256(publicKey || signature || salt, info="lockbox-session-key")
```

### Encryption (XChaCha20-Poly1305)

```
nonce = random(24 bytes)
ciphertext = XChaCha20-Poly1305.encrypt(plaintext, session_key, nonce)
store_on_chain(ciphertext, nonce, salt)
```

### Decryption

```
{ciphertext, nonce, salt} = retrieve_from_chain()
session_key = derive_session_key(wallet.signature, salt)
plaintext = XChaCha20-Poly1305.decrypt(ciphertext, session_key, nonce)
```

## Security Features

- **No Key Storage**: Session keys exist only in memory, never persisted
- **No Data Persistence**: Decrypted data cleared on page refresh
- **Ephemeral Viewing**: Decrypted data auto-hides after 30 seconds
- **Nonce Uniqueness**: Random 24-byte nonces for XChaCha20
- **Memory Scrubbing**: Wipe sensitive data after use
- **Cooldown Rate Limiting**: 10 slots (~4s) between operations
- **Inactivity Timeout**: Auto-disconnect after 15 minutes
- **Size Validation**: Enforce 1 KiB limit before encryption
- **Domain Separation**: Unique context in key derivation

## Error Handling

The program returns precise custom errors:

- `DataTooLarge`: Ciphertext exceeds 1024 bytes
- `InvalidCiphertext`: Empty or malformed data
- `Unauthorized`: Not the lockbox owner
- `CooldownNotElapsed`: Rate limit active
- `FeeTooLow`: Insufficient fee payment

## User Experience

- **Interactive FAQ**: 18 comprehensive questions covering security, costs, and usage
- **Activity Log**: Color-coded real-time transaction monitoring
- **Storage History**: Track all your storage transactions with Explorer links
- **Timed Reveal**: Decrypted data auto-hides after 30s for security
- **Ephemeral Decryption**: Data cleared on every page refresh
- **Size Counter**: Live feedback on remaining bytes
- **Responsive Design**: Optimized for mobile and desktop
- **One-Click Actions**: Copy transaction hashes, view on Explorer
- **Visual Feedback**: Clear loading states and status messages

## Viewing On-Chain Data

Each user's encrypted data is stored in a Program Derived Address (PDA):

```bash
# Calculate your PDA address
node find-pda.js

# View account data
solana account <YOUR_PDA_ADDRESS> --output json

# Or view on Solana Explorer
# https://explorer.solana.com/address/<YOUR_PDA_ADDRESS>?cluster=devnet
```

**On-Chain Data Structure** (Total: ~1141 bytes max):
```
Bytes 0-7:     Anchor discriminator (8 bytes)
Bytes 8-39:    Owner public key (32 bytes)
Bytes 40-43:   Ciphertext length (4 bytes, u32 LE)
Bytes 44-1067: Encrypted ciphertext (max 1024 bytes)
Bytes ...:     Nonce (24 bytes for XChaCha20-Poly1305)
Bytes ...:     Salt (32 bytes for HKDF)
Bytes ...:     Last action slot (8 bytes, u64)
Bytes ...:     Bump seed (1 byte)
```

## Testing

```bash
# Test frontend locally
cd nextjs-app
npm run dev

# Build for production
npm run build

# Test transaction simulation (built into the app)
# Check browser console for detailed simulation logs
```

## Deployment

### Devnet

```bash
# Set Solana to devnet
solana config set --url devnet

# Deploy program
anchor deploy

# Update program ID in nextjs-app/components/LockboxApp.tsx
```

### Mainnet

```bash
# Set Solana to mainnet
solana config set --url mainnet-beta

# Deploy with sufficient SOL
anchor deploy

# Update endpoint in nextjs-app/components/LockboxApp.tsx
```

## License

ISC

## Contributing

PRs welcome! Please ensure:

1. All tests pass: `anchor test`
2. Frontend builds: `cd nextjs-app && npm run build`
3. No ESLint errors
4. Security-focused changes documented

## Threat Model

### Mitigated

- ✅ Client-side key theft (keys never persisted)
- ✅ Nonce reuse (random generation)
- ✅ Brute force (rate limiting)
- ✅ Unauthorized access (owner-only PDA)

### Not Mitigated

- ❌ Wallet compromise (full access to all encrypted data)
- ❌ Side-channel attacks (implementation-dependent)
- ❌ Malicious browser extensions (can intercept in-memory keys)

## Roadmap

- [ ] Multi-device sync via deterministic key derivation
- [ ] Versioned encryption (allow algorithm upgrades)
- [ ] Shared lockboxes (multi-sig access)
- [ ] Data expiration (automatic deletion)
- [ ] Backup recovery phrases (optional, user-controlled)

---

## TypeScript SDK

A complete TypeScript SDK is now available for developers:

```bash
npm install lockbox-solana-sdk
```

```typescript
import { LockboxClient } from 'lockbox-solana-sdk';

const client = new LockboxClient({ connection, wallet });

// Store encrypted data
await client.store('My secret data');

// Retrieve and decrypt
const data = await client.retrieve();
```

See [SDK Documentation](./sdk/README.md) for complete API reference.

## Recent Updates

**v2.2.0** (October 2025):
- Migrated frontend from Vite to Next.js 15 with Turbopack
- Improved build performance and developer experience
- Enhanced mobile responsiveness
- Updated project structure and documentation
- Cleaned up repository for production release

**v1.2.0** (October 2025):
- Added TypeScript SDK for easy integration
- Generated IDL for program interactions
- Enhanced developer documentation
- Improved API reference and examples

**v1.1.0** (October 2025):
- Added interactive FAQ with 18 comprehensive questions
- Implemented ephemeral decryption (cleared on page refresh)
- Removed persistent retrieval tracking for improved privacy
- Added attribution footer with creator link
- Enhanced security documentation

---

Built with [Anchor](https://www.anchor-lang.com/) • [Solana](https://solana.com/) • [Next.js](https://nextjs.org/)

Created with <3 by [GRAFFITO](https://x.com/0xgraffito)
