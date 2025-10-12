#!/bin/bash
set -e

echo "Current directory: $(pwd)"
echo "Listing contents:"
ls -la

# Navigate to app directory
if [ -d "app" ]; then
  cd app
elif [ -d "../app" ]; then
  cd ../app
else
  echo "Error: Cannot find app directory"
  exit 1
fi

echo "Installing dependencies..."
npm install

echo "Building application..."
npm run build

echo "Build complete!"
