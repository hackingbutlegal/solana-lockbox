# Vercel Deployment Guide

## Quick Deploy

The repository is configured for Vercel deployment with the included `vercel.json` configuration.

### Option 1: Deploy via Vercel Dashboard

1. Go to [Vercel](https://vercel.com)
2. Click "Add New Project"
3. Import your GitHub repository: `hackingbutlegal/lockbox`
4. Vercel will auto-detect the configuration from `vercel.json`
5. Click "Deploy"

### Option 2: Deploy via Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy from repository root
vercel

# For production deployment
vercel --prod
```

## Configuration

The `vercel.json` file is already configured with:

- **Build Command**: `cd app && npm install && npm run build`
- **Output Directory**: `app/dist`
- **SPA Routing**: All routes redirect to `/index.html`

## Environment Variables (Optional)

If you want to add environment variables:

1. Go to your Vercel project settings
2. Navigate to "Environment Variables"
3. Add any custom variables (currently none required)

## Troubleshooting

### Blank Page After Deployment

If you see a blank page:

1. **Check Build Logs**: Verify the build completed successfully in Vercel dashboard
2. **Check Browser Console**: Look for JavaScript errors
3. **Verify Assets**: Make sure all assets in `app/dist/assets/` are loading
4. **Force Redeploy**:
   ```bash
   git commit --allow-empty -m "Force redeploy"
   git push
   ```

### Build Fails

If the build fails:

1. **Check Node Version**: Vercel uses Node 18+ by default
2. **Verify Local Build**: Run `cd app && npm run build` locally first
3. **Check Dependencies**: Ensure all dependencies are in `package.json`

### Assets Not Loading

If CSS/JS assets don't load:

1. **Check Asset Paths**: Vercel serves from `/assets/` automatically
2. **Verify Base URL**: The app uses absolute paths starting with `/`
3. **Check Network Tab**: See which assets are 404ing

## Custom Domain

To add a custom domain:

1. Go to your Vercel project
2. Settings → Domains
3. Add your domain
4. Configure DNS as instructed by Vercel

## Monitoring

Once deployed, you can:

- View deployment logs in Vercel dashboard
- Monitor performance via Vercel Analytics
- Check real-time errors via Vercel Monitoring

## Local Preview of Production Build

To test the production build locally:

```bash
cd app
npm run build
npm run preview
```

Visit http://localhost:4173 to see the production build.

---

## Current Deployment Status

- ✅ Repository configured for Vercel
- ✅ `vercel.json` in place
- ✅ Build command set to compile TypeScript + Vite
- ✅ SPA routing configured
- ✅ Output directory: `app/dist`

Push to `main` branch to trigger automatic deployment on Vercel!
