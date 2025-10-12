# Vercel Deployment Setup for Solana Lockbox v2.0

## New Vercel Project Setup

This repository needs its own separate Vercel deployment from the original lockbox.

### Step 1: Create New Vercel Project

1. Go to https://vercel.com/new
2. Click "Import Project"
3. Select "Import Git Repository"
4. Choose: `hackingbutlegal/solana-lockbox`
5. Click "Import"

### Step 2: Configure Project Settings

**Framework Preset**: Next.js

**Root Directory**: `nextjs-app`

**Build Command**: 
```bash
npm install && npm run build
```

**Output Directory**: 
```
.next
```

**Install Command**:
```bash
npm install
```

### Step 3: Environment Variables

No environment variables required for now.

(Future: Add Solana RPC endpoints, program IDs, etc.)

### Step 4: Deploy

Click "Deploy" and wait for the build to complete.

### Expected URLs

- **Production**: `https://solana-lockbox.vercel.app` (or custom domain)
- **Preview**: Automatic preview URLs for each PR

---

## Alternative: CLI Deployment

If you prefer to use Vercel CLI:

```bash
# Install Vercel CLI
npm i -g vercel

# Navigate to project
cd /Users/graffito/solana-lockbox

# Login to Vercel
vercel login

# Deploy (first time - will create project)
vercel

# Follow prompts:
# - Set up and deploy? Y
# - Which scope? [your account]
# - Link to existing project? N
# - What's your project's name? solana-lockbox
# - In which directory is your code located? nextjs-app
# - Want to modify settings? N

# Deploy to production
vercel --prod
```

---

## Vercel Project Settings

### Build & Development Settings

- **Framework Preset**: Next.js
- **Build Command**: `npm run build`
- **Output Directory**: `.next`
- **Install Command**: `npm install`
- **Development Command**: `npm run dev`

### Root Directory

Set to: `nextjs-app`

This ensures Vercel builds from the Next.js app directory.

---

## Continuous Deployment

Once set up, Vercel will automatically:

- Deploy every push to `main` branch → Production
- Deploy every PR → Preview URL
- Run builds on every commit

---

## Comparison with Original Lockbox

| Setting | lockbox (original) | solana-lockbox (new) |
|---------|-------------------|----------------------|
| **Repository** | `hackingbutlegal/lockbox` | `hackingbutlegal/solana-lockbox` |
| **Project Name** | lockbox | solana-lockbox |
| **URL** | lockbox-*.vercel.app | solana-lockbox-*.vercel.app |
| **Branch** | main | main |
| **Root Dir** | nextjs-app | nextjs-app |
| **Purpose** | Production v2.2.0 | Development v2.0 |

---

## Next Steps After Deployment

1. ✅ Verify deployment works at the Vercel URL
2. ⏳ Update README with live deployment URL
3. ⏳ Configure custom domain (optional)
4. ⏳ Set up environment variables for Solana endpoints
5. ⏳ Enable preview deployments for PR testing

---

## Troubleshooting

### Build Fails

Check that:
- Root directory is set to `nextjs-app`
- Node version is 18+ (set in package.json engines if needed)
- All dependencies are in package.json

### 404 on Routes

Ensure Next.js App Router is properly configured in `nextjs-app/app/`

### Environment Variables

For Solana connections, you may need to add:
- `NEXT_PUBLIC_SOLANA_NETWORK=devnet`
- `NEXT_PUBLIC_PROGRAM_ID=<program_id>`

(Add these in Vercel dashboard → Settings → Environment Variables)

---

## Support

- **Vercel Docs**: https://vercel.com/docs
- **Next.js Docs**: https://nextjs.org/docs
- **Repository**: https://github.com/hackingbutlegal/solana-lockbox
- **Issues**: https://github.com/hackingbutlegal/solana-lockbox/issues

---

Built with Anchor • Solana • Next.js  
Deployed on Vercel

Created by GRAFFITO (@0xgraffito)
