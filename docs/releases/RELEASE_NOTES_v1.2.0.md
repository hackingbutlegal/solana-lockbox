# Release Notes - Lockbox v1.2.0

**Release Date:** October 12, 2025

## 🎉 What's New

### TypeScript SDK

We're excited to announce the official TypeScript SDK for Lockbox! This makes it incredibly easy to integrate wallet-tied encrypted storage into your Solana applications.

#### Quick Start

```bash
npm install lockbox-solana-sdk
```

```typescript
import { LockboxClient } from 'lockbox-solana-sdk';

const client = new LockboxClient({ connection, wallet });

// Store encrypted data
await client.store('My secret message');

// Retrieve and decrypt
const data = await client.retrieve();
```

#### Key Features

- **Full TypeScript Support**: Complete type definitions and IntelliSense
- **Simplified API**: No need to handle encryption manually
- **Automatic Key Derivation**: Session keys derived from wallet signatures
- **Error Handling**: Clear error messages and type-safe exceptions
- **React Hooks**: Example integration with React applications
- **Well Documented**: Comprehensive API reference and examples

### IDL Generation

The program now includes a complete Interface Definition Language (IDL) file:

- **Location**: `target/idl/lockbox.json`
- **Type Safety**: Full TypeScript types generated from IDL
- **Cross-Platform**: Use with any language that supports Anchor IDL
- **Documentation**: Embedded documentation in IDL format

### Enhanced Documentation

#### New Documentation Files

1. **SDK README** (`sdk/README.md`)
   - Complete API reference
   - Installation instructions
   - Usage examples
   - React integration guide

2. **Developer Guide** (`DEVELOPER_GUIDE.md`)
   - In-depth integration tutorial
   - Advanced usage patterns
   - Security best practices
   - Troubleshooting guide
   - Complete React examples

3. **Changelog** (`CHANGELOG.md`)
   - Detailed version history
   - Migration guides
   - Breaking changes documentation

#### Updated Documentation

- **Main README**: Added SDK quick start section
- **Project Structure**: Updated to include SDK directory
- **Recent Updates**: New v1.2.0 highlights

## 📦 What's Included

### SDK Package Structure

```
sdk/
├── src/
│   ├── index.ts          # Main SDK exports
│   ├── types.ts          # TypeScript type definitions
│   └── idl/
│       └── lockbox.json  # Program IDL
├── dist/                 # Compiled JavaScript
├── package.json
├── tsconfig.json
└── README.md
```

### Key SDK Components

#### `LockboxClient` Class

The main class for interacting with the Lockbox program:

- `store(plaintext)` - Encrypt and store data
- `retrieve()` - Retrieve and decrypt data
- `exists()` - Check if lockbox exists
- `getAccount()` - Get raw account data
- `getLockboxAddress()` - Get PDA address
- `getRentExemption()` - Calculate rent cost

#### Utilities

- `utils.getLockboxAddress()` - Get PDA for any user
- `utils.getAccountSize()` - Get account size
- `utils.validateSize()` - Validate plaintext size

#### Constants

- `PROGRAM_ID` - Program ID on devnet
- `FEE_LAMPORTS` - Fee per operation (0.001 SOL)
- `MAX_ENCRYPTED_SIZE` - Maximum data size (1024 bytes)
- `COOLDOWN_SLOTS` - Cooldown period (10 slots)

## 🔧 Migration Guide

### For Developers Using Direct Program Calls

**Before (v1.1.0):**
```typescript
const [lockboxPda] = PublicKey.findProgramAddressSync(
  [Buffer.from('lockbox'), wallet.publicKey.toBuffer()],
  programId
);

const tx = await program.methods
  .storeEncrypted(ciphertext, nonce, salt)
  .accounts({
    lockbox: lockboxPda,
    user: wallet.publicKey,
    feeReceiver: feeReceiverPubkey,
    systemProgram: SystemProgram.programId,
  })
  .rpc();
```

**After (v1.2.0):**
```typescript
import { LockboxClient } from 'lockbox-solana-sdk';

const client = new LockboxClient({ connection, wallet });
const signature = await client.store('My secret data');
```

The SDK handles:
- ✅ Key derivation from wallet signatures
- ✅ Encryption/decryption with XChaCha20-Poly1305
- ✅ PDA address calculation
- ✅ Account initialization
- ✅ Fee payment
- ✅ Error handling

## 📚 Documentation Links

### For End Users
- **Main README**: [README.md](./README.md)
- **Security Model**: [SECURITY.md](./SECURITY.md)

### For Developers
- **SDK Documentation**: [sdk/README.md](./sdk/README.md)
- **Developer Guide**: [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md)
- **API Reference**: [API.md](./API.md)
- **Changelog**: [CHANGELOG.md](./CHANGELOG.md)

### For Deployment
- **Deployment Instructions**: [DEPLOYMENT.md](./DEPLOYMENT.md)
- **Deploy to Devnet**: [DEPLOY_INSTRUCTIONS.md](./DEPLOY_INSTRUCTIONS.md)

## 🔒 Security

No changes to the security model. The SDK maintains the same security guarantees:

- ✅ Client-side encryption only
- ✅ Zero persistent key storage
- ✅ Wallet-derived session keys
- ✅ AEAD encryption (XChaCha20-Poly1305)
- ✅ Rate limiting protection
- ✅ PDA-based access control

## 🐛 Bug Fixes

- Fixed Anchor build warnings for IDL generation
- Improved type safety in SDK
- Better error messages for common issues

## 🚀 What's Next (v1.3.0)

Planned features for the next release:

- [ ] Multi-device sync support
- [ ] Versioned encryption for algorithm upgrades
- [ ] Shared lockboxes with multi-sig
- [ ] Data expiration/auto-deletion
- [ ] Backup recovery mechanisms
- [ ] Mainnet deployment guide
- [ ] npm package publication

## 🙏 Contributors

- [@0xgraffito](https://x.com/0xgraffito) - Creator and maintainer

## 📝 Feedback

We'd love to hear your feedback! Please:

- Report bugs: [GitHub Issues](https://github.com/hackingbutlegal/lockbox/issues)
- Request features: [GitHub Discussions](https://github.com/hackingbutlegal/lockbox/discussions)
- Follow updates: [@0xgraffito](https://x.com/0xgraffito)

## 🔗 Links

- **Live Application**: https://lockbox-hackingbutlegals-projects.vercel.app
- **GitHub Repository**: https://github.com/hackingbutlegal/lockbox
- **Solana Explorer**: [View Program](https://explorer.solana.com/address/5nr7xe1U3k6U6zPEmW3FCbPyXCa7jr7JpudaLKuVNyvZ?cluster=devnet)

---

**Full Changelog**: [v1.1.0...v1.2.0](./CHANGELOG.md)

Thank you for using Lockbox! 🔒
