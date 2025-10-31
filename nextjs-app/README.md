# Solana Lockbox - Password Manager

A decentralized password manager built on Solana blockchain with client-side encryption.

**Current Version**: 2.2.0  
**Last Updated**: 2025-10-15  
**Production Status**: Pre-production (QA improvements in progress)

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [Development Guide](#development-guide)
- [Testing](#testing)
- [Deployment](#deployment)
- [Security](#security)
- [Recent Changes](#recent-changes)
- [Documentation Index](#documentation-index)

## Overview

### What is Solana Lockbox?

Solana Lockbox is a secure, decentralized password manager that stores encrypted password data on the Solana blockchain. It provides:

- **Zero-knowledge encryption** - All encryption happens client-side
- **Blockchain storage** - Data stored on Solana (immutable, verifiable)
- **Wallet authentication** - Sign in with Solana wallet
- **Password health analysis** - Detect weak, reused, or compromised passwords
- **Import/export** - Support for Bitwarden, LastPass, 1Password
- **Subscription tiers** - Free, Standard, Premium storage tiers

### Tech Stack

- **Frontend**: Next.js 15.5.4 (React 19, TypeScript)
- **Blockchain**: Solana (Devnet), Anchor Framework
- **Wallet**: Solana Wallet Adapter (Phantom, Solflare, etc.)
- **Encryption**: AES-256-GCM via Web Crypto API
- **Key Derivation**: HKDF with wallet signatures
- **Testing**: Jest 29+ with React Testing Library
- **Styling**: Tailwind CSS

### Key Features

#### Core Functionality
- ✅ Password CRUD operations (create, read, update, delete)
- ✅ Multi-wallet support
- ✅ Session management with timeout (15 min absolute, 5 min inactivity)
- ✅ Encrypted search with blind indexes
- ✅ Batch operations (multi-select, bulk update/delete)
- ✅ Password categories and tags
- ✅ Favorites and archive
- ✅ TOTP 2FA code generation

#### Security Features
- ✅ Client-side AES-256-GCM encryption
- ✅ HKDF key derivation from wallet signatures
- ✅ Domain separation (session keys vs search keys)
- ✅ CSV injection protection on export
- ✅ Session timeout enforcement
- ✅ Secure memory wiping
- ✅ Password health analysis (entropy, patterns, common passwords)

#### Recent Additions (Oct 2025)
- ✅ **Batched updates** - Queue multiple changes, sync once
- ✅ **Comprehensive test suite** - 193 tests covering core modules
- ✅ **Standardized error handling** - Error classes with recovery guidance
- ✅ **QA improvements** - Security fixes and reliability enhancements

## Quick Start

### Prerequisites

```bash
# Required versions
Node.js >= 18.x
npm >= 9.x
Solana CLI >= 1.18.x
Anchor >= 0.30.x

# Optional (for development)
Rust >= 1.75.x (if modifying program)
```

### Installation

```bash
# Clone repository
git clone https://github.com/hackingbutlegal/solana-lockbox.git
cd solana-lockbox/nextjs-app

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your configuration

# Run development server
npm run dev

# Open http://localhost:3000
```

### Environment Variables

Required variables in `.env.local`:

```bash
# Solana Configuration
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_PROGRAM_ID=7JxsHjdReydiz36jwsWuvwwR28qqK6V454VwFJnnSkoB

# Optional: Custom RPC (recommended for production)
# NEXT_PUBLIC_SOLANA_RPC_URL=https://your-custom-rpc.com
```

### First-Time Setup

1. **Install a Solana wallet** (Phantom, Solflare, etc.)
2. **Get devnet SOL** from https://faucet.solana.com
3. **Connect wallet** in the app
4. **Initialize master lockbox** (one-time setup, costs ~0.01 SOL)
5. **Start adding passwords**

## Architecture

### High-Level Overview

```
┌─────────────────┐
│   Next.js App   │
│   (Frontend)    │
└────────┬────────┘
         │
         ├─ Contexts (React)
         │  ├─ AuthContext (session management)
         │  ├─ PasswordContext (CRUD + batching)
         │  ├─ LockboxContext (blockchain interaction)
         │  └─ SubscriptionContext
         │
         ├─ SDK (client-v2.ts)
         │  ├─ LockboxV2Client (Anchor program wrapper)
         │  ├─ Encryption/Decryption
         │  └─ Transaction building
         │
         └─ Solana Program (Anchor)
            ├─ Master Lockbox (account metadata)
            ├─ Storage Chunks (encrypted data)
            └─ Subscription management
```

### Key Components

#### Contexts (React State Management)

1. **AuthContext** (`contexts/AuthContext.tsx`)
   - Wallet connection
   - Session key derivation (HKDF)
   - Session timeout tracking
   - Client instance creation

2. **PasswordContext** (`contexts/PasswordContext.tsx`)
   - Password CRUD operations
   - **Batched updates** (new)
   - Optimistic UI updates
   - Pending changes management

3. **LockboxContext** (`contexts/LockboxContext.tsx`)
   - Master lockbox initialization
   - Blockchain state management
   - Storage chunk tracking

4. **SubscriptionContext** (`contexts/SubscriptionContext.tsx`)
   - Subscription tier management
   - Storage capacity tracking
   - Upgrade/downgrade operations

#### SDK (`sdk/src/`)

- **client-v2.ts** - Main Anchor program client (2,241 lines)
- **types-v2.ts** - TypeScript type definitions
- **utils.ts** - Helper functions

#### Core Libraries (`lib/`)

- **crypto.ts** - HKDF, session keys, encryption
- **password-health-analyzer.ts** - Entropy, patterns, common passwords
- **search-manager.ts** - Blind index, fuzzy search
- **batch-operations.ts** - Multi-select, bulk operations
- **pending-changes-manager.ts** - Local change tracking (new)
- **import-export.ts** - CSV/JSON import/export with injection protection
- **validation-schemas.ts** - Zod schemas for input validation
- **errors.ts** - Standardized error classes (new)

### Data Flow

#### Password Storage Flow

```
User Input → Validation → Encryption → Blockchain Transaction
                                    ↓
                              Storage Chunk
                                    ↓
                              Entry Header (metadata)
                              + Encrypted Data
```

#### Password Retrieval Flow

```
Blockchain Query → Fetch Chunk → Decrypt Data → Display in UI
```

#### Batched Updates Flow (New)

```
User Edits → Queue Locally → Optimistic UI Update
                          ↓
                    Pending Changes Manager
                          ↓
                    User clicks "Sync"
                          ↓
                    Batch Transaction → Blockchain
```

### On-Chain Data Structure

```rust
// Master Lockbox (per user)
pub struct MasterLockbox {
    pub owner: Pubkey,                // User's wallet
    pub entry_count: u64,             // Total entries
    pub chunk_count: u16,             // Number of chunks
    pub subscription_tier: SubscriptionTier,
    pub subscription_expiry: i64,
    // ... metadata
}

// Storage Chunk (up to 50 entries per chunk)
pub struct StorageChunk {
    pub master_lockbox: Pubkey,       // Parent lockbox
    pub chunk_index: u16,             // Chunk number
    pub entry_headers: Vec<EntryHeader>,  // Entry metadata
    pub encrypted_data: Vec<u8>,      // Encrypted entry data
}

// Entry Header (unencrypted metadata)
pub struct EntryHeader {
    pub entry_id: u64,
    pub entry_type: u8,
    pub offset: u32,                  // Offset in encrypted_data
    pub size: u32,                    // Size of encrypted entry
    pub created_at: i64,
    pub last_modified: i64,
}
```

## Development Guide

### Project Structure

```
nextjs-app/
├── app/                    # Next.js 15 app directory
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── components/            # React components
│   ├── features/          # Feature-specific components
│   ├── layout/            # Layout components
│   ├── modals/            # Modal dialogs
│   └── ui/                # Reusable UI components
├── contexts/              # React contexts (state management)
├── lib/                   # Core libraries and utilities
│   └── __tests__/         # Unit tests
├── sdk/                   # Solana program SDK
│   └── src/
│       ├── client-v2.ts   # Main client
│       ├── types-v2.ts    # TypeScript types
│       └── idl/           # Anchor IDL files
├── public/                # Static assets
├── docs/                  # Documentation
└── scripts/               # Build/deploy scripts
```

### Development Workflow

#### 1. Running the Development Server

```bash
npm run dev
# Server runs on http://localhost:3000
```

#### 2. Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test -- lib/__tests__/crypto.test.ts

# Watch mode (TDD)
npm test -- --watch
```

#### 3. Linting and Type Checking

```bash
# TypeScript type check
npm run type-check

# ESLint
npm run lint

# Format with Prettier
npm run format
```

#### 4. Building for Production

```bash
npm run build
# Output in .next/ directory
```

### Adding New Features

#### Example: Adding a New Password Operation

1. **Add SDK method** in `sdk/src/client-v2.ts`:
```typescript
async myNewOperation(param: string): Promise<Result> {
  // Build instruction
  // Send transaction
  // Return result
}
```

2. **Add context method** in `contexts/PasswordContext.tsx`:
```typescript
const myOperation = useCallback(async (param: string) => {
  await checkSessionTimeout();
  await client.myNewOperation(param);
  await refreshEntries();
}, [client, checkSessionTimeout, refreshEntries]);
```

3. **Add UI component** in `components/features/`:
```typescript
export function MyFeature() {
  const { myOperation } = usePassword();
  // Implement UI
}
```

4. **Add tests** in `lib/__tests__/`:
```typescript
describe('myNewOperation', () => {
  it('should work correctly', () => {
    // Test implementation
  });
});
```

### Common Development Tasks

#### Connecting to a Different Network

Edit `.env.local`:
```bash
# Mainnet
NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.mainnet-beta.solana.com

# Devnet (default)
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com

# Localnet
NEXT_PUBLIC_SOLANA_NETWORK=localnet
NEXT_PUBLIC_SOLANA_RPC_URL=http://localhost:8899
```

#### Deploying a New Program Version

See [DEPLOYMENT.md](./docs/DEPLOYMENT.md) for full guide.

#### Debugging

```typescript
// Enable debug logging
localStorage.setItem('DEBUG', 'lockbox:*');

// View decryption errors
console.log(window.__lockboxDecryptionErrors);

// View pending transactions
console.log(client.pendingTransactions);
```

## Testing

### Test Infrastructure

- **Framework**: Jest 29+ with Next.js integration
- **Environment**: jsdom for DOM simulation
- **Coverage Target**: 60% (all metrics)
- **Current Coverage**: ~18% overall, 95% for tested modules

### Test Organization

```
lib/__tests__/
├── crypto.test.ts                    # Cryptographic operations (297 lines)
├── password-health-analyzer.test.ts  # Password analysis (414 lines)
├── import-export.test.ts             # Import/export + CSV injection (492 lines)
├── search-manager.test.ts            # Search and filtering (650+ lines)
└── batch-operations.test.ts          # Batch operations (700+ lines)
```

### Running Tests

```bash
# All tests
npm test

# With coverage report
npm test -- --coverage

# Watch mode
npm test -- --watch

# Specific test file
npm test -- lib/__tests__/crypto.test.ts

# View coverage report
open coverage/lcov-report/index.html
```

### Test Coverage by Module

| Module | Statements | Branches | Functions | Lines | Status |
|--------|-----------|----------|-----------|-------|--------|
| **batch-operations.ts** | 94.77% | 81.08% | 100% | 95.07% | ✅ Excellent |
| **password-health-analyzer.ts** | 87.96% | 80.59% | 86.36% | 88.55% | ✅ Excellent |
| **validation-schemas.ts** | 81.98% | 78.57% | 85.71% | 92.68% | ✅ Good |
| **import-export.ts** | 67.8% | 57.38% | 78.57% | 67.51% | ✅ Good |
| **search-manager.ts** | 41.42% | 45.45% | 55.88% | 40.82% | ⚠️ Needs improvement |

**Next Steps for Testing**:
- Add React Context tests (AuthContext, PasswordContext, etc.)
- Add SDK integration tests
- Reach 60% overall coverage

See [TEST_IMPLEMENTATION_SUMMARY.md](./TEST_IMPLEMENTATION_SUMMARY.md) for details.

## Deployment

### Prerequisites

- Vercel account (recommended) or any Node.js hosting
- Custom Solana RPC endpoint (recommended for production)
- Domain name (optional)

### Deployment Steps

1. **Set production environment variables** in Vercel:
```bash
NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta
NEXT_PUBLIC_SOLANA_RPC_URL=https://your-rpc.com
NEXT_PUBLIC_PROGRAM_ID=7JxsHjdReydiz36jwsWuvwwR28qqK6V454VwFJnnSkoB
```

2. **Deploy to Vercel**:
```bash
npm install -g vercel
vercel --prod
```

3. **Verify deployment**:
- Test wallet connection
- Test password CRUD
- Test import/export
- Monitor for errors

### Monitoring

- **Console Errors**: Check browser console for client-side errors
- **RPC Errors**: Monitor RPC endpoint rate limits
- **Performance**: Use Vercel Analytics or similar

## Security

### Security Model

1. **Zero-Knowledge Architecture**
   - All encryption/decryption happens client-side
   - Server/blockchain never sees plaintext
   - Wallet signature never leaves client

2. **Encryption**
   - Algorithm: AES-256-GCM
   - Key derivation: HKDF-SHA256
   - Session keys: Derived from wallet signature
   - Search keys: Separate domain (HKDF with different info string)

3. **Session Management**
   - Absolute timeout: 15 minutes
   - Inactivity timeout: 5 minutes
   - Automatic session clearing
   - Secure memory wiping

### Recent Security Improvements (Oct 2025)

✅ **Fixed**: Session key storage (class-based instead of WeakMap)  
✅ **Added**: CSV injection protection (6 attack vectors)  
✅ **Expanded**: Common password list (300+)  
✅ **Added**: Immediate session timeout checks  
✅ **Added**: Standardized error handling

See [QA_ANALYSIS_REPORT.md](./QA_ANALYSIS_REPORT.md) for full security audit.

### Security Best Practices

1. **For Users**:
   - Use a strong wallet password
   - Don't share wallet private key
   - Sign out when done
   - Use unique passwords for entries

2. **For Developers**:
   - Never log sensitive data
   - Always validate user input
   - Check session before sensitive operations
   - Use standardized error classes
   - Run security audits regularly

## Recent Changes

### October 2025 - QA Improvements & Batched Updates

#### Major Features Added

1. **Batched Updates System**
   - Queue multiple password changes locally
   - Sync all changes to blockchain at once
   - Optimistic UI updates (instant feedback)
   - Visual pending changes notification
   - Rollback support (discard changes)

2. **Comprehensive Test Suite**
   - 193 passing tests
   - 5 test files covering core modules
   - 95% coverage for batch operations
   - 88% coverage for password health analyzer
   - Security validation tests (CSV injection, session timeout, etc.)

3. **Security Enhancements**
   - Fixed session key storage vulnerability
   - Added CSV injection protection
   - Expanded common password detection (100 → 300+)
   - Added immediate session timeout checks
   - Implemented standardized error handling

#### Bug Fixes

- Fixed circular dependency in AuthContext (clearSession before checkSessionTimeout)
- Fixed pending transaction tracking
- Improved error messages for listPasswords()

#### Documentation Updates

- TEST_IMPLEMENTATION_SUMMARY.md - Complete test coverage analysis
- BATCHED_UPDATES.md - Batched updates API reference
- BATCHED_UPDATES_EXAMPLE.tsx - Integration examples
- QA_ANALYSIS_REPORT.md - Security audit findings

### Commits (Recent)

```
d4b2274 - Implement batched updates system for password entries
a3af487 - Implement comprehensive test suite for core modules
10530bf - Fix circular dependency in AuthContext
803ab4c - Implement comprehensive orphaned chunk prevention system
45892f0 - Improve storePassword error handling
```

## Documentation Index

### User Guides
- [README.md](./README.md) - This file (project overview)
- [SETUP_GUIDE.md](./docs/SETUP_GUIDE.md) - Detailed setup instructions
- [USER_GUIDE.md](./docs/USER_GUIDE.md) - End-user documentation

### Developer Guides
- [DEVELOPMENT.md](./docs/DEVELOPMENT.md) - Development guide
- [API_REFERENCE.md](./docs/API_REFERENCE.md) - Complete API documentation
- [ARCHITECTURE.md](./docs/ARCHITECTURE.md) - System architecture
- [TESTING_GUIDE.md](./docs/TESTING_GUIDE.md) - Testing best practices

### Feature Documentation
- [BATCHED_UPDATES.md](./docs/BATCHED_UPDATES.md) - Batched updates system
- [BATCHED_UPDATES_EXAMPLE.tsx](./docs/BATCHED_UPDATES_EXAMPLE.tsx) - Usage examples
- [SEARCH.md](./docs/SEARCH.md) - Search and filtering
- [IMPORT_EXPORT.md](./docs/IMPORT_EXPORT.md) - Import/export guide

### Operations
- [DEPLOYMENT.md](./docs/DEPLOYMENT.md) - Deployment guide
- [TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md) - Common issues
- [CHANGELOG.md](./CHANGELOG.md) - Version history

### Quality Assurance
- [QA_ANALYSIS_REPORT.md](./QA_ANALYSIS_REPORT.md) - Security audit (Oct 2025)
- [TEST_IMPLEMENTATION_SUMMARY.md](./TEST_IMPLEMENTATION_SUMMARY.md) - Test coverage
- [KNOWN_ISSUES.md](./docs/KNOWN_ISSUES.md) - Current issues and workarounds
- [ROADMAP.md](./docs/ROADMAP.md) - Future plans

## Contributing

### Code Style

- **TypeScript**: Strict mode enabled
- **React**: Hooks-based, functional components
- **Formatting**: Prettier with 2-space indents
- **Naming**: camelCase for functions, PascalCase for components

### Pull Request Process

1. Create feature branch from `main`
2. Write tests for new features
3. Ensure all tests pass (`npm test`)
4. Update documentation
5. Submit PR with clear description

### Commit Message Format

```
<type>: <subject>

<body>

<footer>
```

Types: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`

## Support

- **GitHub Issues**: https://github.com/hackingbutlegal/solana-lockbox/issues
- **Discord**: Coming soon
- **Email**: feedback@web3stud.io

## License

[Your License]

## Acknowledgments

- Solana Foundation
- Anchor Framework team
- Web Crypto API contributors

---

**Last Updated**: 2025-10-15  
**Maintainers**: [Your Team]  
**Version**: 2.2.0
