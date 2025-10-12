# Lockbox Next.js Deployment Guide

## ✅ Current Status

- **Frontend**: ✅ Live Demo on Vercel
- **URL**: https://lockbox-steel.vercel.app
- **Program ID**: `5nr7xe1U3k6U6zPEmW3FCbPyXCa7jr7JpudaLKuVNyvZ`
- **Network**: Solana Devnet
- **Framework**: Next.js 15.5.4
- **Status**: Demo/Educational - NOT FOR PRODUCTION USE

⚠️ **IMPORTANT**: This is a demonstration project. Do NOT store sensitive passwords, private keys, seed phrases, or critical data. The implementation has not undergone professional security audits.

[View on Vercel](https://vercel.com/hackingbutlegals-projects/nextjs-app)

---

## Quick Deploy

### Vercel (Recommended)

**Option 1: GitHub Integration**
1. Fork repository: https://github.com/hackingbutlegal/lockbox
2. Go to [Vercel Dashboard](https://vercel.com/new)
3. Import your GitHub repository
4. Vercel auto-detects Next.js configuration
5. Click "Deploy"

**Option 2: Vercel CLI**
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy from repository root
vercel

# Deploy to production
vercel --prod
```

### Manual Deployment

```bash
# Build for production
npm run build

# Test production build locally
npm start

# Deploy .next folder + public + package.json to your hosting
```

---

## Features

###Working Features ✅
- ✅ Client-side XChaCha20-Poly1305 encryption
- ✅ HKDF key derivation from wallet signatures
- ✅ On-chain storage in Program Derived Addresses
- ✅ Tab-based navigation (App / Quick Start / FAQ)
- ✅ Smart data detection (auto-checks for existing on-chain data)
- ✅ Conditional Decrypt button (only shows when data exists)
- ✅ Overwrite warning before replacing data
- ✅ Real-time activity log with transaction history
- ✅ Real-time activity logging
- ✅ Quick copy button for decrypted data
- ✅ Ephemeral decryption (cleared on refresh)
- ✅ Auto-hide decrypted data after 30 seconds
- ✅ Wallet adapter integration (Phantom, Solflare)
- ✅ Mobile-first responsive design
- ✅ Session timeout (15 minutes inactivity)
- ✅ Memory scrubbing for sensitive data
- ✅ 0.001 SOL fee per storage operation
- ✅ 10-slot cooldown rate limiting
- ✅ Next.js 15 with App Router
- ✅ Dynamic imports for wallet components
- ✅ Webpack polyfills for Solana dependencies

### UI Improvements (v2.2.0)
- Three-tab navigation (App, Quick Start, FAQ)
- Quick Start guide for new users
- Single-column centered layout (max-width 800px)
- Smart Decrypt button (only appears when data exists)
- Overwrite protection with inline checkbox confirmation (no popup)
- Copy to clipboard functionality
- Scrollable Activity Log with clean user-facing messages
- Technical debug info moved to browser console for power users
- Clear Stored Data button for account recovery
- Transaction confirmations link to Solana Explorer
- Lazy session key initialization (no popup on wallet connect)
- Polished UI following modern design best practices
- Enhanced form elements with hover/focus states
- Better button states and transitions
- Improved spacing and typography
- Removed storage history modal
- Optimized mobile experience

---

## Development

### Local Development

```bash
# Clone repository
git clone https://github.com/hackingbutlegal/lockbox.git
cd lockbox

# Install dependencies
npm install

# Start dev server (with hot reload)
npm run dev

# Visit http://localhost:3000
```

### Build for Production

```bash
# Create optimized production build
npm run build

# Test production build locally
npm start

# Check build output
ls -la .next/
```

### Environment Setup

No environment variables required by default. Optional:

```bash
# .env.local (optional)
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_PROGRAM_ID=5nr7xe1U3k6U6zPEmW3FCbPyXCa7jr7JpudaLKuVNyvZ
```

---

## Configuration Files

### next.config.ts

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    config.externals.push('pino-pretty', 'lokijs', 'encoding');
    return config;
  },
};

export default nextConfig;
```

### vercel.json

```json
{
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/"
    }
  ]
}
```

---

## Testing

### Test Flow

1. **Connect Wallet**: Ensure wallet is on Devnet
2. **Get Devnet SOL**: Use [faucet](https://faucet.solana.com)
3. **Store Data**: Enter text (max ~1000 bytes), click "Encrypt & Store"
4. **Check Activity Log**: Verify transaction success
5. **Decrypt Data**: Click "Decrypt & View Latest"
6. **Verify Auto-Hide**: Data should hide after 30 seconds
7. **Test Refresh**: Refresh page, decrypted data should be cleared
8. **Test FAQ Tab**: Switch to FAQ tab, verify content

### Browser Testing

Test on:
- ✅ Chrome/Edge (Desktop & Mobile)
- ✅ Firefox (Desktop & Mobile)
- ✅ Safari (macOS & iOS)
- ✅ Mobile browsers (responsive design)

---

## Troubleshooting

### Common Issues

**Issue**: "Buffer is not defined"
**Solution**: This is handled by dynamic imports with `ssr: false`. Ensure you're not importing wallet components at the top level.

**Issue**: Webpack errors about Node.js modules
**Solution**: Check `next.config.ts` has proper fallbacks (fs, net, tls set to false)

**Issue**: Hydration mismatch
**Solution**: Wallet components are dynamically imported. Don't render wallet UI during SSR.

**Issue**: Build fails on Vercel
**Solution**: Ensure `package-lock.json` is committed and dependencies are compatible


### Debug Commands

```bash
# View build logs
npm run build

# Check for TypeScript errors
npx tsc --noEmit

# Check for ESLint issues
npx eslint .

# Clear Next.js cache
rm -rf .next

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

---

## Security Considerations

### Implemented Security

- ✅ **No SSR for wallets**: Dynamic imports with `ssr: false`
- ✅ **Client-side encryption**: All crypto happens in browser
- ✅ **No key persistence**: Keys only in memory
- ✅ **Ephemeral decryption**: Cleared on page refresh
- ✅ **Session timeouts**: 15-minute inactivity limit
- ✅ **Memory scrubbing**: Sensitive data wiped
- ✅ **Rate limiting**: 10-slot cooldown on-chain

### Production Checklist

Before mainnet deployment:
- [ ] Security audit by third party
- [ ] Penetration testing
- [ ] Code review by multiple developers
- [ ] Bug bounty program
- [ ] Incident response plan
- [ ] Monitoring and alerting
- [ ] Legal compliance review
- [ ] Insurance coverage

---

## Performance

### Build Stats

```
Route (app)                Size     First Load JS
┌ ○ /                    1.54 kB      114 kB
└ ○ /_not-found            0 B        113 kB
+ First Load JS shared   114 kB
```

### Optimization

- ✅ Dynamic imports for wallet components
- ✅ Code splitting via Next.js
- ✅ Minified production builds
- ✅ Tree shaking for unused code
- ✅ Image optimization (Next.js Image component available)

---

## Monitoring

### Vercel Analytics

Enable in Vercel dashboard:
- Real User Monitoring (RUM)
- Web Vitals tracking
- Error logging
- Performance metrics

### Custom Monitoring

```typescript
// Add to app layout
if (typeof window !== 'undefined') {
  window.addEventListener('error', (e) => {
    console.error('Global error:', e);
    // Send to monitoring service
  });
}
```

---

## Support

For issues:
1. Check [README.md](./README.md) for documentation
2. Review browser console for errors
3. Check activity log for transaction details
4. View transactions on [Solana Explorer](https://explorer.solana.com)
5. Open issue on [GitHub](https://github.com/hackingbutlegal/lockbox/issues)

---

## Links

- **Live Demo**: https://lockbox-steel.vercel.app
- **GitHub**: https://github.com/hackingbutlegal/lockbox
- **Program**: https://explorer.solana.com/address/5nr7xe1U3k6U6zPEmW3FCbPyXCa7jr7JpudaLKuVNyvZ?cluster=devnet
- **Vercel**: https://vercel.com/hackingbutlegals-projects/nextjs-app

---

**Last Updated**: October 2025
**Version**: v2.2.0
**Status**: ⚠️ Demo/Educational Only - Not Audited

Created with <3 by [GRAFFITO](https://x.com/0xgraffito)
