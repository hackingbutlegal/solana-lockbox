# Lockbox v2.0 Architecture & Design Principles

## Core Philosophy: Frontend-Agnostic Design

**CRITICAL PRINCIPLE**: The Lockbox v2.0 password manager is architected as a **frontend-agnostic platform**. Any developer should be able to build their own frontend interface that fully interacts with the Solana program and SDK without any loss of functionality.

### Why Frontend-Agnostic?

1. **Decentralization**: Users aren't locked into a single interface or provider
2. **Innovation**: Developers can build specialized UIs (mobile, browser extensions, CLI, etc.)
3. **Resilience**: If one frontend goes down, others continue to work
4. **User Choice**: Users pick the interface that best suits their needs
5. **Open Ecosystem**: Encourages community contributions and alternative implementations

### Design Guarantees

The following guarantees ensure frontend interoperability:

#### 1. **On-Chain State is the Single Source of Truth**

All password data, metadata, and state live on-chain in the Solana program accounts:

- `MasterLockbox` account stores vault metadata, subscription status, storage chunks list
- `StorageChunk` accounts store encrypted password entries
- Entry headers contain all metadata (title hash, type, category, timestamps, flags)
- No frontend-specific data or dependencies

**Guarantee**: Any frontend reading the same PDAs will see identical data.

#### 2. **Deterministic Encryption**

Encryption keys are derived from wallet signatures using a deterministic process:

```
User Wallet Signature → HKDF/SHA-512 → Session Key → Encrypt/Decrypt
```

- Same wallet + same signature message = same session key
- No frontend-specific encryption schemes
- Standard XChaCha20-Poly1305 AEAD (libsodium/tweetnacl)
- Nonce stored with ciphertext on-chain

**Guarantee**: Any frontend using the same wallet signature will decrypt the same data.

#### 3. **Standardized Data Format**

All encrypted entries use a standard JSON schema:

```json
{
  "id": 123,
  "type": 0,
  "title": "GitHub",
  "username": "user@example.com",
  "password": "secure_password",
  "url": "https://github.com",
  "notes": "My GitHub account",
  "category": 1,
  "tags": ["work", "development"],
  "favorite": false,
  "archived": false,
  "createdAt": "2025-01-15T10:30:00Z",
  "lastModified": "2025-01-15T10:30:00Z"
}
```

- Well-defined TypeScript interfaces in SDK
- Backward-compatible schema evolution
- Optional fields for extensibility

**Guarantee**: Any frontend using the SDK's `PasswordEntry` interface will correctly serialize/deserialize entries.

#### 4. **Open-Source SDK**

The TypeScript SDK (`sdk/`) is:

- **MIT/ISC licensed** - free to use, modify, distribute
- **Fully documented** - comprehensive JSDoc comments
- **Type-safe** - complete TypeScript definitions
- **Framework-agnostic** - works with React, Vue, Svelte, vanilla JS, Node.js
- **Well-tested** - (to be implemented)

**Guarantee**: Developers can use the SDK in any JavaScript/TypeScript environment.

#### 5. **Public Program & Reproducible Builds**

The Solana program is:

- **Deployed at a fixed address**: `5nr7xe1U3k6U6zPEmW3FCbPyXCa7jr7JpudaLKuVNyvZ`
- **Verifiable on-chain**: Program code is immutable and auditable
- **Open-source**: Full Rust source available in `programs/lockbox/`
- **Reproducible builds**: Anyone can verify the deployed binary matches source

**Guarantee**: All frontends interact with the exact same on-chain program logic.

#### 6. **No Hidden State or Backend Dependencies**

The architecture explicitly avoids:

- ❌ Backend APIs or databases
- ❌ Centralized servers for key management
- ❌ Proprietary encryption schemes
- ❌ Rate limiting or authentication servers
- ❌ Frontend-specific account linking

**Guarantee**: A frontend only needs:
1. Connection to Solana RPC
2. User's wallet adapter
3. The open-source SDK

## Reference Frontend vs. Alternative Implementations

### This Repository's Frontend (`nextjs-app/`)

The Next.js frontend in this repository is a **reference implementation**:

- Demonstrates best practices
- Shows all features of the SDK
- Provides a polished user experience
- Serves as documentation by example

**It is NOT required** - developers can build completely different interfaces.

### Examples of Alternative Frontends

Developers could build:

1. **Mobile Apps** (React Native, Flutter)
   - Use the SDK with mobile wallet adapters
   - Same encryption, same on-chain data
   - Native mobile UX

2. **Browser Extensions** (Chrome/Firefox)
   - Autofill integration
   - One-click password generation
   - Direct browser integration

3. **CLI Tools** (Node.js)
   - Scripting and automation
   - CI/CD integration
   - Headless password management

4. **Desktop Apps** (Electron, Tauri)
   - Native OS integration
   - Offline-first architecture
   - System tray access

5. **Hardware Wallets** (Ledger/Trezor integration)
   - Enhanced security
   - Hardware-backed encryption
   - Air-gapped operations

6. **Team Dashboards** (Custom Enterprise UI)
   - Admin controls
   - Audit log visualization
   - Team management

### Interoperability Testing

To ensure frontend-agnostic design, we will:

1. **Document the SDK thoroughly** - So any developer can understand it
2. **Write integration tests** - That simulate multiple frontends accessing the same vault
3. **Provide example code** - For different frameworks and use cases
4. **Maintain API stability** - Avoid breaking changes to SDK and program
5. **Version carefully** - Semantic versioning with migration guides

## Technical Implementation Details

### PDA Derivation (Deterministic Addresses)

All accounts use deterministic PDAs that any frontend can derive:

```typescript
// Master Lockbox PDA
seeds = ["master_lockbox", userPublicKey]
programId = "5nr7xe1U3k6U6zPEmW3FCbPyXCa7jr7JpudaLKuVNyvZ"

// Storage Chunk PDA
seeds = ["storage_chunk", masterLockboxPDA, chunkIndex(u16)]

// Any frontend can derive these using the SDK:
const [masterPDA] = client.getMasterLockboxAddress();
const [chunkPDA] = client.getStorageChunkAddress(0);
```

### Encryption Key Derivation (Consistent Across Frontends)

Standard message for wallet signature:

```typescript
const SIGNATURE_MESSAGE = "Sign to access your Lockbox Password Manager";

// Any frontend using this message will derive the same key:
const signature = await wallet.signMessage(SIGNATURE_MESSAGE);
const sessionKey = nacl.hash(signature).slice(0, 32);
```

**Important**: This message should NEVER change, or users won't be able to decrypt their data.

### Blind Index Generation (Searchable Titles)

Standard HMAC-SHA256 process:

```typescript
const titleHash = crypto.createHmac('sha256', sessionKey)
  .update(title.toLowerCase())
  .digest();
```

Any frontend using this process can search the same entries.

### Entry Metadata (On-Chain, Accessible to All)

Entry headers stored on-chain include:

- `entry_id` - Unique identifier
- `offset` - Position in chunk
- `size` - Encrypted data size
- `entry_type` - Login, CreditCard, etc.
- `category` - User-defined category ID
- `title_hash` - Blind index for search
- `created_at` - Unix timestamp
- `last_modified` - Unix timestamp
- `access_count` - Number of retrievals
- `flags` - Favorite, archived, etc.

All frontends can read this metadata without decryption.

## Migration & Upgrade Path

### Future Program Updates

If the program needs updates:

1. **New program version** deployed at new address
2. **Migration instruction** to transfer data
3. **Both versions** supported during transition
4. **SDK updated** to support both
5. **Frontends migrate** at their own pace

### Frontend Compatibility Promise

We commit to:

- **Semantic versioning** for SDK and program
- **Deprecation warnings** 6+ months before breaking changes
- **Migration guides** with code examples
- **Backward compatibility** whenever possible
- **Community input** on architectural decisions

## Testing Frontend Interoperability

### Test Scenario: Multiple Frontends, One Vault

```typescript
// Frontend A (Next.js web app)
const clientA = new LockboxV2Client({ connection, wallet });
await clientA.storePassword({
  title: "Test Entry",
  username: "user@test.com",
  password: "password123",
});

// Frontend B (CLI tool)
const clientB = new LockboxV2Client({ connection, wallet });
const entries = await clientB.listPasswords();
// Should see "Test Entry" from Frontend A

// Frontend C (Mobile app)
const clientC = new LockboxV2Client({ connection, wallet });
const entry = await clientC.retrievePassword(0, 1);
// Should decrypt "Test Entry" with password "password123"
```

All three frontends see the same data because they:
1. Derive the same PDAs
2. Use the same encryption keys
3. Read from the same on-chain accounts
4. Follow the same data format

## Documentation for Alternative Frontend Developers

### Quick Start Guide for Custom Frontends

1. **Install the SDK**:
   ```bash
   npm install lockbox-solana-sdk
   ```

2. **Initialize the client**:
   ```typescript
   import { LockboxV2Client } from 'lockbox-solana-sdk';
   const client = new LockboxV2Client({ connection, wallet });
   ```

3. **Check if vault exists**:
   ```typescript
   const exists = await client.exists();
   if (!exists) await client.initializeMasterLockbox();
   ```

4. **Use the full API**:
   - All methods documented in `sdk/src/client-v2.ts`
   - Full TypeScript types in `sdk/src/types-v2.ts`
   - Helper utilities in `sdk/src/utils.ts`

5. **Follow the reference frontend**:
   - See `nextjs-app/` for implementation examples
   - Component patterns in `nextjs-app/components/`
   - State management in `nextjs-app/lib/`

### Support for Alternative Frontends

We provide:

- **GitHub Discussions** - Ask questions, share implementations
- **Example Code** - Multiple framework examples
- **API Reference** - Complete SDK documentation
- **Integration Tests** - Verify compatibility
- **Community Support** - Help from other developers

## Commitment to Openness

**This is a public good.** The Lockbox v2.0 password manager is designed to be:

- ✅ **Open**: All code is open-source
- ✅ **Permissionless**: Anyone can build a frontend
- ✅ **Interoperable**: All frontends work together
- ✅ **Decentralized**: No single point of failure
- ✅ **User-owned**: Users control their data via their wallet

**Our promise**: We will never introduce features that lock users into our frontend or break compatibility with alternative implementations.

---

## Summary

The Lockbox v2.0 password manager is built on three pillars:

1. **On-chain state** - Single source of truth accessible to all
2. **Standard encryption** - Deterministic, well-documented, reproducible
3. **Open SDK** - Free, documented, framework-agnostic

Any developer can build a frontend that fully interacts with users' password vaults without any loss of functionality. This architecture ensures user freedom, resilience, and innovation in the Lockbox ecosystem.

**Version**: v2.0.0
**Last Updated**: 2025-01-15
**Maintained By**: GRAFFITO (@0xgraffito)
