#!/bin/bash

# Lockbox v2 Devnet Test Runner
# Runs tests against the deployed devnet program without rebuilding
# Program ID: 7JxsHjdReydiz36jwsWuvwwR28qqK6V454VwFJnnSkoB

set -e

echo "================================================"
echo "Lockbox v2 Devnet Test Suite"
echo "================================================"
echo ""

# Check Solana configuration
echo "📡 Checking Solana configuration..."
CLUSTER=$(solana config get | grep "RPC URL" | awk '{print $3}')
WALLET=$(solana config get | grep "Keypair Path" | awk '{print $3}')
BALANCE=$(solana balance 2>/dev/null || echo "0 SOL")

echo "   Cluster: $CLUSTER"
echo "   Wallet: $WALLET"
echo "   Balance: $BALANCE"
echo ""

# Verify devnet connection
if [[ ! "$CLUSTER" == *"devnet"* ]]; then
    echo "⚠️  Warning: Not connected to devnet!"
    echo "   Run: solana config set --url devnet"
    echo ""
fi

# Check balance
if [[ "$BALANCE" == "0 SOL" ]] || [[ "$BALANCE" == "0.0"* ]]; then
    echo "⚠️  Warning: Low SOL balance for testing"
    echo "   Run: solana airdrop 2"
    echo ""
fi

# Verify program deployment
echo "🔍 Verifying program deployment..."
PROGRAM_ID="7JxsHjdReydiz36jwsWuvwwR28qqK6V454VwFJnnSkoB"
PROGRAM_INFO=$(solana program show $PROGRAM_ID 2>&1)

if [[ "$PROGRAM_INFO" == *"Error"* ]]; then
    echo "❌ Program not found on devnet!"
    echo "   Program ID: $PROGRAM_ID"
    exit 1
else
    echo "✅ Program deployed and active"
    echo "   Program ID: $PROGRAM_ID"
    echo ""
fi

# Run TypeScript tests (without rebuilding)
echo "🧪 Running TypeScript tests..."
echo ""

# Set environment variables for tests
export ANCHOR_PROVIDER_URL="https://api.devnet.solana.com"
export ANCHOR_WALLET="$WALLET"
export ANCHOR_PROGRAM_ID="$PROGRAM_ID"

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Run tests using ts-mocha directly
echo "Running: yarn run ts-mocha -p ./tsconfig.json -t 1000000 tests/lockbox-v2.ts"
echo ""

yarn run ts-mocha -p ./tsconfig.json -t 1000000 tests/lockbox-v2.ts || {
    echo ""
    echo "================================================"
    echo "❌ Tests failed or encountered errors"
    echo "================================================"
    echo ""
    echo "Common issues:"
    echo "1. Insufficient SOL balance - run: solana airdrop 2"
    echo "2. Master lockbox already initialized"
    echo "3. Network connectivity issues"
    echo "4. RPC rate limiting"
    echo ""
    echo "Check logs above for specific error messages."
    exit 1
}

echo ""
echo "================================================"
echo "✅ Devnet tests completed"
echo "================================================"
