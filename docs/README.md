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
- `DEPLOYMENT.md` - Comprehensive deployment guide (local, devnet, mainnet, Vercel)
- Environment-specific configurations
- Troubleshooting deployment issues

### `/security`
Security model, audit reports, and security fixes.
- `SECURITY.md` - Security model and best practices
- `SECURITY_AUDIT_TRAIL_OF_BITS.md` - Trail of Bits audit findings
- Security fix test plans

### `/technical`
Technical deep-dives, specific fixes, and implementation details.
- Toolchain documentation
- Technical fix logs
- Implementation notes
- Orphaned chunk prevention strategies

### `/releases`
Release notes and version history.
- Historical release notes
- Schema migration guides
- Breaking changes documentation

## Main Documentation (Root)

The following documents remain in the project root for easy access:

- **README.md** - Project overview and quick start
- **API.md** - API reference
- **DEVELOPER_GUIDE.md** - Development setup and workflow
- **QUICKSTART.md** - Quick start guide
- **TESTING.md** - Testing procedures
- **TROUBLESHOOTING.md** - Common issues and solutions
- **CHANGELOG.md** - Version history (semantic versioning)
- **LICENSE** - ISC license
- **PASSWORD_MANAGER_EXPANSION.md** - V2.0 expansion plan

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

**Last Updated**: January 2025 (Refactor Phase 1)
**Maintained By**: GRAFFITO (@0xgraffito)
