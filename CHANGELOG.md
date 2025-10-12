# Changelog

All notable changes to the Lockbox project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2025-10-12

### Added
- **TypeScript SDK** for easy integration with the Lockbox program
  - Complete client library with encryption/decryption utilities
  - Full TypeScript support with type definitions
  - React hooks example
  - Comprehensive API documentation
- **IDL Generation** for the Solana program
  - Auto-generated Interface Definition Language file
  - Enables cross-language client development
  - Complete type safety for program interactions
- **SDK Documentation**
  - Detailed API reference in `sdk/README.md`
  - Usage examples and code snippets
  - React integration guide
  - Security best practices

### Changed
- Updated main README with SDK integration instructions
- Enhanced project structure documentation
- Improved developer onboarding experience

### Developer Experience
- Simplified integration process for developers
- Reduced boilerplate code for common operations
- Better error handling and type safety
- Clearer separation between SDK and application code

## [1.1.0] - 2025-10-11

### Added
- **Interactive FAQ Component** with 18 comprehensive questions
  - Security model explanations
  - Cost breakdowns
  - Technical implementation details
  - Usage guidelines
- **Ephemeral Decryption** feature
  - Decrypted data cleared on page refresh
  - No persistent storage of sensitive information
  - Enhanced privacy protection
- **Attribution Footer** with creator link
- **Enhanced Security Documentation**
  - Detailed threat model
  - Security feature explanations
  - Best practices guide

### Changed
- Removed persistent retrieval tracking for improved privacy
- Updated UI with better visual hierarchy
- Enhanced mobile responsiveness

### Security
- Improved session management
- Better memory cleanup on page refresh
- Enhanced documentation of security model

## [1.0.0] - 2025-10-11

### Added
- **Core Solana Program**
  - Anchor-based smart contract
  - PDA-based storage architecture
  - XChaCha20-Poly1305 encryption support
  - Rate limiting (10-slot cooldown)
  - Fee mechanism (0.001 SOL per operation)
- **Web Application**
  - React-based frontend with Vite
  - Wallet adapter integration (Phantom, Solflare)
  - Real-time activity logging
  - Storage history tracking
  - Responsive mobile-first design
- **Cryptography Features**
  - HKDF key derivation from wallet signatures
  - Client-side encryption/decryption
  - Nonce uniqueness guarantees
  - Memory scrubbing for sensitive data
- **Security Features**
  - Zero persistent key storage
  - Ephemeral session keys
  - 15-minute inactivity timeout
  - Automatic wallet disconnect
  - Domain-separated key derivation
- **Documentation**
  - Comprehensive README
  - Deployment instructions
  - Security documentation
  - API reference

### Security
- Client-side encryption prevents on-chain plaintext exposure
- Wallet-derived keys ensure only wallet owner can decrypt
- Rate limiting prevents brute force attacks
- PDA isolation ensures per-user data segregation

## Deployment Information

### Devnet
- **Program ID**: `5nr7xe1U3k6U6zPEmW3FCbPyXCa7jr7JpudaLKuVNyvZ`
- **Network**: Solana Devnet
- **Explorer**: [View on Solana Explorer](https://explorer.solana.com/address/5nr7xe1U3k6U6zPEmW3FCbPyXCa7jr7JpudaLKuVNyvZ?cluster=devnet)

## Migration Guides

### Upgrading to 1.2.0

If you were using direct program interactions, you can now use the SDK:

**Before:**
```typescript
const tx = await program.methods
  .storeEncrypted(ciphertext, nonce, salt)
  .accounts({ ... })
  .rpc();
```

**After:**
```typescript
import { LockboxClient } from '@lockbox/sdk';

const client = new LockboxClient({ connection, wallet });
await client.store('My secret data');
```

The SDK handles all encryption, key derivation, and account management automatically.

## Contributors

- [@0xgraffito](https://x.com/0xgraffito) - Creator and maintainer

## Links

- **GitHub**: https://github.com/hackingbutlegal/lockbox
- **Live App**: https://lockbox-hackingbutlegals-projects.vercel.app
- **Twitter**: https://x.com/0xgraffito

---

## Upcoming Features

See [README.md Roadmap](./README.md#roadmap) for planned features.
