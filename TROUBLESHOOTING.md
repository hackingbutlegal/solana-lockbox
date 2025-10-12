# Lockbox v2 Troubleshooting Guide

Common issues and their solutions for Lockbox v2 development and deployment.

## Table of Contents
- [Build & Compilation Issues](#build--compilation-issues)
- [Runtime Errors](#runtime-errors)
- [IDL & Type Issues](#idl--type-issues)
- [Wallet Connection Issues](#wallet-connection-issues)
- [Transaction Failures](#transaction-failures)
- [Network & RPC Issues](#network--rpc-issues)

---

## Build & Compilation Issues

### Issue: Anchor Build Fails with proc-macro2 Errors

**Symptom**:
```
error[E0599]: no method named `source_file` found for struct `proc_macro2::Span`
error[E0425]: cannot find value `owner` in this scope
```

**Cause**: Incompatibility between Anchor versions 0.31+ and proc-macro2

**Solution**:
1. Use Anchor 0.30.1 (proven stable)
2. Use manually-created IDL
3. See [TOOLCHAIN.md](./TOOLCHAIN.md) for details

```bash
# Revert to stable toolchain
rustup override set 1.79.0

# Check versions
anchor --version  # Should be 0.30.1
rustc --version   # Should be 1.79.0
```

### Issue: TypeScript Compilation Errors in SDK

**Symptom**:
```
error TS2307: Cannot find module '../idl/lockbox-v2.json'
```

**Solution**:
Ensure tsconfig.json includes:
```json
{
  "compilerOptions": {
    "resolveJsonModule": true,
    "esModuleInterop": true
  }
}
```

---

## Runtime Errors

### Issue: "Expected Buffer" Error in Next.js

**Symptom**:
```
TypeError: Expected Buffer
    at new LockboxV2Client (sdk/src/client-v2.ts:61:22)
    at new Program(IDL as unknown as Idl, provider)
```

**Cause**: Next.js 15 with Turbopack handles JSON imports differently

**Solution**: ✅ FIXED in commit 93fbe61

The client now includes a `getIDL()` function that handles multiple module formats:
- Direct JSON object
- Module with .default export
- Fallback handling

**Verification**:
Check browser console for:
```
IDL type: object
IDL has address: true
✓ Program initialized successfully with IDL
  Methods: 9
```

If you see this, the fix is working!

**If issue persists**:
1. Clear Next.js cache: `rm -rf .next`
2. Reinstall: `npm install`
3. Rebuild: `npm run build`
4. Check that both IDL files match:
   ```bash
   diff sdk/idl/lockbox-v2.json nextjs-app/sdk/idl/lockbox-v2.json
   ```

### Issue: "Program not initialized - IDL not loaded"

**Symptom**:
```
Error: Program not initialized - IDL not loaded
    at getMasterLockbox (client-v2.ts:438)
```

**Cause**: IDL failed to load, program fell back to minimal interface

**Solution**:
1. Check browser console for error details
2. Verify IDL file exists: `ls -la nextjs-app/sdk/idl/lockbox-v2.json`
3. Verify IDL structure has required fields:
   ```bash
   cat nextjs-app/sdk/idl/lockbox-v2.json | grep '"address"'
   # Should show: "address": "7JxsHjdReydiz36jwsWuvwwR28qqK6V454VwFJnnSkoB"
   ```

### Issue: "Master lockbox already initialized"

**Symptom**:
```
Error: Master lockbox already initialized
```

**Cause**: Account already exists for this wallet

**Solution**: This is expected! The lockbox can only be initialized once per wallet.

**Workaround**:
- Use existing lockbox (recommended)
- Or use a different wallet for testing

---

## IDL & Type Issues

### Issue: "Type not found: StorageType"

**Symptom**:
```
IdlError: Type not found: dataType
```

**Cause**: IDL type definition format incorrect

**Solution**: ✅ FIXED in commit f00cd66

Ensure types use this format:
```json
{
  "type": {
    "defined": { "name": "StorageType" }
  }
}
```

NOT:
```json
{
  "type": {
    "defined": "StorageType"
  }
}
```

### Issue: IDL Files Out of Sync

**Symptom**: Different behavior between SDK and Next.js app

**Solution**:
```bash
# Synchronize IDL files
cp sdk/idl/lockbox-v2.json nextjs-app/sdk/idl/lockbox-v2.json

# Verify they match
diff sdk/idl/lockbox-v2.json nextjs-app/sdk/idl/lockbox-v2.json

# Should show no output (files are identical)
```

---

## Wallet Connection Issues

### Issue: Wallet Not Connecting

**Checklist**:
1. ✓ Wallet extension installed (Phantom, Solflare, etc.)
2. ✓ Wallet unlocked
3. ✓ On correct network (devnet)
4. ✓ Popup blocker not interfering

**Solution**:
```javascript
// Check wallet adapter status
console.log('Wallet connected:', wallet.connected);
console.log('Wallet public key:', wallet.publicKey?.toBase58());
```

### Issue: "Wallet does not support signMessage"

**Cause**: Some wallets don't implement all methods

**Solution**: Use a wallet that supports all required methods:
- ✅ Phantom
- ✅ Solflare
- ✅ Backpack
- ❌ Some hardware wallets (limited support)

---

## Transaction Failures

### Issue: "Transaction simulation failed"

**Common Causes & Solutions**:

1. **Insufficient SOL balance**
   ```bash
   solana balance
   # If low: solana airdrop 2
   ```

2. **Account doesn't exist**
   - Initialize master lockbox first
   - Check with `client.exists()`

3. **Wrong network**
   ```bash
   solana config get
   # Should show: https://api.devnet.solana.com
   ```

4. **Rate limiting**
   - Wait 1 second between operations
   - Error code 6023: "Rate limit exceeded"

### Issue: Transaction Succeeds but Doesn't Update UI

**Solution**:
```typescript
// After transaction, refetch data
await client.getMasterLockbox();
await client.listPasswords();

// Force React re-render
setRefreshCounter(prev => prev + 1);
```

---

## Network & RPC Issues

### Issue: "Failed to fetch" or Network Errors

**Solutions**:

1. **Check RPC endpoint**
   ```typescript
   const connection = new Connection(
     'https://api.devnet.solana.com',
     'confirmed'
   );
   ```

2. **Try alternative RPC**
   - Helius: `https://devnet.helius-rpc.com`
   - Alchemy: `https://solana-devnet.g.alchemy.com/v2/YOUR_KEY`
   - QuickNode: Your custom endpoint

3. **Check network status**
   - Visit https://status.solana.com
   - Check Solana Discord for outages

### Issue: RPC Rate Limiting

**Symptom**:
```
Error: 429 Too Many Requests
```

**Solutions**:
1. Use a custom RPC provider (Helius, Alchemy, QuickNode)
2. Implement exponential backoff
3. Cache results when possible

```typescript
// Exponential backoff example
async function retryRPC<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
    }
  }
  throw new Error('Max retries exceeded');
}
```

---

## Debugging Tips

### Enable Verbose Logging

**Browser**:
```typescript
// In client-v2.ts constructor
console.log('Program ID:', this.program.programId.toBase58());
console.log('Wallet:', this.wallet.publicKey.toBase58());
```

**Solana Logs**:
```bash
# Monitor program logs
solana logs 7JxsHjdReydiz36jwsWuvwwR28qqK6V454VwFJnnSkoB

# View specific transaction
solana confirm -v [TRANSACTION_SIGNATURE]
```

### Check Account State

```bash
# View master lockbox account
solana account [MASTER_LOCKBOX_PDA]

# View program account
solana account 7JxsHjdReydiz36jwsWuvwwR28qqK6V454VwFJnnSkoB
```

### Verify Deployment

```bash
./verify-deployment.sh
```

Should show all green checkmarks.

---

## Getting Help

### Before Opening an Issue

1. ✓ Check this troubleshooting guide
2. ✓ Review [QUICKSTART.md](./QUICKSTART.md)
3. ✓ Check console for error messages
4. ✓ Run `./verify-deployment.sh`
5. ✓ Try clearing cache: `rm -rf .next node_modules && npm install`

### When Opening an Issue

Include:
- Full error message and stack trace
- Browser console output
- `anchor --version` and `solana --version`
- Steps to reproduce
- Expected vs actual behavior

### Resources

- **GitHub Issues**: [Report bugs](https://github.com/hackingbutlegal/solana-lockbox/issues)
- **Solana Docs**: [docs.solana.com](https://docs.solana.com)
- **Anchor Docs**: [anchor-lang.com](https://www.anchor-lang.com)
- **Solana Stack Exchange**: [solana.stackexchange.com](https://solana.stackexchange.com)

---

## Quick Fixes Checklist

When something goes wrong, try these in order:

```bash
# 1. Verify deployment
./verify-deployment.sh

# 2. Check Solana config
solana config get
solana balance

# 3. Clear Next.js cache
cd nextjs-app
rm -rf .next
npm install
npm run build

# 4. Verify IDL files match
diff sdk/idl/lockbox-v2.json nextjs-app/sdk/idl/lockbox-v2.json

# 5. Check toolchain
rustc --version  # Should be 1.79.0
anchor --version # Should be 0.30.1

# 6. Test SDK directly
cd sdk
npm test
```

---

**Last Updated**: October 12, 2025
**Version**: 2.0.0
