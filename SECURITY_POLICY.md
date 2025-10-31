# Security Policy

## Overview

Solana Lockbox takes security seriously. We appreciate the security research community's efforts in helping us maintain the security of our users and their data. This document outlines our security policy and how to report vulnerabilities responsibly.

**Current Status**: Pre-Production MVP (Devnet Only)
**Program ID**: `7JxsHjdReydiz36jwsWuvwwR28qqK6V454VwFJnnSkoB` (Devnet)
**Mainnet Status**: Not deployed - additional security audits required

---

## Reporting a Vulnerability

### Contact Information

**Primary Contact**: security@web3stud.io

**Alternative Channels**:
- GitHub Security Advisories: [Create a security advisory](https://github.com/hackingbutlegal/solana-lockbox/security/advisories/new)
- GitHub Issues: For non-sensitive issues only (use `security` label)

### What to Include in Your Report

Please include the following information in your vulnerability report:

1. **Description**: Clear description of the vulnerability
2. **Impact**: Potential impact if exploited
3. **Severity**: Your assessment (Critical/High/Medium/Low)
4. **Steps to Reproduce**: Detailed steps to reproduce the issue
5. **Proof of Concept**: Code, screenshots, or video demonstrating the vulnerability
6. **Affected Components**: Which parts of the system are affected
7. **Suggested Fix**: (Optional) Your recommendations for remediation
8. **Your Contact Information**: Email and preferred method of contact

### Example Report Template

```
**Summary**: Brief one-line description

**Severity**: [Critical/High/Medium/Low]

**Component**: [Smart Contract / Frontend / SDK / Cryptography]

**Description**:
Detailed explanation of the vulnerability...

**Impact**:
What could an attacker do with this vulnerability?

**Steps to Reproduce**:
1. Step one
2. Step two
3. Step three

**Proof of Concept**:
[Code/screenshots/video]

**Suggested Fix**:
[Your recommendations]

**Reporter Contact**: security@web3stud.io
```

---

## Our Commitment to You

### Response Timeline

| Stage | Timeframe | What to Expect |
|-------|-----------|----------------|
| **Initial Response** | Within 48 hours | Acknowledgment of your report with a tracking ID |
| **Validation** | Within 5 business days | Confirmation whether we can reproduce the issue |
| **Assessment** | Within 7 business days | Severity assessment and initial remediation plan |
| **Progress Updates** | Every 7 days | Status updates until issue is resolved |
| **Resolution** | Varies by severity | Fix deployed and coordinated disclosure |

**Note**: These are target timelines for a pre-production project. Critical vulnerabilities will be prioritized and may receive faster responses.

### Severity Definitions

We follow industry-standard severity classifications:

**Critical**
- Complete system compromise
- Loss of funds or private keys
- Unauthorized access to all user data
- Smart contract vulnerabilities allowing theft

**High**
- Partial system compromise
- Unauthorized access to sensitive data
- Authentication bypass
- Cryptographic weaknesses

**Medium**
- Limited data exposure
- Information disclosure
- Denial of service
- Input validation issues

**Low**
- Minor information leakage
- Best practice violations
- Informational findings

### What Happens After You Report

1. **Acknowledgment** (Within 48 hours)
   - We'll send you a tracking ID (e.g., `SOL-LOCKBOX-2025-001`)
   - Confirm receipt and expected timeline

2. **Validation** (Within 5 business days)
   - Our security team will attempt to reproduce the issue
   - We may ask clarifying questions
   - If we cannot reproduce, we'll request additional information

3. **Assessment** (Within 7 business days)
   - Severity classification
   - Impact analysis
   - Remediation plan
   - Estimated fix timeline

4. **Resolution**
   - **Accepted Vulnerabilities**:
     - We'll develop and test a fix
     - You'll receive progress updates every 7 days
     - We'll coordinate disclosure timing with you
     - You'll be credited in our security advisories (with your permission)

   - **Declined Reports**:
     - We'll explain why it doesn't qualify as a vulnerability
     - We may classify it as an enhancement or known limitation
     - You can appeal our decision with additional information

5. **Disclosure**
   - We follow a 90-day coordinated disclosure policy
   - Public disclosure occurs after:
     - Fix is deployed
     - Users have had time to update (if applicable)
     - You and our team agree on timing
   - We'll publish a security advisory crediting you (with permission)

---

## Scope

### In Scope

The following components are within scope for security research:

✅ **Smart Contracts**
- Solana program (Anchor framework)
- All instruction handlers
- Account validation logic
- PDA derivation

✅**Client-Side Cryptography**
- Encryption/decryption implementation
- Key derivation (HKDF, PBKDF2)
- Nonce generation
- Session management

✅ **Frontend Application**
- Authentication flows
- Input validation
- XSS vulnerabilities
- CSRF vulnerabilities
- Session hijacking

✅ **SDK & API**
- Transaction construction
- Account parsing
- Error handling
- Type safety issues

### Out of Scope

The following are **not considered vulnerabilities**:

❌ **By Design**
- Metadata visible on-chain (entry count, timestamps)
- No forward secrecy (requires wallet keypair for decryption)
- Browser memory exposure (inherent to client-side encryption)
- Single wallet dependency (by design choice)

❌ **External Dependencies**
- Solana blockchain bugs (report to Solana Foundation)
- Wallet adapter vulnerabilities (report to respective wallet teams)
- Browser vulnerabilities
- Operating system vulnerabilities

❌ **Low Impact Issues**
- Typos in documentation
- Missing rate limiting (pre-production)
- UI/UX issues without security impact
- Theoretical attacks without proof of concept

❌ **Social Engineering**
- Phishing attacks
- Social engineering against users
- Physical access attacks

❌ **Already Known Issues**
- Issues listed in `docs/security/SECURITY.md`
- Open GitHub issues with `security` label
- Items in our public roadmap

---

## Recognition & Rewards

### Security Researcher Recognition

We value the security research community and will recognize your contributions:

✅ **Public Recognition** (with your permission)
- Credit in security advisories
- Entry in our Hall of Fame (`docs/security/HALL_OF_FAME.md`)
- Social media shout-out (Twitter/Discord)

✅ **Severity-Based Recognition**
- **Critical**: Special recognition, priority coordination
- **High**: Standard recognition in advisory
- **Medium/Low**: Credit in advisory or release notes

### Bug Bounty Program

**Current Status**: Not yet available

**Future Plans**:
- Bug bounty program planned post-mainnet launch
- Likely partnership with Immunefi or similar platform
- Rewards will be based on severity and impact
- Estimated program launch: Q2 2026

**Pre-Launch**:
- While we cannot offer monetary rewards currently, we deeply appreciate your contributions
- Researchers who report valid vulnerabilities before mainnet will receive:
  - Priority recognition in our bug bounty program
  - Early access to bounty submissions
  - Acknowledgment as founding security researchers

---

## Safe Harbor

We support safe harbor for security researchers who:

✅ **Act in Good Faith**
- Make a good faith effort to avoid privacy violations
- Only access data necessary to demonstrate the vulnerability
- Do not intentionally harm our users or systems
- Report vulnerabilities promptly

✅ **Follow Responsible Disclosure**
- Give us reasonable time to fix issues before public disclosure
- Do not publicly disclose vulnerabilities before coordination
- Do not exploit vulnerabilities for personal gain

If you follow these guidelines, we commit to:
- Not pursue legal action against you
- Work with you to understand and resolve the issue
- Acknowledge your contribution publicly (with permission)

### What We Ask You NOT to Do

Please **do not**:
- 🚫 Access or modify user data beyond what's necessary for the PoC
- 🚫 Perform denial of service attacks
- 🚫 Execute social engineering attacks against our team or users
- 🚫 Publicly disclose vulnerabilities before coordination
- 🚫 Demand payment or extort the project
- 🚫 Violate any applicable laws or regulations

---

## Security Best Practices for Users

While researchers focus on finding vulnerabilities, users should follow these best practices:

### For End Users

✅ **Wallet Security**
- Use hardware wallets (Ledger, Trezor) for high-value accounts
- Never share your seed phrase
- Verify all transaction details before signing

✅ **Password Manager Security**
- Use strong, unique master passwords (16+ characters)
- Enable session timeouts
- Regularly review stored credentials
- Back up your wallet seed phrase securely

✅ **Devnet Testing**
- **DO NOT** store production credentials on devnet
- Use test accounts only
- Understand devnet is for testing, not production use

### For Developers

✅ **Integration Security**
- Review our SDK documentation thoroughly
- Validate all inputs before encryption
- Handle errors gracefully
- Keep dependencies updated

✅ **Audit Your Integration**
- Test with devnet extensively
- Review cryptographic implementations
- Follow our security guidelines
- Report issues you discover

---

## Our Security Practices

### Current Security Measures

✅ **Cryptographic Standards**
- XChaCha20-Poly1305 AEAD encryption
- HKDF-SHA256 key derivation
- 192-bit nonces (collision-resistant)
- 100,000 PBKDF2 iterations (OWASP 2023)

✅ **Development Practices**
- Security-first design approach
- Code review for all changes
- Static analysis (Clippy, ESLint)
- Dependency scanning (Dependabot)

✅ **Testing**
- Comprehensive unit tests (85%+ coverage)
- Integration tests on devnet
- E2E testing (Playwright)
- Security-focused test cases

### Planned Security Measures

⏳ **Before Mainnet**
- Third-party security audit (professional firm)
- Formal verification of critical functions
- Penetration testing
- Bug bounty program launch

⏳ **Post-Mainnet**
- Continuous security monitoring
- Regular security audits (annual)
- Incident response procedures
- Security awareness training

---

## Vulnerability Disclosure History

We maintain transparency about security issues:

| ID | Date | Severity | Status | Credit |
|----|------|----------|--------|--------|
| *No vulnerabilities disclosed yet* | - | - | - | - |

**Public Advisories**: [GitHub Security Advisories](https://github.com/hackingbutlegal/solana-lockbox/security/advisories)

**Internal Audits**: See `docs/security/` for internal security reviews

---

## Frequently Asked Questions

### Q: How quickly will critical vulnerabilities be fixed?

**A**: Critical vulnerabilities affecting user funds or private keys will be our highest priority. We aim to:
- Develop a fix within 48-72 hours
- Deploy to devnet within 1 week
- Coordinate disclosure within 2 weeks

### Q: Will you credit me for my discovery?

**A**: Yes! With your permission, we'll credit you in:
- Security advisories
- Release notes
- Hall of Fame
- Social media announcements

You can choose to remain anonymous if preferred.

### Q: What if you disagree with my severity assessment?

**A**: We'll explain our reasoning and provide:
- Our severity classification
- Rationale for the assessment
- References to our severity criteria

You're welcome to appeal with additional information demonstrating higher impact.

### Q: Can I publicly disclose after 90 days?

**A**: Yes, following our 90-day disclosure policy:
- After 90 days, you may disclose even if not fully resolved
- We prefer coordination on timing
- We'll publish our advisory simultaneously

### Q: Do you offer rewards for vulnerabilities?

**A**: Not currently, as we're pre-production. However:
- Bug bounty program planned post-mainnet (Q2 2026)
- Early reporters will receive priority recognition
- Significant findings may receive special acknowledgment

### Q: What if the vulnerability is in a dependency?

**A**: If the issue is in:
- **Our code**: Report to us
- **Solana**: Report to [Solana's security team](https://github.com/solana-labs/solana/security/policy)
- **Wallet adapters**: Report to the respective wallet team
- **Third-party library**: Report to the library maintainers and inform us

---

## Contact Us

**Security Team**: security@web3stud.io
**General Support**: support@web3stud.io
**GitHub**: https://github.com/hackingbutlegal/solana-lockbox
**Documentation**: https://github.com/hackingbutlegal/solana-lockbox/tree/main/docs/security

---

## Updates to This Policy

This security policy may be updated as the project evolves. Major changes will be:
- Announced via GitHub releases
- Posted in our Discord/social media
- Included in release notes

**Last Updated**: December 30, 2024
**Version**: 1.0
**Next Review**: March 2025 (pre-mainnet audit)

---

**Thank you for helping keep Solana Lockbox secure!** 🔒

We appreciate the security research community's contributions to making decentralized password management safer for everyone.
