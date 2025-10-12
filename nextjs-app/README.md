# 🔒 Lockbox (Next.js)

Wallet-tied encrypted storage on Solana with zero persistent client secrets. Built with Next.js 15, TypeScript, and Tailwind CSS.

> **🚀 Live Demo (Devnet Only)**
> **Demo URL**: [https://lockbox-steel.vercel.app](https://lockbox-steel.vercel.app)
> Program ID: [`5nr7xe1U3k6U6zPEmW3FCbPyXCa7jr7JpudaLKuVNyvZ`](https://explorer.solana.com/address/5nr7xe1U3k6U6zPEmW3FCbPyXCa7jr7JpudaLKuVNyvZ?cluster=devnet)
> Network: Solana Devnet
> Last Updated: October 2025
>
> ⚠️ **DEMO STATUS - NOT FOR PRODUCTION USE**
> This is a demonstration project for educational purposes. Do NOT store sensitive passwords, private keys, seed phrases, or critical data. The implementation has not undergone professional security audits.

## Features

- **Wallet-Derived Encryption**: All keys derived from your Solana wallet signature using HKDF
- **AEAD Encryption**: XChaCha20-Poly1305 authenticated encryption with nonce uniqueness
- **Zero Persistent Secrets**: No decrypted data or keys stored - everything cleared on refresh
- **Ephemeral Decryption**: Decrypted data exists only in memory, auto-hides after 30s
- **On-Chain Storage**: Encrypted ciphertext, salt, and nonce stored in Solana PDAs
- **Smart Data Detection**: Auto-checks for existing on-chain data and shows Decrypt button accordingly
- **Overwrite Protection**: Checkbox confirmation required before replacing existing data
- **Tab-Based Navigation**: Switch between App, Quick Start guide, and FAQ
- **Activity Log**: Clean, user-friendly transaction log (technical details in browser console)
- **Quick Copy**: One-click copy button for decrypted data
- **Lazy Key Initialization**: Session key only derived when needed (no popup on wallet connect)
- **Polished UI/UX**: Modern design following web3 best practices
- **Mobile-First Design**: Responsive interface optimized for all devices
- **Session Security**: 15-minute inactivity timeout with automatic wallet disconnect
- **Next.js 15**: Latest Next.js with App Router and React Server Components

## Architecture

### Smart Contract (Anchor Program)

- **PDA Storage**: Each user gets a PDA at `["lockbox", user_pubkey]`
- **Size Limits**: Maximum 1 KiB encrypted payload
- **Fee Model**: 0.001 SOL per store operation
- **Access Control**: Owner-only writes, read returns only ciphertext

### Client Cryptography

1. **Key Derivation**:
   - Generate challenge message with domain separation
   - Sign with wallet (obtains Ed25519 signature)
   - HKDF(public_key || signature || salt) → session_key

2. **Encryption Flow**:
   - Client encrypts plaintext with session key
   - XChaCha20-Poly1305 with random nonce
   - Store (ciphertext, nonce, salt) on-chain

3. **Decryption Flow**:
   - Retrieve (ciphertext, nonce, salt) from chain
   - Derive session key from wallet signature
   - Decrypt and display with timed reveal

## Quick Start

### Prerequisites

- Node.js 18+
- Phantom or Solflare wallet
- Devnet SOL (get from [faucet](https://faucet.solana.com))

### Installation

```bash
# Clone the repository
git clone https://github.com/hackingbutlegal/lockbox.git
cd lockbox

# Install dependencies
npm install

# Start development server
npm run dev
```

Visit http://localhost:3000 and connect your Phantom or Solflare wallet.

### Production Build

```bash
# Build for production
npm run build

# Start production server
npm start
```

## Project Structure

```
lockbox/
├── app/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ActivityLog.tsx     # Real-time transaction log
│   │   │   └── FAQ.tsx             # Interactive FAQ component
│   │   ├── utils/
│   │   │   └── secureStorage.ts    # Session storage utilities
│   │   ├── App.tsx                 # Main application component
│   │   ├── App.css                 # Application styles
│   │   └── crypto.ts               # Cryptography utilities
│   ├── layout.tsx                  # Root layout
│   ├── page.tsx                    # Home page (dynamic import)
│   └── globals.css                 # Global styles
├── components/                     # Additional component copies
├── lib/                            # Shared utilities
├── public/                         # Static assets
├── next.config.ts                  # Next.js configuration
├── tailwind.config.ts              # Tailwind configuration
└── vercel.json                     # Vercel deployment config
```

## UI/UX Updates (v2.0.0)

### New Layout
- **Tab Navigation**: Switch between "App", "Quick Start", and "FAQ" views
- **Single Column**: Streamlined layout eliminates sidebar clutter
- **Smart Decrypt Button**: Only appears when on-chain data is detected
- **No Storage History Modal**: Simplified interface removes transaction history popup

### Tab System
- **App Tab**: Main functionality (encrypt, decrypt, activity log)
- **Quick Start Tab**: Step-by-step guide for new users
- **FAQ Tab**: Comprehensive help and documentation
- Available both when logged in and logged out

### Activity Log
- Positioned below Store Data section
- Fixed height for consistent UI
- Scrollable content area

### Smart Features
- **Auto-detect On-chain Data**: Checks for existing encrypted data after wallet connection
- **Conditional Decrypt Button**: Only shows when data is available
- **Overwrite Protection**: Checkbox confirmation required before replacing existing data
- **Copy to Clipboard**: Quick copy button for decrypted data
- **Clear Data**: Option to clear local state and overwrite corrupted accounts

## Cryptography Design

### Key Derivation (HKDF)

```
challenge = domain_separated_message(publicKey, timestamp)
signature = wallet.signMessage(challenge)
salt = random(32 bytes)
session_key = HKDF-SHA256(publicKey || signature || salt, info="lockbox-session-key")
```

### Encryption (XChaCha20-Poly1305)

```
nonce = random(24 bytes)
ciphertext = XChaCha20-Poly1305.encrypt(plaintext, session_key, nonce)
store_on_chain(ciphertext, nonce, salt)
```

### Decryption

```
{ciphertext, nonce, salt} = retrieve_from_chain()
session_key = derive_session_key(wallet.signature, salt)
plaintext = XChaCha20-Poly1305.decrypt(ciphertext, session_key, nonce)
```

## Security Features

- **No Key Storage**: Session keys exist only in memory, never persisted
- **No Data Persistence**: Decrypted data cleared on page refresh
- **Ephemeral Viewing**: Decrypted data auto-hides after 30 seconds
- **Nonce Uniqueness**: Random 24-byte nonces for XChaCha20
- **Memory Scrubbing**: Wipe sensitive data after use
- **Cooldown Rate Limiting**: 10 slots (~4s) between operations
- **Inactivity Timeout**: Auto-disconnect after 15 minutes
- **Size Validation**: Enforce 1 KiB limit before encryption
- **Domain Separation**: Unique context in key derivation
- **Client-Side Only**: No SSR for wallet components (security best practice)

## Error Handling

The program returns precise custom errors:

- `DataTooLarge`: Ciphertext exceeds 1024 bytes
- `InvalidCiphertext`: Empty or malformed data
- `Unauthorized`: Not the lockbox owner
- `CooldownNotElapsed`: Rate limit active
- `FeeTooLow`: Insufficient fee payment

## Next.js Configuration

### Webpack Fallbacks

The app includes necessary polyfills for Solana Web3.js:

```typescript
webpack: (config) => {
  config.resolve.fallback = {
    fs: false,
    net: false,
    tls: false,
  };
  config.externals.push('pino-pretty', 'lokijs', 'encoding');
  return config;
}
```

### Dynamic Imports

Wallet components are dynamically imported with `ssr: false` to prevent hydration errors:

```typescript
const LockboxApp = dynamic(() => import('./src/App'), {
  ssr: false,
  loading: () => <LoadingState />
});
```

## Deployment

### Vercel (Recommended)

The app is optimized for Vercel deployment:

```bash
# Deploy to production
vercel --prod

# Or connect GitHub repo for automatic deployments
```

Configuration in `vercel.json`:
- Framework: Next.js (auto-detected)
- Build command: `npm run build`
- Output directory: `.next`
- SPA rewrites configured

### Other Platforms

```bash
# Build static export (if using static generation)
npm run build

# Deploy dist folder to any static host
```

## Environment Variables

No environment variables required for basic operation. The app uses hardcoded Devnet configuration.

For custom deployment:
```env
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_PROGRAM_ID=5nr7xe1U3k6U6zPEmW3FCbPyXCa7jr7JpudaLKuVNyvZ
```

## Testing

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Test transaction flow:
# 1. Connect wallet (ensure on Devnet)
# 2. Enter test data: "Hello, Lockbox!"
# 3. Click "Encrypt & Store"
# 4. Wait for confirmation
# 5. Click "Decrypt & View Latest"
# 6. Verify decryption works
# 7. Refresh page - data should be cleared
```

## Browser Compatibility

- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support (iOS 14+)
- Mobile browsers: ✅ Optimized for touch

## License

ISC

## Contributing

PRs welcome! Please ensure:

1. Code builds: `npm run build`
2. No TypeScript errors
3. No ESLint errors (warnings allowed)
4. Security-focused changes documented
5. UI changes tested on mobile

## Threat Model

### Mitigated

- ✅ Client-side key theft (keys never persisted)
- ✅ Nonce reuse (random generation)
- ✅ Brute force (rate limiting)
- ✅ Unauthorized access (owner-only PDA)
- ✅ SSR leaks (client-side only rendering)

### Not Mitigated

- ❌ Wallet compromise (full access to all encrypted data)
- ❌ Side-channel attacks (implementation-dependent)
- ❌ Malicious browser extensions (can intercept in-memory keys)

## Roadmap

- [ ] Multi-device sync via deterministic key derivation
- [ ] Versioned encryption (allow algorithm upgrades)
- [ ] Shared lockboxes (multi-sig access)
- [ ] Data expiration (automatic deletion)
- [ ] Export/import encrypted backups
- [ ] PWA support with offline capabilities

---

## Version History

**v2.2.0** (October 2025):
- Fixed double wallet popup on connect (lazy session key initialization)
- Major UI/UX improvements following best practices
- Cleaner Activity Log (technical details moved to browser console)
- Fixed Activity Log scrolling
- Improved spacing, typography, and button states
- Enhanced form elements with better hover/focus states
- Better tab navigation with visual feedback
- Deterministic signature generation for reliable encryption/decryption

**v2.1.0** (October 2025):
- Fixed activity log to show single explorer link per transaction
- Enhanced UX with cleaner transaction flow notifications

**v2.0.0** (October 2025):
- Migrated to Next.js 15 with App Router
- Added tab-based navigation (App / Quick Start / FAQ)
- Redesigned single-column layout
- Added activity log with transaction history
- Removed storage history modal
- Replaced overwrite popup with inline checkbox confirmation
- Added "Clear Stored Data" button for account recovery
- Optimized for Vercel deployment

**v1.1.0** (October 2025):
- Added interactive FAQ
- Implemented ephemeral decryption
- Enhanced security documentation
- Added Vite build optimization

---

Built with [Next.js](https://nextjs.org/) • [Solana](https://solana.com/) • [React](https://react.dev/)

Created with <3 by [GRAFFITO](https://x.com/0xgraffito)
