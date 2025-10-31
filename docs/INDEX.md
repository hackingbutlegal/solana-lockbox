# Solana Lockbox - Documentation Index

> **Version:** 2.3.2
> **Last Updated:** October 30, 2025
> **Status:** ⚠️ Pre-Production (Devnet - Not Professionally Audited)

**Master index for all technical and user documentation.**

---

## 📚 Documentation Structure

This documentation is organized into four main categories:

1. **[User Guides](#user-guides)** - For end users of Solana Lockbox
2. **[Technical Documentation](#technical-documentation)** - For developers and security researchers
3. **[Development](#development)** - For contributors and developers
4. **[Security](#security)** - For security auditors and researchers
5. **[Archive](#archive)** - Historical documents and session summaries

---

## 👥 User Guides

**For end users, wallet holders, and non-technical readers.**

| Document | Description | Status |
|----------|-------------|--------|
| [README.md](../README.md) | Main project overview and getting started | ✅ Current |
| [QUICKSTART.md](../QUICKSTART.md) | 5-minute quick start guide | ✅ Current |
| [TROUBLESHOOTING.md](../TROUBLESHOOTING.md) | Common issues and solutions | ✅ Current |
| [FAQ](../nextjs-app/components/layout/FAQ.tsx) | Frequently asked questions (in app) | ✅ Current |

---

## 🔧 Technical Documentation

**For developers, integrators, and technical analysts.**

### Architecture & Design

| Document | Description | Last Updated |
|----------|-------------|--------------|
| [ARCHITECTURE.md](architecture/ARCHITECTURE.md) | Complete system architecture | Oct 2025 |
| [CRYPTOGRAPHY.md](CRYPTOGRAPHY.md) | Cryptographic implementation specification | Oct 30, 2025 |
| [API.md](../API.md) | SDK API reference | Oct 2025 |

### Deployment & Operations

| Document | Description | Last Updated |
|----------|-------------|--------------|
| [DEPLOYMENT.md](deployment/DEPLOYMENT.md) | Production deployment guide (v2) | Oct 2025 |
| [BUBBLEWRAP_DEPLOYMENT.md](BUBBLEWRAP_DEPLOYMENT.md) | PWA to Android APK packaging | Oct 2025 |
| [MOBILE_PWA_GUIDE.md](MOBILE_PWA_GUIDE.md) | Mobile and PWA installation | Oct 2025 |

### Technical Deep Dives

| Document | Description | Last Updated |
|----------|-------------|--------------|
| [technical/ORPHANED_CHUNKS_FIX.md](technical/ORPHANED_CHUNKS_FIX.md) | Orphaned chunk prevention | Oct 2025 |
| [technical/RECOVERY_VALIDATION_FIX.md](technical/RECOVERY_VALIDATION_FIX.md) | Recovery validation improvements | Oct 2025 |
| [technical/BACKUP_CODES_VALIDATION_FIX.md](technical/BACKUP_CODES_VALIDATION_FIX.md) | Backup code validation | Oct 2025 |
| [technical/UNIT_TEST_FIXES.md](technical/UNIT_TEST_FIXES.md) | Unit test improvements | Oct 2025 |

---

## 💻 Development

**For contributors and developers working on Solana Lockbox.**

| Document | Description | Last Updated |
|----------|-------------|--------------|
| [DEVELOPER_GUIDE.md](../DEVELOPER_GUIDE.md) | Complete development setup guide | Oct 2025 |
| [TESTING.md](../TESTING.md) | Testing strategies and frameworks | Oct 2025 |
| [SECURITY_TESTS_README.md](../SECURITY_TESTS_README.md) | Security testing framework | Oct 2025 |
| [nextjs-app/docs/DEVELOPMENT.md](../nextjs-app/docs/DEVELOPMENT.md) | Frontend development guide | Oct 2025 |

### Release Documentation

| Document | Description | Date |
|----------|-------------|------|
| [CHANGELOG.md](../CHANGELOG.md) | Version history and changes | Oct 2025 |
| [releases/v2.2.7.md](../nextjs-app/docs/releases/v2.2.7.md) | Latest release notes | Oct 28, 2025 |
| [releases/v2.2.6.md](../nextjs-app/docs/releases/v2.2.6.md) | Previous release | Oct 27, 2025 |
| [releases/v2.2.5.md](../nextjs-app/docs/releases/v2.2.5.md) | Previous release | Oct 26, 2025 |

---

## 🔒 Security

**For security researchers, auditors, and cryptographers.**

### Security Policies & Status

| Document | Description | Last Updated |
|----------|-------------|--------------|
| [SECURITY_POLICY.md](../SECURITY_POLICY.md) | **Vulnerability reporting policy** | Oct 2025 |
| [security/SECURITY_STATUS.md](security/SECURITY_STATUS.md) | Current security posture & fixes | Dec 2024 |
| [CRYPTOGRAPHY.md](CRYPTOGRAPHY.md) | **Complete cryptographic specification** | Oct 30, 2025 |

### Security Audit Reports

| Document | Description | Date |
|----------|-------------|------|
| [security/SECURITY_AUDIT_SUMMARY.md](security/SECURITY_AUDIT_SUMMARY.md) | Internal security audit summary | Dec 2024 |
| [security/SECURITY_REVIEW.md](security/SECURITY_REVIEW.md) | Vulnerability review | Dec 2024 |

### External Audit Status

> ⏳ **Professional security audit pending** (Q1 2026)
>
> Target auditors: Trail of Bits, OtterSec, or equivalent
>
> ⚠️ **Pre-production warning:** Do not use for sensitive data until audit complete.

---

## 📦 Archive

**Historical documents, session summaries, and deprecated documentation.**

### Session Summaries (Historical)

22 session summary documents tracking development history from Oct-Dec 2024.

Location: `/docs/archive/` (to be organized)

### Deprecated Documentation

- Old README backup (removed Oct 30, 2025)
- Component backup files (removed Oct 30, 2025)
- IDL backups (removed Oct 30, 2025)

---

## 🗺️ Quick Navigation

### By Role

**I am a...**

- **User wanting to try Lockbox** → [QUICKSTART.md](../QUICKSTART.md)
- **Developer integrating the SDK** → [DEVELOPER_GUIDE.md](../DEVELOPER_GUIDE.md) + [API.md](../API.md)
- **Security researcher** → [CRYPTOGRAPHY.md](CRYPTOGRAPHY.md) + [SECURITY_STATUS.md](security/SECURITY_STATUS.md)
- **Contributor** → [DEVELOPER_GUIDE.md](../DEVELOPER_GUIDE.md) + [TESTING.md](../TESTING.md)
- **Wallet provider** → [README.md](../README.md) (integration section)
- **Auditor preparing for review** → [CRYPTOGRAPHY.md](CRYPTOGRAPHY.md) + [ARCHITECTURE.md](architecture/ARCHITECTURE.md)

### By Topic

**I want to learn about...**

- **How encryption works** → [CRYPTOGRAPHY.md](CRYPTOGRAPHY.md)
- **System architecture** → [ARCHITECTURE.md](architecture/ARCHITECTURE.md)
- **Deploying to production** → [DEPLOYMENT.md](deployment/DEPLOYMENT.md)
- **Mobile/PWA setup** → [MOBILE_PWA_GUIDE.md](MOBILE_PWA_GUIDE.md)
- **Running tests** → [TESTING.md](../TESTING.md)
- **Security vulnerabilities** → [SECURITY_STATUS.md](security/SECURITY_STATUS.md)
- **Reporting a vulnerability** → [SECURITY_POLICY.md](../SECURITY_POLICY.md)
- **Recent changes** → [CHANGELOG.md](../CHANGELOG.md)
- **Known issues** → [TROUBLESHOOTING.md](../TROUBLESHOOTING.md)

---

## 📊 Documentation Statistics

**Total Documentation:**
- **94+ markdown files**
- **43,722+ lines** of documentation
- **4 main categories** (User, Technical, Development, Security)
- **26 files** in frontend docs
- **52 files** in main docs directory

**Coverage:**
- ✅ User guides complete
- ✅ Technical specifications complete
- ✅ Security documentation complete
- ✅ Development guides complete
- ⏳ Professional audit documentation pending

---

## 🔄 Documentation Maintenance

### Adding New Documentation

1. Place in appropriate category folder
2. Update this INDEX.md with link
3. Add metadata header (version, date, status)
4. Update relevant README sections

### Deprecating Documentation

1. Move to `/docs/archive/`
2. Add deprecation notice at top of file
3. Update INDEX.md to remove or mark as archived
4. Update cross-references

### Version Policy

- **Major updates:** Increment version, note in CHANGELOG
- **Security fixes:** Update immediately, note in SECURITY_STATUS
- **Accuracy corrections:** Update inline, note in commit message
- **Reorganization:** Update INDEX.md, maintain backward compatibility links

---

## 📮 Documentation Feedback

**Found an issue with documentation?**

- **Typo/error:** Open GitHub issue with `documentation` label
- **Missing information:** Open GitHub discussion
- **Security-related:** Follow [SECURITY_POLICY.md](../SECURITY_POLICY.md)
- **Suggestions:** Open GitHub discussion with `enhancement` label

---

## 📄 License

All documentation is licensed under MIT License (same as code).

See [LICENSE](../LICENSE) for full details.

---

**Last Updated:** October 30, 2025
**Document Version:** 1.0.0
**Maintained by:** Web3 Studios LLC
