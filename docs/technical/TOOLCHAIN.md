# Lockbox v2 Toolchain Documentation

## Proven Stable Configuration

The Lockbox v2 program has been successfully deployed to devnet with the following toolchain:

### ✅ Working Toolchain
- **Rust**: 1.79.0
- **Anchor CLI**: 0.30.1
- **Anchor Lang**: 0.30.1
- **@coral-xyz/anchor**: 0.30.1
- **Solana CLI**: 1.18+
- **Program ID**: `7JxsHjdReydiz36jwsWuvwwR28qqK6V454VwFJnnSkoB`

## Known Issues

### Anchor 0.31.0 Incompatibility

**Issue**: Anchor 0.31.0 has breaking changes in the proc-macro system that cause compilation failures.

**Symptoms**:
```
error[E0425]: cannot find value `owner` in this scope
   --> programs/lockbox/src/instructions/password_entry.rs:5:10
    |
5   | #[derive(Accounts)]
    |          ^^^^^^^^ not found in this scope
```

**Root Cause**: The `#[derive(Accounts)]` macro in Anchor 0.31.0 has changed how it resolves variables referenced in seed constraints, causing it to fail even when `#[instruction(...)]` attributes are properly provided.

**Resolution**: Stay on Anchor 0.30.1 until Anchor 0.31.x stabilizes or Anchor 0.32.0 is released with fixes.

### proc-macro2 Version Conflicts

**Issue**: Automatic IDL generation fails due to incompatibilities between:
- `proc-macro2` (multiple versions in dependency tree)
- `anchor-syn` 0.30.1
- Rust's proc-macro system

**Symptoms**:
```
error[E0599]: no method named `source_file` found for struct `proc_macro2::Span`
   --> anchor-syn-0.30.1/src/idl/defined.rs:499:66
```

**Root Cause**: The `proc_macro2::Span::source_file()` method doesn't exist in some versions of proc-macro2, but anchor-syn 0.30.1 tries to call it during IDL generation.

**Workaround**: Manually created IDL (`sdk/idl/lockbox-v2.json`) that accurately represents the deployed program structure.

## Manual IDL Creation

Since automated IDL generation is blocked by toolchain issues, we maintain a manually-created IDL:

### Location
- `sdk/idl/lockbox-v2.json`
- `nextjs-app/sdk/idl/lockbox-v2.json` (duplicate for Next.js app)

### Structure
The manual IDL includes:
- All 9 v2 instructions with complete account specifications
- 2 account structures (MasterLockbox, StorageChunk)
- 5 custom types (enums and structs)
- 24 comprehensive error definitions (codes 6000-6023)
- Proper Anchor 0.30 format with `{"defined": {"name": "TypeName"}}`

### Verification
The manual IDL has been verified to:
- ✅ Match the deployed program structure
- ✅ Compile successfully in TypeScript
- ✅ Work with @coral-xyz/anchor client
- ✅ Support all program instructions
- ✅ Provide proper error messages

## Best Practices

### 1. Don't Upgrade Anchor Yet
Wait for:
- Anchor 0.31.x patch releases
- Anchor 0.32.0 with improved stability
- Community confirmation that proc-macro issues are resolved

### 2. Use Rust 1.79.0
Rust 1.79.0 is the most stable version for Solana/Anchor development:
```bash
rustup override set 1.79.0
```

Newer Rust versions (1.80+, 1.90+) may have proc-macro changes that interact poorly with Anchor.

### 3. Maintain Manual IDL
When making program changes:
1. Update the Rust code
2. Deploy to devnet
3. Manually update both IDL copies
4. Verify TypeScript builds
5. Test SDK functionality
6. Document changes

### 4. IDL Sync Process
Keep both IDL copies synchronized:
```bash
# After updating sdk/idl/lockbox-v2.json
cp sdk/idl/lockbox-v2.json nextjs-app/sdk/idl/lockbox-v2.json
```

### 5. Testing Strategy
Since `anchor test` fails due to build issues:
- Use the deployed devnet program
- Run TypeScript SDK tests (`cd sdk && npm test`)
- Manual testing via Next.js app
- Direct RPC calls for validation

## Deployment Workflow

### Current (Working)
```bash
# 1. Ensure correct Rust version
rustup override set 1.79.0

# 2. Build fails due to IDL generation, but .so file is created
# This is expected - the program binary builds successfully

# 3. Deploy manually using Solana CLI
solana program deploy target/deploy/lockbox.so \\
  --program-id target/deploy/lockbox-keypair.json

# 4. Update IDL manually based on Rust code changes

# 5. Test with SDK
cd sdk && npm test
```

### Future (When Anchor 0.32+ is stable)
```bash
# Should work once toolchain issues are resolved
anchor build
anchor test
anchor deploy
```

## Debugging Tips

### Check Toolchain Versions
```bash
rustc --version        # Should be 1.79.0
cargo --version
anchor --version       # Should be 0.30.1
solana --version
```

### Verify Dependency Versions
```bash
# In programs/lockbox/Cargo.toml
anchor-lang = { version = "0.30.1", features = ["init-if-needed"] }

# In package.json
"@coral-xyz/anchor": "^0.30.1"

# In Anchor.toml
[toolchain]
anchor_version = "0.30.1"
```

### Test Without Rebuilding
```bash
# Use existing deployed program
export ANCHOR_PROVIDER_URL="https://api.devnet.solana.com"
export ANCHOR_WALLET="~/.config/solana/id.json"

# Run TypeScript tests directly
yarn run ts-mocha -p ./tsconfig.json -t 1000000 tests/lockbox-v2.ts
```

## Security Implications

### Manual IDL Maintenance
**Risk**: Manual IDL could diverge from actual program

**Mitigation**:
- Strict review process for IDL changes
- Cross-reference with deployed program
- Comprehensive test coverage
- Version control and diffs

### Toolchain Stability
**Risk**: Dependency vulnerabilities in older Anchor version

**Mitigation**:
- Monitor Anchor security advisories
- Plan migration to newer Anchor when stable
- Regular security audits
- Isolated development environment

## Migration Path

When Anchor improves proc-macro support:

### Phase 1: Validation (Low Risk)
1. Install new Anchor version in test environment
2. Attempt `anchor build`
3. Compare generated IDL with manual IDL
4. Run full test suite
5. Deploy to devnet-test

### Phase 2: Transition (Medium Risk)
1. Update all dependencies
2. Regenerate IDL automatically
3. Update documentation
4. Comprehensive testing
5. Deploy to devnet

### Phase 3: Production (High Risk)
1. Security audit of new toolchain
2. Stress testing
3. Deploy to mainnet (when ready)
4. Monitor for issues
5. Maintain rollback capability

## Resources

- [Anchor GitHub Issues](https://github.com/coral-xyz/anchor/issues)
- [Solana Stack Exchange](https://solana.stackexchange.com/)
- [Anchor Discord](https://discord.gg/anchor)
- [proc-macro2 Documentation](https://docs.rs/proc-macro2/)

## Change Log

### 2025-10-12
- Attempted Anchor 0.31.0 upgrade
- Encountered proc-macro issues
- Reverted to proven 0.30.1 configuration
- Documented toolchain constraints
- Confirmed manual IDL approach

### 2025-10-11
- Successfully deployed with Anchor 0.30.1
- Created manual v2 IDL
- Verified all instructions operational
- Program ID: 7JxsHjdReydiz36jwsWuvwwR28qqK6V454VwFJnnSkoB

## Contact

For toolchain-related issues:
- Open GitHub issue with "toolchain" label
- Include full error output
- Provide `rustc --version` and `anchor --version`
- Share relevant Cargo.toml sections
