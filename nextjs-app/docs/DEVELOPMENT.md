# Development Guide

Complete guide for developers working on Solana Lockbox.

## Table of Contents

- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Core Concepts](#core-concepts)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Common Tasks](#common-tasks)
- [Debugging](#debugging)
- [Performance](#performance)

## Getting Started

### Environment Setup

#### 1. Install Dependencies

```bash
# Node.js 18+ and npm 9+
node -v  # Should be >= 18.0.0
npm -v   # Should be >= 9.0.0

# Install project dependencies
cd nextjs-app
npm install
```

#### 2. Install Solana CLI (Optional but Recommended)

```bash
# macOS/Linux
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"

# Verify installation
solana --version
```

#### 3. Set Up Environment Variables

```bash
# Copy example env file
cp .env.example .env.local

# Required variables
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_PROGRAM_ID=7JxsHjdReydiz36jwsWuvwwR28qqK6V454VwFJnnSkoB
```

#### 4. Install Browser Wallet

Install one of these Solana wallets in your browser:
- [Phantom](https://phantom.app)
- [Solflare](https://solflare.com)
- [Backpack](https://backpack.app)

#### 5. Get Devnet SOL

```bash
# Using Solana CLI
solana airdrop 2 <YOUR_WALLET_ADDRESS> --url devnet

# Or use web faucet
# Visit https://faucet.solana.com
```

### Running the Application

```bash
# Development mode (with hot reload)
npm run dev

# Production build
npm run build
npm start

# Analyze bundle size
npm run build -- --analyze
```

## Project Structure

```
nextjs-app/
├── app/                          # Next.js 15 App Router
│   ├── layout.tsx               # Root layout (providers, global styles)
│   ├── page.tsx                 # Home page
│   └── globals.css              # Global styles
│
├── components/                   # React Components
│   ├── features/                # Feature-specific components
│   │   ├── PasswordList.tsx
│   │   ├── PasswordForm.tsx
│   │   └── SubscriptionManager.tsx
│   ├── layout/                  # Layout components
│   │   ├── Header.tsx
│   │   └── Sidebar.tsx
│   ├── modals/                  # Modal dialogs
│   │   ├── PasswordEntryModal.tsx
│   │   └── ConfirmDialog.tsx
│   └── ui/                      # Reusable UI components
│       ├── Button.tsx
│       ├── Input.tsx
│       └── PendingChangesBar.tsx
│
├── contexts/                     # React Context Providers
│   ├── AuthContext.tsx          # Session management
│   ├── PasswordContext.tsx      # Password operations + batching
│   ├── LockboxContext.tsx       # Blockchain state
│   ├── SubscriptionContext.tsx  # Subscription management
│   └── index.ts                 # Barrel exports
│
├── lib/                          # Core Libraries
│   ├── crypto.ts                # Encryption, HKDF, session keys
│   ├── password-health-analyzer.ts  # Password security analysis
│   ├── search-manager.ts        # Encrypted search
│   ├── batch-operations.ts      # Bulk operations
│   ├── pending-changes-manager.ts   # Batched updates (new)
│   ├── import-export.ts         # Import/export with CSV protection
│   ├── validation-schemas.ts    # Zod validation schemas
│   ├── errors.ts                # Standardized error classes (new)
│   └── __tests__/               # Unit tests
│       ├── crypto.test.ts
│       ├── password-health-analyzer.test.ts
│       ├── import-export.test.ts
│       ├── search-manager.test.ts
│       └── batch-operations.test.ts
│
├── sdk/                          # Solana Program SDK
│   └── src/
│       ├── client-v2.ts         # Anchor program client (main)
│       ├── types-v2.ts          # TypeScript types
│       ├── utils.ts             # Helper functions
│       └── idl/                 # Anchor IDL files
│           └── lockbox-v2.json
│
├── public/                       # Static Assets
│   ├── common-passwords.txt    # Password blacklist
│   └── favicon.ico
│
├── docs/                         # Documentation
│   ├── DEVELOPMENT.md           # This file
│   ├── API_REFERENCE.md         # API docs
│   ├── BATCHED_UPDATES.md       # Batched updates guide
│   └── BATCHED_UPDATES_EXAMPLE.tsx
│
├── scripts/                      # Build/Deploy Scripts
│
├── jest.config.js               # Jest configuration
├── jest.setup.js                # Jest setup (mocks, globals)
├── tsconfig.json                # TypeScript configuration
├── tailwind.config.ts           # Tailwind CSS config
├── next.config.js               # Next.js configuration
└── package.json                 # Dependencies and scripts
```

## Core Concepts

### 1. Context-Based State Management

We use React Context API for global state:

```typescript
// contexts/AuthContext.tsx
export const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

// Usage in components
function MyComponent() {
  const { client, isSessionActive, initializeSession } = useAuth();
  // ...
}
```

**Key Contexts:**
- `AuthContext` - Wallet connection, session management
- `PasswordContext` - CRUD operations, batched updates
- `LockboxContext` - Master lockbox state
- `SubscriptionContext` - Subscription tier

### 2. Anchor Program Client

The SDK wraps the Anchor program:

```typescript
// sdk/src/client-v2.ts
export class LockboxV2Client {
  readonly program: Program;
  readonly connection: Connection;
  readonly wallet: any;

  async storePassword(entry: PasswordEntry): Promise<Result> {
    // 1. Encrypt entry client-side
    const { ciphertext, nonce } = this.encryptEntry(entry, sessionKey);
    
    // 2. Build instruction
    const instruction = this.program.instruction.storePasswordEntry(...);
    
    // 3. Send transaction
    const signature = await this.wallet.signAndSendTransaction(tx);
    
    return { signature, entryId };
  }
}
```

### 3. Client-Side Encryption

All encryption happens in the browser:

```typescript
// lib/crypto.ts

// 1. Derive session key from wallet signature
const { sessionKey } = await createSessionKeyFromSignature(
  publicKey,
  signature
);

// 2. Encrypt with AES-256-GCM
const encrypted = await crypto.subtle.encrypt(
  { name: 'AES-GCM', iv: nonce },
  sessionKey,
  plaintext
);

// 3. Store encrypted data on blockchain
await client.storePassword(encryptedEntry);
```

### 4. Batched Updates (New)

Queue changes locally, sync later:

```typescript
// Queue update (instant UI update)
queueUpdate(chunkIndex, entryId, updatedEntry);

// Later: sync all pending changes
await syncPendingChanges();
```

See [BATCHED_UPDATES.md](./BATCHED_UPDATES.md) for details.

## Development Workflow

### 1. Feature Development

```bash
# 1. Create feature branch
git checkout -b feature/my-feature

# 2. Implement feature
# - Add SDK methods if needed (sdk/src/client-v2.ts)
# - Add context methods (contexts/)
# - Create UI components (components/)
# - Write tests (lib/__tests__/)

# 3. Test
npm test
npm run type-check
npm run lint

# 4. Commit and push
git add .
git commit -m "feat: add my feature"
git push origin feature/my-feature

# 5. Create pull request
```

### 2. Bug Fixing

```bash
# 1. Create bugfix branch
git checkout -b fix/issue-123

# 2. Reproduce bug
# - Add failing test first (TDD)
# - Fix the bug
# - Ensure test passes

# 3. Verify fix
npm test
npm run dev  # Manual testing

# 4. Commit
git commit -m "fix: resolve issue #123"
```

### 3. Testing Workflow

```bash
# Run tests in watch mode (TDD)
npm test -- --watch

# Write test → see it fail → implement feature → see it pass

# Example:
# 1. Write test in lib/__tests__/my-feature.test.ts
# 2. Run: npm test -- --watch
# 3. Implement in lib/my-feature.ts
# 4. Test automatically re-runs and passes
```

## Coding Standards

### TypeScript

#### Strict Mode
```typescript
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true
  }
}
```

#### Type Annotations
```typescript
// ✅ Good - explicit types
function calculateScore(password: string): number {
  return password.length * 2;
}

// ❌ Bad - implicit any
function calculateScore(password) {
  return password.length * 2;
}
```

#### Interfaces vs Types
```typescript
// Use interfaces for objects that can be extended
interface PasswordEntry {
  title: string;
  username: string;
  password: string;
}

// Use types for unions, intersections, or primitives
type PasswordStrength = 'weak' | 'medium' | 'strong';
type ExtendedEntry = PasswordEntry & { favorite: boolean };
```

### React

#### Functional Components
```typescript
// ✅ Good - functional component with hooks
export function MyComponent({ prop }: MyComponentProps) {
  const [state, setState] = useState<string>('');
  
  useEffect(() => {
    // side effects
  }, []);
  
  return <div>{state}</div>;
}

// ❌ Bad - class component (avoid)
export class MyComponent extends React.Component {
  // ...
}
```

#### Hooks

```typescript
// Custom hooks start with 'use'
function usePasswordHealth(entry: PasswordEntry) {
  const [health, setHealth] = useState<PasswordHealth | null>(null);
  
  useEffect(() => {
    const analysis = analyzePassword(entry);
    setHealth(analysis);
  }, [entry]);
  
  return health;
}
```

#### Component Organization
```typescript
// 1. Imports
import React, { useState, useCallback } from 'react';

// 2. Types/Interfaces
interface Props {
  title: string;
}

// 3. Component
export function MyComponent({ title }: Props) {
  // 3a. Hooks (state, context, effects)
  const [state, setState] = useState('');
  const { data } = useContext(MyContext);
  
  // 3b. Event handlers
  const handleClick = useCallback(() => {
    setState('clicked');
  }, []);
  
  // 3c. Render
  return (
    <div onClick={handleClick}>
      {title}
    </div>
  );
}
```

### Naming Conventions

```typescript
// Components: PascalCase
export function PasswordList() {}

// Functions: camelCase
function calculateEntropy() {}

// Constants: UPPER_SNAKE_CASE
const MAX_PASSWORD_LENGTH = 256;

// Types/Interfaces: PascalCase
interface UserConfig {}
type Status = 'active' | 'inactive';

// Files: kebab-case
// password-health-analyzer.ts
// pending-changes-manager.ts
```

### Error Handling

```typescript
// Use standardized error classes
import { ValidationError, SessionExpiredError } from '../lib/errors';

// ✅ Good - specific error
if (!isValid) {
  throw new ValidationError(
    'Invalid password format',
    { field: 'password', reason: 'Too short' }
  );
}

// ✅ Good - catch and handle
try {
  await operation();
} catch (err) {
  if (err instanceof SessionExpiredError) {
    // Handle session expiry
    clearSession();
  }
  throw err; // Re-throw if not handled
}

// ❌ Bad - generic error
throw new Error('Something went wrong');
```

## Common Tasks

### Adding a New Password Operation

1. **Add program instruction method** (if needed):
```typescript
// sdk/src/client-v2.ts
async myNewOperation(param: string): Promise<Result> {
  // Build instruction data
  const instructionData = Buffer.concat([
    INSTRUCTION_DISCRIMINATORS.myOperation,
    Buffer.from(param),
  ]);
  
  // Create instruction
  const instruction = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [/* account metas */],
    data: instructionData,
  });
  
  // Send transaction
  const tx = new Transaction().add(instruction);
  const signature = await this.wallet.signAndSendTransaction(tx);
  
  return { signature };
}
```

2. **Add context method**:
```typescript
// contexts/PasswordContext.tsx
const myOperation = useCallback(async (param: string) => {
  if (!client) return false;
  
  const sessionValid = await checkSessionTimeout();
  if (!sessionValid) return false;
  
  updateActivity();
  
  try {
    await client.myNewOperation(param);
    await refreshEntries();
    return true;
  } catch (err) {
    setError(err.message);
    return false;
  }
}, [client, checkSessionTimeout, updateActivity, refreshEntries]);
```

3. **Add UI component**:
```typescript
// components/features/MyFeature.tsx
export function MyFeature() {
  const { myOperation } = usePassword();
  const [loading, setLoading] = useState(false);
  
  const handleSubmit = async () => {
    setLoading(true);
    const success = await myOperation('param');
    setLoading(false);
    
    if (success) {
      toast.success('Operation completed!');
    }
  };
  
  return (
    <button onClick={handleSubmit} disabled={loading}>
      {loading ? 'Processing...' : 'Submit'}
    </button>
  );
}
```

4. **Add tests**:
```typescript
// lib/__tests__/my-feature.test.ts
describe('myNewOperation', () => {
  it('should complete successfully', async () => {
    const result = await myNewOperation('test');
    expect(result).toBeDefined();
  });
});
```

### Adding a New UI Component

1. **Create component file**:
```typescript
// components/ui/MyButton.tsx
interface MyButtonProps {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}

export function MyButton({ label, onClick, variant = 'primary' }: MyButtonProps) {
  const className = variant === 'primary'
    ? 'bg-blue-600 text-white'
    : 'bg-gray-200 text-gray-800';
  
  return (
    <button onClick={onClick} className={`px-4 py-2 rounded ${className}`}>
      {label}
    </button>
  );
}
```

2. **Export from barrel**:
```typescript
// components/ui/index.ts
export { MyButton } from './MyButton';
```

3. **Use in other components**:
```typescript
import { MyButton } from '../ui';

<MyButton label="Click me" onClick={handleClick} />
```

### Updating the Anchor IDL

If the Solana program changes:

1. **Generate new IDL**:
```bash
cd ../programs/lockbox
anchor build
cp target/idl/lockbox.json ../nextjs-app/sdk/src/idl/lockbox-v2.json
```

2. **Update TypeScript types** (if needed):
```typescript
// sdk/src/types-v2.ts
// Update types to match new IDL
```

3. **Update client methods** (if needed):
```typescript
// sdk/src/client-v2.ts
// Update instruction discriminators
// Update method signatures
```

## Debugging

### Browser DevTools

```typescript
// Enable debug mode
localStorage.setItem('DEBUG', 'lockbox:*');

// View context state
// React DevTools → Components → Find AuthContext/PasswordContext
```

### Logging

```typescript
// Use structured logging
console.log('[PasswordContext] Syncing pending changes:', {
  count: changes.length,
  types: changes.map(c => c.type),
});

// For errors, include stack trace
console.error('[SDK] Transaction failed:', {
  error: err.message,
  stack: err.stack,
  context: { entryId, chunkIndex },
});
```

### Common Issues

#### "Session expired" error
```typescript
// Check session timestamps
console.log({
  sessionStartTime: new Date(sessionStartTime),
  lastActivityTime: new Date(lastActivityTime),
  now: new Date(),
});

// Verify session timeout logic
const sessionAge = Date.now() - sessionStartTime;
const inactivityTime = Date.now() - lastActivityTime;
console.log({ sessionAge, inactivityTime });
```

#### Decryption errors
```typescript
// View detailed errors
console.log(window.__lockboxDecryptionErrors);

// Each error includes:
// - chunkIndex, entryId
// - error message
// - encrypted data length
```

#### Transaction failures
```typescript
// Check RPC logs
// Solana Explorer: https://explorer.solana.com/?cluster=devnet
// Paste transaction signature

// Local debugging
console.log('Transaction details:', {
  signature,
  recentBlockhash: tx.recentBlockhash,
  feePayer: tx.feePayer.toString(),
});
```

## Performance

### Optimizations

1. **Lazy Loading**:
```typescript
// components/modals/PasswordEntryModal.tsx
import dynamic from 'next/dynamic';

const HeavyComponent = dynamic(() => import('./HeavyComponent'), {
  loading: () => <Spinner />,
});
```

2. **Memoization**:
```typescript
const expensiveValue = useMemo(() => {
  return computeExpensive(data);
}, [data]);

const memoizedCallback = useCallback(() => {
  handleAction();
}, [dependency]);
```

3. **Virtualization** (for large lists):
```typescript
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={600}
  itemCount={entries.length}
  itemSize={80}
>
  {({ index, style }) => (
    <div style={style}>
      <PasswordEntry entry={entries[index]} />
    </div>
  )}
</FixedSizeList>
```

### Bundle Analysis

```bash
npm run build -- --analyze
# Opens bundle analyzer in browser
```

### Lighthouse Audit

```bash
# Run Lighthouse in Chrome DevTools
# Or use CLI:
npx lighthouse http://localhost:3000 --view
```

---

**Last Updated**: 2025-10-15  
**Maintainer**: Development Team
