# Converting Solana Lockbox PWA to Android APK

Guide for deploying Solana Lockbox to the Solana dApp Store using Bubblewrap.

## Prerequisites

- Node.js 14.15.0+
- Java Development Kit (JDK) 17+
- Android SDK Build Tools

## Quick Start

```bash
# Install Bubblewrap globally
npm install -g @bubblewrap/cli

# Initialize project
bubblewrap init --manifest https://lockbox.web3stud.io/manifest.json

# Build APK
bubblewrap build

# Result: app-release-signed.apk
```

## Detailed Setup

### 1. Generate Android Keystore

```bash
keytool -genkey -v -keystore lockbox-android.keystore \
  -alias lockbox -keyalg RSA -keysize 2048 -validity 10000

# Save credentials securely!
# Keystore password: [your password]
# Alias password: [your password]
```

### 2. Configure Digital Asset Links

```bash
# Extract SHA256 fingerprint
keytool -list -v -keystore lockbox-android.keystore -alias lockbox

# Look for: SHA256: XX:XX:XX:...

# Generate asset links
bubblewrap fingerprint add <SHA256_fingerprint>
bubblewrap fingerprint generateAssetLinks
```

### 3. Host assetlinks.json

Upload generated file to:
```
https://lockbox.web3stud.io/.well-known/assetlinks.json
```

### 4. Build Release APK

```bash
bubblewrap build

# Output: app-release-signed.apk
# Size: ~10-15MB
```

## Submit to dApp Store

### Install dApp Store CLI

```bash
npm install -g @solana-mobile/dapp-store-cli
```

### Create config.yaml

```yaml
publisher:
  name: "Web3 Studios LLC"
  website: "https://lockbox.web3stud.io"
  email: "support@web3stud.io"

app:
  name: "Solana Lockbox"
  package: "io.web3stud.lockbox"

release:
  version_name: "1.0.0"
  version_code: 1
  display_name: "Solana Lockbox"
  short_description: "Secure blockchain password manager"
  description: |
    Solana Lockbox is a decentralized password manager that stores
    your encrypted passwords on the Solana blockchain. Your data is
    encrypted client-side and only accessible with your wallet.

  icon: "./assets/icon-512x512.png"
  screenshots:
    - "./assets/screenshot1.png"
    - "./assets/screenshot2.png"

  apk: "./app-release-signed.apk"
  category: "TOOLS"
```

### Submit

```bash
# Mint app NFT (first time only)
npx dapp-store create app -k keypair.json -c config.yaml

# Create release
npx dapp-store create release \
  -k keypair.json \
  -b /path/to/android-sdk/build-tools \
  -c config.yaml

# Submit for review
npx dapp-store publish submit \
  -k keypair.json \
  -u https://api.devnet.solana.com \
  --requestor-is-authorized \
  -c config.yaml
```

## Testing

```bash
# Install locally
bubblewrap install app-release-signed.apk

# Or use ADB
adb install app-release-signed.apk
```

## Troubleshooting

**Build fails:**
- Ensure JDK 17+ installed
- Check Android SDK path
- Verify manifest.json is accessible

**App shows browser UI:**
- Asset links not configured
- Wrong SHA256 fingerprint
- assetlinks.json not hosted correctly

**Won't install:**
- Check package name conflicts
- Verify signing certificate
- Try uninstalling old version

## Resources

- [Solana Mobile Docs](https://docs.solanamobile.com/dapp-publishing/publishing-a-pwa)
- [Bubblewrap GitHub](https://github.com/GoogleChromeLabs/bubblewrap)
- [dApp Store Guide](https://docs.solanamobile.com/dapp-publishing/overview)
