#!/bin/bash

# Verify Devnet Deployment Script
# Checks that the recovery_v2 program is properly deployed on devnet

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

PROGRAM_ID="7JxsHjdReydiz36jwsWuvwwR28qqK6V454VwFJnnSkoB"
RPC_URL="https://api.devnet.solana.com"

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}Devnet Deployment Verification${NC}"
echo -e "${CYAN}========================================${NC}\n"

echo -e "${YELLOW}Program ID:${NC} $PROGRAM_ID"
echo -e "${YELLOW}RPC URL:${NC} $RPC_URL\n"

# Check if program exists
echo -e "${CYAN}Checking program account...${NC}"
PROGRAM_INFO=$(solana program show $PROGRAM_ID --url $RPC_URL 2>&1)

if echo "$PROGRAM_INFO" | grep -q "ProgramData Address"; then
    echo -e "${GREEN}✓ Program found on devnet${NC}\n"
    echo "$PROGRAM_INFO"
else
    echo -e "${RED}✗ Program not found on devnet${NC}"
    echo "$PROGRAM_INFO"
    exit 1
fi

# Check program size
echo -e "\n${CYAN}Checking program size...${NC}"
PROGRAM_DATA=$(echo "$PROGRAM_INFO" | grep "ProgramData Address" | awk '{print $3}')
if [ -n "$PROGRAM_DATA" ]; then
    SIZE=$(solana account $PROGRAM_DATA --url $RPC_URL | grep "Length" | awk '{print $2}')
    echo -e "${GREEN}✓ Program size: $SIZE bytes${NC}"
fi

# Check if program is upgradeable
echo -e "\n${CYAN}Checking upgrade authority...${NC}"
AUTHORITY=$(echo "$PROGRAM_INFO" | grep "Authority" | awk '{print $2}')
if [ -n "$AUTHORITY" ]; then
    echo -e "${GREEN}✓ Upgrade authority: $AUTHORITY${NC}"
else
    echo -e "${YELLOW}⚠ Program is not upgradeable${NC}"
fi

# Check last deployed slot
echo -e "\n${CYAN}Checking deployment slot...${NC}"
LAST_SLOT=$(echo "$PROGRAM_INFO" | grep "Last Deployed In Slot" | awk '{print $5}')
if [ -n "$LAST_SLOT" ]; then
    echo -e "${GREEN}✓ Last deployed in slot: $LAST_SLOT${NC}"
fi

# Try to get account info (to verify program is executable)
echo -e "\n${CYAN}Verifying program is executable...${NC}"
ACCOUNT_INFO=$(solana account $PROGRAM_ID --url $RPC_URL)
if echo "$ACCOUNT_INFO" | grep -q "Executable: true"; then
    echo -e "${GREEN}✓ Program is executable${NC}"
else
    echo -e "${RED}✗ Program is not executable${NC}"
    exit 1
fi

# Summary
echo -e "\n${CYAN}========================================${NC}"
echo -e "${GREEN}✓ Deployment verification complete!${NC}"
echo -e "${CYAN}========================================${NC}\n"

echo -e "Program is ready for integration testing."
echo -e "Run: ${YELLOW}npx ts-node tests/integration/recovery-v2-integration.ts${NC}\n"
