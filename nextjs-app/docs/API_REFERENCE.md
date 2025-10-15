# API Reference

Complete API documentation for Solana Lockbox.

## Table of Contents

- [Contexts](#contexts)
  - [AuthContext](#authcontext)
  - [PasswordContext](#passwordcontext)
  - [LockboxContext](#lockboxcontext)
  - [SubscriptionContext](#subscriptioncontext)
- [SDK Client](#sdk-client)
- [Core Libraries](#core-libraries)
- [Type Definitions](#type-definitions)

## Contexts

### AuthContext

Session management and wallet authentication.

**Location**: `contexts/AuthContext.tsx`

#### Hook

```typescript
import { useAuth } from '../contexts/AuthContext';

function MyComponent() {
  const auth = useAuth();
  // ...
}
```

#### API

##### `client: LockboxV2Client | null`
The Anchor program client instance. `null` if wallet not connected.

##### `isSessionActive: boolean`
Whether a session is currently active (user has signed the challenge).

##### `sessionTimeRemaining: number | null`
Seconds remaining until session timeout. `null` if no active session.

##### `initializeSession(): Promise<boolean>`
Initialize a new session by prompting user to sign a challenge message.

**Returns**: `true` if successful, `false` otherwise.

**Example**:
```typescript
const success = await initializeSession();
if (success) {
  console.log('Session initialized!');
}
```

##### `clearSession(): void`
Clear the current session and wipe sensitive data from memory.

**Example**:
```typescript
clearSession();
// User must re-sign to access passwords
```

##### `updateActivity(): void`
Update the last activity timestamp to prevent inactivity timeout.

**Call this**: On any user interaction with sensitive data.

##### `checkSessionTimeout(): void`
Immediately check if session has timed out. Throws error if expired.

**Throws**: `Error` if session expired.

**Example**:
```typescript
try {
  checkSessionTimeout();
  // Proceed with sensitive operation
} catch (err) {
  // Session expired, re-authenticate
}
```

##### `loading: boolean`
True during session initialization.

##### `error: string | null`
Error message if session initialization failed.

#### Session Timeouts

- **Absolute timeout**: 15 minutes from session start
- **Inactivity timeout**: 5 minutes since last activity
- **Check interval**: Every 30 seconds

---

### PasswordContext

Password CRUD operations and batched updates.

**Location**: `contexts/PasswordContext.tsx`

#### Hook

```typescript
import { usePassword } from '../contexts/PasswordContext';

function MyComponent() {
  const password = usePassword();
  // ...
}
```

#### API

##### `entries: PasswordEntry[]`
Array of all password entries.

##### Immediate Operations

###### `refreshEntries(): Promise<void>`
Fetch all entries from blockchain and decrypt.

**Example**:
```typescript
await refreshEntries();
console.log('Entries refreshed:', entries);
```

###### `createEntry(entry: PasswordEntry): Promise<number | null>`
Create a new password entry immediately (sends transaction).

**Parameters**:
- `entry: PasswordEntry` - The entry to create

**Returns**: Entry ID if successful, `null` otherwise.

**Example**:
```typescript
const newEntry: PasswordEntry = {
  type: PasswordEntryType.Login,
  title: 'GitHub',
  username: 'myusername',
  password: 'MyP@ssw0rd!',
  url: 'https://github.com',
  createdAt: new Date(),
  lastModified: new Date(),
};

const entryId = await createEntry(newEntry);
```

###### `updateEntry(chunkIndex: number, entryId: number, entry: PasswordEntry): Promise<boolean>`
Update an existing entry immediately (sends transaction).

**Parameters**:
- `chunkIndex: number` - Chunk index containing the entry
- `entryId: number` - Entry ID to update
- `entry: PasswordEntry` - Updated entry data

**Returns**: `true` if successful.

**Example**:
```typescript
const success = await updateEntry(0, 1, updatedEntry);
```

###### `deleteEntry(chunkIndex: number, entryId: number): Promise<boolean>`
Delete an entry immediately (sends transaction).

**Parameters**:
- `chunkIndex: number` - Chunk index containing the entry
- `entryId: number` - Entry ID to delete

**Returns**: `true` if successful.

**Example**:
```typescript
const success = await deleteEntry(0, 1);
```

##### Batched Operations

###### `queueUpdate(chunkIndex: number, entryId: number, entry: PasswordEntry): void`
Queue an update locally without sending transaction. UI updates instantly.

**Parameters**:
- `chunkIndex: number` - Chunk index
- `entryId: number` - Entry ID
- `entry: PasswordEntry` - Updated entry data

**Example**:
```typescript
queueUpdate(0, 1, updatedEntry);
// UI updates immediately, no blockchain wait
```

###### `queueDelete(chunkIndex: number, entryId: number): void`
Queue a delete locally without sending transaction. UI updates instantly.

**Parameters**:
- `chunkIndex: number` - Chunk index
- `entryId: number` - Entry ID

**Example**:
```typescript
queueDelete(0, 1);
// Entry removed from UI immediately
```

###### `syncPendingChanges(): Promise<boolean>`
Sync all pending changes to blockchain.

**Returns**: `true` if all changes synced successfully.

**Example**:
```typescript
const success = await syncPendingChanges();
if (success) {
  console.log('All changes synced!');
}
```

###### `discardPendingChanges(): Promise<void>`
Discard all pending changes and revert to blockchain state.

**Example**:
```typescript
await discardPendingChanges();
// UI reverts to last synced state
```

##### Pending Changes State

###### `pendingChanges: PendingChange[]`
Array of pending changes.

###### `pendingStats: ChangeStats`
Statistics about pending changes.

```typescript
interface ChangeStats {
  total: number;        // Total pending changes
  creates: number;      // Number of creates
  updates: number;      // Number of updates
  deletes: number;      // Number of deletes
  affectedEntries: number; // Unique entries affected
}
```

###### `hasPendingChanges: boolean`
Whether there are any pending changes.

##### Loading State

###### `loading: boolean`
True during immediate operations (create/update/delete).

###### `syncing: boolean`
True during sync operation.

###### `error: string | null`
Error message if operation failed.

---

### LockboxContext

Master lockbox state management.

**Location**: `contexts/LockboxContext.tsx`

#### Hook

```typescript
import { useLockbox } from '../contexts/LockboxContext';

function MyComponent() {
  const lockbox = useLockbox();
  // ...
}
```

#### API

##### `masterLockbox: MasterLockbox | null`
The user's master lockbox account data. `null` if not initialized.

```typescript
interface MasterLockbox {
  owner: PublicKey;
  entryCount: bigint;
  chunkCount: number;
  subscriptionTier: SubscriptionTier;
  subscriptionExpiry: bigint;
  createdAt: bigint;
  lastModified: bigint;
}
```

##### `refreshLockbox(): Promise<void>`
Fetch latest master lockbox data from blockchain.

##### `initializeLockbox(): Promise<boolean>`
Initialize a new master lockbox (one-time setup).

**Cost**: ~0.01 SOL

**Returns**: `true` if successful.

##### `loading: boolean`
True during operations.

##### `error: string | null`
Error message if operation failed.

---

### SubscriptionContext

Subscription tier management.

**Location**: `contexts/SubscriptionContext.tsx`

#### Hook

```typescript
import { useSubscription } from '../contexts/SubscriptionContext';

function MyComponent() {
  const subscription = useSubscription();
  // ...
}
```

#### API

##### `currentTier: SubscriptionTier`
Current subscription tier.

```typescript
enum SubscriptionTier {
  Free = 0,
  Standard = 1,
  Premium = 2,
}
```

##### `storageUsed: number`
Number of entries stored.

##### `storageLimit: number`
Maximum entries allowed for current tier.

##### `isNearLimit: boolean`
True if storage usage > 80% of limit.

##### `upgradeSubscription(newTier: SubscriptionTier): Promise<boolean>`
Upgrade to a higher tier.

**Returns**: `true` if successful.

##### `renewSubscription(): Promise<boolean>`
Renew current subscription for another period.

**Returns**: `true` if successful.

---

## SDK Client

### LockboxV2Client

Main client for interacting with the Anchor program.

**Location**: `sdk/src/client-v2.ts`

#### Constructor

```typescript
import { LockboxV2Client } from '../sdk/src/client-v2';

const client = new LockboxV2Client({
  connection: new Connection(rpcUrl),
  wallet: walletAdapter,
  programId: new PublicKey(PROGRAM_ID),
});
```

#### Methods

##### `initializeMasterLockbox(): Promise<string>`
Initialize a new master lockbox.

**Returns**: Transaction signature.

**Throws**: Error if already initialized or insufficient funds.

##### `storePassword(entry: PasswordEntry): Promise<{ signature: string; entryId: number }>`
Store a new encrypted password entry.

**Parameters**:
- `entry: PasswordEntry` - Entry to store

**Returns**: Transaction signature and entry ID.

**Example**:
```typescript
const result = await client.storePassword(newEntry);
console.log('Stored entry:', result.entryId);
```

##### `retrievePassword(chunkIndex: number, entryId: number, sessionKey: Uint8Array): Promise<PasswordEntry>`
Retrieve and decrypt a password entry.

**Parameters**:
- `chunkIndex: number` - Chunk index
- `entryId: number` - Entry ID
- `sessionKey: Uint8Array` - Session key for decryption

**Returns**: Decrypted entry.

##### `updatePassword(chunkIndex: number, entryId: number, entry: PasswordEntry): Promise<string>`
Update an existing password entry.

**Parameters**:
- `chunkIndex: number` - Chunk index
- `entryId: number` - Entry ID
- `entry: PasswordEntry` - Updated entry

**Returns**: Transaction signature.

##### `deletePassword(chunkIndex: number, entryId: number): Promise<string>`
Delete a password entry.

**Parameters**:
- `chunkIndex: number` - Chunk index
- `entryId: number` - Entry ID

**Returns**: Transaction signature.

##### `listPasswords(): Promise<{ entries: PasswordEntry[]; errors: DecryptionError[] }>`
List all password entries (decrypted).

**Returns**: Object with entries array and any decryption errors.

**Example**:
```typescript
const { entries, errors } = await client.listPasswords();
console.log('Loaded entries:', entries.length);
if (errors.length > 0) {
  console.warn('Decryption errors:', errors);
}
```

---

## Core Libraries

### Crypto

**Location**: `lib/crypto.ts`

#### Functions

##### `generateChallenge(publicKey: PublicKey): Uint8Array`
Generate a challenge message for wallet signing.

**Parameters**:
- `publicKey: PublicKey` - User's wallet public key

**Returns**: Challenge message (UTF-8 encoded).

##### `createSessionKeyFromSignature(publicKey: PublicKey, signature: Uint8Array): Promise<{ sessionKey: Uint8Array }>`
Derive a session key from wallet signature using HKDF.

**Parameters**:
- `publicKey: PublicKey` - Wallet public key
- `signature: Uint8Array` - Signed challenge (64 bytes)

**Returns**: Session key (32 bytes).

##### `deriveSearchKey(publicKey: PublicKey, signature: Uint8Array): Promise<Uint8Array>`
Derive a search key (separate from session key).

**Returns**: Search key (32 bytes).

##### `wipeSensitiveData(data: Uint8Array): void`
Securely wipe sensitive data from memory (zero-fill).

**Parameters**:
- `data: Uint8Array` - Data to wipe

---

### Password Health Analyzer

**Location**: `lib/password-health-analyzer.ts`

#### Functions

##### `analyzePasswordHealth(entry: PasswordEntry, passwordMap: Map<string, string[]>): PasswordHealth`
Analyze the security of a password.

**Parameters**:
- `entry: PasswordEntry` - Entry to analyze
- `passwordMap: Map<string, string[]>` - Map of passwords to entry titles (for reuse detection)

**Returns**: `PasswordHealth` object.

```typescript
interface PasswordHealth {
  strength: PasswordStrength;  // 0-5 (VeryWeak to VeryStrong)
  entropy: number;             // Shannon entropy (bits)
  length: number;
  isWeak: boolean;
  isReused: boolean;
  isCommon: boolean;
  isOld: boolean;
  hasPatterns: boolean;
  daysSinceChange: number;
  characterDiversity: {
    lowercase: boolean;
    uppercase: boolean;
    numbers: boolean;
    symbols: boolean;
  };
  recommendations: string[];
}
```

##### `analyzeVaultHealth(entries: PasswordEntry[]): VaultHealth`
Analyze overall security of password vault.

**Returns**: `VaultHealth` object.

```typescript
interface VaultHealth {
  overallScore: number;        // 0-100
  totalPasswords: number;
  weakPasswords: PasswordEntry[];
  reusedPasswords: ReusedPasswordGroup[];
  compromisedPasswords: PasswordEntry[];
  oldPasswords: PasswordEntry[];
  strengthDistribution: Record<PasswordStrength, number>;
  recommendations: string[];
}
```

---

### Search Manager

**Location**: `lib/search-manager.ts`

#### Class: SearchManager

##### `static async create(walletSignature: Uint8Array): Promise<SearchManager>`
Create a new search manager instance.

##### `async generateBlindIndex(entryId: number, fields: { title?: string; url?: string; username?: string; keywords?: string[] }): Promise<BlindIndexEntry>`
Generate blind index hashes for an entry.

##### `async search(query: string, blindIndexes: BlindIndexEntry[], options?: SearchOptions): Promise<SearchResult[]>`
Search through blind indexes.

**Parameters**:
- `query: string` - Search query
- `blindIndexes: BlindIndexEntry[]` - All blind indexes
- `options?: SearchOptions` - Search options

**Returns**: Array of search results (ranked by relevance).

#### Function: clientSideSearch

##### `clientSideSearch(entries: PasswordEntry[], query: string, filters?: ClientSearchFilters): ClientSearchResult[]`
Search through decrypted entries client-side.

**Parameters**:
- `entries: PasswordEntry[]` - Entries to search
- `query: string` - Search query
- `filters?: ClientSearchFilters` - Optional filters

**Returns**: Ranked search results.

---

### Batch Operations

**Location**: `lib/batch-operations.ts`

#### Class: MultiSelectManager

##### `select(entryId: number): void`
Select an entry.

##### `deselect(entryId: number): void`
Deselect an entry.

##### `selectAll(): void`
Select all entries.

##### `deselectAll(): void`
Clear selection.

##### `getSelectedEntries(): PasswordEntry[]`
Get all selected entries.

#### Functions

##### `async batchUpdateCategory(entries: PasswordEntry[], categoryId: number, updateFn: (entry: PasswordEntry) => Promise<void>, options?: BatchOperationOptions): Promise<BatchOperationResult>`
Batch update category for multiple entries.

##### `async batchToggleFavorite(entries: PasswordEntry[], favorite: boolean, updateFn: (entry: PasswordEntry) => Promise<void>, options?: BatchOperationOptions): Promise<BatchOperationResult>`
Batch toggle favorite status.

##### `async batchDelete(entries: PasswordEntry[], deleteFn: (entry: PasswordEntry) => Promise<void>, options?: BatchOperationOptions): Promise<BatchOperationResult>`
Batch delete entries (requires confirmation).

---

### Pending Changes Manager

**Location**: `lib/pending-changes-manager.ts`

#### Class: PendingChangesManager

##### `addUpdate(chunkIndex: number, entryId: number, entry: PasswordEntry, originalEntry?: PasswordEntry): string`
Add an update operation.

##### `addDelete(chunkIndex: number, entryId: number, originalEntry?: PasswordEntry): string`
Add a delete operation.

##### `getAllChanges(): PendingChange[]`
Get all pending changes in order.

##### `getPendingCount(): number`
Get count of pending changes.

##### `getStats(): ChangeStats`
Get statistics about pending changes.

##### `validateChanges(): { valid: boolean; errors: string[] }`
Validate all pending changes.

##### `clearAll(): void`
Clear all pending changes.

---

## Type Definitions

### Core Types

**Location**: `sdk/src/types-v2.ts`

#### PasswordEntry

```typescript
interface PasswordEntry {
  type: PasswordEntryType;
  title: string;
  
  // Login-specific (if type === Login)
  username?: string;
  password?: string;
  url?: string;
  
  // Common optional fields
  notes?: string;
  category?: number;
  tags?: string[];
  favorite?: boolean;
  archived?: boolean;
  
  // TOTP
  totpSecret?: string;
  
  // Metadata
  createdAt: Date;
  lastModified: Date;
  accessCount?: number;
  lastAccessed?: Date;
  
  // Internal (populated after retrieval)
  id?: number;
  chunkIndex?: number;
}
```

#### PasswordEntryType

```typescript
enum PasswordEntryType {
  Login = 0,
  SecureNote = 1,
  CreditCard = 2,
  Identity = 3,
  ApiKey = 4,
  SshKey = 5,
  CryptoWallet = 6,
}
```

#### SubscriptionTier

```typescript
enum SubscriptionTier {
  Free = 0,      // 10 entries
  Standard = 1,  // 100 entries
  Premium = 2,   // 1000 entries
}
```

---

**Last Updated**: 2025-10-15  
**Version**: 2.2.0
