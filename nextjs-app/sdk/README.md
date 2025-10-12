# Lockbox TypeScript SDK

Official TypeScript SDK for the Lockbox Solana program - wallet-tied encrypted storage on-chain.

## Installation

```bash
npm install @lockbox/sdk
```

## Quick Start

```typescript
import { LockboxClient } from '@lockbox/sdk';
import { Connection, clusterApiUrl } from '@solana/web3.js';

// Initialize connection and wallet
const connection = new Connection(clusterApiUrl('devnet'));
const wallet = // your Solana wallet adapter

// Create client
const client = new LockboxClient({
  connection,
  wallet,
});

// Store encrypted data
const tx = await client.store('My secret data');
console.log('Stored! Transaction:', tx);

// Retrieve and decrypt data
const data = await client.retrieve();
console.log('Retrieved:', data);
```

## Features

- **End-to-End Encryption**: All encryption happens client-side
- **Wallet-Derived Keys**: Session keys derived from wallet signatures
- **Type-Safe**: Full TypeScript support with detailed type definitions
- **Easy to Use**: Simple API for storing and retrieving encrypted data
- **Solana Native**: Built on Anchor framework

## API Reference

### `LockboxClient`

Main class for interacting with the Lockbox program.

#### Constructor

```typescript
new LockboxClient(options: LockboxClientOptions)
```

**Options:**
- `connection: Connection` - Solana RPC connection
- `wallet: any` - Wallet adapter instance
- `programId?: PublicKey` - Optional custom program ID
- `feeReceiver?: PublicKey` - Optional custom fee receiver

#### Methods

##### `store(plaintext: string): Promise<string>`

Encrypts and stores data on-chain.

**Parameters:**
- `plaintext: string` - The data to encrypt and store (max ~1008 bytes)

**Returns:**
- `Promise<string>` - Transaction signature

**Throws:**
- Error if plaintext is too large
- Error if wallet signature is rejected

##### `retrieve(): Promise<string>`

Retrieves and decrypts data from on-chain storage.

**Returns:**
- `Promise<string>` - Decrypted plaintext data

**Throws:**
- Error if decryption fails
- Error if lockbox doesn't exist

##### `exists(): Promise<boolean>`

Checks if a lockbox exists for the current wallet.

**Returns:**
- `Promise<boolean>` - True if lockbox exists

##### `getAccount(): Promise<any>`

Gets the raw lockbox account data (encrypted).

**Returns:**
- `Promise<any>` - Lockbox account data

##### `getLockboxAddress(): [PublicKey, number]`

Gets the PDA address for the current wallet's lockbox.

**Returns:**
- `[PublicKey, number]` - [PDA address, bump seed]

##### `getRentExemption(): Promise<number>`

Calculates the rent exemption amount for a lockbox account.

**Returns:**
- `Promise<number>` - Rent exemption in lamports

### Static Methods

##### `LockboxClient.getLockboxAddress(userPubkey: PublicKey): [PublicKey, number]`

Derives the lockbox PDA for any user.

**Parameters:**
- `userPubkey: PublicKey` - User's wallet public key

**Returns:**
- `[PublicKey, number]` - [PDA address, bump seed]

##### `LockboxClient.getAccountSize(): number`

Gets the required account size for a lockbox.

**Returns:**
- `number` - Account size in bytes

### Utilities

```typescript
import { utils } from '@lockbox/sdk';

// Get lockbox address for a user
const [pda, bump] = utils.getLockboxAddress(userPubkey);

// Get account size
const size = utils.getAccountSize();

// Validate plaintext size
const isValid = utils.validateSize('my data');
```

### Constants

```typescript
import {
  PROGRAM_ID,
  FEE_LAMPORTS,
  MAX_ENCRYPTED_SIZE,
  COOLDOWN_SLOTS
} from '@lockbox/sdk';

console.log('Program ID:', PROGRAM_ID.toBase58());
console.log('Fee per operation:', FEE_LAMPORTS, 'lamports');
console.log('Max encrypted size:', MAX_ENCRYPTED_SIZE, 'bytes');
console.log('Cooldown period:', COOLDOWN_SLOTS, 'slots');
```

## Security Model

### Client-Side Encryption

All encryption and decryption happens in your browser/client. The Lockbox program never sees:
- Your plaintext data
- Your encryption keys
- Your wallet private key (beyond standard transaction signing)

### Key Derivation

1. User signs a message with their wallet
2. Signature + random salt → HKDF → encryption key
3. Key is used with XChaCha20-Poly1305 for AEAD encryption
4. Only ciphertext, nonce, and salt are stored on-chain

### Rate Limiting

The program enforces a 10-slot cooldown between operations to prevent brute force attacks.

## Examples

### Basic Usage

```typescript
import { LockboxClient } from '@lockbox/sdk';

const client = new LockboxClient({ connection, wallet });

// Check if lockbox exists
if (await client.exists()) {
  const data = await client.retrieve();
  console.log('Existing data:', data);
} else {
  await client.store('Initial data');
  console.log('Created new lockbox');
}
```

### Custom Fee Receiver

```typescript
import { PublicKey } from '@solana/web3.js';

const feeReceiver = new PublicKey('YOUR_FEE_RECEIVER_ADDRESS');

const client = new LockboxClient({
  connection,
  wallet,
  feeReceiver,
});
```

### Error Handling

```typescript
try {
  await client.store('My secret');
} catch (error) {
  if (error.message.includes('Plaintext too large')) {
    console.error('Data is too large to store');
  } else if (error.message.includes('CooldownNotElapsed')) {
    console.error('Please wait before performing another operation');
  } else {
    console.error('Storage failed:', error);
  }
}
```

### React Hook Example

```typescript
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { LockboxClient } from '@lockbox/sdk';
import { useMemo, useState } from 'react';

function useLockbox() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [loading, setLoading] = useState(false);

  const client = useMemo(
    () => wallet.publicKey ? new LockboxClient({ connection, wallet }) : null,
    [connection, wallet]
  );

  const store = async (data: string) => {
    if (!client) throw new Error('Wallet not connected');
    setLoading(true);
    try {
      return await client.store(data);
    } finally {
      setLoading(false);
    }
  };

  const retrieve = async () => {
    if (!client) throw new Error('Wallet not connected');
    setLoading(true);
    try {
      return await client.retrieve();
    } finally {
      setLoading(false);
    }
  };

  return { store, retrieve, loading, client };
}
```

## Development

### Building

```bash
npm install
npm run build
```

### Project Structure

```
sdk/
├── src/
│   ├── index.ts       # Main SDK exports
│   ├── types.ts       # TypeScript type definitions
│   └── idl/
│       └── lockbox.json  # Program IDL
├── dist/              # Compiled output
├── package.json
├── tsconfig.json
└── README.md
```

## License

ISC

## Links

- [Program Repository](https://github.com/hackingbutlegal/lockbox)
- [Documentation](https://github.com/hackingbutlegal/lockbox#readme)
- [Security Model](https://github.com/hackingbutlegal/lockbox/blob/main/SECURITY.md)
