# Changelog

All notable changes to the Lockbox project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2025-10-12 (v2 Devnet Release)

### 🚀 Deployed
- **v2 Program ID**: `7JxsHjdReydiz36jwsWuvwwR28qqK6V454VwFJnnSkoB`
- **Network**: Solana Devnet
- **Slot**: 414207771
- **Transaction**: 9yTWHq4kbJAhEuaqvbUedgnsU9vjBzyE83zbWKFL735T5V9rN8K4HeZ4U7qCuaPdoXRukxdSQem3aWkYua7PQpt
- **Size**: 355,672 bytes (347 KB)

### 🐛 Critical Fixes
1. **Instruction Discriminators** - Fixed incorrect values causing InstructionFallbackNotFound (0x65)
   - All discriminators were placeholder values instead of SHA256 hashes
   - Created `scripts/generate-discriminators.js` to calculate correct values
   - Updated `client-v2.ts` with correct discriminators for all 9 instructions
   - See: [TECHNICAL_FIXES_OCT_2025.md](./TECHNICAL_FIXES_OCT_2025.md#issue-1)

2. **INIT_SPACE Calculation** - Fixed missing 4 bytes causing AccountDidNotDeserialize (0xbbb)
   - Missing length prefix for `encrypted_index` Vec in master_lockbox.rs
   - Account deserialization failed immediately after creation
   - Fixed: Changed INIT_SPACE from 102 to 106 bytes
   - See: [TECHNICAL_FIXES_OCT_2025.md](./TECHNICAL_FIXES_OCT_2025.md#issue-2)

3. **UI Error Handling** - Fixed missing "Initialize Lockbox" button
   - Context treated "account not found" as error instead of expected state
   - Updated LockboxV2Context.tsx to clear error for uninitialized accounts
   - See: [TECHNICAL_FIXES_OCT_2025.md](./TECHNICAL_FIXES_OCT_2025.md#issue-3)

4. **Lazy Session Initialization** - Eliminated double signature prompts
   - Users were prompted to sign twice: once on connect, once on transaction
   - Session key only needed for encryption/decryption, not viewing vault
   - Deferred session initialization until first CRUD operation
   - Users now sign only once when performing password operations
   - See: [DEPLOYMENT_V2.md](./DEPLOYMENT_V2.md#issue-4-double-signature-prompts-lazy-session-initialization)

### 📚 Documentation
- Added [DEPLOYMENT_V2.md](./DEPLOYMENT_V2.md) - Complete v2 deployment guide
- Added [TECHNICAL_FIXES_OCT_2025.md](./TECHNICAL_FIXES_OCT_2025.md) - Detailed bug analysis
- Updated [README.md](./README.md) with v2 deployment status
- Updated SDK README with v2 documentation

### 🔧 Developer Tools
- Added `npm run generate-discriminators` - Generate instruction discriminators
- Added `npm run test-initialize` - Test master lockbox initialization
- Added `npm run check-lockbox` - Check if master lockbox exists for a wallet
- Added discriminator generation script
- Added test initialization script
- Added lockbox verification utility

### ✨ Features
- Full password manager functionality
- Multi-tier subscription system (Free, Basic, Premium, Enterprise)
- Dynamic storage chunk allocation
- Encrypted search indexes
- Rate limiting and access control

## [2.2.0] - 2025-10-12

### Changed
- **Frontend Migration**: Migrated from Vite to Next.js 15 with Turbopack
  - Improved build performance and developer experience
  - Better production optimizations
  - Enhanced SEO capabilities with server-side rendering
  - Improved mobile responsiveness
- **Project Structure**: Updated to use `nextjs-app/` directory
  - Removed old `app/` directory
  - Updated all documentation references
  - Updated build scripts to use Next.js
- **Documentation**: Cleaned up and finalized for production release
  - Updated README with Next.js instructions
  - Updated deployment guides
  - Clarified project structure

### Removed
- Old Vite-based frontend (replaced with Next.js)
- Unused dependencies and configurations

### Fixed
- Build script paths updated for Next.js app
- Vercel deployment configuration corrected

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
