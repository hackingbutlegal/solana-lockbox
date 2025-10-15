# 🔒 Solana Lockbox v2.0
## Decentralized Password Manager

> **🚧 Active Development - Pre-Production**
> This is the v2.0 expansion repository for Lockbox, transforming it into a full-featured decentralized password manager.
> For the previous v1.0 pre-production release, see: [lockbox](https://github.com/hackingbutlegal/lockbox)

**Current Status**: ✅ Live on Devnet - Fully Functional
**Program ID**: `7JxsHjdReydiz36jwsWuvwwR28qqK6V454VwFJnnSkoB`
**Last Deployed**: October 13, 2025 (Phase 5: Subscription UI Complete)
**Target Mainnet**: Q1 2026
**Network**: Solana Devnet → Mainnet Beta

📖 **[DEPLOYMENT_V2.md](./DEPLOYMENT_V2.md)** - Complete v2 deployment guide with recent fixes

---

## What's New in v2.0?

Solana Lockbox v2.0 expands the original 1KB encrypted storage into a comprehensive password manager with blockchain-native innovations:

### 🚀 Blockchain-Native Innovations
- **Social Recovery**: Never lose your passwords - trusted guardians can help recover access via Shamir Secret Sharing (M-of-N threshold cryptography)
- **Emergency Access**: Dead man's switch for digital estate planning - designated contacts gain access after inactivity period
- **Gasless Transactions**: Subscription pools cover transaction fees - Web2 UX with Web3 security

### 🎯 Core Features
- **Unlimited Storage**: Scale from 1KB to 1MB+ via dynamic chunk allocation
- **Password Management**: Store, organize, and retrieve unlimited password entries
- **Categories & Folders**: Organize credentials with hierarchical structure
- **Encrypted Search**: Search without decrypting using blind indexes (coming Q1 2026)
- **Secure Sharing**: Share passwords with other users via asymmetric encryption (coming Q2 2026)
- **TOTP/2FA**: Built-in 2FA code generation (coming Q3 2026)
- **Password Health**: Analyze weak, reused, and old passwords (coming Q2 2026)

### 💎 Subscription Tiers
- **Free**: 1KB (~10 passwords)
- **Basic**: 10KB (~100 passwords) - 0.001 SOL/month
- **Premium**: 100KB (~1,000 passwords) - 0.01 SOL/month
- **Enterprise**: 1MB+ (unlimited) - 0.1 SOL/month

### 🔐 Security
- Zero-knowledge encryption (client-side only)
- Wallet-derived encryption keys
- XChaCha20-Poly1305 AEAD
- HKDF key derivation
- No persistent secrets

### 🎨 User Experience
- **Responsive Design**: Optimized for desktop, tablet, and mobile
- **Lazy Signature Prompts**: Single wallet signature on first password operation
- **Sticky Navigation**: Persistent header for easy access
- **Touch-Optimized**: Mobile-friendly interface with proper touch targets
- **Modern UI**: Clean, professional design with Next.js 15 + Turbopack

---

## Architecture Overview

### Multi-Tier Storage System
```
Master Lockbox Account
├── Storage Chunk 1 (10KB)
├── Storage Chunk 2 (10KB)
├── Storage Chunk 3 (10KB)
└── Storage Chunk N...
```

### Key Components
1. **Master Lockbox**: Manages metadata, subscriptions, and chunk references
2. **Storage Chunks**: Hold encrypted password entries (expandable via realloc)
3. **Search Index**: Blind indexes for encrypted search
4. **Shared Vaults**: Secure password sharing between users

### Refactored Architecture (October 2025)

The codebase has undergone a comprehensive refactor to improve maintainability, type safety, and user experience:

**SDK Improvements**:
- V2 as default export, V1 namespaced as legacy
- Discriminated union types for type-safe password entries
- Centralized constants (no magic values)
- Retry utility with exponential backoff for network failures
- User-friendly error formatting with actionable suggestions
- WeakMap-based session storage for enhanced security

**Frontend Organization**:
- Components organized by purpose: `modals/`, `ui/`, `features/`, `layout/`
- Context architecture split into 4 focused providers:
  - `AuthContext`: Session management & client creation
  - `LockboxContext`: Master lockbox metadata
  - `PasswordContext`: Password CRUD operations
  - `SubscriptionContext`: Subscription tier management
- Error boundaries at multiple layers for graceful failure handling
- Enhanced toast system with loading states, actions, and progress bars
- Consistent loading states across all async operations
- Barrel exports for clean imports

**Developer Experience**:
- Type-safe password entry types (LoginEntry, CreditCardEntry, etc.)
- Zod validation matching TypeScript types
- Comprehensive JSDoc documentation
- Better error messages with suggested fixes
- Automatic retry for transient failures

---

## Documentation

📖 **[docs/deployment/DEPLOYMENT.md](./docs/deployment/DEPLOYMENT.md)** ⭐ COMPREHENSIVE
Consolidated deployment guide (1,760 lines) including:
- Current devnet deployment status & program ID
- All critical fixes and their resolutions
- Complete deployment procedures (devnet & Vercel)
- Testing procedures and troubleshooting
- Production readiness checklist
- 8 major issue resolutions documented

📖 **[docs/technical/RUST_OPTIMIZATION_RECOMMENDATIONS.md](./docs/technical/RUST_OPTIMIZATION_RECOMMENDATIONS.md)**
Future optimization recommendations for the Rust program:
- Batch operations design
- Chunk defragmentation strategies
- Performance optimizations
- Compute unit analysis
- Migration strategies

📖 **[docs/README.md](./docs/README.md)**
Documentation navigation hub with organized sections:
- Architecture & design documents
- Deployment guides
- Security documentation
- Technical specifications
- Release notes

📖 **Legacy Documentation**
- **[PASSWORD_MANAGER_EXPANSION.md](./PASSWORD_MANAGER_EXPANSION.md)**: Original v2.0 technical specification
- **[DEPLOYMENT_V2.md](./DEPLOYMENT_V2.md)**: Original deployment guide (superseded by docs/deployment/DEPLOYMENT.md)

---

## Quick Start (Development)

### Prerequisites
- Node.js 18+
- Rust & Anchor CLI 0.30.1+
- Solana CLI
- Phantom or Solflare wallet

### Installation
```bash
# Clone the repository
git clone https://github.com/hackingbutlegal/solana-lockbox.git
cd solana-lockbox

# Install frontend dependencies
cd nextjs-app
npm install
cd ..

# Build Solana program
anchor build

# Deploy to devnet
anchor deploy

# Start frontend dev server
cd nextjs-app
npm run dev
```

Visit http://localhost:3000

---

## Development Roadmap

### Phase 1-3: Foundation & Core Features (October 2025) ✅ COMPLETE

**Phase 1: Storage Architecture**
- [x] Multi-tier storage architecture (MasterLockbox + StorageChunks)
- [x] Dynamic chunk allocation with on-chain realloc
- [x] Storage chunks with automatic expansion
- [x] Transaction deduplication and wallet adapter fixes
- [x] Fixed discriminators and INIT_SPACE calculations

**Phase 2: Password Structure & Encryption**
- [x] Enhanced password entry schema (v2 with versioning)
- [x] Password entry type system (Login, SecureNote, CreditCard, etc.)
- [x] Comprehensive category management system
- [x] Client-side encryption (XChaCha20-Poly1305 AEAD)
- [x] Wallet-derived keys with HKDF
- [x] Session management with 15-minute timeout
- [x] Secure WeakMap-based session storage
- [x] Data integrity validation with Zod schema
- [x] Serialization/deserialization with checksum verification

**Phase 3: Subscription System**
- [x] Four-tier subscription system (Free, Basic, Premium, Enterprise)
- [x] On-chain subscription management (upgrade, renew, downgrade)
- [x] Storage capacity enforcement per tier
- [x] Subscription expiration tracking
- [x] Client-side storage limit validation (prevents failed transactions)
- [x] Subscription tier display component (SubscriptionCard)
- [x] Subscription upgrade modal with payment flow
- [x] Storage usage visualization with tier limits
- [x] Real-time storage monitoring and warnings
- [x] Responsive design for mobile/tablet/desktop

---

### Phase 4: Search & Intelligence (Q1 2026) 🔍 NEXT - 6-8 weeks - HIGH priority
- [ ] Blind index search system with HMAC-based keyword hashing
- [ ] Fuzzy search on client side with trigram matching
- [ ] Advanced filtering and sorting
- [ ] Favorites and recently accessed entries
- [ ] Import/export functionality (1Password, Bitwarden, LastPass formats)
- [ ] Batch operations (import/update/delete multiple entries)

**Why**: Essential for usability at scale. Users need to find passwords quickly.

---

### Phase 5: Social Recovery & Emergency Access (Q1 2026) 🔥 CRITICAL - 8-10 weeks
- [ ] **Social Recovery via Threshold Cryptography** (Shamir Secret Sharing)
  - M-of-N guardian network for wallet recovery
  - On-chain encrypted share distribution
  - Guardian invitation and acceptance flow
  - Recovery initiation with mandatory delay
  - Guardian approval threshold enforcement
- [ ] **Time-Locked Emergency Access** (Dead Man's Switch)
  - Inactivity monitoring with on-chain countdown
  - Emergency contact notification system
  - Mandatory waiting period before access
  - Owner cancellation mechanism
  - Partial or full vault access grants

**Why**: Solves Web3's biggest problem - wallet loss = permanent data loss. THIS is our killer feature.

---

### Phase 6: Gasless Transactions & UX (Q2 2026) - 4-6 weeks - MEDIUM priority
- [ ] **Gasless Transaction Pool** (Subscription-Funded)
  - Subscription SOL pools for transaction fees
  - Transaction delegation system
  - Fee-less password operations for paid users
  - Usage quotas per tier
  - Pool refill automation
- [ ] Password generator with strength scoring
- [ ] Password health dashboard (weak, reused, old passwords)
- [ ] Password strength analyzer with suggestions

**Why**: Makes Web3 feel like Web2. Users shouldn't think about gas.

---

### Phase 7: Sharing & Collaboration (Q2 2026) - 6-8 weeks - MEDIUM priority
- [ ] Secure sharing protocol with asymmetric encryption (X25519)
- [ ] Per-entry permission management (view, edit, share)
- [ ] Share expiration and revocation
- [ ] Audit log infrastructure for all operations

**Why**: Teams need to share credentials securely. Builds foundation for enterprise features.

---

### Phase 8: Advanced Security (Q3 2026) - 4-6 weeks - MEDIUM priority
- [ ] 2FA/TOTP code generation and storage
- [ ] Password history tracking (last 10 versions)
- [ ] Password expiration and rotation reminders
- [ ] Breach monitoring integration (HaveIBeenPwned API)
- [ ] Biometric authentication support (WebAuthn)

**Why**: Security features that differentiate us from basic password managers.

---

### Phase 9: Platform Expansion (Q3-Q4 2026) - 8-10 weeks - LOW priority
- [ ] Mobile applications (iOS, Android with React Native)
- [ ] CLI tool for advanced users
- [ ] Cross-platform synchronization
- [ ] API access for third-party integrations

**Why**: Expand reach after core product is solid.

---

### Future Innovations (Post-Mainnet)

**Browser Extension**: Chrome, Firefox, Edge with auto-fill
**Cross-Chain Portability**: Export encrypted vault to Ethereum, Polygon, Arbitrum
**AI-Powered Security**: ML-based phishing detection, smart password suggestions
**NFT-Gated Passwords**: Credentials that require NFT ownership to decrypt
**Hardware Wallet Integration**: Ledger/Trezor as second factor

---

### Deprioritized Features

These features have been removed from the roadmap as they don't align with our core value proposition or are premature for pre-mainnet:

- ~~Custom branding~~ - Adds complexity for <1% of users
- ~~SSO Integration (SAML, OAuth)~~ - Conflicts with Web3-first philosophy
- ~~Desktop Apps (Electron)~~ - PWA covers 90% of use cases
- ~~Compliance Reporting (SOC 2, ISO 27001)~~ - Premature for pre-mainnet product

---

## Project Structure

```
solana-lockbox/
├── programs/lockbox/              # Anchor Solana program
│   ├── src/
│   │   ├── lib.rs                # Main program logic
│   │   ├── state/                # Account structures
│   │   │   ├── master_lockbox.rs
│   │   │   ├── storage_chunk.rs
│   │   │   └── subscription.rs
│   │   ├── instructions/         # Program instructions
│   │   │   ├── initialize.rs
│   │   │   ├── password_entry.rs
│   │   │   ├── subscription.rs
│   │   │   └── chunk_management.rs
│   │   └── errors.rs             # Custom error types
├── nextjs-app/                    # Next.js 15 frontend
│   ├── app/                      # App router pages
│   ├── components/               # Organized React components
│   │   ├── modals/              # Modal dialogs
│   │   │   ├── PasswordEntryModal.tsx
│   │   │   ├── SubscriptionUpgradeModal.tsx
│   │   │   ├── HealthDashboardModal.tsx
│   │   │   └── TOTPManagerModal.tsx
│   │   ├── ui/                  # UI primitives
│   │   │   ├── Toast.tsx        # Enhanced toast system
│   │   │   ├── ErrorBoundary.tsx
│   │   │   ├── LoadingState.tsx
│   │   │   └── StorageUsageBar.tsx
│   │   ├── features/            # Feature components
│   │   │   ├── PasswordManager.tsx
│   │   │   └── SubscriptionCard.tsx
│   │   └── layout/              # Layout components
│   ├── contexts/                # React contexts (split architecture)
│   │   ├── AuthContext.tsx      # Session management
│   │   ├── LockboxContext.tsx   # Lockbox metadata
│   │   ├── PasswordContext.tsx  # Password operations
│   │   └── SubscriptionContext.tsx
│   └── lib/                     # Crypto & utilities
├── sdk/                          # TypeScript SDK (v2 default)
│   ├── src/
│   │   ├── client-v2.ts         # V2 SDK client (default)
│   │   ├── client-v1.ts         # V1 client (legacy)
│   │   ├── types-v2.ts          # Discriminated union types
│   │   ├── constants.ts         # Centralized constants
│   │   ├── retry.ts             # Retry utility with backoff
│   │   ├── error-formatter.ts   # User-friendly errors
│   │   └── utils.ts             # Helper functions
├── docs/                         # Organized documentation
│   ├── deployment/              # Deployment guides
│   ├── security/                # Security documentation
│   ├── technical/               # Technical specifications
│   └── releases/                # Release notes
└── README.md                     # This file
```

---

## Comparison with v1.0 Pre-Production

| Feature | v1.0 (pre-production) | v2.0 (current) |
|---------|----------------------|----------------|
| Storage | 1KB fixed | 1KB - 1MB+ dynamic |
| Entries | 1 entry | Unlimited |
| Organization | None | Categories + folders |
| Search | None | Blind index (Q1 2026) |
| Sharing | None | Asymmetric (Q2 2026) |
| Subscriptions | Free only | Free + 3 paid tiers |
| **Social Recovery** | **None** | **Shamir Secret Sharing (Q1 2026)** |
| **Emergency Access** | **None** | **Time-locked (Q1 2026)** |
| **Gasless Txns** | **None** | **Subscription pools (Q2 2026)** |
| UI | Basic | Modern responsive design |
| Session Mgmt | None | 15-min timeout with lazy init |

---

## Contributing

This is an active development project. Contributions welcome!

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

ISC

---

## Links

- **v1.0 Pre-Production**: https://github.com/hackingbutlegal/lockbox
- **v2.0 Current Development**: https://github.com/hackingbutlegal/solana-lockbox
- **Creator**: [@0xgraffito](https://x.com/0xgraffito)
- **Documentation**: See DEPLOYMENT_V2.md and PASSWORD_MANAGER_EXPANSION.md

---

Built with [Anchor](https://www.anchor-lang.com/) • [Solana](https://solana.com/) • [Next.js](https://nextjs.org/)

Created with <3 by [GRAFFITO](https://x.com/0xgraffito)
