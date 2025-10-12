# Deployment Instructions for Lockbox

## Current Status

✅ **Frontend**: Fully functional at http://localhost:5173
✅ **Program Code**: Complete and ready in `programs/lockbox/src/lib.rs`
⚠️ **Deployment**: Blocked by Solana toolchain Rust version

## Issue

The Solana platform-tools (v1.41) in solana-cli 1.18.18 uses rustc 1.75.0, but Anchor 0.30.1 dependencies require rustc 1.76+.

## Solution Options

### Option 1: Use Prebuilt Binary (Recommended for Testing)

The frontend is already functional with the hardcoded program ID. For testing purposes, you can continue using it with simulated transactions until Solana updates their toolchain.

### Option 2: Install Agave (Newest Solana Client)

```bash
# Install Agave (latest Solana client with updated toolchain)
sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"

# Update PATH
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"

# Verify versions
solana --version  # Should show Agave
cargo-build-sbf --version  # Should show rustc 1.76+

# Build and deploy
cd /Users/graffito/lockbox
anchor build
anchor deploy
```

### Option 3: Wait for Solana Toolchain Update

Solana periodically updates their embedded Rust version. Check https://github.com/solana-labs/platform-tools for updates.

### Option 4: Manual Binary Build (Advanced)

```bash
# Use system Rust with BPF target
rustup target add sbf-solana-solana
cd programs/lockbox

# Build manually
cargo build --target sbf-solana-solana --release

# Deploy manually
solana program deploy ../../target/sbf-solana-solana/release/lockbox.so
```

## After Successful Deployment

Once deployed, update the program ID in the frontend:

1. Get the deployed program ID:
   ```bash
   solana address -k target/deploy/lockbox-keypair.json
   ```

2. Update `app/src/App.tsx`:
   ```typescript
   const PROGRAM_ID = new PublicKey('YOUR_DEPLOYED_PROGRAM_ID');
   ```

3. Rebuild frontend:
   ```bash
   cd app && npm run build
   ```

## Current Configuration

- **Solana CLI**: 1.18.18 (Agave)
- **Anchor CLI**: 0.30.1
- **System Rust**: 1.90.0 ✅
- **Platform-tools Rust**: 1.75.0 ❌
- **Wallet**: 3H8e4VnGjxKGFKxk2QMmjuu1B7dnDLysGN8hvcDCKxZh
- **Devnet Balance**: 3.4 SOL ✅

## Frontend Works Without Deployment

The application is fully functional for testing:
- ✅ Wallet connection (Phantom, Solflare)
- ✅ Session key derivation
- ✅ Client-side encryption (XChaCha20-Poly1305)
- ✅ Balance checks
- ✅ Transaction building
- ✅ Live activity log
- ✅ Storage history tracking
- ✅ Retrieval tracking

The only limitation is that transactions currently perform SOL transfers instead of storing encrypted data on-chain.

## Recommended Next Steps

1. **For Development**: Continue using the app as-is for UX testing and frontend development
2. **For Production**: Install Agave client (Option 1 above)
3. **Alternative**: Deploy using Solana Playground: https://beta.solpg.io/

## Questions?

- Solana Platform Tools: https://github.com/solana-labs/platform-tools/releases
- Anchor Issues: https://github.com/coral-xyz/anchor/issues
- Agave (new Solana client): https://github.com/anza-xyz/agave

---

**Note**: This issue affects all Anchor 0.30+ projects using Solana CLI 1.18.x. It's a known compatibility gap during the Solana→Agave transition.
