#!/bin/bash

# Lockbox v2 Deployment Verification Script
# Verifies program deployment, IDL integrity, and basic functionality

set -e

PROGRAM_ID="7JxsHjdReydiz36jwsWuvwwR28qqK6V454VwFJnnSkoB"
EXPECTED_SIZE=355672

echo "================================================"
echo "Lockbox v2 Deployment Verification"
echo "================================================"
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

success() {
    echo -e "${GREEN}✓${NC} $1"
}

error() {
    echo -e "${RED}✗${NC} $1"
}

warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# 1. Check Solana Configuration
echo "1. Checking Solana Configuration"
echo "   ---"
CLUSTER=$(solana config get | grep "RPC URL" | awk '{print $3}')
WALLET=$(solana config get | grep "Keypair Path" | awk '{print $3}')
BALANCE=$(solana balance 2>/dev/null | awk '{print $1}')

if [[ "$CLUSTER" == *"devnet"* ]]; then
    success "Connected to devnet: $CLUSTER"
else
    error "Not connected to devnet!"
    echo "   Current: $CLUSTER"
    echo "   Run: solana config set --url devnet"
    exit 1
fi

success "Wallet: $WALLET"
success "Balance: $BALANCE SOL"
echo ""

# 2. Verify Program Deployment
echo "2. Verifying Program Deployment"
echo "   ---"
PROGRAM_INFO=$(solana program show $PROGRAM_ID 2>&1)

if [[ "$PROGRAM_INFO" == *"Error"* ]]; then
    error "Program not found on devnet!"
    exit 1
fi

success "Program ID: $PROGRAM_ID"

# Extract program details
PROGRAM_SIZE=$(echo "$PROGRAM_INFO" | grep "Data Length" | awk '{print $3}')
AUTHORITY=$(echo "$PROGRAM_INFO" | grep "Authority" | awk '{print $2}')
SLOT=$(echo "$PROGRAM_INFO" | grep "Last Deployed" | awk '{print $5}')
BALANCE_SOL=$(echo "$PROGRAM_INFO" | grep "Balance" | awk '{print $2}')

success "Program Size: $PROGRAM_SIZE bytes"
success "Authority: $AUTHORITY"
success "Deployed Slot: $SLOT"
success "Program Balance: $BALANCE_SOL SOL"

if [ "$PROGRAM_SIZE" == "$EXPECTED_SIZE" ]; then
    success "Program size matches expected ($EXPECTED_SIZE bytes)"
else
    warning "Program size differs from expected"
    echo "   Expected: $EXPECTED_SIZE bytes"
    echo "   Actual: $PROGRAM_SIZE bytes"
fi
echo ""

# 3. Verify IDL Files
echo "3. Verifying IDL Files"
echo "   ---"

if [ -f "sdk/idl/lockbox-v2.json" ]; then
    success "Root IDL exists: sdk/idl/lockbox-v2.json"

    # Check IDL contents
    IDL_PROGRAM_ID=$(cat sdk/idl/lockbox-v2.json | grep '"address"' | head -1 | awk -F'"' '{print $4}')
    if [ "$IDL_PROGRAM_ID" == "$PROGRAM_ID" ]; then
        success "IDL program ID matches: $IDL_PROGRAM_ID"
    else
        error "IDL program ID mismatch!"
        echo "   Expected: $PROGRAM_ID"
        echo "   IDL has: $IDL_PROGRAM_ID"
    fi

    # Count instructions
    INSTRUCTION_COUNT=$(cat sdk/idl/lockbox-v2.json | grep -c '"name":' | head -1)
    success "IDL contains instructions"

    # Check for errors
    ERROR_COUNT=$(cat sdk/idl/lockbox-v2.json | grep -A1 '"errors"' | grep -c '"code"')
    if [ "$ERROR_COUNT" -gt 0 ]; then
        success "IDL contains $ERROR_COUNT error definitions"
    else
        warning "IDL has no error definitions"
    fi
else
    error "Root IDL not found!"
fi

if [ -f "nextjs-app/sdk/idl/lockbox-v2.json" ]; then
    success "Next.js IDL exists: nextjs-app/sdk/idl/lockbox-v2.json"

    # Verify they match
    if diff -q sdk/idl/lockbox-v2.json nextjs-app/sdk/idl/lockbox-v2.json > /dev/null; then
        success "Both IDL files are synchronized"
    else
        warning "IDL files differ! They should be identical."
    fi
else
    warning "Next.js IDL not found"
fi
echo ""

# 4. Check TypeScript SDK
echo "4. Checking TypeScript SDK"
echo "   ---"

if [ -f "sdk/src/client-v2.ts" ]; then
    success "SDK client exists: sdk/src/client-v2.ts"

    # Check if program ID matches
    SDK_PROGRAM_ID=$(grep "PROGRAM_ID = new PublicKey" sdk/src/client-v2.ts | awk -F"'" '{print $2}')
    if [ "$SDK_PROGRAM_ID" == "$PROGRAM_ID" ]; then
        success "SDK program ID matches: $SDK_PROGRAM_ID"
    else
        error "SDK program ID mismatch!"
        echo "   Expected: $PROGRAM_ID"
        echo "   SDK has: $SDK_PROGRAM_ID"
    fi
else
    error "SDK client not found!"
fi

if [ -f "sdk/src/types-v2.ts" ]; then
    success "SDK types exist: sdk/src/types-v2.ts"
else
    warning "SDK types not found"
fi
echo ""

# 5. Verify Test Files
echo "5. Verifying Test Files"
echo "   ---"

if [ -f "tests/lockbox-v2.ts" ]; then
    success "Anchor test suite exists"
else
    warning "Anchor test suite not found"
fi

if [ -f "sdk/tests/integration.test.ts" ]; then
    success "SDK integration tests exist"
else
    warning "SDK integration tests not found"
fi

if [ -f "run-devnet-tests.sh" ] && [ -x "run-devnet-tests.sh" ]; then
    success "Test runner script exists and is executable"
else
    warning "Test runner script missing or not executable"
fi
echo ""

# 6. Check Documentation
echo "6. Checking Documentation"
echo "   ---"

DOCS=("TESTING.md" "STATUS.md" "TOOLCHAIN.md" "README.md")
for doc in "${DOCS[@]}"; do
    if [ -f "$doc" ]; then
        success "$doc exists"
    else
        warning "$doc not found"
    fi
done
echo ""

# 7. Verify Next.js App
echo "7. Verifying Next.js App"
echo "   ---"

if [ -d "nextjs-app" ]; then
    success "Next.js app directory exists"

    if [ -f "nextjs-app/package.json" ]; then
        success "Next.js package.json exists"
    fi

    if [ -d "nextjs-app/node_modules" ]; then
        success "Next.js dependencies installed"
    else
        warning "Next.js dependencies not installed (run: cd nextjs-app && npm install)"
    fi
else
    error "Next.js app directory not found!"
fi
echo ""

# 8. Test Program Accessibility
echo "8. Testing Program Accessibility"
echo "   ---"

# Try to fetch program account
if solana account $PROGRAM_ID > /dev/null 2>&1; then
    success "Program account is accessible"
else
    error "Cannot access program account"
fi

# Check if we can query the program
PROGRAM_ACCOUNTS=$(solana program show $PROGRAM_ID 2>&1 | grep -c "Program Id")
if [ "$PROGRAM_ACCOUNTS" -ge 1 ]; then
    success "Program details queryable"
else
    warning "Program details query failed"
fi
echo ""

# 9. Summary
echo "================================================"
echo "Verification Summary"
echo "================================================"
echo ""
echo "Program Information:"
echo "  • Program ID: $PROGRAM_ID"
echo "  • Size: $PROGRAM_SIZE bytes"
echo "  • Deployed Slot: $SLOT"
echo "  • Authority: $AUTHORITY"
echo "  • Balance: $BALANCE_SOL SOL"
echo ""
echo "Network Information:"
echo "  • Cluster: $CLUSTER"
echo "  • Your Wallet: $WALLET"
echo "  • Your Balance: $BALANCE SOL"
echo ""
echo "View on Solana Explorer:"
echo "  https://explorer.solana.com/address/$PROGRAM_ID?cluster=devnet"
echo ""

success "Deployment verification complete!"
echo ""
echo "Next Steps:"
echo "  1. Run tests: ./run-devnet-tests.sh"
echo "  2. Start Next.js: cd nextjs-app && npm run dev"
echo "  3. Manual testing via UI at http://localhost:3000"
echo ""
