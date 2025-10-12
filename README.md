# 🔒 Solana Lockbox v2.0
## Decentralized Password Manager

> **🚧 Pre-Production Development**  
> This is the v2.0 expansion repository for Lockbox, transforming it into a full-featured decentralized password manager.  
> For the production v1.1 release, see: [lockbox](https://github.com/hackingbutlegal/lockbox)

**Current Status**: Development  
**Target Release**: Q1 2026  
**Network**: Solana Devnet → Mainnet Beta

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

📖 **[PASSWORD_MANAGER_EXPANSION.md](./PASSWORD_MANAGER_EXPANSION.md)**  
Complete technical specification for v2.0 architecture, including:
- Multi-tier storage design
- Enhanced password entry structure
- Encrypted search implementation
- Secure sharing protocol
- Subscription management system
- 12-month implementation roadmap

📖 **[MIGRATION_GUIDE_V2.md](./MIGRATION_GUIDE_V2.md)**  
Migration path from v1.1 to v2.0, including:
- Backward compatibility strategy
- Data migration procedures
- Client-side migration helpers
- Testing and rollback plans

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

### Phase 1: Foundation (Months 1-3) ✅ In Progress
- [ ] Multi-tier storage architecture
- [ ] Dynamic chunk allocation
- [ ] Subscription tier system
- [ ] Enhanced password entry schema

### Phase 2: Search & Organization (Months 2-4)
- [ ] Blind index search system
- [ ] Fuzzy search on client
- [ ] Folder/tag organization
- [ ] Batch operations

### Phase 3: Security Enhancements (Months 3-5)
- [ ] Secure sharing protocol
- [ ] Permission management
- [ ] Audit log infrastructure
- [ ] 2FA/TOTP support

### Phase 4: Subscription System (Months 4-6)
- [ ] Subscription management
- [ ] Payment processing
- [ ] Auto-renewal system
- [ ] Revenue distribution

### Phase 5: Advanced Features (Months 5-7)
- [ ] Password generator
- [ ] Password health analyzer
- [ ] Breach monitoring
- [ ] Browser extension

### Phase 6: Enterprise Features (Months 6-12)
- [ ] Team management
- [ ] Advanced audit logging
- [ ] Custom branding
- [ ] API access

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
│   └── lib/                  # Crypto & utilities
├── sdk/                       # TypeScript SDK
│   ├── src/
│   │   ├── index.ts          # SDK client
│   │   └── types.ts          # Type definitions
├── PASSWORD_MANAGER_EXPANSION.md  # Technical spec
├── MIGRATION_GUIDE_V2.md         # Migration guide
└── README.md                     # This file
```

---

## Comparison with v1.1

| Feature | v1.1 (lockbox) | v2.0 (solana-lockbox) |
|---------|---------------|---------------------|
| Storage | 1KB fixed | 1KB - 1MB+ dynamic |
| Entries | 1 entry | Unlimited |
| Organization | None | Categories, folders, tags |
| Search | None | Encrypted blind index search |
| Sharing | None | Secure asymmetric sharing |
| Subscriptions | Free only | Free + 3 paid tiers |
| Features | Basic storage | Full password manager |

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

- **v1.1 Production**: https://github.com/hackingbutlegal/lockbox
- **v2.0 Development**: https://github.com/hackingbutlegal/solana-lockbox
- **Creator**: [@0xgraffito](https://x.com/0xgraffito)
- **Documentation**: See PASSWORD_MANAGER_EXPANSION.md

---

Built with [Anchor](https://www.anchor-lang.com/) • [Solana](https://solana.com/) • [Next.js](https://nextjs.org/)

Created with <3 by [GRAFFITO](https://x.com/0xgraffito)
