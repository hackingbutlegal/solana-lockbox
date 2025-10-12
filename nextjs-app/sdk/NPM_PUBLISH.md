# Publishing lockbox-solana-sdk to npm

## Prerequisites

1. An npm account (create at https://www.npmjs.com/signup)
2. npm CLI installed (comes with Node.js)

## Steps to Publish

### 1. Login to npm

```bash
cd sdk
npm login
```

Enter your npm credentials when prompted:
- Username
- Password
- Email
- 2FA code (if enabled)

### 2. Verify Package

Check that everything looks good:

```bash
# Dry run to see what will be published
npm publish --dry-run

# Check the tarball contents
npm pack
tar -tzf lockbox-solana-sdk-0.1.0.tgz
```

### 3. Publish

```bash
npm publish --access public
```

### 4. Verify Publication

Visit: https://www.npmjs.com/package/lockbox-solana-sdk

Or install it:

```bash
npm install lockbox-solana-sdk
```

## Updating Documentation After Publishing

Once published, update these files to use the correct package name:

1. **README.md** (root):
```bash
npm install lockbox-solana-sdk
```

2. **sdk/README.md**:
```bash
npm install lockbox-solana-sdk
```

3. **DEVELOPER_GUIDE.md**:
```bash
npm install lockbox-solana-sdk
```

Then commit and push:

```bash
git add README.md sdk/README.md DEVELOPER_GUIDE.md
git commit -m "Update package name in documentation after npm publish"
git push origin main
```

## Version Updates

For future releases:

```bash
# Update version
cd sdk
npm version patch  # or minor, or major

# Build
npm run build

# Publish
npm publish --access public

# Commit version bump
git add package.json
git commit -m "Bump SDK version to $(node -p "require('./package.json').version")"
git push origin main
```

## Troubleshooting

### "Package name too similar to existing package"

The name `lockbox-solana-sdk` should be unique. If not, try:
- `lockbox-solana`
- `solana-lockbox-sdk`
- `lockbox-encryption-sdk`

### "You need to authorize this machine"

Run `npm login` first.

### "Publishing failed"

Check:
1. You're logged in: `npm whoami`
2. Package builds: `npm run build`
3. No `.npmignore` excluding important files
4. Version isn't already published

## Package Info

- **Name**: lockbox-solana-sdk
- **Version**: 0.1.0
- **Registry**: https://registry.npmjs.org/
- **Scope**: None (public, no namespace)
- **License**: ISC

## After Publishing

Don't forget to:

1. ✅ Update all documentation with the published package name
2. ✅ Create a GitHub release/tag for v0.1.0
3. ✅ Announce on social media
4. ✅ Update the live demo to use the published package
