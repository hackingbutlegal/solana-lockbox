# Lockbox Deployment Guide

## Current Status

✅ **Frontend**: Fully functional with live activity log, transaction tracking, and devnet integration
⚠️ **Smart Contract**: Needs Rust toolchain update to deploy

## Frontend (Working Now!)

The frontend is live at `http://localhost:5173/` with:

- ✅ Live activity log showing all operations
- ✅ Transaction hash display with copy functionality
- ✅ Solana Explorer links (devnet)
- ✅ Real-time progress indicators
- ✅ Wallet integration (Phantom, Solflare)
- ✅ Client-side encryption (XChaCha20-Poly1305)
- ✅ Session key derivation from wallet signatures

**Demo Mode**: Currently sends minimal SOL transfers to demonstrate the transaction flow. Once the program is deployed, it will store encrypted data in PDAs.

## Deploy Smart Contract

### Prerequisites

```bash
# Install/update Solana toolchain
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"

# Verify versions
solana --version   # Should be 1.18+
anchor --version   # Should be 0.30+
rustc --version    # Should be 1.76+
```

### Build and Deploy

```bash
# 1. Configure Solana for devnet
solana config set --url devnet

# 2. Create/fund a keypair
solana-keygen new --outfile ~/.config/solana/lockbox-deploy.json
solana airdrop 2 ~/.config/solana/lockbox-deploy.json

# 3. Build the program
anchor build

# 4. Get the program ID
solana address -k target/deploy/lockbox-keypair.json

# 5. Update program ID in:
#    - programs/lockbox/src/lib.rs (declare_id!)
#    - Anchor.toml ([programs.devnet])
#    - app/src/App.tsx (PROGRAM_ID constant)

# 6. Rebuild with correct program ID
anchor build

# 7. Deploy to devnet
anchor deploy

# 8. Verify deployment
solana program show <PROGRAM_ID>
```

### Update Frontend

After deploying, update `app/src/App.tsx`:

```typescript
const PROGRAM_ID = new PublicKey('YOUR_DEPLOYED_PROGRAM_ID');
```

Then restart the dev server or rebuild:

```bash
npm run dev    # For development
npm run build  # For production
```

## Testing on Devnet

1. **Get devnet SOL**:
   ```bash
   # In your browser wallet (Phantom/Solflare)
   # Switch to Devnet
   # Use built-in faucet or:
   solana airdrop 1 <YOUR_WALLET_ADDRESS> --url devnet
   ```

2. **Test the flow**:
   - Connect wallet
   - Watch activity log for session key derivation
   - Enter data (< 1 KiB)
   - Click "Encrypt & Store"
   - Observe live progress in activity log
   - Copy transaction hash
   - View on Solana Explorer
   - Test "Retrieve & Decrypt"

## Activity Log Features

The log shows:
- 🔵 **Info**: General information (wallet connected, PDA addresses, etc.)
- 🟢 **Success**: Successful operations with transaction hashes
- 🟡 **Warning**: Non-critical issues (cooldown, auto-hide warnings)
- 🔴 **Error**: Failures (insufficient balance, validation errors)
- 🟣 **Progress**: Ongoing operations (animated)

Each transaction entry includes:
- Transaction signature (shortened)
- "Copy" button
- "View on Explorer" link → opens Solana Explorer (devnet)

## Known Issues

### Rust Toolchain Version

Current error: `rustc 1.75.0-dev` is too old for dependencies requiring 1.76+

**Solution**:
```bash
# Update Solana's embedded Rust (if using cargo-build-sbf)
solana-install update

# Or use system Rust
rustup update stable
rustup default stable
cargo build-sbf  # Should now use rustc 1.90+
```

### Demo Mode

Until the program is deployed, the app:
- ✅ Performs full client-side encryption
- ✅ Calculates correct PDA addresses
- ✅ Shows accurate transaction flow
- ⚠️ Sends 0.001 SOL transfers instead of actual program calls
- ⚠️ Simulates retrieval (no on-chain data yet)

This is intentional to let you test the UX without waiting for program deployment.

## Production Deployment

### Smart Contract (Mainnet)

```bash
solana config set --url mainnet-beta
anchor build
anchor deploy --provider.cluster mainnet
```

**Cost**: ~2-5 SOL for deployment + rent-exempt minimum for program account

### Frontend (Vercel/Netlify)

```bash
cd app
npm run build

# Deploy dist/ folder to:
# - Vercel: vercel deploy
# - Netlify: netlify deploy
# - GitHub Pages: gh-pages -d dist
```

Update `App.tsx` to use mainnet:
```typescript
const network = WalletAdapterNetwork.Mainnet;
```

## Security Checklist

Before mainnet:

- [ ] Audit smart contract (especially fee handling)
- [ ] Set proper fee receiver address (not system program)
- [ ] Test cooldown rate limiting
- [ ] Verify all error codes work correctly
- [ ] Test with multiple wallets
- [ ] Ensure nonce uniqueness across sessions
- [ ] Review AEAD implementation
- [ ] Add monitoring/alerting for program errors
- [ ] Implement backup/recovery documentation

## Support

Issues? Check:
- Activity log for detailed error messages
- Browser console for client-side errors
- Solana Explorer for transaction details
- `solana logs` for program logs during testing
