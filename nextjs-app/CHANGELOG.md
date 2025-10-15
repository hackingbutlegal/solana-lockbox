# Changelog

All notable changes to Solana Lockbox will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.2.0] - 2025-10-15

### Added

#### Batched Updates System
- Queue multiple password changes locally before syncing to blockchain
- Optimistic UI updates for instant feedback
- `PendingChangesBar` component to show unsaved changes
- `PendingChangesManager` class for change tracking
- New PasswordContext methods: `queueUpdate()`, `queueDelete()`, `syncPendingChanges()`, `discardPendingChanges()`
- Change validation before sync
- Rollback support for discarding changes

#### Comprehensive Test Suite
- 193 passing tests covering core modules
- Test infrastructure with Jest 29+ and Next.js integration
- `crypto.test.ts` - Cryptographic operations testing (297 lines)
- `password-health-analyzer.test.ts` - Password analysis testing (414 lines)
- `import-export.test.ts` - Import/export and CSV injection testing (492 lines)
- `search-manager.test.ts` - Search functionality testing (650+ lines)
- `batch-operations.test.ts` - Batch operations testing (700+ lines)
- Coverage: 95% for batch-operations, 88% for password-health-analyzer

#### Security Enhancements
- CSV injection protection (sanitizes =, +, -, @, tab, \r prefixes)
- Expanded common password detection (100 → 300+ passwords)
- Lazy loading support for larger password blacklists
- Immediate session timeout checks before sensitive operations
- Standardized error classes with recovery guidance

#### Documentation
- `TEST_IMPLEMENTATION_SUMMARY.md` - Complete test coverage analysis
- `BATCHED_UPDATES.md` - Batched updates API reference
- `BATCHED_UPDATES_EXAMPLE.tsx` - Integration examples
- Comprehensive inline code documentation

### Fixed
- **Critical**: Session key storage vulnerability (WeakMap with Symbol keys)
  - Replaced with class-based SessionKeyStore
  - Proper memory isolation and cleanup
- **High**: Circular dependency in AuthContext (clearSession before checkSessionTimeout)
- Pending transaction tracking race conditions
- Error messages in listPasswords() now user-friendly

### Changed
- Session key storage from WeakMap to class-based encapsulation
- Common password list expanded to 300+ with optional external file
- PasswordContext now supports both immediate and batched operations

### Technical
- Added `PendingChangesManager` (`lib/pending-changes-manager.ts`)
- Added `PendingChangesBar` component (`components/ui/PendingChangesBar.tsx`)
- Enhanced PasswordContext with batching support
- Added error classes hierarchy (`lib/errors.ts`)
- Updated crypto mocks in jest.setup.js (TextEncoder, TextDecoder)

---

## [2.1.0] - 2025-10-14

### Added
- Orphaned chunk prevention system
- Comprehensive chunk tracking and validation
- Automatic orphaned chunk recovery tools

### Fixed
- Storage chunk creation RPC lag issues
- Orphaned chunks from failed transactions
- Error handling in storePassword operation

---

## [2.0.0] - 2025-10-13

### Added
- Complete migration to Zod-based validation
- Subscription tier UI improvements
- Phase 5 documentation updates

### Changed
- **Breaking**: Moved from custom validation to Zod schemas
- Improved type safety across validation layer

---

## [1.2.0] - 2025-10-12

### Added
- Password health analysis
- Entropy calculation
- Pattern detection (keyboard, sequences, repeated chars)
- Common password detection
- Reuse detection across entries
- Password age tracking
- Vault-wide security scoring

---

## [1.1.0] - 2025-10-10

### Added
- Import/export functionality
- Support for Bitwarden CSV format
- Support for LastPass CSV format
- Support for 1Password CSV format
- Lockbox JSON format for backup/restore

---

## [1.0.0] - 2025-10-01

### Added
- Initial release
- Solana blockchain integration
- AES-256-GCM client-side encryption
- HKDF key derivation from wallet signatures
- Session management with timeouts
- Password CRUD operations
- Master lockbox initialization
- Storage chunk management
- Subscription tiers (Free, Standard, Premium)
- Search functionality with blind indexes
- Batch operations (multi-select, bulk update/delete)
- TOTP 2FA code generation
- Categories and tags
- Favorites and archive

### Security
- Zero-knowledge architecture
- Domain separation for session and search keys
- Secure memory wiping
- Session timeouts (15 min absolute, 5 min inactivity)

---

## Version History

| Version | Date | Description |
|---------|------|-------------|
| 2.2.0 | 2025-10-15 | QA improvements, batched updates, test suite |
| 2.1.0 | 2025-10-14 | Orphaned chunk prevention |
| 2.0.0 | 2025-10-13 | Zod validation, subscription UI |
| 1.2.0 | 2025-10-12 | Password health analysis |
| 1.1.0 | 2025-10-10 | Import/export support |
| 1.0.0 | 2025-10-01 | Initial release |

---

## Upgrade Guide

### From 2.1.0 to 2.2.0

**No breaking changes**. New features are additive.

#### Using Batched Updates

**Before** (immediate updates):
```typescript
const handleUpdate = async () => {
  setLoading(true);
  await updateEntry(chunkIndex, entryId, entry);
  setLoading(false);
};
```

**After** (batched updates):
```typescript
const handleUpdate = () => {
  queueUpdate(chunkIndex, entryId, entry);
  // UI updates immediately, sync later
};
```

Add PendingChangesBar to your layout:
```typescript
import { PendingChangesBar } from '../components/ui/PendingChangesBar';

<PendingChangesBar position="bottom" />
```

#### Running New Tests

```bash
npm test
# Run with coverage
npm test -- --coverage
```

---

## Migration Notes

### 2.0.0 Breaking Changes

If upgrading from v1.x:

1. **Update validation imports**:
```typescript
// Old
import { validatePasswordEntry } from '../lib/validation';

// New
import { passwordEntrySchema } from '../lib/validation-schemas';
import { validate } from '../lib/validation-schemas';

const result = validate(passwordEntrySchema, entry);
```

2. **Handle validation errors**:
```typescript
if (!result.success) {
  console.error('Validation errors:', result.errors);
  return;
}

const validEntry = result.data;
```

---

## Security Advisories

### SA-2025-001: Session Key Storage (Fixed in 2.2.0)

**Severity**: Medium  
**Affected Versions**: 2.0.0 - 2.1.0  
**Fixed in**: 2.2.0

**Description**:
Session keys were stored in a WeakMap with Symbol keys. Since Symbols are primitives (not objects), WeakMap cannot properly track them, potentially exposing keys in memory.

**Fix**:
Replaced WeakMap with class-based SessionKeyStore providing proper encapsulation.

**Action Required**:
Upgrade to 2.2.0 or later.

### SA-2025-002: CSV Injection (Fixed in 2.2.0)

**Severity**: Low  
**Affected Versions**: All versions < 2.2.0  
**Fixed in**: 2.2.0

**Description**:
Exported CSV files could contain formula injection vectors (=, +, -, @) that execute when opened in Excel/Sheets.

**Fix**:
All CSV fields are now sanitized with single quote prefix for dangerous characters.

**Action Required**:
Upgrade to 2.2.0 or later. Re-export CSVs to include protection.

---

## Contributors

- Development Team
- Claude Code AI Assistant
- Community Contributors

---

## Links

- [GitHub Repository](https://github.com/your-org/solana-lockbox)
- [Documentation](./README.md)
- [Issue Tracker](https://github.com/your-org/solana-lockbox/issues)
- [Roadmap](./docs/ROADMAP.md)

---

**Last Updated**: 2025-10-15
