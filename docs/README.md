# Solana Lockbox Documentation

This directory contains organized documentation for the Solana Lockbox v2.0 password manager project.

## Directory Structure

### `/architecture`
System architecture, design principles, and technical specifications.
- `ARCHITECTURE.md` - Overall system architecture
- Frontend-agnostic design philosophy
- Component interaction diagrams

### `/deployment`
Deployment guides for various environments.
- `DEPLOYMENT.md` - Comprehensive v2 deployment guide (1,760 lines) - **PRIMARY GUIDE**
- `DEPLOYMENT_V1.md` - Legacy v1 deployment guide (archived)
- Local development setup
- Devnet deployment procedures
- Vercel deployment configuration
- Troubleshooting deployment issues

### `/security`
Security model, audit reports, and security fixes.
- `SECURITY.md` - Security model and best practices
- `SECURITY_AUDIT_TRAIL_OF_BITS.md` - Trail of Bits audit findings
- Security fix test plans

### `/technical`
Technical deep-dives, specific fixes, and implementation details.
- `PENDING-TRANSACTION-TRACKING-FIX.md` - Fix for duplicate transaction processing errors
- `ORPHANED-CHUNK-FIX-SUMMARY.md` - Prevention and recovery for orphaned storage chunks
- `CLOSE-CHUNK-FIX.md` - Account ordering fix for chunk closure
- `MULTI-WALLET-RECOVERY-GUIDE.md` - Multi-wallet orphan recovery procedures
- `ORPHANED-CHUNK-RECOVERY-GUIDE.md` - User-facing recovery guide
- `VALIDATION_MIGRATION.md` - Migration to Zod validation schemas
- `ORPHANED_CHUNKS_PREVENTION.md` - Prevention strategies for orphaned chunks
- `RUST_OPTIMIZATION_RECOMMENDATIONS.md` - Future Rust program optimizations
- `TOOLCHAIN.md` - Development toolchain documentation
- `TECHNICAL_FIXES_OCT_2025.md` - Technical fixes log

### `/releases`
Release notes and version history.
- `RELEASE_NOTES_v1.2.0.md` - v1.2.0 release notes
- `RELEASE_SUMMARY.md` - Overall release summary
- `SCHEMA_V2_RELEASE_NOTES.md` - Schema v2 migration
- `PHASE-10-VALIDATION-REPORT.md` - Phase 10 validation results

### `/docs` (This Directory)
Project-wide documentation and refactor summaries.
- `REFACTOR_SUMMARY.md` - Comprehensive 10-phase refactor documentation
- Category system implementation details
- Architecture improvements

## Main Documentation (Root)

The following documents remain in the project root for easy access:

- **README.md** - Project overview and quick start guide
- **ROADMAP.md** ⭐ - Detailed development roadmap with phases, timelines, and success criteria
- **PASSWORD_MANAGER_EXPANSION.md** - Detailed v2.0 technical specification
- **API.md** - SDK API reference
- **DEVELOPER_GUIDE.md** - Development setup and workflow
- **QUICKSTART.md** - Quick start guide for new developers
- **TESTING.md** - Testing procedures and guidelines
- **TROUBLESHOOTING.md** - Common issues and solutions
- **CHANGELOG.md** - Version history (semantic versioning)
- **LICENSE** - ISC license

## Finding Documentation

**For Users**:
- Start with root `README.md`
- Quick start: `QUICKSTART.md`
- Problems? Check `TROUBLESHOOTING.md`

**For Developers**:
- Setup: `DEVELOPER_GUIDE.md`
- Architecture: `docs/architecture/`
- API: `API.md`
- Testing: `TESTING.md`

**For DevOps**:
- Deployment: `docs/deployment/`
- Toolchain: `docs/technical/TOOLCHAIN.md`

**For Security Researchers**:
- Security model: `docs/security/`
- Audit reports: `docs/security/SECURITY_AUDIT_TRAIL_OF_BITS.md`

## Documentation Standards

All documentation follows these standards:
- **Markdown format** for consistency
- **Clear headings** for easy navigation
- **Code examples** where applicable
- **Last updated** dates included
- **Cross-references** to related docs

## Contributing to Documentation

When updating documentation:
1. Keep it concise and actionable
2. Include examples and commands
3. Update cross-references
4. Add date of last update
5. Test all commands and code snippets

---

---

---

**Last Updated**: October 15, 2025 (Post-Documentation Refactor)
**Maintained By**: GRAFFITO (@0xgraffito)
**Version**: v2.0 (Phase 3 Complete)
