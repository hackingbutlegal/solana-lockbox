# Integrating lockbox-solana-sdk into the App

The `lockbox-solana-sdk` package is now installed in the app. This guide shows how to use it.

## Current Status

✅ SDK installed: `lockbox-solana-sdk@0.1.0`
✅ Dependencies compatible
⏳ App still uses custom crypto implementation

## Option 1: Use SDK Directly (Recommended)

Replace the custom crypto implementation with the SDK:

### Before (Current Implementation):
```typescript
// app/src/App.tsx
import { deriveSessionKey, encryptData, decryptData } from './crypto';

// Manual encryption
const sessionKey = deriveSessionKey(signature, salt);
const { ciphertext, nonce } = encryptData(plaintext, sessionKey);

// Manual program interaction
const tx = await program.methods
  .storeEncrypted(ciphertext, nonce, salt)
  .accounts({...})
  .rpc();
```

### After (Using SDK):
```typescript
// app/src/App.tsx
import { LockboxClient } from 'lockbox-solana-sdk';

// Create client once
const client = new LockboxClient({
  connection,
  wallet
});

// Store - handles everything automatically
const signature = await client.store(plaintext);

// Retrieve - handles decryption automatically
const data = await client.retrieve();
```

## Option 2: Use SDK Utilities Only

Keep current UI but use SDK utilities:

```typescript
import {
  utils,
  PROGRAM_ID,
  FEE_LAMPORTS,
  MAX_ENCRYPTED_SIZE
} from 'lockbox-solana-sdk';

// Validate size before operations
if (!utils.validateSize(plaintext)) {
  throw new Error('Data too large');
}

// Get PDA address
const [pda, bump] = utils.getLockboxAddress(wallet.publicKey);

// Use constants
console.log('Fee:', FEE_LAMPORTS / 1e9, 'SOL');
```

## Step-by-Step Migration

### 1. Update Imports

```typescript
// Add to top of App.tsx
import { LockboxClient, utils, PROGRAM_ID } from 'lockbox-solana-sdk';
```

### 2. Initialize Client

```typescript
// In your component
const client = useMemo(() => {
  if (!wallet.publicKey || !connection) return null;
  return new LockboxClient({ connection, wallet });
}, [connection, wallet]);
```

### 3. Replace Store Function

```typescript
// Old
const handleStore = async () => {
  const signature = await wallet.signMessage(message);
  const key = deriveSessionKey(signature, salt);
  const { ciphertext, nonce } = encryptData(plaintext, key);

  const tx = await program.methods
    .storeEncrypted(ciphertext, nonce, salt)
    .accounts({...})
    .rpc();
};

// New
const handleStore = async () => {
  if (!client) return;
  const signature = await client.store(plaintext);
  console.log('Stored!', signature);
};
```

### 4. Replace Retrieve Function

```typescript
// Old
const handleRetrieve = async () => {
  const account = await program.account.lockbox.fetch(pda);
  const signature = await wallet.signMessage(message);
  const key = deriveSessionKey(signature, account.salt);
  const plaintext = decryptData(account.ciphertext, account.nonce, key);
};

// New
const handleRetrieve = async () => {
  if (!client) return;
  const plaintext = await client.retrieve();
  setDecryptedData(plaintext);
};
```

### 5. Simplify State Management

```typescript
// Can remove these if using SDK:
// - crypto.ts (SDK handles encryption)
// - Manual key derivation
// - Manual nonce/salt generation
// - Program interaction boilerplate
```

## Benefits of Using SDK

✅ **Less Code**: ~70% reduction in crypto/program code
✅ **Type Safety**: Full TypeScript support
✅ **Tested**: SDK is tested and published
✅ **Maintained**: Updates via npm
✅ **Best Practices**: Handles edge cases automatically
✅ **Error Handling**: Better error messages
✅ **Documentation**: Complete API reference

## Current File Structure

```
app/src/
├── App.tsx           # Main component (update here)
├── crypto.ts         # Can remove if using SDK
├── components/
│   ├── ActivityLog.tsx
│   ├── FAQ.tsx
│   └── StorageHistory.tsx
└── utils/
    └── secureStorage.ts
```

## Example: Complete Integration

Here's a minimal example using the SDK:

```typescript
import React, { useMemo, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { LockboxClient } from 'lockbox-solana-sdk';

export function LockboxApp() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [plaintext, setPlaintext] = useState('');
  const [decrypted, setDecrypted] = useState('');
  const [loading, setLoading] = useState(false);

  const client = useMemo(() => {
    if (!wallet.publicKey) return null;
    return new LockboxClient({ connection, wallet });
  }, [connection, wallet]);

  const handleStore = async () => {
    if (!client) return;
    setLoading(true);
    try {
      const sig = await client.store(plaintext);
      console.log('Stored!', sig);
    } catch (error) {
      console.error('Store failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRetrieve = async () => {
    if (!client) return;
    setLoading(true);
    try {
      const data = await client.retrieve();
      setDecrypted(data);
    } catch (error) {
      console.error('Retrieve failed:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!wallet.connected) {
    return <div>Please connect your wallet</div>;
  }

  return (
    <div>
      <h1>Lockbox</h1>

      <div>
        <textarea
          value={plaintext}
          onChange={(e) => setPlaintext(e.target.value)}
          placeholder="Enter data to encrypt..."
        />
        <button onClick={handleStore} disabled={loading}>
          {loading ? 'Storing...' : 'Encrypt & Store'}
        </button>
      </div>

      <div>
        <button onClick={handleRetrieve} disabled={loading}>
          {loading ? 'Retrieving...' : 'Decrypt & Retrieve'}
        </button>
        {decrypted && (
          <div>
            <h3>Decrypted Data:</h3>
            <pre>{decrypted}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
```

## Testing the SDK

```bash
cd app
npm run dev
```

Then in browser console:
```javascript
const sdk = await import('lockbox-solana-sdk');
console.log('SDK loaded:', sdk);
console.log('Program ID:', sdk.PROGRAM_ID.toBase58());
```

## Next Steps

1. ✅ SDK is installed
2. ⏳ Update App.tsx to use LockboxClient
3. ⏳ Remove crypto.ts if no longer needed
4. ⏳ Test all functionality
5. ⏳ Update error handling
6. ⏳ Deploy updated app

## Resources

- SDK Documentation: `/sdk/README.md`
- Developer Guide: `/DEVELOPER_GUIDE.md`
- npm Package: https://www.npmjs.com/package/lockbox-solana-sdk
- GitHub: https://github.com/hackingbutlegal/lockbox
