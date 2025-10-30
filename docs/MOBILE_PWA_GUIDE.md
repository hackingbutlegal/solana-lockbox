# Solana Lockbox - Mobile & PWA Guide

Complete guide for using Solana Lockbox on mobile devices and as a Progressive Web App (PWA).

## Table of Contents
1. [Mobile Wallet Connection](#mobile-wallet-connection)
2. [PWA Installation](#pwa-installation)
3. [Solana Seeker Integration](#solana-seeker-integration)
4. [Offline Support](#offline-support)
5. [Troubleshooting](#troubleshooting)

---

## Mobile Wallet Connection

### Supported Platforms
- ✅ **Android (Chrome)** - Full Mobile Wallet Adapter support
- ⚠️ **iOS** - Use in-app browser or WalletConnect
- ✅ **Solana Seeker** - Native wallet integration

### Connecting Your Wallet on Android

1. **Install a Solana Wallet**
   - [Phantom](https://phantom.app/) (Recommended)
   - [Solflare](https://solflare.com/)
   - [Backpack](https://backpack.app/)

2. **Open Solana Lockbox**
   - Navigate to https://lockbox.web3stud.io
   - Tap "Connect Wallet" button

3. **Authorize Connection**
   - Your wallet app will automatically open
   - Review the connection request
   - Approve to connect

4. **Start Using Lockbox**
   - Create your master vault
   - Add passwords
   - All data encrypted on-device

### iOS Users

Since iOS doesn't support Mobile Wallet Adapter, use one of these methods:

**Option 1: In-App Browser (Recommended)**
1. Open your Solana wallet app (Phantom, Solflare, etc.)
2. Use the built-in browser
3. Navigate to https://lockbox.web3stud.io
4. Connect normally - you're already in the wallet!

**Option 2: WalletConnect**
1. Open Solana Lockbox in Safari
2. Use WalletConnect option (if available)
3. Scan QR code with wallet app

---

## PWA Installation

### What is a PWA?
Progressive Web Apps work like native apps but run in your browser. Benefits:
- **Home screen icon** - Launch like a native app
- **Offline access** - Use even without internet
- **Full screen** - No browser UI clutter
- **Fast loading** - Cached assets

### Installing on Android

1. **Open in Chrome**
   - Navigate to https://lockbox.web3stud.io
   - You may see an "Install" prompt automatically

2. **Manual Installation**
   - Tap the three-dot menu (⋮)
   - Select "Add to Home screen" or "Install app"
   - Confirm installation

3. **Launch the App**
   - Find "Solana Lockbox" icon on home screen
   - Tap to launch in full-screen mode

### Installing on iOS

1. **Open in Safari** (must use Safari, not Chrome)
   - Navigate to https://lockbox.web3stud.io

2. **Add to Home Screen**
   - Tap the Share button (square with arrow)
   - Scroll and tap "Add to Home Screen"
   - Name it "Solana Lockbox"
   - Tap "Add"

3. **Launch the App**
   - Tap the new icon on your home screen

### Installing on Desktop (Chrome/Edge)

1. Look for the install icon in the address bar
2. Click "Install Solana Lockbox"
3. App appears in your applications list
4. Launch from Start Menu (Windows) or Applications (Mac)

---

## Solana Seeker Integration

### What is Solana Seeker?
Solana Seeker is a Web3-native Android phone with built-in Seed Vault for secure key storage.

### Features on Seeker
- ✅ **Native Wallet Integration** - Direct Seed Vault access
- ✅ **Hardware-Backed Security** - Keys stored in secure processor
- ✅ **Optimized Performance** - Built for Solana dApps
- ✅ **Seamless Signing** - Fast transaction approvals

### Setup on Seeker

1. **Pre-installed Wallet**
   - Seeker comes with built-in Solana wallet
   - Uses Seed Vault for maximum security

2. **Install Solana Lockbox**
   - Open Chrome browser
   - Navigate to https://lockbox.web3stud.io
   - Install as PWA (see above)

3. **Connect to Seed Vault Wallet**
   - Tap "Connect Wallet"
   - Select "Use Installed Wallet"
   - Authorize with biometrics/PIN
   - Connected securely!

4. **Why Seeker is Better**
   - Keys never leave Seed Vault
   - Biometric authentication
   - Fast, secure signatures
   - Purpose-built for Web3

---

## Offline Support

### What Works Offline?
✅ **Browse passwords** - View saved entries
✅ **Search and filter** - Find passwords instantly
✅ **Copy passwords** - Access when you need them
✅ **View notes** - Read secure notes
✅ **UI navigation** - Full app interface

### What Requires Internet?
❌ **Initial load** - First visit needs connection
❌ **Wallet connection** - Requires network
❌ **Save new passwords** - Blockchain transactions
❌ **Sync changes** - Update encrypted data
❌ **Delete entries** - On-chain operations

### How Offline Mode Works

**Service Worker Caching:**
- Static assets cached automatically
- App loads instantly on repeat visits
- No data downloaded in background
- Updates only when online

**Security Note:**
- Your encrypted passwords are cached locally
- Only YOU can decrypt them (wallet-based encryption)
- Clearing browser data removes cached passwords
- Always keep wallet backup safe!

---

## Troubleshooting

### Wallet Won't Connect (Android)

**Problem:** "Connect Wallet" button doesn't work

**Solutions:**
1. **Use Chrome** - Other browsers not supported
   ```
   Open Settings > Apps > Chrome > Set as default
   ```

2. **Update Wallet App**
   - Open Google Play Store
   - Search for your wallet (Phantom, Solflare, etc.)
   - Tap "Update" if available

3. **Clear Browser Cache**
   - Chrome Settings > Privacy > Clear browsing data
   - Select "Cached images and files"
   - Clear data, then retry

4. **Check Wallet Permissions**
   - Settings > Apps > [Your Wallet]
   - Permissions > Allow all required permissions

### PWA Won't Install

**Problem:** No "Install" option appears

**Solutions:**
1. **Android**
   - Must use Chrome browser
   - Visit site 2-3 times (triggers install prompt)
   - Look for banner at bottom of screen

2. **iOS**
   - Must use Safari (Chrome won't work)
   - Use Share button, not menu
   - Scroll down in share sheet to find "Add to Home Screen"

3. **Desktop**
   - Look for ⊕ icon in address bar
   - Or: Menu > More tools > Create shortcut
   - Check "Open as window"

### Slow Performance on Mobile

**Problem:** App is laggy or slow to load

**Solutions:**
1. **Clear App Cache**
   - Uninstall PWA
   - Clear browser cache
   - Reinstall PWA

2. **Check Storage Space**
   - Need at least 100MB free
   - Android: Settings > Storage
   - iOS: Settings > General > iPhone Storage

3. **Update Browser**
   - Chrome or Safari to latest version
   - Check Google Play / App Store

4. **Disable Battery Saver**
   - Can throttle JavaScript
   - Settings > Battery > Battery Saver > Off

### Transaction Failures

**Problem:** "Transaction failed" when saving passwords

**Solutions:**
1. **Check Wallet Balance**
   - Need ~0.001 SOL for transactions
   - Get devnet SOL: https://faucet.solana.com

2. **Network Issues**
   - Switch to better WiFi/mobile data
   - Wait for network to stabilize
   - Retry transaction

3. **RPC Errors**
   - Solana devnet can be slow
   - Wait 30 seconds, retry
   - Try again during off-peak hours

4. **Wallet Disconnected**
   - Wallet connection timed out
   - Tap "Connect Wallet" again
   - Approve connection

### Offline Mode Issues

**Problem:** Can't access passwords offline

**Solutions:**
1. **Initial Load Required**
   - Must visit site online at least once
   - Service worker needs to install
   - Refresh page while online

2. **Cache Cleared**
   - Don't clear browser data
   - Passwords stored encrypted locally
   - Re-visit online to re-cache

3. **PWA Not Installed**
   - Offline works better with PWA
   - Install to home screen (see above)

---

## Advanced: Building for dApp Store

Want to submit Solana Lockbox to the Solana dApp Store? See our [Bubblewrap Deployment Guide](./BUBBLEWRAP_DEPLOYMENT.md) for step-by-step instructions on converting this PWA to an Android APK.

---

## Support

- **Issues:** https://github.com/hackingbutlegal/solana-lockbox/issues
- **Docs:** https://docs.solana.com/developing/clients/javascript-api
- **Solana Mobile:** https://docs.solanamobile.com

---

**Pro Tip:** For best experience on Solana Seeker, install as PWA and use the native Seed Vault wallet. It's faster, more secure, and optimized for Web3!
