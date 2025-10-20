#!/bin/bash

# Fix all test files to call mockWalletConnection BEFORE page.goto
for file in e2e/batch-operations.spec.ts e2e/danger-zone-advanced.spec.ts e2e/features-tools.spec.ts e2e/search-filter-favorites.spec.ts; do
  echo "Fixing $file..."
  
  # Use perl for in-place editing with proper multi-line support
  perl -i -p0e 's/(\s+)await page\.goto\([^)]+\);\n\s+await page\.waitForLoadState\([^)]+\);\n\s+await mockWalletConnection\(page\);/\1await mockWalletConnection(page);\n\1await page.goto('\''\/'\''delete);\n\1await page.waitForLoadState('\''networkidle'\'');  \n\1await mockWalletConnection(page);/g' "$file"
  
  # Fix the mess we just made - remove duplicate mockWalletConnection  
  perl -i -pe 's/await mockWalletConnection\(page\);\n.*await mockWallet Connection\(page\);/await mockWalletConnection(page);/g' "$file"
done

echo "Done!"
