# Lockbox Developer Guide

Complete guide for integrating the Lockbox SDK into your Solana application.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Core Concepts](#core-concepts)
- [API Reference](#api-reference)
- [React Integration](#react-integration)
- [Advanced Usage](#advanced-usage)
- [Error Handling](#error-handling)
- [Security Best Practices](#security-best-practices)
- [Examples](#examples)

## Installation

### Using the SDK

```bash
npm install lockbox-solana-sdk
```

### Peer Dependencies

Ensure you have the required peer dependencies:

```bash
npm install @coral-xyz/anchor @solana/web3.js tweetnacl tweetnacl-util
```

## Quick Start

### Basic Usage

```typescript
import { LockboxClient, PROGRAM_ID } from 'lockbox-solana-sdk';
import { Connection, clusterApiUrl } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';

// Initialize connection
const connection = new Connection(clusterApiUrl('devnet'));

// In your React component or function
const wallet = useWallet();

// Create client
const client = new LockboxClient({
  connection,
  wallet,
});

// Store data
try {
  const signature = await client.store('My secret message');
  console.log('Stored! Transaction:', signature);
} catch (error) {
  console.error('Storage failed:', error);
}

// Retrieve data
try {
  const data = await client.retrieve();
  console.log('Retrieved:', data);
} catch (error) {
  console.error('Retrieval failed:', error);
}
```

## Core Concepts

### Program Derived Address (PDA)

Each user has a unique PDA where their encrypted data is stored:

```typescript
import { LockboxClient } from 'lockbox-solana-sdk';

// Get your lockbox PDA
const [pda, bump] = LockboxClient.getLockboxAddress(wallet.publicKey);
console.log('Your lockbox address:', pda.toBase58());
```

### Encryption Flow

1. User provides plaintext data
2. SDK requests wallet signature for key derivation
3. Derives session key using HKDF (signature + random salt)
4. Encrypts plaintext with XChaCha20-Poly1305
5. Stores ciphertext, nonce, and salt on-chain

### Decryption Flow

1. Fetches ciphertext, nonce, and salt from on-chain PDA
2. Requests wallet signature
3. Derives session key using stored salt
4. Decrypts ciphertext
5. Returns plaintext

## API Reference

### LockboxClient Class

#### Constructor

```typescript
new LockboxClient(options: LockboxClientOptions)
```

**Parameters:**
- `connection: Connection` - Solana RPC connection
- `wallet: any` - Wallet adapter instance
- `programId?: PublicKey` - Optional program ID (defaults to devnet)
- `feeReceiver?: PublicKey` - Optional fee receiver address

#### Instance Methods

##### `store(plaintext: string): Promise<string>`

Encrypts and stores data on-chain.

```typescript
const signature = await client.store('My secret data');
```

**Throws:**
- `Error` if plaintext exceeds size limit (~1008 bytes)
- `Error` if wallet signature is rejected
- `Error` if transaction fails

##### `retrieve(): Promise<string>`

Retrieves and decrypts data from on-chain storage.

```typescript
const plaintext = await client.retrieve();
```

**Throws:**
- `Error` if lockbox doesn't exist
- `Error` if decryption fails
- `Error` if wallet signature is rejected

##### `exists(): Promise<boolean>`

Checks if a lockbox exists for the connected wallet.

```typescript
const hasLockbox = await client.exists();
if (!hasLockbox) {
  console.log('No lockbox found for this wallet');
}
```

##### `getAccount(): Promise<any>`

Gets the raw lockbox account data (encrypted).

```typescript
const account = await client.getAccount();
console.log('Owner:', account.owner.toBase58());
console.log('Ciphertext length:', account.ciphertext.length);
console.log('Last action slot:', account.lastActionSlot.toString());
```

##### `getLockboxAddress(): [PublicKey, number]`

Gets the PDA address for the connected wallet's lockbox.

```typescript
const [pda, bump] = client.getLockboxAddress();
console.log('Lockbox PDA:', pda.toBase58());
console.log('Bump seed:', bump);
```

##### `getRentExemption(): Promise<number>`

Calculates the rent exemption amount for a lockbox account.

```typescript
const rentLamports = await client.getRentExemption();
console.log('Rent exemption:', rentLamports / 1e9, 'SOL');
```

#### Static Methods

##### `LockboxClient.getLockboxAddress(userPubkey: PublicKey): [PublicKey, number]`

Derives the lockbox PDA for any user without requiring a client instance.

```typescript
import { PublicKey } from '@solana/web3.js';

const userPubkey = new PublicKey('...');
const [pda, bump] = LockboxClient.getLockboxAddress(userPubkey);
```

##### `LockboxClient.getAccountSize(): number`

Gets the required account size for a lockbox.

```typescript
const sizeBytes = LockboxClient.getAccountSize();
console.log('Account size:', sizeBytes, 'bytes');
```

### Constants

```typescript
import {
  PROGRAM_ID,
  FEE_LAMPORTS,
  MAX_ENCRYPTED_SIZE,
  COOLDOWN_SLOTS
} from 'lockbox-solana-sdk';

console.log('Program ID:', PROGRAM_ID.toBase58());
// 5nr7xe1U3k6U6zPEmW3FCbPyXCa7jr7JpudaLKuVNyvZ

console.log('Fee per operation:', FEE_LAMPORTS / 1e9, 'SOL');
// 0.001 SOL

console.log('Max encrypted size:', MAX_ENCRYPTED_SIZE, 'bytes');
// 1024 bytes

console.log('Cooldown:', COOLDOWN_SLOTS, 'slots (~4 seconds)');
// 10 slots
```

### Utilities

```typescript
import { utils } from 'lockbox-solana-sdk';

// Validate plaintext size before encrypting
const plaintext = 'My data';
if (!utils.validateSize(plaintext)) {
  console.error('Data too large!');
}

// Get account size
const size = utils.getAccountSize();

// Get lockbox address
const [pda, bump] = utils.getLockboxAddress(userPubkey);
```

## React Integration

### Custom Hook

```typescript
import { useMemo, useState, useCallback } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { LockboxClient } from 'lockbox-solana-sdk';

export function useLockbox() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const client = useMemo(() => {
    if (!wallet.publicKey) return null;
    return new LockboxClient({ connection, wallet });
  }, [connection, wallet]);

  const store = useCallback(async (data: string) => {
    if (!client) throw new Error('Wallet not connected');
    setLoading(true);
    setError(null);
    try {
      const signature = await client.store(data);
      return signature;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [client]);

  const retrieve = useCallback(async () => {
    if (!client) throw new Error('Wallet not connected');
    setLoading(true);
    setError(null);
    try {
      const data = await client.retrieve();
      return data;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [client]);

  const exists = useCallback(async () => {
    if (!client) return false;
    return await client.exists();
  }, [client]);

  return {
    client,
    store,
    retrieve,
    exists,
    loading,
    error,
    connected: !!client,
  };
}
```

### Using the Hook

```typescript
function MyComponent() {
  const { store, retrieve, exists, loading, error } = useLockbox();
  const [data, setData] = useState('');
  const [retrievedData, setRetrievedData] = useState('');

  const handleStore = async () => {
    try {
      const sig = await store(data);
      console.log('Stored! Signature:', sig);
    } catch (err) {
      console.error('Failed to store:', err);
    }
  };

  const handleRetrieve = async () => {
    try {
      const result = await retrieve();
      setRetrievedData(result);
    } catch (err) {
      console.error('Failed to retrieve:', err);
    }
  };

  return (
    <div>
      <input
        value={data}
        onChange={(e) => setData(e.target.value)}
        placeholder="Enter data to store"
      />
      <button onClick={handleStore} disabled={loading}>
        {loading ? 'Storing...' : 'Store Data'}
      </button>
      <button onClick={handleRetrieve} disabled={loading}>
        {loading ? 'Retrieving...' : 'Retrieve Data'}
      </button>
      {error && <p>Error: {error.message}</p>}
      {retrievedData && <p>Retrieved: {retrievedData}</p>}
    </div>
  );
}
```

## Advanced Usage

### Custom Fee Receiver

```typescript
import { PublicKey } from '@solana/web3.js';

const myTreasury = new PublicKey('YOUR_TREASURY_ADDRESS');

const client = new LockboxClient({
  connection,
  wallet,
  feeReceiver: myTreasury,
});
```

### Checking Account State

```typescript
// Check if lockbox exists before operations
if (await client.exists()) {
  const account = await client.getAccount();
  console.log('Last updated at slot:', account.lastActionSlot.toString());
  console.log('Ciphertext size:', account.ciphertext.length, 'bytes');
}
```

### Size Validation

```typescript
import { utils, MAX_ENCRYPTED_SIZE } from '@lockbox/sdk';

const plaintext = 'My very long message...';

// Check before attempting to store
if (utils.validateSize(plaintext)) {
  await client.store(plaintext);
} else {
  console.error(`Data too large! Max ${MAX_ENCRYPTED_SIZE - 16} bytes`);
}
```

## Error Handling

### Common Errors

```typescript
try {
  await client.store(data);
} catch (error) {
  if (error.message.includes('DataTooLarge')) {
    // Plaintext exceeds 1008 bytes
    console.error('Data is too large to encrypt');
  } else if (error.message.includes('CooldownNotElapsed')) {
    // Tried to operate too soon after last action
    console.error('Please wait 10 slots (~4 seconds)');
  } else if (error.message.includes('FeeTooLow')) {
    // Insufficient SOL for fee
    console.error('Need at least 0.001 SOL for fee');
  } else if (error.message.includes('Unauthorized')) {
    // Not the lockbox owner
    console.error('You don\'t own this lockbox');
  } else if (error.message.includes('User rejected')) {
    // User rejected wallet signature
    console.error('Signature rejected by user');
  } else {
    console.error('Unknown error:', error);
  }
}
```

### Transaction Confirmation

```typescript
const signature = await client.store(data);

// Wait for confirmation
const confirmation = await connection.confirmTransaction(signature, 'confirmed');

if (confirmation.value.err) {
  console.error('Transaction failed:', confirmation.value.err);
} else {
  console.log('Transaction confirmed!');
}
```

## Security Best Practices

### 1. Never Log Sensitive Data

```typescript
// ❌ BAD
const data = await client.retrieve();
console.log('Retrieved data:', data);

// ✅ GOOD
const data = await client.retrieve();
console.log('Data retrieved successfully');
```

### 2. Clear Sensitive Data After Use

```typescript
let secretData = await client.retrieve();
// Use the data...
// Clear it when done
secretData = '';
```

### 3. Validate Input Size

```typescript
import { utils } from 'lockbox-solana-sdk';

function validateAndStore(input: string) {
  if (!utils.validateSize(input)) {
    throw new Error('Input too large');
  }
  return client.store(input);
}
```

### 4. Handle Wallet Disconnection

```typescript
const { connected } = useWallet();

if (!connected) {
  return <div>Please connect your wallet</div>;
}

// Safe to use client now
```

## Examples

### Complete React Application

See the [full example app](./app/src/App.tsx) for a production-ready implementation.

### Next.js Integration

```typescript
// pages/lockbox.tsx
import { LockboxClient } from 'lockbox-solana-sdk';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

export default function LockboxPage() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [data, setData] = useState('');

  const client = useMemo(
    () => wallet.publicKey ? new LockboxClient({ connection, wallet }) : null,
    [connection, wallet]
  );

  // ... rest of implementation
}
```

### CLI Tool

```typescript
// lockbox-cli.ts
import { LockboxClient } from 'lockbox-solana-sdk';
import { Connection, Keypair } from '@solana/web3.js';
import * as fs from 'fs';

const connection = new Connection('https://api.devnet.solana.com');
const keypairFile = fs.readFileSync('/path/to/keypair.json', 'utf8');
const keypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(keypairFile)));

// Create a wallet-like object for CLI
const wallet = {
  publicKey: keypair.publicKey,
  signMessage: async (message: Uint8Array) => {
    return nacl.sign.detached(message, keypair.secretKey);
  },
  signTransaction: async (tx: any) => {
    tx.partialSign(keypair);
    return tx;
  },
};

const client = new LockboxClient({ connection, wallet });

// Store
const sig = await client.store('My CLI secret');
console.log('Stored:', sig);

// Retrieve
const data = await client.retrieve();
console.log('Retrieved:', data);
```

## Troubleshooting

### "Insufficient SOL for fee"

Ensure your wallet has at least 0.001 SOL plus rent exemption (~0.002 SOL total).

```typescript
const balance = await connection.getBalance(wallet.publicKey);
const rentExemption = await client.getRentExemption();
const required = rentExemption + FEE_LAMPORTS;

if (balance < required) {
  console.error(`Need ${required / 1e9} SOL, have ${balance / 1e9} SOL`);
}
```

### "Decryption failed"

This usually means:
1. You're not using the same wallet that stored the data
2. The on-chain data is corrupted
3. The signature derivation changed

```typescript
try {
  const data = await client.retrieve();
} catch (error) {
  if (error.message.includes('Decryption failed')) {
    const account = await client.getAccount();
    console.log('Owner:', account.owner.toBase58());
    console.log('Your wallet:', wallet.publicKey.toBase58());
  }
}
```

## Support

- GitHub Issues: https://github.com/hackingbutlegal/lockbox/issues
- Twitter: [@0xgraffito](https://x.com/0xgraffito)

## License

ISC
