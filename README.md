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

Solana Lockbox v2.0 expands the original 1KB encrypted storage into a comprehensive password manager with:

### 🎯 Core Features
- **Unlimited Storage**: Scale from 1KB to 1MB+ via dynamic chunk allocation
- **Password Management**: Store, organize, and retrieve unlimited password entries
- **Categories & Folders**: Organize credentials with hierarchical structure
- **Encrypted Search**: Search without decrypting using blind indexes
- **Secure Sharing**: Share passwords with other users via asymmetric encryption
- **TOTP/2FA**: Built-in 2FA code generation
- **Password Health**: Analyze weak, reused, and old passwords

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

---

## Documentation

📖 **[DEPLOYMENT_V2.md](./DEPLOYMENT_V2.md)** ⭐ COMPLETE
Complete v2 deployment guide including:
- Current devnet deployment status
- All critical fixes (discriminators, INIT_SPACE, transaction handling, realloc)
- Phase 5 subscription UI implementation
- Program instructions and discriminators
- Testing procedures
- Troubleshooting common issues

📖 **[PASSWORD_MANAGER_EXPANSION.md](./PASSWORD_MANAGER_EXPANSION.md)**
Complete technical specification for v2.0 architecture, including:
- Multi-tier storage design
- Enhanced password entry structure
- Encrypted search implementation
- Secure sharing protocol
- Subscription management system
- Implementation roadmap and phases

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

### Phase 1: Foundation (October 2025) ✅ Complete
- [x] Multi-tier storage architecture (MasterLockbox + StorageChunks)
- [x] Dynamic chunk allocation (realloc implementation)
- [x] Storage chunks with automatic expansion
- [x] Enhanced password entry schema (v2 with compression)
- [x] Transaction deduplication and wallet adapter fixes
- [x] Fixed discriminators and INIT_SPACE calculations
- [x] Client-side encryption (XChaCha20-Poly1305)
- [x] Wallet-derived keys with HKDF
- [x] Session management with 15-minute timeout

### Phase 5: Subscription System UI (October 2025) ✅ Complete
- [x] Subscription tier display component (SubscriptionCard)
- [x] Subscription upgrade modal with payment flow
- [x] Storage usage visualization with tier limits
- [x] Integration with on-chain upgradeSubscription instruction
- [x] Real-time storage monitoring and warnings
- [x] Responsive design for mobile/tablet/desktop
- [x] Lazy signature prompts (single wallet signature)

### Phase 2: Search & Organization (Q1 2026)
- [ ] Blind index search system
- [ ] Fuzzy search on client
- [ ] Folder/tag organization
- [ ] Batch operations
- [ ] Import/export functionality

### Phase 3: Security Enhancements (Q1 2026)
- [ ] Secure sharing protocol (asymmetric encryption)
- [ ] Permission management
- [ ] Audit log infrastructure
- [ ] 2FA/TOTP support
- [ ] Password history tracking

### Phase 4: Subscription Management (Q2 2026)
- [ ] Subscription renewal flow
- [ ] Payment history and invoices
- [ ] Auto-renewal system
- [ ] Downgrade handling
- [ ] Revenue distribution

### Phase 6: Advanced Features (Q2-Q3 2026)
- [ ] Password generator with strength options
- [ ] Password health analyzer
- [ ] Breach monitoring integration
- [ ] Browser extension (Chrome/Firefox)
- [ ] Mobile applications

### Phase 7: Enterprise Features (Q3-Q4 2026)
- [ ] Team management and sharing
- [ ] Advanced audit logging
- [ ] Custom branding options
- [ ] API access for integrations
- [ ] SSO support

---

## Project Structure

```
solana-lockbox/
├── programs/lockbox/          # Anchor Solana program
│   ├── src/
│   │   ├── lib.rs            # Main program logic
│   │   ├── state.rs          # Account structures
│   │   └── instructions/     # Program instructions
├── nextjs-app/                # Next.js 15 frontend
│   ├── app/                  # App router pages
│   ├── components/           # React components
│   │   ├── PasswordManager.tsx
│   │   ├── SubscriptionCard.tsx
│   │   ├── SubscriptionUpgradeModal.tsx
│   │   └── StorageUsageBar.tsx
│   └── lib/                  # Crypto & utilities
├── sdk/                       # TypeScript SDK
│   ├── src/
│   │   ├── client-v2.ts      # SDK client
│   │   └── types-v2.ts       # Type definitions
├── PASSWORD_MANAGER_EXPANSION.md  # Technical spec
├── DEPLOYMENT_V2.md              # Deployment guide
└── README.md                     # This file
```

---

## Comparison with v1.0 Pre-Production

| Feature | v1.0 (pre-production) | v2.0 (current) |
|---------|----------------------|----------------|
| Storage | 1KB fixed | 1KB - 1MB+ dynamic |
| Entries | 1 entry | Unlimited |
| Organization | None | Categories, folders, tags |
| Search | None | Encrypted blind index search |
| Sharing | None | Secure asymmetric sharing |
| Subscriptions | Free only | Free + 3 paid tiers |
| Features | Basic storage | Full password manager |
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
