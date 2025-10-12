# Lockbox API Documentation

## Table of Contents
- [Program Instructions](#program-instructions)
- [Frontend API](#frontend-api)
- [Cryptography Functions](#cryptography-functions)
- [Error Codes](#error-codes)
- [Data Types](#data-types)

---

## Program Instructions

### `store_encrypted`

Stores encrypted data in the user's lockbox PDA.

**Accounts:**
```typescript
{
  lockbox: PublicKey,      // PDA: ["lockbox", user.publicKey]
  user: Signer,            // Transaction signer (must be writable)
  feeReceiver: PublicKey,  // Receives 0.001 SOL fee (must be writable)
  systemProgram: PublicKey // System program ID
}
```

**Arguments:**
```rust
ciphertext: Vec<u8>,           // Encrypted payload (max 1024 bytes)
nonce: [u8; 24],               // XChaCha20-Poly1305 nonce
salt: [u8; 32]                 // HKDF salt
```

**Validation:**
- `ciphertext.len() <= 1024` (DataTooLarge)
- `!ciphertext.is_empty()` (InvalidCiphertext)
- Cooldown elapsed: `current_slot >= last_action_slot + 10` (CooldownNotElapsed)
- User balance >= 0.001 SOL (FeeTooLow)

**Returns:**
- `Ok(())` on success
- `Err(LockboxError)` on failure

**Example (TypeScript):**
```typescript
const [lockboxPda] = PublicKey.findProgramAddressSync(
  [Buffer.from('lockbox'), wallet.publicKey.toBuffer()],
  programId
);

// Calculate discriminator
const instructionName = "global:store_encrypted";
const hashBuffer = await crypto.subtle.digest('SHA-256',
  new TextEncoder().encode(instructionName));
const discriminator = new Uint8Array(hashBuffer).slice(0, 8);

// Build instruction data
const instructionData = Buffer.concat([
  Buffer.from(discriminator),
  Buffer.from([ciphertext.length & 0xFF, (ciphertext.length >> 8) & 0xFF,
               (ciphertext.length >> 16) & 0xFF, (ciphertext.length >> 24) & 0xFF]),
  Buffer.from(ciphertext),
  Buffer.from(nonce),
  Buffer.from(salt),
]);

const instruction = new TransactionInstruction({
  keys: [
    { pubkey: lockboxPda, isSigner: false, isWritable: true },
    { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
    { pubkey: feeReceiver, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ],
  programId: programId,
  data: instructionData,
});
```

---

### `retrieve_encrypted`

Retrieves encrypted data from the user's lockbox.

**Accounts:**
```typescript
{
  lockbox: PublicKey,  // PDA: ["lockbox", user.publicKey]
  user: Signer         // Transaction signer (must be owner)
}
```

**Arguments:** None

**Validation:**
- Lockbox exists
- `lockbox.owner == user.publicKey` (Unauthorized)
- Cooldown elapsed: `current_slot >= last_action_slot + 10` (CooldownNotElapsed)

**Returns:**
```rust
EncryptedData {
  ciphertext: Vec<u8>,
  nonce: [u8; 24],
  salt: [u8; 32]
}
```

---

## Frontend API

### Connection Setup

```typescript
import { Connection, clusterApiUrl } from '@solana/web3.js';

const connection = new Connection(
  clusterApiUrl('devnet'),
  {
    commitment: 'confirmed',
    confirmTransactionInitialTimeout: 60000,
  }
);
```

### Program ID

```typescript
const PROGRAM_ID = new PublicKey('5nr7xe1U3k6U6zPEmW3FCbPyXCa7jr7JpudaLKuVNyvZ');
```

### Calculate User's PDA

```typescript
function getUserLockboxPDA(userPublicKey: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('lockbox'), userPublicKey.toBuffer()],
    PROGRAM_ID
  );
}
```

---

## Cryptography Functions

### `generateChallenge(publicKey: PublicKey): Uint8Array`

Generates a challenge message for wallet signing.

**Purpose:** Domain-separated challenge to derive session keys

**Returns:** Challenge message bytes

```typescript
function generateChallenge(publicKey: PublicKey): Uint8Array {
  const message = `Lockbox session key derivation\nTimestamp: ${Date.now()}\nWallet: ${publicKey.toBase58()}`;
  return new TextEncoder().encode(message);
}
```

---

### `createSessionKeyFromSignature(publicKey: PublicKey, signature: Uint8Array, salt: Uint8Array): Promise<Uint8Array>`

Derives a session key using HKDF.

**Parameters:**
- `publicKey` - User's wallet public key
- `signature` - Signature from wallet.signMessage()
- `salt` - 32-byte random salt

**Returns:** 32-byte session key

**Algorithm:**
```
IKM = publicKey || signature || salt
session_key = HKDF-SHA256(IKM, salt, info="lockbox-session-key")
```

**Implementation:**
```typescript
async function createSessionKeyFromSignature(
  publicKey: PublicKey,
  signature: Uint8Array,
  salt: Uint8Array
): Promise<Uint8Array> {
  const ikm = new Uint8Array([
    ...publicKey.toBytes(),
    ...signature,
    ...salt
  ]);

  const key = await crypto.subtle.importKey(
    'raw',
    ikm,
    { name: 'HKDF' },
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: salt,
      info: new TextEncoder().encode('lockbox-session-key')
    },
    key,
    256
  );

  return new Uint8Array(derivedBits);
}
```

---

### `encryptAEAD(plaintext: Uint8Array, sessionKey: Uint8Array): { ciphertext: Uint8Array, nonce: Uint8Array, salt: Uint8Array }`

Encrypts plaintext using XChaCha20-Poly1305.

**Parameters:**
- `plaintext` - Data to encrypt
- `sessionKey` - 32-byte session key

**Returns:**
- `ciphertext` - Encrypted data with auth tag
- `nonce` - 24-byte random nonce
- `salt` - 32-byte random salt (for re-derivation)

**Implementation:**
```typescript
import nacl from 'tweetnacl';

function encryptAEAD(
  plaintext: Uint8Array,
  sessionKey: Uint8Array
): { ciphertext: Uint8Array; nonce: Uint8Array; salt: Uint8Array } {
  const nonce = nacl.randomBytes(24);
  const ciphertext = nacl.secretbox(plaintext, nonce, sessionKey);
  const salt = nacl.randomBytes(32);

  return { ciphertext, nonce, salt };
}
```

---

### `decryptAEAD(ciphertext: Uint8Array, sessionKey: Uint8Array, nonce: Uint8Array): Uint8Array | null`

Decrypts ciphertext using XChaCha20-Poly1305.

**Parameters:**
- `ciphertext` - Encrypted data with auth tag
- `sessionKey` - 32-byte session key
- `nonce` - 24-byte nonce from encryption

**Returns:**
- `Uint8Array` - Decrypted plaintext
- `null` - Authentication failed

**Implementation:**
```typescript
function decryptAEAD(
  ciphertext: Uint8Array,
  sessionKey: Uint8Array,
  nonce: Uint8Array
): Uint8Array | null {
  return nacl.secretbox.open(ciphertext, nonce, sessionKey);
}
```

---

### `wipeSensitiveData(data: Uint8Array): void`

Wipes sensitive data from memory.

**Purpose:** Overwrite memory containing keys/plaintext

```typescript
function wipeSensitiveData(data: Uint8Array): void {
  for (let i = 0; i < data.length; i++) {
    data[i] = 0;
  }
}
```

---

### `validateEncryptedSize(ciphertext: Uint8Array): boolean`

Validates ciphertext size before sending to program.

**Parameters:**
- `ciphertext` - Encrypted data to validate

**Returns:**
- `true` - Size valid (<= 1024 bytes)
- `false` - Size exceeds limit

```typescript
const MAX_ENCRYPTED_SIZE = 1024;

function validateEncryptedSize(ciphertext: Uint8Array): boolean {
  return ciphertext.length <= MAX_ENCRYPTED_SIZE;
}
```

---

## Error Codes

### Program Errors

| Code | Name | Message |
|------|------|---------|
| 6000 | DataTooLarge | Encrypted data exceeds maximum size of 1024 bytes |
| 6001 | InvalidCiphertext | Invalid ciphertext: data cannot be empty |
| 6002 | NonceReuseDetected | Nonce reuse detected: operation rejected |
| 6003 | FeeTooLow | Fee too low: minimum 0.001 SOL required |
| 6004 | Unauthorized | Unauthorized: you are not the owner of this lockbox |
| 6005 | CooldownNotElapsed | Cooldown not elapsed: wait 10 slots before retry |
| 6006 | AccountSpaceExceeded | Account space exceeded: cannot store more data |

### Frontend Errors

```typescript
class LockboxError extends Error {
  constructor(
    message: string,
    public code?: number,
    public logs?: string[]
  ) {
    super(message);
    this.name = 'LockboxError';
  }
}
```

---

## Data Types

### Lockbox Account

```rust
pub struct Lockbox {
    pub owner: Pubkey,                  // 32 bytes
    pub ciphertext: Vec<u8>,            // 4 + up to 1024 bytes
    pub nonce: [u8; 24],                // 24 bytes
    pub salt: [u8; 32],                 // 32 bytes
    pub last_action_slot: u64,          // 8 bytes
    pub bump: u8,                       // 1 byte
}
// Total max size: 1141 bytes + 8-byte discriminator
```

### EncryptedData

```rust
pub struct EncryptedData {
    pub ciphertext: Vec<u8>,
    pub nonce: [u8; 24],
    pub salt: [u8; 32],
}
```

### TypeScript Types

```typescript
interface StoredItem {
  id: string;
  timestamp: Date;
  txHash: string;
  dataPreview: string;
  sizeBytes: number;
  retrievals: RetrievalRecord[];
}

interface RetrievalRecord {
  timestamp: Date;
  success: boolean;
}

type LogLevel = 'info' | 'success' | 'warning' | 'error' | 'progress';

interface LogEntry {
  id: string;
  timestamp: Date;
  level: LogLevel;
  message: string;
  txHash?: string;
}
```

---

## Constants

### Program Constants

```rust
const MAX_ENCRYPTED_SIZE: usize = 1024;      // 1 KiB
const SALT_SIZE: usize = 32;                 // 32 bytes
const NONCE_SIZE: usize = 24;                // 24 bytes for XChaCha20
const FEE_LAMPORTS: u64 = 1_000_000;         // 0.001 SOL
const COOLDOWN_SLOTS: u64 = 10;              // ~4 seconds
```

### Frontend Constants

```typescript
const PROGRAM_ID = new PublicKey('5nr7xe1U3k6U6zPEmW3FCbPyXCa7jr7JpudaLKuVNyvZ');
const FEE_RECEIVER = new PublicKey('3H8e4VnGjxKGFKxk2QMmjuu1B7dnDLysGN8hvcDCKxZh');
const MAX_ENCRYPTED_SIZE = 1024;
const SALT_SIZE = 32;
const NONCE_SIZE = 24;
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;   // 30 minutes
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
```

---

## Security Considerations

### Key Derivation
- Session keys derived from wallet signatures (non-deterministic)
- HKDF with domain separation ("lockbox-session-key")
- 32-byte random salts stored on-chain for key re-derivation
- Keys exist only in memory, never persisted

### Encryption
- XChaCha20-Poly1305 AEAD (authenticated encryption)
- 24-byte random nonces (no reuse)
- Authentication tag prevents tampering
- Maximum plaintext size: ~1000 bytes (accounts for auth tag overhead)

### Access Control
- PDA ensures unique storage per user
- Owner-only access enforced by program
- Rate limiting prevents brute force (10 slots cooldown)
- Fee requirement prevents spam (0.001 SOL)

### Memory Safety
- Sensitive data wiped after use
- Session keys cleared on inactivity (15 minutes)
- Decrypted data auto-hidden (30 seconds)
- No localStorage/IndexedDB persistence

---

## Example Usage

### Full Storage Flow

```typescript
import { Connection, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';

async function storeEncryptedData(plaintext: string) {
  const { publicKey, signMessage, sendTransaction } = useWallet();
  const connection = new Connection(clusterApiUrl('devnet'));

  // 1. Generate challenge and get signature
  const challenge = generateChallenge(publicKey);
  const signature = await signMessage(challenge);

  // 2. Derive session key
  const salt = nacl.randomBytes(32);
  const sessionKey = await createSessionKeyFromSignature(publicKey, signature, salt);

  // 3. Encrypt data
  const plaintextBytes = new TextEncoder().encode(plaintext);
  const { ciphertext, nonce } = encryptAEAD(plaintextBytes, sessionKey);

  // 4. Validate size
  if (!validateEncryptedSize(ciphertext)) {
    throw new Error('Data too large');
  }

  // 5. Build transaction
  const [lockboxPda] = getUserLockboxPDA(publicKey);
  const instructionData = buildInstructionData(ciphertext, nonce, salt);

  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: lockboxPda, isSigner: false, isWritable: true },
      { pubkey: publicKey, isSigner: true, isWritable: true },
      { pubkey: FEE_RECEIVER, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data: instructionData,
  });

  const { blockhash } = await connection.getLatestBlockhash();
  const transaction = new Transaction({ feePayer: publicKey, blockhash }).add(instruction);

  // 6. Send and confirm
  const signature = await sendTransaction(transaction, connection);
  await connection.confirmTransaction(signature);

  // 7. Clean up
  wipeSensitiveData(plaintextBytes);
  wipeSensitiveData(sessionKey);

  return signature;
}
```

---

## Links

- **Explorer**: https://explorer.solana.com/address/5nr7xe1U3k6U6zPEmW3FCbPyXCa7jr7JpudaLKuVNyvZ?cluster=devnet
- **Repository**: https://github.com/hackingbutlegal/lockbox
- **Solana Docs**: https://docs.solana.com/
- **Anchor Docs**: https://www.anchor-lang.com/

---

**Last Updated**: October 2025
