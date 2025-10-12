#!/bin/bash
set -e

echo "Current directory: $(pwd)"
echo "Listing contents:"
ls -la

# Navigate to nextjs-app directory
if [ -d "nextjs-app" ]; then
  cd nextjs-app
elif [ -d "../nextjs-app" ]; then
  cd ../nextjs-app
else
  echo "Error: Cannot find nextjs-app directory"
  exit 1
fi

echo "Installing dependencies..."
npm install

echo "Building Next.js application..."
npm run build

echo "Build complete!"
